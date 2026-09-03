(() => {
  'use strict'

  if (window.top !== window) return

  const api = typeof browser === 'undefined' ? chrome : browser
  const nativeFetch = window.fetch.bind(window)
  const PROCESS_CATALOG_PATH = 'data/catalogo-processos.json'
  const SCRIPT_CATALOG_PATH = 'data/catalogo-scripts.json'
  const OPERATIONAL_PATH = 'data/trellinho-operacional-2808.json'
  const TRELLO_STATE_PATH = 'data/trello-fase02-estado-atual.json'

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
