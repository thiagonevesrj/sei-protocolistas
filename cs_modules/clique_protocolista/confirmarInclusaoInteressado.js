(() => {
  'use strict'

  const CONFIRM_KEY = 'spFastProcConfirmarInclusaoInteressado'
  const NAME_KEY = 'spFastProcNomeInteressadoPendente'
  const RESULT_KEY = 'spFastProcResultadoConfirmacaoInteressado'
  const ARM_EVENT = 'sp-fast-proc-armar-inclusao-interessado'
  const MAX_AGE = 10 * 60 * 1000
  const nativeConfirm = window.confirm.bind(window)
  let armedAt = 0

  document.addEventListener(ARM_EVENT, () => {
    armedAt = Date.now()
  })

  function normalizeMessage (value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
  }

  function hasActiveFastProcConfirmation () {
    if (armedAt && Date.now() - armedAt <= MAX_AGE) {
      return true
    }

    try {
      const createdAt = Number(sessionStorage.getItem(CONFIRM_KEY))
      return Boolean(createdAt) && Date.now() - createdAt <= MAX_AGE
    } catch (error) {
      return false
    }
  }

  window.confirm = function (message) {
    const isInterestedConfirmation = normalizeMessage(message) ===
      'nome inexistente. deseja incluir?'

    if (isInterestedConfirmation && hasActiveFastProcConfirmation()) {
      armedAt = 0

      let name = ''
      try {
        name = String(sessionStorage.getItem(NAME_KEY) || '')
          .replace(/\s+/g, ' ')
          .trim()
        sessionStorage.removeItem(CONFIRM_KEY)
        sessionStorage.removeItem(NAME_KEY)
      } catch (error) {
        // A confirmação continua limitada à mensagem exata do interessado.
      }

      const accepted = nativeConfirm(
        `O SEI não localizou um cadastro existente${name ? ` para “${name}”` : ''}. ` +
        'Confira o nome e o CPF. Deseja confirmar a inclusão de um novo interessado?'
      )

      try {
        sessionStorage.setItem(RESULT_KEY, accepted ? 'accepted' : 'cancelled')
      } catch (error) {
        // O FAST PROC tratará a ausência de resposta como confirmação pendente.
      }

      return accepted
    }

    return nativeConfirm(message)
  }
})()

