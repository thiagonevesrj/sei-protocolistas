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

function readText (relativePath) {
  const fullPath = path.join(root, relativePath)
  try {
    return fs.readFileSync(fullPath, 'utf8')
  } catch (error) {
    errors.push(`${relativePath}: ${error.message}`)
    return ''
  }
}

function expect (condition, message) {
  if (!condition) errors.push(message)
}

function expectFile (relativePath, source) {
  const fullPath = path.join(root, relativePath)
  expect(fs.existsSync(fullPath), `${source}: arquivo não encontrado: ${relativePath}`)
}

function expectIconFiles (icons, source) {
  if (typeof icons === 'string') {
    expectFile(icons, source)
    return
  }

  expect(icons && typeof icons === 'object', `${source}: configuração de ícones inválida`)
  if (!icons || typeof icons !== 'object') return

  Object.entries(icons).forEach(([size, iconPath]) => {
    expectFile(iconPath, `${source}[${size}]`)
  })
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
const scriptCatalog = readJson('data/catalogo-scripts.json')
const curatedResponses = readJson('data/respostas-curadas.json')
const responseModels = readJson('data/modelos-resposta.json')
const fastMailSource = readText('cs_modules/fast_mail/index.js')
const fastProcSource = readText('cs_modules/clique_protocolista/index.js')
const seiLoginSource = readText('cs_modules/core/login/index.js')
const handoffSource = readText('cs_modules/fast_proc_handoff/index.js')
const returnCoordinatorSource = readText('background/service-worker.js')
const protocolSource = readText('cs_modules/protocolo_cliente/index.js')
const centralSource = readText('central_protocolista/main.js')
const centralHtml = readText('central_protocolista/index.html')
const scriptCatalogBuilderSource = readText('scripts/build-script-catalog.js')

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
    'https://venus2.detran.rj.gov.br/owa/*',
    'https://formsubmit.co/*'
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
    expectIconFiles(manifest.action.default_icon, 'manifest.action.default_icon')
  }
  if (manifest.icons) {
    expectIconFiles(manifest.icons, 'manifest.icons')
  }
  expect(
    manifest.background?.service_worker === 'background/service-worker.js',
    'Manifesto: coordenador de retorno ao Webmail obrigatório'
  )
  if (manifest.background?.service_worker) {
    expectFile(manifest.background.service_worker, 'manifest.background.service_worker')
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

  const handoffEntry = contentScripts.find((entry) =>
    (entry.js || []).includes('cs_modules/fast_proc_handoff/index.js')
  )
  expect(Boolean(handoffEntry), 'Manifesto: orquestrador FAST MAIL → FAST PROC obrigatório')
  expect(handoffEntry?.all_frames === false, 'Manifesto: orquestrador deve executar apenas no frame principal')
}

expect(centralHtml.includes('FINALIZAR EXPEDIENTE') === false, 'Central: o botão deve alternar o texto pelo estado salvo')
expect(centralHtml.includes('EXPORTAR MEU RELATÓRIO EM CSV'), 'Central: exportação individual do relatório não encontrada')
expect(centralHtml.includes('Sugestões e bugs'), 'Central: canal de sugestões e bugs não encontrado')
expect(centralSource.includes("const METRICS_KEY = 'centralProtocolistaMetricsByOperator'"), 'Central: métricas não estão separadas por protocolista')
expect(centralSource.includes("button.textContent = 'FINALIZAR EXPEDIENTE'"), 'Central: finalização do expediente não encontrada')
expect(centralSource.includes('state.report.dayKey !== localDayKey()'), 'Central: limpeza do relatório no dia seguinte não encontrada')
expect(!centralHtml.includes('thiagonevesrj@gmail.com'), 'Central: e-mail particular não pode aparecer na interface')
expect(!centralSource.includes('thiagonevesrj@gmail.com'), 'Central: e-mail particular deve permanecer ofuscado no código da interface')
expect(fastMailSource.includes("recordWorkdayMetric('emails')"), 'FAST MAIL: contagem de e-mails do expediente não encontrada')
expect(fastMailSource.includes("recordWorkdayMetric('requirements')"), 'FAST MAIL: contagem de exigências do expediente não encontrada')
expect(protocolSource.includes('recordProcessMetric'), 'Protocolo: contagem de processos do expediente não encontrada')

;[
  'name',
  'cpf',
  'procedureId',
  'seiProcessName',
  'destination',
  'areaId',
  'objectiveId',
  'operator'
].forEach((field) => {
  expect(fastMailSource.includes(`${field},`) || fastMailSource.includes(`${field}:`), `FAST MAIL: handoff sem ${field}`)
})
expect(fastMailSource.includes('window.open(\'about:blank\''), 'FAST MAIL: deve abrir o SEI a partir do clique do operador')
expect(fastMailSource.includes('autoLoginWebmail'), 'Webmail: retomada automática de login obrigatória')
expect(fastMailSource.includes('spfm-priority-areas'), 'FAST MAIL: áreas prioritárias devem aparecer na tela inicial')
expect(fastMailSource.includes('spfm-priority-topic'), 'FAST MAIL: seletor de assunto prioritário obrigatório')
expect(fastMailSource.includes('openPriorityResponses'), 'FAST MAIL: caminho de resposta por assunto obrigatório')
expect(fastMailSource.includes('openPriorityMissingDocuments'), 'FAST MAIL: pendência documental deve ser uma ação vinculada ao assunto')
expect(fastMailSource.includes('openPriorityProcess'), 'FAST MAIL: caminho de abertura no FAST PROC obrigatório')
expect(fastMailSource.includes('CURATED_RESPONSES_PATH'), 'FAST MAIL: respostas curadas devem prevalecer sobre exportações antigas')
expect(fastMailSource.includes('PREPARAR E-MAIL'), 'FAST MAIL: botão PREPARAR E-MAIL obrigatório no fluxo de resposta')
expect(fastMailSource.includes('spfm-email-preparation'), 'FAST MAIL: área de preparação do e-mail obrigatória')
expect(
  fastMailSource.includes("phase.value = mappedScript?.phase || ''"),
  'FAST MAIL: assunto prioritário deve abrir na fase da resposta principal'
)
expect(
  fastMailSource.includes('Atenciosamente,<br><br>Serviço de Protocolo<br>DETRAN-RJ'),
  'FAST MAIL: respostas devem usar a assinatura institucional'
)
expect(!fastMailSource.includes('background:#fff1f1'), 'FAST MAIL: alerta de reenvio não deve usar caixa vermelha')
expect(
  fastMailSource.includes("replace(/[\\u200B-\\u200D\\uFEFF]/g, '')"),
  'FAST MAIL: respostas do Trello devem remover caracteres invisíveis'
)
expect(
  fastMailSource.includes("replace(/\\n{3,}/g, '\\n\\n')"),
  'FAST MAIL: respostas do Trello devem reduzir excesso de linhas vazias'
)
expect(fastProcSource.includes("source: 'fast-mail'"), 'FAST PROC: origem do FAST MAIL obrigatória')
expect(fastProcSource.includes('sp-clique-prefill-missing'), 'FAST PROC: campos ausentes devem ser destacados')
expect(seiLoginSource.includes('centralProtocolistaSeiCredentials'), 'SEI: credenciais da Central não são reaproveitadas')
expect(handoffSource.includes('procedimento_escolher_tipo'), 'SEI: navegação até Iniciar Processo obrigatória')
expect(returnCoordinatorSource.includes('fastMailAttendanceRoutes'), 'Retorno: mapa de abas por atendimento obrigatório')
expect(returnCoordinatorSource.includes("api.tabs, 'update'"), 'Retorno: aba original deve receber foco')
expect(protocolSource.includes('sei-protocolistas:return-fast-mail'), 'PROTOCOLO CLIENTE: comando de retorno obrigatório')
expect(scriptCatalogBuilderSource.includes('txt-attachment'), 'Importador Trello: scripts em anexos .txt devem prevalecer sobre a descrição')
expect(scriptCatalogBuilderSource.includes('destino[\\s_]+do[\\s_]+processo'), 'Importador Trello: DESTINO DO PROCESSO.txt não pode virar resposta')
expect(scriptCatalogBuilderSource.includes('attachedDestination'), 'Importador Trello: destino anexado deve alimentar o catálogo de processos')
expect(scriptCatalogBuilderSource.includes('syncProcessDestinations'), 'Importador Trello: destino deve ficar salvo por procedimento')

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

  const transfer = processTypes.find((item) => item.id === 'transferencia-prontuario-habilitacao')
  expect(Boolean(transfer), 'Catálogo: transferência de prontuário obrigatória')
  if (transfer) {
    expect(
      transfer.seiNames?.includes('Detran: Solicitação Geral - Habilitação'),
      'Transferência: deve usar Solicitação Geral - Habilitação'
    )
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

  const priorityTopics = catalog.fastMailPriorityTopics
  expect(Array.isArray(priorityTopics) && priorityTopics.length === 16, 'FAST MAIL: 16 assuntos principais obrigatórios')
  if (Array.isArray(priorityTopics)) {
    expectUniqueValues(priorityTopics.map((topic) => topic.id), 'FAST MAIL: assuntos prioritários')
    const priorityAreaIds = new Set((areas || []).map((area) => area.id))
    priorityTopics.forEach((topic, topicIndex) => {
      const prefix = `FAST MAIL: fastMailPriorityTopics[${topicIndex}]`
      const routes = Array.isArray(topic.variants) && topic.variants.length ? topic.variants : [topic]
      expect(Boolean(topic.id), `${prefix}: id obrigatório`)
      expect(Boolean(topic.label), `${prefix}: label obrigatório`)
      expect(priorityAreaIds.has(topic.area), `${prefix}: área inexistente ${topic.area}`)
      expect(Number.isInteger(topic.recentUsageCount), `${prefix}: frequência recente obrigatória`)
      expect(typeof topic.canOpenProcess === 'boolean', `${prefix}: canOpenProcess deve ser booleano`)
      if (topic.canOpenProcess) {
        expect(processIds.has(topic.processId), `${prefix}: processo inexistente ${topic.processId}`)
      } else {
        expect(Boolean(topic.blockedReason), `${prefix}: motivo do atendimento somente presencial obrigatório`)
      }
      routes.forEach((route, routeIndex) => {
        const routePrefix = `${prefix}.routes[${routeIndex}]`
        expect(Boolean(route.scriptId), `${routePrefix}: scriptId obrigatório`)
        expect(
          Array.isArray(route.responseScriptIds) && route.responseScriptIds.includes(route.scriptId),
          `${routePrefix}: responseScriptIds deve incluir o script principal`
        )
        expect(
          scriptCatalog?.scripts?.some((script) => script.id === route.scriptId && script.body),
          `${routePrefix}: script inexistente ou vazio ${route.scriptId}`
        )
        ;(route.responseScriptIds || []).forEach((scriptId) => {
          expect(
            scriptCatalog?.scripts?.some((script) => script.id === scriptId && script.body),
            `${routePrefix}: resposta relacionada inexistente ou vazia ${scriptId}`
          )
        })
      })
    })

    const expectedOpenProcesses = {
      'devolucao-taxas': 'devolucao-taxas',
      'desistencia-categoria': 'desistencia-categoria-primeira-habilitacao',
      'pericia-medica-pcd': 'solicitacao-pericia-medica',
      'troca-clinica': 'troca-retirada-clinica',
      'rebaixamento-categoria': 'rebaixamento-categoria-cnh',
      'retorno-categoria': 'retorno-categoria-cnh-rebaixada',
      'transferencia-prontuario': 'transferencia-prontuario-habilitacao',
      'generico-habilitacao': 'solicitacao-geral-habilitacao',
      'generico-veiculos': 'solicitacoes-gerais-veiculos',
      'cnh-estrangeira': 'averbacao-cnh-estrangeira',
      oficios: 'oficio-mero-expediente'
    }
    Object.entries(expectedOpenProcesses).forEach(([topicId, processId]) => {
      const topic = priorityTopics.find((item) => item.id === topicId)
      const processType = processTypes.find((item) => item.id === processId)
      expect(topic?.canOpenProcess === true, `FAST MAIL: ${topicId} deve permitir FAST PROC`)
      expect(topic?.processId === processId, `FAST MAIL: ${topicId} deve usar ${processId}`)
      expect(processType?.missingDocuments?.length > 0, `FAST MAIL: ${topicId} deve ter checklist`)
    })

    ;['cancelamento-comunicacao-venda', 'comunicacao-venda', 'intencao-venda', 'motor', 'chassi'].forEach((topicId) => {
      const topic = priorityTopics.find((item) => item.id === topicId)
      expect(topic?.canOpenProcess === false, `FAST MAIL: ${topicId} deve ser somente orientação`)
      expect(!topic?.processId, `FAST MAIL: ${topicId} não pode apontar para o FAST PROC`)
    })

    const expectedPriorityAreas = {
      'devolucao-taxas': 'taxas',
      'desistencia-categoria': 'habilitacao',
      'pericia-medica-pcd': 'habilitacao',
      'troca-clinica': 'habilitacao',
      'rebaixamento-categoria': 'habilitacao',
      'retorno-categoria': 'habilitacao',
      'transferencia-prontuario': 'habilitacao',
      'generico-habilitacao': 'habilitacao',
      'cnh-estrangeira': 'habilitacao',
      'cancelamento-comunicacao-venda': 'veiculos',
      'comunicacao-venda': 'veiculos',
      'intencao-venda': 'veiculos',
      motor: 'veiculos',
      chassi: 'veiculos',
      'generico-veiculos': 'veiculos',
      oficios: 'oficios'
    }
    Object.entries(expectedPriorityAreas).forEach(([topicId, areaId]) => {
      const topic = priorityTopics.find((item) => item.id === topicId)
      expect(topic?.area === areaId, `FAST MAIL: ${topicId} deve aparecer somente em ${areaId}`)
    })

    const expectedCorePriority = [
      'devolucao-taxas',
      'desistencia-categoria',
      'pericia-medica-pcd',
      'transferencia-prontuario',
      'cancelamento-comunicacao-venda',
      'comunicacao-venda',
      'intencao-venda'
    ]
    expectedCorePriority.forEach((topicId, index) => {
      const topic = priorityTopics.find((item) => item.id === topicId)
      expect(topic?.corePriority === true, `FAST MAIL: ${topicId} deve ser prioridade central`)
      expect(topic?.corePriorityRank === index + 1, `FAST MAIL: ordem central incorreta para ${topicId}`)
    })

    const genericTopics = {
      'generico-habilitacao': 'trello-64e2a0fc88d682bd3ad5edb5',
      'generico-veiculos': 'trello-64dfa7d9de9f8501856b0f8c'
    }
    Object.entries(genericTopics).forEach(([topicId, scriptId]) => {
      const topic = priorityTopics.find((item) => item.id === topicId)
      const script = scriptCatalog?.scripts?.find((item) => item.id === scriptId)
      const processType = processTypes.find((item) => item.id === topic?.processId)
      const documentIds = new Set((processType?.missingDocuments || []).map((item) => item.id))
      expect(topic?.scriptId === scriptId, `FAST MAIL: ${topicId} deve usar o script genérico do Trello`)
      expect(documentIds.has('general-request'), `FAST MAIL: ${topicId} deve oferecer Requerimento Geral`)
      expect(documentIds.has('residence'), `FAST MAIL: ${topicId} deve oferecer Declaração de Residência`)
      expect(script?.body?.includes('DETRAN_0049_requerimento_geral.pdf'), `FAST MAIL: ${topicId} deve incluir link do Requerimento Geral`)
      expect(script?.body?.includes('DETRAN0034_declararesid.pdf'), `FAST MAIL: ${topicId} deve incluir link da Declaração de Residência`)
    })
  }

  const formPolicy = catalog.formPolicy
  expect(formPolicy?.default === 'Requerimento Geral', 'Catálogo: Requerimento Geral deve ser o padrão')
  expect(Object.keys(formPolicy?.specificForms || {}).length === 6, 'Catálogo: seis requerimentos específicos confirmados obrigatórios')
  Object.keys(formPolicy?.specificForms || {}).forEach((processId) => {
    expect(processIds.has(processId), `Catálogo: formulário específico aponta para processo inexistente ${processId}`)
  })

  const clinic = processTypes.find((item) => item.id === 'troca-retirada-clinica')
  const clinicDocumentIds = (clinic?.missingDocuments || []).map((document) => document.id)
  expect(clinic?.documentsStatus === 'operator-confirmed-2026-08-10', 'Troca de clínica: fonte real deve estar confirmada')
  expect(clinicDocumentIds.join(',') === 'general-request,identification,cpf,residence,renach,workplace-declaration', 'Troca de clínica: checklist deve seguir o script real')
  expect(clinic?.destinationUnit === 'SERVMT', 'Troca de clínica: destino deve ser SERVMT conforme Trello e SEI')
  expect(!JSON.stringify(clinic).includes('HAB0135'), 'Troca de clínica: link inexistente da declaração de trabalho deve ser removido')
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

if (scriptCatalog) {
  expect(scriptCatalog.schemaVersion === 1, 'Catálogo de scripts: schemaVersion deve ser 1')
  expect(scriptCatalog.originalActiveCards === 181, 'Catálogo de scripts: origem deve conter 181 cartões ativos')
  expect(scriptCatalog.activeScripts === 176, 'Catálogo de scripts: deve conter 176 scripts vigentes')
  expect(scriptCatalog.actionableScripts === 175, 'Catálogo de scripts: deve conter 175 respostas com conteúdo')
  expect(
    Array.isArray(scriptCatalog.emptyCards) && scriptCatalog.emptyCards.length === 1,
    'Catálogo de scripts: deve registrar o cartão ativo sem conteúdo'
  )
  expect(
    Array.isArray(scriptCatalog.retiredDuplicateCards) && scriptCatalog.retiredDuplicateCards.length === 5,
    'Catálogo de scripts: deve aposentar as 5 versões antigas confirmadas'
  )
  expect(Array.isArray(scriptCatalog.scripts), 'Catálogo de scripts: scripts deve ser uma lista')

  const scripts = Array.isArray(scriptCatalog.scripts) ? scriptCatalog.scripts : []
  expect(scripts.length === 176, 'Catálogo de scripts: quantidade operacional incorreta')
  expectUniqueValues(scripts.map((script) => script.id), 'Catálogo de scripts')
  scripts.forEach((script, index) => {
    const prefix = `Catálogo de scripts: scripts[${index}]`
    expect(Boolean(script.id), `${prefix}: id obrigatório`)
    expect(Boolean(script.title), `${prefix}: title obrigatório`)
    expect(Boolean(script.phase), `${prefix}: phase obrigatória`)
    expect(Boolean(script.group), `${prefix}: group obrigatório`)
    expect(typeof script.body === 'string', `${prefix}: body deve ser texto`)
    expect(Boolean(script.source?.cardId), `${prefix}: origem do Trello obrigatória`)
  })
}

if (curatedResponses && scriptCatalog) {
  expect(curatedResponses.schemaVersion === 1, 'Respostas curadas: schemaVersion deve ser 1')
  expect(Array.isArray(curatedResponses.scripts), 'Respostas curadas: scripts deve ser uma lista')
  const curatedScripts = Array.isArray(curatedResponses.scripts) ? curatedResponses.scripts : []
  expectUniqueValues(curatedScripts.map((script) => script.id), 'Respostas curadas')
  curatedScripts.forEach((script, index) => {
    const prefix = `Respostas curadas: scripts[${index}]`
    expect(scriptCatalog.scripts.some((catalogScript) => catalogScript.id === script.id), `${prefix}: script original inexistente`)
    expect(Boolean(script.title), `${prefix}: title obrigatório`)
    expect(Boolean(script.validation), `${prefix}: validation obrigatória`)
    expect(Array.isArray(script.bodyLines) && script.bodyLines.join('\n').trim().length > 0, `${prefix}: bodyLines obrigatório`)
  })

  const clinicResponse = curatedScripts.find((script) => script.id === 'trello-64fe3bd5d6087d02fc82d184')
  const clinicBody = clinicResponse?.bodyLines?.join('\n') || ''
  expect(clinicBody.includes('Requerimento Geral'), 'Troca de clínica: resposta deve usar Requerimento Geral')
  expect(clinicBody.includes('Formulário RENACH'), 'Troca de clínica: RENACH deve ser obrigatório')
  expect(clinicBody.includes('100 DPI'), 'Troca de clínica: regra de 100 DPI obrigatória')
  expect(clinicBody.includes('2,9 MB'), 'Troca de clínica: limite de 2,9 MB obrigatório')
  expect(!clinicBody.includes('FORMULÁRIO DE TROCA DE CLÍNICA'), 'Troca de clínica: formulário incorreto não pode retornar')
  expect(!clinicBody.includes('HAB0135'), 'Troca de clínica: link inexistente não pode retornar')
}

[
  'browser_action/index.html',
  'browser_action/main.js',
  'browser_action/style.css',
  'background/service-worker.js',
  'central_protocolista/index.html',
  'central_protocolista/main.js',
  'central_protocolista/styles.css',
  'cs_modules/clique_protocolista/index.js',
  'cs_modules/fast_mail/index.js',
  'cs_modules/fast_mail/styles.css',
  'cs_modules/fast_proc_handoff/index.js',
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
