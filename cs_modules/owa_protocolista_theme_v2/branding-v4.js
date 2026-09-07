(() => {
  'use strict'

  if (window.top !== window) return
  if (/\/owa\/auth\/logon\.aspx/i.test(window.location.pathname)) return

  const api = typeof browser === 'undefined' ? chrome : browser
  const ROOT_ID = 'sp-owa-protocolista-theme-v2-root'
  const BRAND_ID = 'sp-owa-v4-branding'
  const HOTSPOT_ID = 'sp-owa-v4-snow-hotspot'
  const LOGO_PATH = 'icons/webmail-protocolistas-fast-mail.png'

  function cleanText (element) {
    return String(element?.innerText || element?.textContent || '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  function markNativeOutlookBrand () {
    Array.from(document.querySelectorAll('body *'))
      .filter((element) => cleanText(element) === 'Outlook Web App')
      .forEach((element) => element.classList.add('sp-owa-v4-native-outlook-brand'))
  }

  function toggleExistingMenu (event) {
    event.preventDefault()
    event.stopPropagation()

    const trigger = document.getElementById('sp-owa-v3-settings-trigger')
    if (!trigger) return
    trigger.click()
  }

  function prepareExistingThemeUi () {
    const root = document.getElementById(ROOT_ID)
    if (!root || !root.isConnected) return false

    root.querySelector('.sp-owa-v3-branding')?.classList.add('sp-owa-v4-superseded')
    root.querySelector('.sp-owa-v3-settings')?.classList.add('sp-owa-v4-menu-anchor')
    return true
  }

  function ensureBranding () {
    if (!document.body) return false
    if (!prepareExistingThemeUi()) return false

    let branding = document.getElementById(BRAND_ID)
    if (!branding) {
      branding = document.createElement('div')
      branding.id = BRAND_ID
      branding.className = 'sp-owa-v4-branding'
      branding.setAttribute('role', 'img')
      branding.setAttribute('aria-label', 'Webmail Protocolistas — Fast Mail')
      branding.innerHTML = `
        <span class="sp-owa-v4-logo" aria-hidden="true"></span>
        <button id="${HOTSPOT_ID}" type="button" aria-label="Opções do Webmail Protocolistas" aria-haspopup="menu"></button>`

      const logo = branding.querySelector('.sp-owa-v4-logo')
      if (logo) logo.style.backgroundImage = `url("${api.runtime.getURL(LOGO_PATH)}")`

      branding.querySelector(`#${HOTSPOT_ID}`)?.addEventListener('click', toggleExistingMenu)

      /*
       * Branding fora do header detectado da V3 e renderizado como background.
       * Isso evita regras legadas do OWA que recortam elementos <img>.
       */
      document.body.appendChild(branding)
    }

    markNativeOutlookBrand()
    return true
  }

  ;[0, 120, 300, 650, 1200, 2200, 3600].forEach((delay) => {
    window.setTimeout(ensureBranding, delay)
  })
})()
