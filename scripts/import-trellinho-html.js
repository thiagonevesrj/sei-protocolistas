/* eslint-env node */
'use strict'

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const defaultCatalogPath = path.join(root, 'data', 'catalogo-scripts.json')
const defaultProcessCatalogPath = path.join(root, 'data', 'catalogo-processos.json')
const defaultCuratedResponsesPath = path.join(root, 'data', 'respostas-curadas.json')
const defaultRulesPath = path.join(root, 'data', 'trellinho-import-rules.json')
const defaultReportPath = path.join(root, 'data', 'relatorio-importacao-trellinho.json')

const phaseDefinitions = {
  'FASE 01 - Identificação': { id: 'identificacao', label: 'Identificação', order: 1 },
  'FASE 02 - Orientação': { id: 'orientacao', label: 'Orientação', order: 2 },
  'FASE 03 - Protocolos': { id: 'protocolos', label: 'Protocolos', order: 3 },
  'Extras - Exigências / Agendamento / Críticas': { id: 'atendimento', label: 'Exigências e finalização', order: 4 }
}

function normalize (value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function compactBody (value) {
  return normalize(value).replace(/\s+/g, ' ')
}

function hash (value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex')
}

function shortHash (value) {
  return hash(value).slice(0, 12)
}

function stableKey (phase, group, title) {
  return `${phase}|${normalize(group)}|${normalize(title)}`
}

function deterministicId (key) {
  return `trellinho-${hash(key).slice(0, 24)}`
}

function extractJsonConstant (html, constantName, nextConstantName) {
  const startMarker = `const ${constantName} = `
  const endMarker = `const ${nextConstantName} = `
  const markerIndex = html.indexOf(startMarker)
  if (markerIndex < 0) throw new Error(`Trellinho sem a constante ${constantName}.`)

  const start = markerIndex + startMarker.length
  const end = html.indexOf(endMarker, start)
  if (end < 0) throw new Error(`Trellinho sem o delimitador ${nextConstantName}.`)

  const raw = html.slice(start, end).trim().replace(/;$/, '').trim()
  const payload = JSON.parse(raw)
  if (!Array.isArray(payload)) throw new Error(`${constantName} não contém uma lista.`)
  return payload
}

function parseTrellinhoHtml (html) {
  return extractJsonConstant(html, 'SCRIPTS', 'PDF_FORMS')
}

function parseTipologia (value) {
  const source = String(value || '').trim()
  if (!source) return { name: null, url: null }

  const markdown = source.match(/^\[([^\]]+)]\((https?:\/\/[^\s)]+)(?:\s+"[^"]*")?\)$/)
  if (!markdown) return { name: source, url: null }
  return { name: markdown[1].trim(), url: markdown[2] }
}

function normalizeIncomingScript (script, index) {
  const phase = phaseDefinitions[script.fase]
  const title = String(script.nome || '').trim()
  const group = String(script.lista || '').trim()
  const body = String(script.texto || '').trim()
  const tipologia = parseTipologia(script.tipologia_processual)

  return {
    index,
    originalPhase: String(script.fase || '').trim(),
    phase: phase?.id || '',
    phaseLabel: phase?.label || String(script.fase || '').trim(),
    phaseOrder: phase?.order || Number.MAX_SAFE_INTEGER,
    group,
    title,
    body,
    bodyHash: hash(compactBody(body)),
    destinationUnit: String(script.destino_processo || '').trim() || null,
    seiProcessType: tipologia.name,
    seiProcessTypeUrl: tipologia.url,
    routingValidation: null,
    presencialOnly: Boolean(script.presencial),
    noProcess: Boolean(script.nao_abre),
    stableKey: stableKey(phase?.id || '', group, title)
  }
}

function applyRoutingOverrides (incomingScripts, rules) {
  const overrides = rules.routingOverrides || {}

  return incomingScripts.map((script) => {
    const override = overrides[script.stableKey]
    if (!override) return script

    return {
      ...script,
      destinationUnit: String(override.destinationUnit || script.destinationUnit || '').trim() || null,
      seiProcessType: String(override.seiProcessType || script.seiProcessType || '').trim() || null,
      seiProcessTypeUrl: String(override.seiProcessTypeUrl || script.seiProcessTypeUrl || '').trim() || null,
      routingValidation: String(override.validation || '').trim() || null
    }
  })
}

function duplicateSignature (script) {
  return JSON.stringify({
    bodyHash: script.bodyHash,
    destinationUnit: script.destinationUnit,
    seiProcessType: script.seiProcessType,
    presencialOnly: script.presencialOnly,
    noProcess: script.noProcess
  })
}

function scriptSummary (script) {
  return {
    key: script.stableKey,
    phase: script.phase,
    group: script.group,
    title: script.title,
    bodyHash: script.bodyHash.slice(0, 12),
    destinationUnit: script.destinationUnit,
    seiProcessType: script.seiProcessType,
    presencialOnly: script.presencialOnly,
    noProcess: script.noProcess
  }
}

function resolveDuplicates (incomingScripts, rules) {
  const grouped = new Map()
  incomingScripts.forEach((script) => {
    const entries = grouped.get(script.stableKey) || []
    entries.push(script)
    grouped.set(script.stableKey, entries)
  })

  const scripts = []
  const collapsedDuplicates = []
  const conflictingDuplicates = []
  const choices = rules.duplicateChoices || {}

  grouped.forEach((entries, key) => {
    if (entries.length === 1) {
      scripts.push(entries[0])
      return
    }

    const signatures = new Set(entries.map(duplicateSignature))
    if (signatures.size === 1) {
      scripts.push(entries[0])
      collapsedDuplicates.push({
        key,
        count: entries.length,
        phase: entries[0].phase,
        group: entries[0].group,
        title: entries[0].title,
        bodyHash: entries[0].bodyHash.slice(0, 12)
      })
      return
    }

    const preferredHash = choices[key]?.bodyHash
    const selected = preferredHash
      ? entries.find((entry) => entry.bodyHash.startsWith(preferredHash))
      : null

    if (selected) scripts.push(selected)
    else {
      conflictingDuplicates.push({
        key,
        phase: entries[0].phase,
        group: entries[0].group,
        title: entries[0].title,
        candidates: entries.map(scriptSummary)
      })
    }
  })

  return { scripts, collapsedDuplicates, conflictingDuplicates, uniqueKeys: grouped.size }
}

function currentScriptKey (script) {
  return stableKey(script.phase, script.group, script.title)
}

function curatedBody (script) {
  return Array.isArray(script.bodyLines) ? script.bodyLines.join('\n') : String(script.body || '')
}

function createCatalogScript (incoming, current, inputName, matchType) {
  const currentSource = current?.source || {}
  const id = current?.id || deterministicId(incoming.stableKey)

  return {
    id,
    title: incoming.title,
    phase: incoming.phase,
    phaseLabel: incoming.phaseLabel,
    group: incoming.group,
    body: incoming.body,
    status: current?.status || 'trellinho-vigente',
    availability: {
      presencialOnly: incoming.presencialOnly,
      noProcess: incoming.noProcess,
      emailResponse: !incoming.noProcess
    },
    routing: {
      destinationUnit: incoming.destinationUnit,
      seiProcessType: incoming.seiProcessType,
      seiProcessTypeUrl: incoming.seiProcessTypeUrl,
      validation: incoming.routingValidation
    },
    source: {
      ...currentSource,
      cardId: currentSource.cardId || null,
      trellinhoKey: incoming.stableKey,
      originalPhase: incoming.originalPhase,
      bodySource: 'trellinho-html',
      importFile: inputName,
      legacyMatch: matchType
    }
  }
}

function compareRouting (processType, incoming) {
  if (!processType || !incoming.destinationUnit) return null
  if (normalize(processType.destinationUnit) === normalize(incoming.destinationUnit)) return null
  return {
    processId: processType.id,
    processName: processType.name,
    confirmedDestination: processType.destinationUnit,
    trellinhoDestination: incoming.destinationUnit,
    script: scriptSummary(incoming)
  }
}

function collectRequiredScriptIds (processCatalog) {
  const ids = new Set()
  ;(processCatalog.fastMailPriorityTopics || []).forEach((topic) => {
    if (topic.scriptId) ids.add(topic.scriptId)
    ;(topic.responseScriptIds || []).forEach((id) => ids.add(id))
    ;(topic.variants || []).forEach((variant) => {
      if (variant.scriptId) ids.add(variant.scriptId)
      ;(variant.responseScriptIds || []).forEach((id) => ids.add(id))
    })
  })
  return ids
}

function buildImport ({ incomingRaw, currentCatalog, processCatalog, curatedResponses, rules, inputName }) {
  const incoming = applyRoutingOverrides(incomingRaw.map(normalizeIncomingScript), rules)
  const unknownPhases = [...new Set(incoming.filter((script) => !script.phase).map((script) => script.originalPhase))]
  const duplicates = resolveDuplicates(incoming, rules)
  const currentByKey = new Map(currentCatalog.scripts.map((script) => [currentScriptKey(script), script]))
  const currentById = new Map(currentCatalog.scripts.map((script) => [script.id, script]))
  const curatedById = new Map((curatedResponses.scripts || []).map((script) => [script.id, script]))
  const processesByCardId = new Map(
    (processCatalog.processTypes || [])
      .filter((processType) => processType.source?.cardId)
      .map((processType) => [processType.source.cardId, processType])
  )
  const aliases = rules.aliases || {}
  const matchedCurrentIds = new Set()
  const importedScripts = []
  const added = []
  const changed = []
  const protectedCurations = []
  const destinationConflicts = []
  const bodyMatchSuggestions = []
  const currentByBodyHash = new Map(
    currentCatalog.scripts.map((script) => [hash(compactBody(script.body)), script])
  )

  duplicates.scripts.forEach((incomingScript) => {
    const direct = currentByKey.get(incomingScript.stableKey)
    const aliasId = aliases[incomingScript.stableKey]
    const aliased = aliasId ? currentById.get(aliasId) : null
    const current = direct || aliased || null
    const matchType = direct ? 'stable-key' : aliased ? 'explicit-alias' : 'new'
    const catalogScript = createCatalogScript(incomingScript, current, inputName, matchType)
    importedScripts.push(catalogScript)

    if (current) {
      matchedCurrentIds.add(current.id)
      const bodyChanged = hash(compactBody(current.body)) !== incomingScript.bodyHash
      const routingChanged = normalize(current.source?.destinationUnit) !== normalize(incomingScript.destinationUnit)
      if (bodyChanged || routingChanged) {
        changed.push({
          id: current.id,
          phase: incomingScript.phase,
          group: incomingScript.group,
          title: incomingScript.title,
          bodyChanged,
          previousBodyHash: shortHash(compactBody(current.body)),
          incomingBodyHash: incomingScript.bodyHash.slice(0, 12),
          previousDestination: current.source?.destinationUnit || null,
          incomingDestination: incomingScript.destinationUnit
        })
      }

      const curated = curatedById.get(current.id)
      if (curated && hash(compactBody(curatedBody(curated))) !== incomingScript.bodyHash) {
        protectedCurations.push({
          id: current.id,
          title: incomingScript.title,
          incomingBodyHash: incomingScript.bodyHash.slice(0, 12),
          curatedBodyHash: shortHash(compactBody(curatedBody(curated))),
          validation: curated.validation || 'curated'
        })
      }

      const processType = processesByCardId.get(current.source?.cardId)
      const routingConflict = compareRouting(processType, incomingScript)
      if (routingConflict) destinationConflicts.push(routingConflict)
    } else {
      added.push(scriptSummary(incomingScript))
      const sameBody = currentByBodyHash.get(incomingScript.bodyHash)
      if (sameBody) {
        bodyMatchSuggestions.push({
          incoming: scriptSummary(incomingScript),
          possibleExisting: {
            id: sameBody.id,
            phase: sameBody.phase,
            group: sameBody.group,
            title: sameBody.title
          }
        })
      }
    }
  })

  const missingFromSource = currentCatalog.scripts
    .filter((script) => !matchedCurrentIds.has(script.id))
    .map((script) => ({
      id: script.id,
      phase: script.phase,
      group: script.group,
      title: script.title
    }))

  const retainedMissingScripts = currentCatalog.scripts
    .filter((script) => !matchedCurrentIds.has(script.id))
    .map((script) => ({
      ...script,
      status: 'fonte-ausente-pendente-revisao',
      source: {
        ...script.source,
        missingFromTrellinho: true,
        lastImportFile: inputName
      }
    }))

  const scripts = [...importedScripts, ...retainedMissingScripts]
    .sort((a, b) => {
      const phaseA = Object.values(phaseDefinitions).find((phase) => phase.id === a.phase)?.order || 99
      const phaseB = Object.values(phaseDefinitions).find((phase) => phase.id === b.phase)?.order || 99
      return phaseA - phaseB || `${a.group} ${a.title}`.localeCompare(`${b.group} ${b.title}`, 'pt-BR')
    })

  const outputIds = new Set(scripts.map((script) => script.id))
  const duplicateOutputIds = scripts
    .map((script) => script.id)
    .filter((id, index, all) => all.indexOf(id) !== index)
  const requiredScriptIds = collectRequiredScriptIds(processCatalog)
  const missingRequiredScripts = [...requiredScriptIds].filter((id) => !outputIds.has(id))
  const curatedIds = (curatedResponses.scripts || []).map((script) => script.id)
  const missingCuratedScripts = curatedIds.filter((id) => !outputIds.has(id))
  const uniqueInputCount = duplicates.uniqueKeys
  const currentCount = currentCatalog.scripts.length
  const suspiciousVolume = uniqueInputCount < currentCount * 0.8 || uniqueInputCount > currentCount * 1.5

  const blockers = []
  if (unknownPhases.length) blockers.push(`${unknownPhases.length} fase(s) desconhecida(s)`)
  if (duplicates.conflictingDuplicates.length) blockers.push(`${duplicates.conflictingDuplicates.length} duplicidade(s) com conteúdo conflitante`)
  if (duplicateOutputIds.length) blockers.push(`${duplicateOutputIds.length} ID(s) duplicado(s) no catálogo proposto`)
  if (missingRequiredScripts.length) blockers.push(`${missingRequiredScripts.length} script(s) obrigatório(s) ausente(s)`)
  if (missingCuratedScripts.length) blockers.push(`${missingCuratedScripts.length} resposta(s) curada(s) ausente(s)`)
  if (suspiciousVolume) blockers.push('variação de volume fora da margem segura de 20% a 50%')

  const phases = Object.values(phaseDefinitions)
    .sort((a, b) => a.order - b.order)
    .map(({ id, label }) => ({ id, label }))
  const actionableScripts = scripts.filter((script) => script.body).length
  const emptyCards = scripts.filter((script) => !script.body).map((script) => script.source?.cardId || script.id)
  const catalog = {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    source: 'Trellinho HTML',
    sourceFile: inputName,
    originalActiveCards: incoming.length,
    retiredDuplicateCards: currentCatalog.retiredDuplicateCards || [],
    activeScripts: scripts.length,
    phases,
    sourceBoards: phases.map((phase) => ({
      name: phase.label,
      activeCards: scripts.filter((script) => script.phase === phase.id).length
    })),
    actionableScripts,
    emptyCards,
    integrity: {
      importedCards: incoming.length,
      uniqueSourceKeys: uniqueInputCount,
      collapsedDuplicates: duplicates.collapsedDuplicates.length,
      unresolvedConflicts: duplicates.conflictingDuplicates.length,
      retainedMissingScripts: retainedMissingScripts.length,
      protectedCurations: protectedCurations.length
    },
    scripts
  }

  const report = {
    schemaVersion: 1,
    generatedAt: catalog.generatedAt,
    sourceFile: inputName,
    safeToApply: blockers.length === 0,
    blockers,
    summary: {
      sourceCards: incoming.length,
      uniqueSourceKeys: uniqueInputCount,
      catalogBefore: currentCount,
      catalogProposed: scripts.length,
      matched: matchedCurrentIds.size,
      added: added.length,
      changed: changed.length,
      missingFromSource: missingFromSource.length,
      collapsedDuplicates: duplicates.collapsedDuplicates.length,
      conflictingDuplicates: duplicates.conflictingDuplicates.length,
      protectedCurations: protectedCurations.length,
      destinationConflicts: destinationConflicts.length,
      withDestination: incoming.filter((script) => script.destinationUnit).length,
      withSeiProcessType: incoming.filter((script) => script.seiProcessType).length,
      presencialOnly: incoming.filter((script) => script.presencialOnly).length,
      noProcess: incoming.filter((script) => script.noProcess).length
    },
    unknownPhases,
    collapsedDuplicates: duplicates.collapsedDuplicates,
    conflictingDuplicates: duplicates.conflictingDuplicates,
    added,
    changed,
    missingFromSource,
    protectedCurations,
    destinationConflicts,
    bodyMatchSuggestions,
    missingRequiredScripts,
    missingCuratedScripts
  }

  return { catalog, report }
}

function readJson (filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function writeJson (filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`)
}

function parseArguments (argv) {
  const options = {
    inputPath: '',
    apply: false,
    reportPath: defaultReportPath,
    catalogPath: defaultCatalogPath,
    rulesPath: defaultRulesPath
  }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--apply') options.apply = true
    else if (argument === '--report') options.reportPath = path.resolve(argv[++index])
    else if (argument === '--catalog') options.catalogPath = path.resolve(argv[++index])
    else if (argument === '--rules') options.rulesPath = path.resolve(argv[++index])
    else if (!options.inputPath) options.inputPath = path.resolve(argument)
    else throw new Error(`Argumento desconhecido: ${argument}`)
  }
  return options
}

function runCli () {
  const options = parseArguments(process.argv.slice(2))
  if (!options.inputPath) {
    throw new Error('Informe o arquivo HTML do Trellinho.')
  }

  const html = fs.readFileSync(options.inputPath, 'utf8')
  const incomingRaw = parseTrellinhoHtml(html)
  const currentCatalog = readJson(options.catalogPath)
  const processCatalog = readJson(defaultProcessCatalogPath, { processTypes: [], fastMailPriorityTopics: [] })
  const curatedResponses = readJson(defaultCuratedResponsesPath, { scripts: [] })
  const rules = readJson(options.rulesPath, { aliases: {}, duplicateChoices: {} })
  const result = buildImport({
    incomingRaw,
    currentCatalog,
    processCatalog,
    curatedResponses,
    rules,
    inputName: path.basename(options.inputPath)
  })

  writeJson(options.reportPath, result.report)
  console.log(`Relatório salvo em ${options.reportPath}`)
  console.log(`${result.report.summary.sourceCards} cartões; ${result.report.summary.catalogProposed} scripts propostos; ${result.report.blockers.length} bloqueio(s).`)

  if (!options.apply) return
  if (!result.report.safeToApply) {
    throw new Error(`Aplicação bloqueada: ${result.report.blockers.join('; ')}.`)
  }
  writeJson(options.catalogPath, result.catalog)
  console.log(`Catálogo atualizado com segurança em ${options.catalogPath}`)
}

if (require.main === module) {
  try {
    runCli()
  } catch (error) {
    console.error(error.message || error)
    process.exitCode = 1
  }
}

module.exports = {
  buildImport,
  extractJsonConstant,
  normalize,
  parseTrellinhoHtml,
  stableKey
}
