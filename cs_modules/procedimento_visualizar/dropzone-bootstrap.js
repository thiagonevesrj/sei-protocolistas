/* global dropzone */
(() => {
  'use strict'

  /*
   * O upload por arraste faz parte do fluxo operacional do FAST PROC.
   * Ele precisa iniciar antes e independentemente dos demais recursos da
   * tela procedimento_visualizar. Se outro módulo falhar, o navegador não
   * pode assumir o drop e abrir o PDF em uma nova aba.
   *
   * O wrapper abaixo também torna dropzone.iniciar idempotente, pois o
   * index.js legado ainda pode tentar inicializá-lo novamente.
   */
  if (typeof dropzone === 'undefined' || typeof dropzone.iniciar !== 'function') {
    console.error('[SEI Protocolistas] Dropzone indisponível na árvore do processo.')
    return
  }

  const iniciarOriginal = dropzone.iniciar.bind(dropzone)
  let iniciado = false

  dropzone.iniciar = function (baseName) {
    if (iniciado) return
    iniciado = true
    document.documentElement.setAttribute('data-sei-protocolistas-dropzone', 'ready')
    iniciarOriginal(baseName)
  }

  dropzone.iniciar('procedimento_visualizar.DropzoneBootstrap')
})()
