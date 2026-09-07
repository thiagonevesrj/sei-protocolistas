(() => {
  'use strict'

  if (window.top !== window) return
  if (/\/owa\/auth\/logon\.aspx/i.test(window.location.pathname)) return

  const api = typeof browser === 'undefined' ? chrome : browser
  const nativeFetch = window.fetch.bind(window)
  const PROCESS_CATALOG_PATH = 'data/catalogo-processos.json'
  const SCRIPT_CATALOG_PATH = 'data/catalogo-scripts.json'
  const OPERATIONAL_PATH = 'data/trellinho-operacional-2808.json'
  const TRELLO_STATE_PATH = 'data/trello-fase02-estado-atual.json'
  const CERTIDAO_PROCESS_ID = 'certidao-identificacao-civil'
  const CERTIDAO_TOPIC_ID = 'certidao-identificacao-civil'
  const CERTIDAO_SCRIPT_ID = 'trello-64e2a71210e1a7e149276334'
  const CERTIDAO_FORM_URL = 'https://www.detran.rj.gov.br/images/formularios/Formul%C3%A1rio_solicita%C3%A7%C3%A3o_certidao_dic_05-02-25.pdf'

  const CERTIDAO_MISSING_DOCUMENTS = [
    {
      id: 'certidao-form',
      label: 'Formulário de Solicitação de Certidão de Identificação Civil',
      text: 'Formulário de Solicitação de Certidão de Identificação Civil devidamente preenchido e assinado a caneta ou por Certificação Digital.',
      link: CERTIDAO_FORM_URL,
      linkLabel: 'Acessar o Formulário de Solicitação de Certidão de Identificação Civil'
    },
    {
      id: 'requester-identification',
      label: 'Documento de identidade do solicitante/requerente',
      text: 'Documento de identidade do solicitante/requerente.'
    },
    {
      id: 'direct-relative-proof',
      label: 'Ascendente/descendente — comprovação do grau de parentesco',
      text: 'Para ascendentes ou descendentes diretos do(a) pesquisado(a): documentação oficial que comprove o grau de parentesco com o pesquisado.'
    },
    {
      id: 'direct-relative-death-certificate',
      label: 'Ascendente/descendente — Certidão de Óbito com filiação',
      text: 'Para ascendentes ou descendentes diretos do(a) pesquisado(a): Certidão de Óbito com filiação.'
    },
    {
      id: 'spouse-marriage-certificate',
      label: 'Cônjuge — Certidão de Casamento',
      text: 'Para cônjuge do(a) pesquisado(a): Certidão de Casamento.'
    },
    {
      id: 'spouse-death-certificate',
      label: 'Cônjuge — Certidão de Óbito com filiação',
      text: 'Para cônjuge do(a) pesquisado(a): Certidão de Óbito com filiação.'
    },
    {
      id: 'partner-death-certificate',
      label: 'Companheiro(a) — Certidão de Óbito com filiação',
      text: 'Para companheiro(a) do(a) pesquisado(a): Certidão de Óbito com filiação.'
    },
    {
      id: 'partner-stable-union-proof',
      label: 'Companheiro(a) — comprovação da União Estável',
      text: 'Para companheiro(a) do(a) pesquisado(a): Certidão de nascimento de filho(s) menor(es) registrado(s) pelo casal OU Sentença Judicial que comprove a União Estável + União Estável lavrada em cartório, com comparecimento das partes contratadas.'
    },
    {
      id: 'lawyer-power-of-attorney',
      label: 'Representação por advogado — Procuração Simples',
      text: 'Procuração Simples, caso representado por Advogado.'
    },
    {
      id: 'lawyer-oab',
      label: 'Representação por advogado — Carteira da OAB',
      text: 'Carteira da Ordem dos Advogados do Brasil, caso representado por Advogado.'
    },
    {
      id: 'documentary-agent-asd',
      label: 'Despachante Documentalista — ASD',
      text: 'Anotação de Serviço Documental - ASD, caso representado por Despachante Documentalista.'
    },
    {
      id: 'documentary-agent-card',
      label: 'Despachante Documentalista — Carteira do Conselho Regional',
      text: 'Carteira do Conselho Regional dos Despachantes Documentalistas do Estado do Rio de Janeiro.'
    },
    {
      id: 'public-agent-certificate',
      label: 'Despachante Público — Certificado Analítico',
      text: 'Certificado Analítico, caso representado por Despachante Público.'
    },
    {
      id: 'public-agent-card',
      label: 'Despachante Público — Carteira do Sindicato',
      text: 'Carteira do Sindicato dos Despachantes.'
    },
    {
      id: 'other-representation-power-of-attorney',
      label: 'Outro procurador — Procuração Pública',
      text: 'Procuração Pública, caso representado, exceto por Advogado/Despachante.'
    },
    {
      id: 'other-representation-id-cpf',
      label: 'Outro procurador — Documento de Identidade e CPF',
      text: 'Documento de Identidade e CPF do procurador, caso representado, exceto Advogado/Despachante.'
    }
  ]

  function normalize (value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  function slug (value) {
    return normalize(value).replace(/\s+/g, '-').slice(0, 80) || 'atendimento'
  }

  function areaForRecord (record) {
    const text = normalize(`${record.group || ''} ${record.title || ''}`)
    if (/\b(divmed|pericia|junta medica|junta psicologica|clinica)\b/.test(text)) return 'pericia-medica'
    if (/\b(daf|divaf|taxa|grt|duda|ressarcimento)\b/.test(text)) return 'taxas'
    if (/\b(oficio|dijur)\b/.test(text)) return 'oficios'
    if (/\b(hab|cnh|renach|cfc|condutor|habilitacao|nucrae|nucda|nucnae|servech|servmt|servnpda|comispl|divaprend)\b/.test(text)) return 'habilitacao'
    return 'veiculos'
  }

  function findExistingProcess (processTypes, record) {
    const title = normalize(record.title)
    const sei = normalize(record.seiProcessName)
    const destination = normalize(record.destinationUnit)

    return processTypes.find((item) => {
      const names = [item?.name, ...(Array.isArray(item?.seiNames) ? item.seiNames : [])].map(normalize)
      const itemDestination = normalize(item?.destinationUnit)
      if (title && names.includes(title) && (!destination || itemDestination === destination)) return true
      if (sei && names.includes(sei) && destination && itemDestination === destination) return true
      return false
    }) || null
  }

  function findScript (scripts, record) {
    const title = normalize(record.title)
    const group = normalize(record.group)
    const exact = scripts.find((script) => normalize(script.title) === title && (!group || normalize(script.group) === group))
    return exact || scripts.find((script) => normalize(script.title) === title) || null
  }

  function uniqueId (base, usedIds) {
    let candidate = base
    let index = 2
    while (usedIds.has(candidate)) {
      candidate = `${base}-${index}`
      index += 1
    }
    usedIds.add(candidate)
    return candidate
  }

  function trelloStateForScript (statePayload, script) {
    if (!script) return null
    const records = Array.isArray(statePayload?.records) ? statePayload.records : []
    return records.find((item) => item.scriptId === script.id) || null
  }

  function isClosedInTrello (statePayload, script) {
    if (!script) return false
    return (statePayload?.closedCards || []).some((item) => item.scriptId === script.id)
  }

  function hasLabel (trelloState, label) {
    return Array.isArray(trelloState?.labels) && trelloState.labels.includes(label)
  }

  function operationalState (record, trelloState) {
    const title = normalize(record.title)
    const noProcess = hasLabel(trelloState, 'NÃO PRECISA ABRIR PROCESSO') ||
      record.noProcess || /nao abre processo/.test(title)
    const presential = hasLabel(trelloState, 'PRESENCIAL SOMENTE') ||
      record.presential || /somente presencial/.test(title)

    if (noProcess) {
      return { canOpenProcess: false, blockedReason: 'Este atendimento não abre processo administrativo.' }
    }
    if (presential) {
      return { canOpenProcess: false, blockedReason: 'Este processo é aberto somente de forma presencial.' }
    }
    return { canOpenProcess: true, blockedReason: '' }
  }

  function trelloMeta (trelloState) {
    return {
      requiresAttachments: hasLabel(trelloState, 'OBRIGATÓRIO INCLUIR ANEXOS'),
      retainsOriginal: hasLabel(trelloState, 'DOCUMENTO ORIGINAL RETIDO'),
      hasDuda: hasLabel(trelloState, 'DUDA'),
      provisional: hasLabel(trelloState, 'PROVISÓRIO'),
      directAtPost: hasLabel(trelloState, 'ATENDIMENTO DIRETO NO POSTO'),
      seeObservation: hasLabel(trelloState, 'VEJA A OBSERVAÇÃO')
    }
  }

  function operationalRecords (payload) {
    const records = Array.isArray(payload?.records) ? payload.records.slice() : []
    const leilaoTitle = 'Leilão - Geral (COMISLE)'

    if (!records.some((record) => normalize(record.title) === normalize(leilaoTitle))) {
      records.push({
        id: 'trellinho-leilao-geral-comisle',
        title: leilaoTitle,
        group: 'Leilão',
        destinationUnit: 'COMISLE',
        seiProcessName: '',
        manualSeiTypeSelection: true
      })
    }
    return records
  }

  function applyCertidaoCivil (processTypes, topics) {
    const process = processTypes.find((item) => item?.id === CERTIDAO_PROCESS_ID)
    if (process && !Array.isArray(process.missingDocuments)) {
      process.documentsStatus = 'trello-current-card'
      process.missingDocuments = CERTIDAO_MISSING_DOCUMENTS
      process.source = {
        board: 'SCRIPTS - FASE02 - Orientação',
        card: 'Certidão de Identificação Civil',
        cardId: '64e2a71210e1a7e149276334',
        lastActivity: '2026-07-27'
      }
    }

    const topicPatch = {
      id: CERTIDAO_TOPIC_ID,
      label: 'Certidão de Identificação Civil',
      area: 'outros',
      recentUsageCount: 0,
      searchQuery: 'certidão identificação civil',
      processId: CERTIDAO_PROCESS_ID,
      canOpenProcess: true,
      scriptId: CERTIDAO_SCRIPT_ID,
      responseScriptIds: [CERTIDAO_SCRIPT_ID]
    }

    const existingTopic = topics.find((item) => item?.id === CERTIDAO_TOPIC_ID)
    if (existingTopic) Object.assign(existingTopic, topicPatch)
    else topics.push(topicPatch)
  }

  function mergeOperationalCatalog (catalog, operationalPayload, scriptPayload, statePayload) {
    const processTypes = Array.isArray(catalog.processTypes) ? catalog.processTypes.slice() : []
    const topics = Array.isArray(catalog.fastMailPriorityTopics) ? catalog.fastMailPriorityTopics.slice() : []
    const scripts = Array.isArray(scriptPayload?.scripts) ? scriptPayload.scripts : []
    const records = operationalRecords(operationalPayload)
    const usedProcessIds = new Set(processTypes.map((item) => item.id))
    const usedTopicIds = new Set(topics.map((item) => item.id))
    const closedScriptIds = new Set((statePayload?.closedCards || []).map((item) => item.scriptId))

    for (let index = topics.length - 1; index >= 0; index -= 1) {
      if (closedScriptIds.has(topics[index]?.scriptId)) topics.splice(index, 1)
    }

    records.forEach((record) => {
      const script = findScript(scripts, record)
      if (isClosedInTrello(statePayload, script)) return

      const normalizedTitle = normalize(record.title)
      const normalizedGroup = normalize(record.group)
      const currentTrelloState = trelloStateForScript(statePayload, script)
      const state = operationalState(record, currentTrelloState)
      const meta = trelloMeta(currentTrelloState)
      let process = findExistingProcess(processTypes, record)

      if (state.canOpenProcess && !process) {
        const processId = uniqueId(`trellinho-${slug(record.title)}`, usedProcessIds)
        const area = areaForRecord(record)
        process = {
          id: processId,
          name: record.title,
          category: area,
          seiNames: record.seiProcessName ? [record.seiProcessName] : [],
          destinationUnit: record.destinationUnit || '',
          responseModel: area === 'veiculos' ? 'drv' : area === 'pericia-medica' ? 'divmed' : area === 'taxas' ? 'daf' : 'standard',
          source: 'trellinho-2808+trello-atual',
          manualSeiTypeSelection: Boolean(record.manualSeiTypeSelection || !record.seiProcessName),
          trelloMeta: meta
        }
        processTypes.push(process)
      } else if (process) {
        process.trelloMeta = { ...(process.trelloMeta || {}), ...meta }
      }

      const existingTopic = topics.find((topic) => {
        if (normalize(topic.label) === normalizedTitle) return true
        const mappedScript = scripts.find((item) => item.id === topic.scriptId)
        return Boolean(mappedScript && normalize(mappedScript.title) === normalizedTitle && (!normalizedGroup || normalize(mappedScript.group) === normalizedGroup))
      })

      const topicPatch = {
        label: record.title,
        area: areaForRecord(record),
        processId: process?.id || null,
        scriptId: script?.id || existingTopic?.scriptId || null,
        responseScriptIds: script?.id ? [script.id] : existingTopic?.responseScriptIds,
        canOpenProcess: state.canOpenProcess && Boolean(process?.id),
        blockedReason: state.blockedReason,
        trellinhoSource: '2808',
        trelloStateSource: statePayload?.boardLastActivity || '',
        trelloMeta: meta
      }

      if (existingTopic) {
        Object.assign(existingTopic, topicPatch)
        return
      }
      if (!script) return

      topics.push({
        id: uniqueId(`trellinho-topic-${slug(record.title)}`, usedTopicIds),
        ...topicPatch,
        corePriority: false,
        corePriorityRank: 9999,
        recentUsageCount: 0
      })
    })

    applyCertidaoCivil(processTypes, topics)

    return {
      ...catalog,
      processTypes,
      fastMailPriorityTopics: topics,
      trellinhoOperationalOverlay: {
        sourceDate: operationalPayload?.sourceDate || '2026-08-28',
        trelloBoardLastActivity: statePayload?.boardLastActivity || '',
        trelloActiveCards: Number(statePayload?.activeCards || 0),
        recordCount: records.length,
        appliedAt: new Date().toISOString()
      }
    }
  }

  let mergedCatalogPromise = null

  async function getJson (url, label) {
    const response = await nativeFetch(url)
    if (!response.ok) throw new Error(`${label} HTTP ${response.status}`)
    return response.json()
  }

  async function getMergedCatalog (catalogUrl) {
    if (mergedCatalogPromise) return mergedCatalogPromise

    mergedCatalogPromise = Promise.all([
      getJson(catalogUrl, 'Catálogo base'),
      getJson(api.runtime.getURL(OPERATIONAL_PATH), 'Trellinho operacional'),
      getJson(api.runtime.getURL(SCRIPT_CATALOG_PATH), 'Catálogo de scripts'),
      getJson(api.runtime.getURL(TRELLO_STATE_PATH), 'Estado atual do Trello')
    ]).then(([catalog, operational, scripts, trelloState]) =>
      mergeOperationalCatalog(catalog, operational, scripts, trelloState)
    ).catch((error) => {
      console.error('[SEI Protocolistas] Falha ao aplicar camada Trellinho/Trello:', error)
      mergedCatalogPromise = null
      throw error
    })

    return mergedCatalogPromise
  }

  window.fetch = async function fastMailTrellinhoFetch (input, init) {
    const url = typeof input === 'string' ? input : input?.url || ''
    const catalogUrl = api.runtime.getURL(PROCESS_CATALOG_PATH)
    if (url !== catalogUrl) return nativeFetch(input, init)

    try {
      const merged = await getMergedCatalog(catalogUrl)
      return new Response(JSON.stringify(merged), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      })
    } catch (_) {
      return nativeFetch(input, init)
    }
  }
})()
