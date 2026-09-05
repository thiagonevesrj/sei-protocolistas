(() => {
  'use strict'

  if (window.top !== window) return
  if (/\/owa\/auth\/logon\.aspx/i.test(window.location.pathname)) return

  // Compatibilidade: este arquivo permanece carregado pelo manifest, mas não
  // interfere mais no formato do compositor. O FAST MAIL agora resolve o
  // corpo do OWA de forma determinística em index.js, tanto em Texto simples
  // (#divBdy > #txtBdy) quanto em HTML (#divBdy > #ifBdy).
})()
