/* global ModuleInit, AtualizarAnotacaoNaArvore */
const BaseName = 'anotacao_registrar'

ModuleInit(BaseName).then(() => {
  AtualizarAnotacaoNaArvore(BaseName)
}).catch(e => console.log(e.message))
