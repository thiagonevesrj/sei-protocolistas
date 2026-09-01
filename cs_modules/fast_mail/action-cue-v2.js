(() => {
  'use strict'

  if (window.top !== window) return

  const api = typeof browser === 'undefined' ? chrome : browser
  const READY_TIMEOUT = 10000
  const CUE_DURATION = 2800
  const INVENTORY_CHOOSER_ID = 'spfm-v2-inventory-chooser'
  const INVENTORY_TITLES = {
    heirs: 'Baixa de restrição referente a inventário (PARA HERDEIROS)',
    thirdParty: 'Transferência de propriedade com baixa de restrição de inventário (PARA TERCEIROS)'
  }
  let cueTimer = null
  let cueRequest = 0
  let scriptCatalogPromise = null

  function cleanText (value) {
    return String(value || '').replace(/\s+/g, ' ').trim()
  }

  function normalizeText (value) {
    return cleanText(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
  }

  function isVisible (element) {
    if (!element || element.hidden || element.closest('[hidden]')) return false
    const style = window.getComputedStyle(element)
    return style.display !== 'none' && style.visibility !== 'hidden'
  }

  function visibleNextTarget () {
    const inventory = document.getElementById(INVENTORY_CHOOSER_ID)
    if (isVisible(inventory)) return inventory

    const variant = document.querySelector('#spfm-v2-variant-field')
    if (isVisible(variant)) return variant

    const special = document.querySelector('#spfm-v2-special-actions')
    if (isVisible(special)) return special

    const actionStep = document.querySelector('#spfm-action-step')
    if (isVisible(actionStep)) return actionStep

    const catalog = document.querySelector('#spfm-script-catalog')
    if (isVisible(catalog)) return catalog

    const identificationResults = document.querySelector('#spfm-v2-identification-result')?.closest('label, .spfm-v2-field, div')
    if (isVisible(identificationResults)) return identificationResults

    const orientationTopic = document.querySelector('#spfm-v2-orientation-topic')?.closest('label, .spfm-v2-field, div')
    if (isVisible(orientationTopic)) return orientationTopic

    return null
  }

  function cueNextClick () {
    const target = visibleNextTarget()
    if (!target) return false

    target.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
    target.classList.remove('spfm-v2-action-cue')
    void target.offsetWidth
    target.classList.add('spfm-v2-action-cue')

    if (cueTimer) window.clearTimeout(cueTimer)
    cueTimer = window.setTimeout(() => {
      target.classList.remove('spfm-v2-action-cue')
    }, CUE_DURATION)

    return true
  }

  function scheduleCue () {
    const request = ++cueRequest
    ;[80, 190, 380, 650].forEach((delay) => {
      window.setTimeout(() => {
        if (request !== cueRequest) return
        if (cueNextClick()) cueRequest += 1
      }, delay)
    })
  }

  function setStatus (message) {
    const status = document.querySelector('#spfm-v2-status')
    if (status) status.textContent = message
  }

  function selectDefaultTaxVariant () {
    const select = document.querySelector('#spfm-v2-variant')
    if (!select || select.hidden || select.closest('[hidden]')) return false

    const options = Array.from(select.options || []).filter((option) => option.value)
    if (!options.length) return false

    const scored = options.map((option) => {
      const label = normalizeText(option.textContent)
      let score = 0
      if (label.includes('pessoa fisica')) score += 100
      if (label.includes('duda')) score += 25
      if (label.includes('grt')) score -= 5
      if (label.includes('pessoa juridica')) score -= 100
      return { option, score }
    }).sort((a, b) => b.score - a.score)

    const best = scored[0]
    if (!best || best.score < 100) return false

    if (select.value !== best.option.value) {
      select.value = best.option.value
      select.dispatchEvent(new Event('change', { bubbles: true }))
    }

    setStatus(best.score >= 125
      ? 'Devolução de taxas: Pessoa Física / DUDA selecionado por padrão. Altere somente se o caso for diferente.'
      : 'Devolução de taxas: Pessoa Física selecionada por padrão. Altere somente se o caso for diferente.')
    scheduleCue()
    return true
  }

  function scheduleDefaultTaxVariant () {
    ;[80, 180, 360, 650].forEach((delay) => {
      window.setTimeout(() => selectDefaultTaxVariant(), delay)
    })
  }

  async function loadScriptCatalog () {
    if (!scriptCatalogPromise) {
      scriptCatalogPromise = fetch(api.runtime.getURL('data/catalogo-scripts.json'))
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          return response.json()
        })
        .then((catalog) => Array.isArray(catalog?.scripts) ? catalog.scripts : [])
    }
    return scriptCatalogPromise
  }

  async function findInventoryScript (title) {
    const scripts = await loadScriptCatalog()
    const normalizedTitle = normalizeText(title)
    return scripts.find((script) => script.phase === 'orientacao' && normalizeText(script.title) === normalizedTitle) || null
  }

  function openOrientationMode () {
    const navigationButton = document.querySelector('[data-spfm-v2-mode="orientacao"]')
    if (navigationButton) {
      navigationButton.click()
      return true
    }

    const nativeButton = document.querySelector('.spfm-phase-button[data-phase-id="orientacao"]')
    if (nativeButton) {
      nativeButton.click()
      return true
    }

    return false
  }

  function selectNativeScript (script) {
    if (!script || !openOrientationMode()) return false

    const catalog = document.querySelector('#spfm-script-catalog')
    const toggle = document.querySelector('#spfm-script-toggle')
    if (catalog?.hidden && toggle) toggle.click()

    const search = document.querySelector('#spfm-script-search')
    const result = document.querySelector('#spfm-script-result')
    if (!search || !result) return false

    search.value = script.title
    search.dispatchEvent(new Event('input', { bubbles: true }))

    const option = Array.from(result.options || []).find((candidate) => candidate.value === script.id)
    if (!option) return false

    result.value = script.id
    result.dispatchEvent(new Event('change', { bubbles: true }))
    catalog?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
    setStatus(`Inventário: ${script.title}. Confira a orientação e siga para a próxima ação disponível.`)
    scheduleCue()
    return true
  }

  async function chooseInventoryFlow (title) {
    setStatus('Carregando o fluxo correto de inventário…')
    try {
      const script = await findInventoryScript(title)
      if (!script || !selectNativeScript(script)) {
        setStatus('Não foi possível abrir automaticamente este fluxo de inventário. Use a busca da Fase 2.')
      }
    } catch (error) {
      console.error('[SEI Protocolistas] Falha ao abrir fluxo de inventário:', error)
      setStatus('Não foi possível carregar o catálogo de inventário. Use a busca da Fase 2.')
    }
  }

  function removeInventoryChooser () {
    document.getElementById(INVENTORY_CHOOSER_ID)?.remove()
  }

  function showInventoryChooser (anchorButton) {
    removeInventoryChooser()

    const chooser = document.createElement('div')
    chooser.id = INVENTORY_CHOOSER_ID
    chooser.style.display = 'grid'
    chooser.style.gap = '7px'
    chooser.style.margin = '8px 0'
    chooser.style.padding = '10px'
    chooser.style.border = '1px solid rgba(217, 173, 49, 0.65)'
    chooser.style.borderRadius = '10px'
    chooser.style.background = 'rgba(7, 24, 44, 0.96)'

    const title = document.createElement('strong')
    title.textContent = 'INVENTÁRIO — QUAL É O CASO?'
    title.style.fontSize = '12px'
    title.style.color = '#f1c44f'

    const helper = document.createElement('span')
    helper.textContent = 'Escolha a situação para abrir diretamente a orientação correta.'
    helper.style.fontSize = '11px'
    helper.style.opacity = '0.85'

    const heirs = document.createElement('button')
    heirs.type = 'button'
    heirs.className = 'spfm-v2-quick-button'
    heirs.textContent = 'HERDEIROS / BAIXA DA RESTRIÇÃO'
    heirs.title = INVENTORY_TITLES.heirs

    const thirdParty = document.createElement('button')
    thirdParty.type = 'button'
    thirdParty.className = 'spfm-v2-quick-button'
    thirdParty.textContent = 'TERCEIROS / VENDA APÓS INVENTÁRIO'
    thirdParty.title = INVENTORY_TITLES.thirdParty

    heirs.addEventListener('click', () => {
      removeInventoryChooser()
      chooseInventoryFlow(INVENTORY_TITLES.heirs)
    })

    thirdParty.addEventListener('click', () => {
      removeInventoryChooser()
      chooseInventoryFlow(INVENTORY_TITLES.thirdParty)
    })

    chooser.append(title, helper, heirs, thirdParty)
    const shortcutContainer = anchorButton.closest('#spfm-v2-identification-shortcuts')
    shortcutContainer?.insertAdjacentElement('afterend', chooser)
    chooser.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
    setStatus('Inventário identificado. Agora escolha: herdeiros/baixa da restrição ou transferência para terceiro.')
    scheduleCue()
  }

  function isGuidedControl (target) {
    return Boolean(target.closest(
      '.spfm-v2-quick-button, #spfm-v2-identification-open, #spfm-v2-orientation-open, #spfm-v2-orientation-unknown, #spfm-v2-identification-unknown, [data-spfm-v2-mode]'
    ))
  }

  function bind () {
    const panel = document.querySelector('#sei-protocolistas-fast-mail-status')
    if (!panel || panel.dataset.spfmV2ActionCueBound === 'true') return false

    panel.dataset.spfmV2ActionCueBound = 'true'

    panel.addEventListener('click', (event) => {
      const inventoryButton = event.target.closest('#spfm-v2-identification-shortcuts .spfm-v2-quick-button')
      if (!inventoryButton || normalizeText(inventoryButton.textContent) !== 'inventario') return

      event.preventDefault()
      event.stopImmediatePropagation()
      showInventoryChooser(inventoryButton)
    }, true)

    panel.addEventListener('click', (event) => {
      const orientationShortcut = event.target.closest('#spfm-v2-orientation .spfm-v2-quick-button')

      if (orientationShortcut && normalizeText(orientationShortcut.textContent) === 'devolucao de taxas') {
        scheduleDefaultTaxVariant()
      }

      if (isGuidedControl(event.target)) scheduleCue()
    })

    panel.addEventListener('change', (event) => {
      if (event.target.matches('select, input[type="radio"], input[type="checkbox"]')) scheduleCue()
    })

    return true
  }

  async function initialize () {
    const startedAt = Date.now()
    while (Date.now() - startedAt < READY_TIMEOUT) {
      if (bind()) return
      await new Promise((resolve) => window.setTimeout(resolve, 100))
    }
  }

  initialize()
})()
