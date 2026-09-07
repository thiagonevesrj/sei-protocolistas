/* global ModuleInit, seiVersionCompare, EsperaCarregar, AjustarElementosNativos,
   ConsultarInteressado, consultarAtribuicao, copiarNumeroProcessoDocumento,
   copiarLinkInterno, documentoModelo, MostrarAnotacao, dropzone,
   AlterarTitulo, pontoControleCores
*/
const BaseName = 'procedimento_visualizar'

/*
 * O upload por arraste é parte do fluxo operacional do FAST PROC e precisa
 * registrar seus listeners antes de qualquer outro recurso desta tela.
 * Não pode depender de ModuleInit, preferências locais ou da execução bem-
 * sucedida dos demais módulos; sem preventDefault no drop, o navegador abre
 * o PDF diretamente em uma nova aba.
 */
try {
  dropzone.iniciar(BaseName + '.DropzoneBootstrap')
  document.documentElement.setAttribute('data-sei-protocolistas-dropzone', 'ready')
} catch (error) {
  console.error('[SEI Protocolistas] Falha ao iniciar anexos por arraste:', error)
}

// eslint-disable-next-line no-unused-vars
function ExecutarNaArvore (Modlog, func) {
  EsperaCarregar(Modlog, '#divArvore > div', "a[target$='Visualizacao']", function () {
    func()
    $('#divArvore > div > div:hidden').each(function () {
      const idPasta = $(this).attr('id').substr(3)
      Modlog.log(idPasta + ' -> evento click adicionado.')
      $('#ancjoin' + idPasta).click(function () {
        EsperaCarregar(Modlog, '#div' + idPasta, "a[target$='Visualizacao']", func)
        $(this).off('click')
      })
    })
  })
}

ModuleInit(BaseName).then((options) => {
  /* Ajusta o design de alguns elementos nativos do SEI */
  AjustarElementosNativos()

  /* Mostra o tipo do processo e interessados */
  if (options.CheckTypes.includes('exibeinfointeressado')) ConsultarInteressado(BaseName)

  /* Mostra a quem o processo está atribuído */
  if (options.exibeinfoatribuicao) consultarAtribuicao(BaseName)

  /* Mostra botão de copiar o número do processo ou do documento ao lado de cada documento e do processo */
  if (options.CheckTypes.includes('copiarnumeroprocessodocumento')) {
    if (seiVersionCompare('<', '4')) {
      copiarNumeroProcessoDocumento(BaseName)
    }
  }

  /* Mostra botão de copiar o link interno do processo ou de cada documento sem hash */
  if (options.CheckTypes.includes('copiarlinkinterno')) {
    if (seiVersionCompare('<', '4')) {
      copiarLinkInterno(BaseName)
    }
  }
  /* Mostra o botão de 'usar documento como modelo' */
  if (options.usardocumentocomomodelo) documentoModelo(BaseName)

  /* Mostra a anotação */
  if (options.CheckTypes.includes('mostraranotacao')) MostrarAnotacao(BaseName)

  /*
   * A função herdada que abria documentos em nova aba com Ctrl foi desativada.
   * Ela injetava JavaScript inline na página e passou a ser bloqueada pela
   * política de segurança (CSP) do SEI-RJ.
   */

  options.CheckTypes.forEach(function (e) {
    switch (e) {
      case 'alterar_titulo':
        /* Atualiza o título da janela/aba com os dados do processo  */
        AlterarTitulo(BaseName)
        break
      case 'ponto_controle_cores':
        pontoControleCores(BaseName)
        break
      default:
        break
    }
  })
}).catch(e => console.log(e.message))
