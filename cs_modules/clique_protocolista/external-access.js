(() => {
  'use strict'

  const KEY = 'spFastProcExternalAccess'
  const MAX_AGE = 15 * 60 * 1000
  const STATUS_ID = 'sp-external-access-status'
  const normalize = (value) => String(value || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()

  function readPending () {
    try {
      const pending = JSON.parse(sessionStorage.getItem(KEY) || 'null')
      if (!pending || !pending.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pending.email || '') ||
        !pending.createdAt || Date.now() - pending.createdAt > MAX_AGE) return null
      return pending
    } catch (_) { return null }
  }

  function pageContext () {
    const urls = [new URL(location.href)]
    try { if (window.top !== window) urls.push(new URL(window.top.location.href)) } catch (_) {}
    const ids = urls.map((url) => url.searchParams.get('id_procedimento')).filter(Boolean)
    if (new Set(ids).size > 1) return null
    const fromCreation = urls.some((url) => url.searchParams.get('acao_origem') === 'procedimento_gerar') ||
      (() => {
        try {
          const ref = new URL(document.referrer)
          return ref.origin === location.origin && ref.searchParams.get('acao') === 'procedimento_gerar'
        } catch (_) { return false }
      })()
    return { processId: ids[0] || '', fromCreation }
  }

  function bindProcess (pending, context) {
    if (!context?.processId) return false
    if (pending.processId) return pending.processId === context.processId
    if (!context.fromCreation) return false
    pending.processId = context.processId
    sessionStorage.setItem(KEY, JSON.stringify(pending))
    return true
  }

  function visible (element) {
    if (!element || element.hidden || element.closest('[hidden]')) return false
    const rect = element.getBoundingClientRect()
    const style = getComputedStyle(element)
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
  }

  function accessHeading () {
    return Array.from(document.querySelectorAll('h1,h2,h3,legend,span,div'))
      .find((element) => visible(element) && normalize(element.textContent) === 'gerenciar disponibilizacoes de acesso externo') || null
  }

  function showStatus (anchor, message, ready = false) {
    let box = document.getElementById(STATUS_ID)
    if (!box) {
      box = document.createElement('aside')
      box.id = STATUS_ID
      box.setAttribute('role', 'status')
      box.setAttribute('aria-live', 'polite')
      box.style.cssText = 'position:relative;box-sizing:border-box;padding:12px;margin:8px 0;border:2px solid;border-radius:8px;font:14px Arial;max-width:760px;'
      const label = document.createElement('span')
      label.className = 'sp-access-message'
      label.style.color = 'inherit'
      const collapse = document.createElement('button')
      collapse.type = 'button'
      collapse.textContent = 'Recolher'
      collapse.style.cssText = 'margin-left:12px;cursor:pointer;color:#172b4d;background:#fff;border:1px solid #64748b;border-radius:4px;'
      collapse.addEventListener('click', () => {
        label.hidden = !label.hidden
        collapse.textContent = label.hidden ? 'Mostrar acesso externo' : 'Recolher'
      })
      box.append(label, collapse)
      anchor.insertAdjacentElement('afterend', box)
    }
    const label = box.querySelector('.sp-access-message')
    if (label.textContent !== message) label.textContent = message
    box.style.backgroundColor = ready ? '#e6f4ea' : '#fff4ce'
    box.style.borderColor = ready ? '#16803c' : '#b77900'
    box.style.color = ready ? '#14532d' : '#663c00'
  }

  function fieldByLabel (text, selector) {
    const labels = Array.from(document.querySelectorAll('label,span,td,div'))
      .filter((element) => normalize(element.textContent) === normalize(text))
    for (const label of labels) {
      const associated = label.control || document.getElementById(label.getAttribute('for') || '')
      if (associated?.matches(selector) && visible(associated)) return associated
      const nested = Array.from(label.querySelectorAll(selector)).filter(visible)
      if (nested.length === 1) return nested[0]
      const sibling = label.nextElementSibling
      if (sibling?.matches(selector) && visible(sibling)) return sibling
      const group = label.parentElement
      if (!group || group.matches('body,form')) continue
      const grouped = Array.from(group.querySelectorAll(selector)).filter(visible)
      if (grouped.length === 1) return grouped[0]
    }
    return null
  }

  function findFields () {
    const text = 'input:not([type="password"]):not([type="hidden"]):not([type="radio"]):not([type="checkbox"]),textarea'
    return {
      sender: fieldByLabel('E-mail da Unidade', 'select'),
      name: fieldByLabel('Destinatário', text),
      email: fieldByLabel('E-mail do Destinatário', text),
      reason: fieldByLabel('Motivo', text),
      days: fieldByLabel('Validade (dias)', text),
      integral: fieldByLabel('Acompanhamento integral do processo', 'input[type="radio"]')
    }
  }

  function setValue (element, value) {
    const view = element.ownerDocument.defaultView
    const prototype = element.tagName === 'SELECT'
      ? view.HTMLSelectElement.prototype
      : element.tagName === 'TEXTAREA' ? view.HTMLTextAreaElement.prototype : view.HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set
    if (setter) setter.call(element, value)
    else element.value = value
    element.dispatchEvent(new view.Event('input', { bubbles: true }))
    element.dispatchEvent(new view.Event('change', { bubbles: true }))
  }

  function fillFields (fields, pending) {
    if (Object.values(fields).some((field) => !field || field.disabled || field.readOnly)) return false
    const first = Array.from(fields.sender.options).find((option) => !option.disabled && option.value && String(option.textContent).includes('@'))
    if (!first) return false
    // Nunca substituir silenciosamente um destinatário já digitado pelo operador.
    if ((fields.name.value.trim() && fields.name.value.trim() !== pending.name.trim()) ||
      (fields.email.value.trim() && fields.email.value.trim().toLowerCase() !== pending.email.trim().toLowerCase())) return false
    setValue(fields.sender, first.value)
    setValue(fields.name, pending.name)
    setValue(fields.email, pending.email)
    setValue(fields.reason, 'Vistas ao processo')
    setValue(fields.days, '365')
    if (!fields.integral.checked) fields.integral.click()
    return fields.sender.value === first.value && fields.name.value === pending.name &&
      fields.email.value === pending.email && fields.reason.value === 'Vistas ao processo' &&
      fields.days.value === '365' && fields.integral.checked
  }

  function findAccessLink () {
    return Array.from(document.querySelectorAll('#divArvoreAcoes a[href]')).find((link) => {
      if (!visible(link)) return false
      const caption = normalize([link.textContent, link.title, link.getAttribute('aria-label'),
        ...Array.from(link.querySelectorAll('img')).map((img) => `${img.alt} ${img.title}`)].join(' '))
      if (!/gerenciar.*acesso externo/.test(caption)) return false
      try {
        const url = new URL(link.href, location.href)
        return url.origin === location.origin && url.searchParams.get('acao') === 'acesso_externo_gerenciar'
      } catch (_) { return false }
    }) || null
  }

  async function fillSavedPassword (field) {
    if (!field || field.disabled || field.readOnly || location.protocol !== 'https:') return false
    if (field.value) return true
    const credentialsKey = 'centralProtocolistaSeiCredentials'
    const stored = await new Promise((resolve) => {
      try {
        chrome.storage.local.get(credentialsKey, (result) => {
          resolve(chrome.runtime.lastError ? {} : result || {})
        })
      } catch (_) { resolve({}) }
    })
    const credentials = stored[credentialsKey]
    if (!credentials?.remember || !credentials.password) return false
    // Usar o cadastro já autorizado da Central, sem duplicar a senha no rascunho.
    if (!field.value) setValue(field, credentials.password)
    return Boolean(field.value)
  }

  function findPasswordField () {
    const byLabel = fieldByLabel('Senha', 'input[type="password"]')
    if (byLabel) return byLabel
    return Array.from(document.querySelectorAll(
      '#pwdSenha, input[name="pwdSenha"], input[id*="senha" i], input[name*="senha" i], input[type="password"]'
    )).find((field) => visible(field) && !field.disabled && !field.readOnly) || null
  }

  async function hasSavedPassword () {
    const credentialsKey = 'centralProtocolistaSeiCredentials'
    const stored = await new Promise((resolve) => {
      try {
        chrome.storage.local.get(credentialsKey, (result) => {
          resolve(chrome.runtime.lastError ? {} : result || {})
        })
      } catch (_) { resolve({}) }
    })
    const credentials = stored[credentialsKey]
    return Boolean(credentials?.remember && credentials.password)
  }

  let busy = false
  let done = false
  async function reconcile () {
    if (busy || done) return
    const pending = readPending()
    if (!pending || !bindProcess(pending, pageContext())) return
    busy = true
    try {
      const heading = accessHeading()
      if (heading) {
        if (pending.filled) { done = true; return }
        showStatus(heading, 'Aguarde — preparando acesso externo…')
        // Deixar o navegador exibir a etapa de espera antes do preenchimento.
        await new Promise((resolve) => window.setTimeout(resolve, 100))
        if (!fillFields(findFields(), pending)) {
          showStatus(heading, 'Não foi possível completar todos os campos. Confira o formulário antes de disponibilizar o acesso.')
          return
        }
        const passwordField = findPasswordField()
        // O SEI pode montar a senha depois dos demais campos. Se houver senha
        // salva, aguardar esse controle em vez de encerrar a automação cedo.
        if (!passwordField && await hasSavedPassword()) {
          showStatus(heading, 'Dados preenchidos — aguardando o campo de senha do SEI…')
          return
        }
        const passwordReady = await fillSavedPassword(passwordField)
        pending.filled = true
        sessionStorage.setItem(KEY, JSON.stringify(pending))
        showStatus(heading, passwordReady
          ? 'Dados e senha preenchidos — confira e clique em Disponibilizar.'
          : 'Dados preenchidos — informe sua senha do SEI e clique em Disponibilizar. Para automatizar a senha, salve o acesso do SEI na Central.', passwordReady)
        done = true
      } else if (!pending.opened) {
        const link = findAccessLink()
        if (!link) return
        const linkedId = new URL(link.href, location.href).searchParams.get('id_procedimento')
        if (linkedId && linkedId !== pending.processId) return
        pending.opened = true
        sessionStorage.setItem(KEY, JSON.stringify(pending))
        link.click()
      }
    } finally { busy = false }
  }

  // Eventos assíncronos do SEI podem montar a barra e o formulário em frames.
  // Tempo limitado; nunca clicar em Disponibilizar nem copiar a senha para o contexto.
  if (readPending()) {
    reconcile()
    const timer = window.setInterval(() => {
      reconcile()
      if (done) window.clearInterval(timer)
    }, 500)
    window.setTimeout(() => window.clearInterval(timer), 30000)
  }
})()
