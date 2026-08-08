/* eslint-env node */
'use strict'

const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const errors = []
const allowedOrigins = [
  '*://sei.rj.gov.br/',
  'https://venus2.detran.rj.gov.br/'
]

function readJson (relativePath) {
  const fullPath = path.join(root, relativePath)
  try {
    return JSON.parse(fs.readFileSync(fullPath, 'utf8'))
  } catch (error) {
    errors.push(`${relativePath}: ${error.message}`)
    return null
  }
}

function expect (condition, message) {
  if (!condition) errors.push(message)
}

function expectFile (relativePath, source) {
  const fullPath = path.join(root, relativePath)
  expect(fs.existsSync(fullPath), `${source}: arquivo não encontrado: ${relativePath}`)
}

function isAllowedMatch (match) {
  return allowedOrigins.some((origin) => match.startsWith(origin))
}

function expectUniqueValues (values, source) {
  const seen = new Set()
  values.forEach((value) => {
    expect(!seen.has(value), `${source}: valor duplicado ${value}`)
    seen.add(value)
  })
}

const manifest = readJson('manifest.json')
const packageJson = readJson('package.json')
const catalog = readJson('data/catalogo-processos.json')
const responseModels = readJson('data/modelos-resposta.json')

if (manifest && packageJson) {
  expect(
    manifest.version === packageJson.version,
    `Versões diferentes: manifest=${manifest.version}, package=${packageJson.version}`
  )
  expect(/^\d+\.\d+\.\d+$/.test(manifest.version), 'Manifesto: versão deve usar o formato X.Y.Z')
  expect(manifest.manifest_version === 3, 'Manifesto: manifest_version deve ser 3')
  expect(!/[ÃÂ]/.test(manifest.description || ''), 'Manifesto: descrição contém texto corrompido')

  const expectedHostPermissions = [
    '*://sei.rj.gov.br/*',
    'https://venus2.detran.rj.gov.br/owa/*'
  ]
  const hostPermissions = manifest.host_permissions || []
  expect(
    expectedHostPermissions.length === hostPermissions.length &&
      expectedHostPermissions.every((permission) => hostPermissions.includes(permission)),
    `Manifesto: host_permissions deve conter somente ${expectedHostPermissions.join(' e ')}`
  )

  if (manifest.action?.default_popup) {
    expectFile(manifest.action.default_popup, 'manifest.action.default_popup')
  }
  if (manifest.action?.default_icon) {
    expectFile(manifest.action.default_icon, 'manifest.action.default_icon')
  }

  const contentScripts = manifest.content_scripts || []
  contentScripts.forEach((entry, entryIndex) => {
    const files = [...(entry.js || []), ...(entry.css || [])]
    const matches = entry.matches || []
    files.forEach((file) => expectFile(file, `manifest.content_scripts[${entryIndex}]`))
    matches.forEach((match) => {
      expect(
        isAllowedMatch(match),
        `manifest.content_scripts[${entryIndex}]: domínio não autorizado: ${match}`
      )
    })
  })

  const accessibleResources = manifest.web_accessible_resources || []
  accessibleResources.forEach((entry, entryIndex) => {
    const resources = entry.resources || []
    const matches = entry.matches || []
    resources.forEach((file) => expectFile(file, `manifest.web_accessible_resources[${entryIndex}]`))
    matches.forEach((match) => {
      expect(
        isAllowedMatch(match),
        `manifest.web_accessible_resources[${entryIndex}]: domínio não autorizado: ${match}`
      )
    })
  })
}

let processTypes = []
let processIds = new Set()

if (catalog) {
  expect(catalog.schemaVersion === 4, 'Catálogo: schemaVersion deve ser 4')
  expect(Array.isArray(catalog.processTypes), 'Catálogo: processTypes deve ser uma lista')

  processTypes = Array.isArray(catalog.processTypes) ? catalog.processTypes : []
  processIds = new Set(processTypes.map((processType) => processType.id))
  expectUniqueValues(processTypes.map((processType) => processType.id), 'Catálogo: processTypes')

  processTypes.forEach((processType, index) => {
    const prefix = `Catálogo: processTypes[${index}]`
    expect(Boolean(processType.id), `${prefix}: id obrigatório`)
    expect(Boolean(processType.name), `${prefix}: name obrigatório`)
    expect(Array.isArray(processType.seiNames) && processType.seiNames.length > 0, `${prefix}: seiNames obrigatório`)
    expect(Boolean(processType.destinationUnit), `${prefix}: destinationUnit obrigatório`)
    expect(Boolean(processType.quickTrigger), `${prefix}: quickTrigger obrigatório`)
    expect(typeof processType.priority === 'boolean', `${prefix}: priority deve ser booleano`)
    expect(Boolean(processType.responseModel), `${prefix}: responseModel obrigatório`)
    expect(Boolean(processType.documentsStatus), `${prefix}: documentsStatus obrigatório`)
    expect(Boolean(processType.category), `${prefix}: category obrigatório`)

    const documents = processType.missingDocuments || []
    expect(Array.isArray(documents), `${prefix}: missingDocuments deve ser uma lista`)
    expectUniqueValues(documents.map((document) => document.id), `${prefix}: missingDocuments`)
    documents.forEach((document, documentIndex) => {
      const documentPrefix = `${prefix}.missingDocuments[${documentIndex}]`
      expect(Boolean(document.id), `${documentPrefix}: id obrigatório`)
      expect(Boolean(document.label), `${documentPrefix}: label obrigatório`)
      expect(Boolean(document.text), `${documentPrefix}: text obrigatório`)
    })
  })

  const daf = processTypes.find((item) => item.id === 'devolucao-taxas')
  expect(Boolean(daf), 'Catálogo: devolucao-taxas obrigatório')
  if (daf) {
    expect(daf.destinationUnit === 'DIVAF', 'Catálogo DAF: unidade deve ser DIVAF')
    expect(daf.quickTrigger === 'TAXAS', 'Catálogo DAF: gatilho deve ser TAXAS')
    expect(daf.responseModel === 'daf', 'Catálogo DAF: modelo deve ser daf')
    expect(daf.category === 'taxas', 'Catálogo DAF: categoria deve ser taxas')
    expect(
      daf.documentsStatus === 'validated-in-fast-mail',
      'Catálogo DAF: documentos devem estar validados no FAST MAIL'
    )
    expect(daf.missingDocuments?.length > 0, 'Catálogo DAF: pendências obrigatórias')
  }

  const areas = catalog.fastMailNavigation?.areas
  expect(Array.isArray(areas) && areas.length > 0, 'FAST MAIL: áreas de navegação obrigatórias')
  if (Array.isArray(areas)) {
    expectUniqueValues(areas.map((area) => area.id), 'FAST MAIL: áreas')
    areas.forEach((area, areaIndex) => {
      const prefix = `FAST MAIL: areas[${areaIndex}]`
      expect(Boolean(area.id), `${prefix}: id obrigatório`)
      expect(Boolean(area.label), `${prefix}: label obrigatório`)

      const references = [
        ...(area.processId ? [area.processId] : []),
        ...(area.processIds || []),
        ...(area.objectives || []).map((objective) => objective.processId)
      ]
      references.forEach((processId) => {
        expect(processIds.has(processId), `${prefix}: processo inexistente ${processId}`)
      })
    })
  }
}

if (responseModels) {
  expect(responseModels.schemaVersion === 1, 'Modelos: schemaVersion deve ser 1')
  expect(Array.isArray(responseModels.models), 'Modelos: models deve ser uma lista')

  const models = Array.isArray(responseModels.models) ? responseModels.models : []
  const modelIds = new Set(models.map((model) => model.id))
  expectUniqueValues(models.map((model) => model.id), 'Modelos')
  models.forEach((model, index) => {
    const prefix = `Modelos: models[${index}]`
    expect(Boolean(model.id), `${prefix}: id obrigatório`)
    expect(Boolean(model.name), `${prefix}: name obrigatório`)
    expect(typeof model.body === 'string' && model.body.length > 0, `${prefix}: body obrigatório`)
    expect(model.body?.includes('{{numeroProcesso}}'), `${prefix}: marcador {{numeroProcesso}} obrigatório`)
  })

  processTypes.forEach((processType) => {
    expect(modelIds.has(processType.responseModel), `Catálogo: modelo inexistente ${processType.responseModel}`)
  })
}

[
  'browser_action/index.html',
  'browser_action/main.js',
  'browser_action/style.css',
  'central_protocolista/index.html',
  'central_protocolista/main.js',
  'central_protocolista/styles.css',
  'cs_modules/clique_protocolista/index.js',
  'cs_modules/fast_mail/index.js',
  'cs_modules/fast_mail/styles.css',
  'docs/CHECKLIST-REGRESSAO.md',
  'docs/PLANO-MESTRE.md',
  'docs/REGRAS-FUNCIONAIS.md'
].forEach((file) => expectFile(file, 'Linha de base funcional'))

if (errors.length) {
  console.error('Validação falhou:')
  errors.forEach((error) => console.error(`- ${error}`))
  process.exitCode = 1
} else {
  console.log('SEI Protocolistas validado com sucesso.')
}
