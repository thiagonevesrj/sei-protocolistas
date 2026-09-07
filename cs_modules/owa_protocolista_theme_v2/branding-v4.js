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
    Array.from(document.querySelectorAll('a, span, div, td'))
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

  function ensureBranding () {
    const root = document.getElementById(ROOT_ID)
    if (!root || !root.isConnected) return false

    root.querySelector('.sp-owa-v3-branding')?.classList.add('sp-owa-v4-superseded')
    root.querySelector('.sp-owa-v3-settings')?.classList.add('sp-owa-v4-menu-anchor')

    let branding = document.getElementById(BRAND_ID)
    if (!branding) {
      branding = document.createElement('div')
      branding.id = BRAND_ID
      branding.className = 'sp-owa-v4-branding'
      branding.innerHTML = `
        <img class="sp-owa-v4-logo" alt="Webmail Protocolistas — Fast Mail">
        <button id="${HOTSPOT_ID}" type="button" aria-label="Opções do Webmail Protocolistas" aria-haspopup="menu"></button>`

      const image = branding.querySelector('.sp-owa-v4-logo')
      if (image) image.src = api.runtime.getURL(LOGO_PATH)

      branding.querySelector(`#${HOTSPOT_ID}`)?.addEventListener('click', toggleExistingMenu)
      root.appendChild(branding)
    }

    markNativeOutlookBrand()
    return true
  }

  ;[0, 180, 450, 900, 1600, 2800].forEach((delay) => {
    window.setTimeout(ensureBranding, delay)
  })
})()
