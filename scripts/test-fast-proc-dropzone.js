/* eslint-env node */
'use strict'

const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const source = fs.readFileSync(
  path.join(root, 'cs_modules/procedimento_visualizar/index.js'),
  'utf8'
)

const errors = []
const expect = (condition, message) => {
  if (!condition) errors.push(message)
}

expect(
  source.includes('dropzone.iniciar(BaseName)'),
  'FAST PROC: dropzone deve iniciar na visualização do processo'
)
expect(
  !source.includes("if (options.CheckTypes.includes('incluirdocaoarrastar')) dropzone.iniciar(BaseName)"),
  'FAST PROC: anexos por arraste não podem depender da configuração local antiga'
)
expect(
  source.includes('Chrome aplica o comportamento padrão e abre o PDF em nova aba'),
  'FAST PROC: regressão de drop deve permanecer documentada no ponto de inicialização'
)

if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}

console.log('FAST PROC dropzone: OK')
