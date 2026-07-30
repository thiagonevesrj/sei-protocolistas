/* global ModuleInit, autopreencherDocumentoExterno */
const BaseName = 'documento_receber'

ModuleInit(BaseName).then(async (options) => {
  if (options.CheckTypes.includes('cliquemenos')) {
    await autopreencherDocumentoExterno(BaseName)
  }
}).catch(e => console.log(e.message))
