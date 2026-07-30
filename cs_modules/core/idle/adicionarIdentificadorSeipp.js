/* global currentBrowser, seiVersionCompare */

// eslint-disable-next-line no-unused-vars
function AdicionarIdentificadorSeipp (BaseName) {
  /* Adiciona a identidade do SEI Protocolistas ao cabeçalho do SEI */
  const idLogo = seiVersionCompare('>=', '4.0.0.0') ? '#divInfraBarraSistemaPadraoE' : '#divInfraBarraSistemaE'
  if ($('#sei-protocolistas-brand').length) return

  const wordmarkUrl = currentBrowser.runtime.getURL('icons/sei-protocolistas-wordmark.png')

  $(idLogo).append(`
    <div id="sei-protocolistas-brand" title="SEI Protocolistas">
      <span class="sei-protocolistas-brand-prefix">SEI</span>
      <img class="sei-protocolistas-brand-wordmark" src="${wordmarkUrl}" alt="Protocolistas">
      <span class="sei-protocolistas-brand-signature">by Thiago Neves Design</span>
    </div>
  `)
}
