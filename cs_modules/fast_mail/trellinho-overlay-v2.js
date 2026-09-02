(() => {
  'use strict'

  if (window.top !== window) return

  const api = typeof browser === 'undefined' ? chrome : browser
  const nativeFetch = window.fetch.bind(window)
  const PROCESS_CATALOG_PATH = 'data/catalogo-processos.json'
  const SCRIPT_CATALOG_PATH = 'data/catalogo-scripts.json'
  const OPERATIONAL_PATH = 'data/trellinho-operacional-2808.json'

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

  function processKey (item) {
    return normalize([
      item?.name,
      ...(Array.isArray(item?.seiNames) ? item.seiNames : []),
      item?.destinationUnit
    ].join(' '))
  }

  function findExistingProcess (processTypes, record) {
    const title = normalize(record.title)
    const sei = normalize(record.seiProcessName)
    const destination = normalize(record.destinationUnit)

    return processTypes.find((item) => {
      const names = [item?.name, ...(Array.isArray(item?.seiNames) ? item.seiNames : [])].map(normalize)
      if (sei && names.includes(sei)) return true
      if (title && names.includes(title)) return true
      return Boolean(destination && normalize(item?.destinationUnit) === destination && names.some((name) => name === title || name === sei))
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

  function operationalState (record) {
    if (record.noProcess) {
      return {
        canOpenProcess: false,
        blockedReason: 'Este atendimento não abre processo administrativo.'
      }
    }
    if (record.presential) {
      return {
        canOpenProcess: false,
        blockedReason: 'Este processo é aberto somente de forma presencial.'
      }
    }
    return { canOpenProcess: true, blockedReason: '' }
  }

  function mergeOperationalCatalog (catalog, operationalPayload, scriptPayload) {
    const processTypes = Array.isArray(catalog.processTypes) ? catalog.processTypes.slice() : []
    const topics = Array.isArray(catalog.fastMailPriorityTopics) ? catalog.fastMailPriorityTopics.slice() : []
    const scripts = Array.isArray(scriptPayload?.scripts) ? scriptPayload.scripts : []
    const records = Array.isArray(operationalPayload?.records) ? operationalPayload.records : []
    const usedProcessIds = new Set(processTypes.map((item) => item.id))
    const usedTopicIds = new Set(topics.map((item) => item.id))

    records.forEach((record) => {
      const script = findScript(scripts, record)
      const normalizedTitle = normalize(record.title)
      const normalizedGroup = normalize(record.group)
      let process = findExistingProcess(processTypes, record)

      if (!record.noProcess && !record.presential && !process) {
        const processId = uniqueId(`trellinho-${slug(record.title)}`, usedProcessIds)
        process = {
          id: processId,
          name: record.title,
          category: areaForRecord(record),
          seiNames: record.seiProcessName ? [record.seiProcessName] : [],
          destinationUnit: record.destinationUnit || '',
          responseModel: areaForRecord(record) === 'veiculos' ? 'drv' : areaForRecord(record) === 'pericia-medica' ? 'divmed' : areaForRecord(record) === 'taxas' ? 'daf' : 'standard',
          source: 'trellinho-2808',
          manualSeiTypeSelection: !record.seiProcessName
        }
        processTypes.push(process)
      }

      const existingTopic = topics.find((topic) => {
        if (normalize(topic.label) === normalizedTitle) return true
        const mappedScript = scripts.find((item) => item.id === topic.scriptId)
        return Boolean(mappedScript && normalize(mappedScript.title) === normalizedTitle && (!normalizedGroup || normalize(mappedScript.group) === normalizedGroup))
      })

      const state = operationalState(record)
      const topicPatch = {
        label: record.title,
        area: areaForRecord(record),
        processId: process?.id || null,
        scriptId: script?.id || existingTopic?.scriptId || null,
        responseScriptIds: script?.id ? [script.id] : existingTopic?.responseScriptIds,
        canOpenProcess: state.canOpenProcess && Boolean(process?.id),
        blockedReason: state.blockedReason,
        trellinhoSource: '2808'
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
        recordCount: records.length,
        appliedAt: new Date().toISOString()
      }
    }
  }

  let mergedCatalogPromise = null

  async function getMergedCatalog (catalogUrl) {
    if (mergedCatalogPromise) return mergedCatalogPromise

    mergedCatalogPromise = Promise.all([
      nativeFetch(catalogUrl).then((response) => {
        if (!response.ok) throw new Error(`Catálogo base HTTP ${response.status}`)
        return response.json()
      }),
      nativeFetch(api.runtime.getURL(OPERATIONAL_PATH)).then((response) => {
        if (!response.ok) throw new Error(`Trellinho operacional HTTP ${response.status}`)
        return response.json()
      }),
      nativeFetch(api.runtime.getURL(SCRIPT_CATALOG_PATH)).then((response) => {
        if (!response.ok) throw new Error(`Catálogo de scripts HTTP ${response.status}`)
        return response.json()
      })
    ]).then(([catalog, operational, scripts]) => mergeOperationalCatalog(catalog, operational, scripts))
      .catch((error) => {
        console.error('[SEI Protocolistas] Falha ao aplicar camada Trellinho 28/08:', error)
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
