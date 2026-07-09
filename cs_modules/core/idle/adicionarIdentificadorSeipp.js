/* global seiVersionCompare, __mconsole, isChrome */

// eslint-disable-next-line no-unused-vars
function AdicionarIdentificadorSeipp (BaseName) {
  /** inicialização do módulo */
  const mconsole = new __mconsole(BaseName + '.AdicionarIdentificadorSeipp')

  /* Adiciona o identificador ++ no logo do SEI */
  const idLogo = seiVersionCompare('>=', '4.0.0.0') ? '#divInfraBarraSistemaPadraoE' : '#divInfraBarraSistemaE'
  $(idLogo).append('<div id="seipp">++</div>')

  if (!isChrome) {
    currentBrowser.storage.local.get('version').then(function (params) {
      if (params.version) {
        const version = parseInt(params.version)
        mconsole.log(version)
        if (version < 68) {
          $('#seipp').attr('title', 'Firefox ' + version + ' - Você está utilizando uma versão antiga do Firefox, não compativel com alguns recursos do SEI++')
            .css({ 'font-weight': 'bold', color: 'red', filter: 'none', 'background-color': 'black' })
        }
      }
    }, null)
  }
}
