/* global seiVersionCompare */

// eslint-disable-next-line no-unused-vars
function AdicionarIdentificadorSeipp (BaseName) {
  /* Adiciona a identidade do SEI Protocolistas ao cabeçalho do SEI */
  const idLogo = seiVersionCompare('>=', '4.0.0.0') ? '#divInfraBarraSistemaPadraoE' : '#divInfraBarraSistemaE'
  if ($('#sei-protocolistas-brand').length) return

  $(idLogo).append(`
    <div id="sei-protocolistas-brand" title="SEI Protocolistas">
      <span class="sei-protocolistas-brand-name">SEI Protocolista<span class="sei-protocolistas-brand-final-s">S</span></span>
      <span class="sei-protocolistas-brand-signature">by Thiago Neves Design</span>
    </div>
  `)
}
