/* eslint-env node */
'use strict'

const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const errors = []

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

const manifest = readJson('manifest.json')
const packageJson = readJson('package.json')
const catalog = readJson('data/catalogo-processos.json')
const responseModels = readJson('data/modelos-resposta.json')

if (manifest && packageJson) {
  expect(
    manifest.version === packageJson.version,
    `Versões diferentes: manifest=${manifest.version}, package=${packageJson.version}`
  )
  expect(
    manifest.host_permissions?.length === 1 &&
      manifest.host_permissions[0] === '*://sei.rj.gov.br/*',
    'Manifesto: host_permissions deve ficar restrito ao domínio sei.rj.gov.br'
  )

  if (manifest.action?.default_popup) {
    expectFile(manifest.action.default_popup, 'manifest.action.default_popup')
  }

  const contentScripts = manifest.content_scripts || []
  contentScripts.forEach((entry, entryIndex) => {
    const files = [...(entry.js || []), ...(entry.css || [])]
    const matches = entry.matches || []
    files.forEach((file) => {
      expectFile(file, `manifest.content_scripts[${entryIndex}]`)
    })
    matches.forEach((match) => {
      expect(
        match.startsWith('*://sei.rj.gov.br/'),
        `manifest.content_scripts[${entryIndex}]: domínio não autorizado: ${match}`
      )
    })
  })

  const accessibleResources = manifest.web_accessible_resources || []
  accessibleResources.forEach((entry, entryIndex) => {
    const resources = entry.resources || []
    const matches = entry.matches || []
    resources.forEach((file) => {
      expectFile(file, `manifest.web_accessible_resources[${entryIndex}]`)
    })
    matches.forEach((match) => {
      expect(
        match.startsWith('*://sei.rj.gov.br/'),
        `manifest.web_accessible_resources[${entryIndex}]: domínio não autorizado: ${match}`
      )
    })
  })
}

if (catalog) {
  expect(catalog.schemaVersion === 1, 'Catálogo: schemaVersion deve ser 1')
  expect(Array.isArray(catalog.processTypes), 'Catálogo: processTypes deve ser uma lista')

  const processTypes = Array.isArray(catalog.processTypes) ? catalog.processTypes : []
  const ids = new Set()
  processTypes.forEach((processType, index) => {
    const prefix = `Catálogo: processTypes[${index}]`
    expect(Boolean(processType.id), `${prefix}: id obrigatório`)
    expect(Boolean(processType.name), `${prefix}: name obrigatório`)
    expect(Array.isArray(processType.seiNames), `${prefix}: seiNames deve ser uma lista`)
    expect(Boolean(processType.responseModel), `${prefix}: responseModel obrigatório`)
    expect(Boolean(processType.catalogStatus), `${prefix}: catalogStatus obrigatório`)
    expect(!ids.has(processType.id), `${prefix}: id duplicado ${processType.id}`)
    ids.add(processType.id)
  })

  const daf = processTypes.find((item) => item.id === 'devolucao-taxas')
  expect(Boolean(daf), 'Catálogo: piloto devolucao-taxas obrigatório')
  if (daf) {
    expect(daf.destinationUnit === 'DIVAF', 'Catálogo DAF: unidade deve ser DIVAF')
    expect(daf.subjectAcronym === 'DAF', 'Catálogo DAF: sigla deve ser DAF')
    expect(daf.catalogStatus === 'pilot', 'Catálogo DAF: status deve ser pilot')
  }
}

if (responseModels) {
  expect(responseModels.schemaVersion === 1, 'Modelos: schemaVersion deve ser 1')
  expect(Array.isArray(responseModels.models), 'Modelos: models deve ser uma lista')

  const models = Array.isArray(responseModels.models) ? responseModels.models : []
  const modelIds = new Set()
  models.forEach((model, index) => {
    const prefix = `Modelos: models[${index}]`
    expect(Boolean(model.id), `${prefix}: id obrigatório`)
    expect(Boolean(model.name), `${prefix}: name obrigatório`)
    expect(typeof model.body === 'string' && model.body.length > 0, `${prefix}: body obrigatório`)
    expect(
      model.body?.includes('{{numeroProcesso}}'),
      `${prefix}: marcador {{numeroProcesso}} obrigatório`
    )
    expect(!modelIds.has(model.id), `${prefix}: id duplicado ${model.id}`)
    modelIds.add(model.id)
  })

  if (catalog?.processTypes) {
    catalog.processTypes.forEach((processType) => {
      expect(
        modelIds.has(processType.responseModel),
        `Catálogo: modelo inexistente ${processType.responseModel}`
      )
    })
  }
}

expectFile('central_protocolista/index.html', 'Central Protocolista')
expectFile('central_protocolista/styles.css', 'Central Protocolista')
expectFile('central_protocolista/main.js', 'Central Protocolista')
expectFile('docs/CHECKLIST-REGRESSAO.md', 'Regressão')

if (errors.length) {
  console.error('Validação falhou:')
  errors.forEach((error) => console.error(`- ${error}`))
  process.exitCode = 1
} else {
  console.log('SEI Protocolistas validado com sucesso.')
}
