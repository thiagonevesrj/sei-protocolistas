(() => {
  'use strict'

  if (window.top !== window) return
  if (/\/owa\/auth\/logon\.aspx/i.test(window.location.pathname)) return

  const HISTORY_SEPARATOR = '----- HISTÓRICO DE MENSAGENS ANTERIORES -----'
  const BCC_EMAIL = 'protocolodetran@detran.rj.gov.br'
  let runToken = 0

  const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim()
  const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms))

  function setStatus (message) {
    ;['#spfm-body-status', '#spfm-workflow-v3-status', '#spfm-priority-status'].forEach((selector) => {
      const target = document.querySelector(selector)
      if (target) target.textContent = message
    })
  }

  function findPlainEditor () {
    const textarea = document.querySelector('#divBdy textarea#txtBdy')
    if (!textarea || textarea.disabled || textarea.readOnly) return null
    if (textarea.closest?.('#divHdrMessage')) return null
    return textarea
  }

  function findHtmlBody () {
    const frame = document.querySelector('#divBdy iframe#ifBdy')
    if (!frame || frame.closest?.('#divHdrMessage')) return null
    try {
      return frame.contentDocument?.body || null
    } catch (_) {
      return null
    }
  }

  function currentReplyText () {
    const textarea = findPlainEditor()
    if (textarea) return String(textarea.value || '').split(HISTORY_SEPARATOR)[0]
    const body = findHtmlBody()
    return body ? String(body.innerText || '') : ''
  }

  function requirementConfirmed () {
    const body = findHtmlBody()
    if (body?.querySelector?.('[data-sei-protocolistas="missing-documents-requirement"]')) return true

    const text = currentReplyText()
    return /Após a análise da documentação encaminhada/i.test(text) &&
      /todos os documentos necessários/i.test(text)
  }

  function findSubjectField () {
    return document.querySelector(
      '#divWellSubject input, #divWellSubject textarea, input[name*="subject" i], input[id*="subject" i], input[name*="assunto" i], input[id*="assunto" i]'
    )
  }

  function findBccField () {
    return document.querySelector(
      '#divWellBcc input, #divWellBcc textarea, input[name*="bcc" i], textarea[name*="bcc" i], input[id*="bcc" i], textarea[id*="bcc" i]'
    )
  }

  function fieldText (field) {
    return clean(field?.value || field?.textContent || field?.innerText).toLowerCase()
  }

  function emailPrepared () {
    const subject = fieldText(findSubjectField())
    const bcc = fieldText(findBccField())
    return /\btriagem\b/i.test(subject) && bcc.includes(BCC_EMAIL)
  }

  function showManualPreparation (message) {
    const section = document.querySelector('#spfm-email-preparation')
    const button = document.querySelector('#spfm-triagem')
    if (section) section.hidden = false
    if (button) {
      button.textContent = 'PREPARAR E-MAIL'
      button.classList.remove('spfm-workflow-v3-cue')
      void button.offsetWidth
      button.classList.add('spfm-workflow-v3-cue')
      button.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' })
    }
    setStatus(message || 'Exigência inserida. Clique em PREPARAR E-MAIL para concluir assunto e Bcc.')
  }

  async function finalizeRequirement (token) {
    await sleep(320)
    if (token !== runToken) return

    if (!requirementConfirmed()) {
      await sleep(450)
      if (token !== runToken) return
    }

    if (!requirementConfirmed()) {
      setStatus('ATENÇÃO: o FAST MAIL não confirmou a cobrança de documentos no corpo do e-mail. Confira a resposta antes de prosseguir.')
      return
    }

    if (emailPrepared()) {
      const section = document.querySelector('#spfm-email-preparation')
      if (section) section.hidden = true
      setStatus('✓ EXIGÊNCIA INSERIDA • ASSUNTO E BCC PREPARADOS. Confira o e-mail antes de enviar.')
      return
    }

    const prepare = document.querySelector('#spfm-triagem')
    if (!prepare) {
      showManualPreparation('Exigência inserida, mas não localizei o controle de preparação do e-mail.')
      return
    }

    setStatus('✓ Exigência inserida. Preparando assunto e Bcc automaticamente…')
    prepare.click()
    await sleep(1100)
    if (token !== runToken) return

    if (emailPrepared()) {
      const section = document.querySelector('#spfm-email-preparation')
      if (section) section.hidden = true
      setStatus('✓ EXIGÊNCIA INSERIDA • ASSUNTO E BCC PREPARADOS. Confira o e-mail antes de enviar.')
      return
    }

    showManualPreparation('Exigência inserida. A preparação automática não terminou — clique em PREPARAR E-MAIL.')
  }

  document.addEventListener('click', (event) => {
    if (!event.target.closest?.('#spfm-insert-requirement')) return
    const token = ++runToken
    window.setTimeout(() => finalizeRequirement(token).catch(() => {
      showManualPreparation('Exigência inserida. Não consegui concluir a preparação automática — clique em PREPARAR E-MAIL.')
    }), 40)
  }, true)
})()
