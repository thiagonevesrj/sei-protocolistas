/* global __mconsole */
function AtualizarAnotacaoNaArvore (BaseName) {
  /** inicialização do módulo ***************************************************/
  const mconsole = new __mconsole(BaseName + '.AtualizarAnotacaoNaArvore')

  $('#divInfraBarraComandosSuperior > button').click(function () {
    mconsole.log('Atualizando...')
    const contexts = [window.parent, window.top, window.opener].filter(Boolean)

    for (const context of contexts) {
      try {
        const treeFrame = context.document?.getElementById('ifrArvore')
        if (treeFrame?.contentWindow) {
          treeFrame.contentWindow.location.reload()
          return
        }
      } catch (error) {
        // O salvamento da anotação não deve falhar se a árvore estiver em outro contexto.
      }
    }

    mconsole.log('Árvore do processo indisponível para atualização automática.')
  })
}
