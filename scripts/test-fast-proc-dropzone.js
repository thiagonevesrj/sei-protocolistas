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

const dropInit = source.indexOf("dropzone.iniciar(BaseName + '.DropzoneBootstrap')")
const moduleInit = source.indexOf('ModuleInit(BaseName)')

expect(
  dropInit >= 0,
  'FAST PROC: dropzone operacional deve iniciar na visualização do processo'
)
expect(
  moduleInit >= 0 && dropInit < moduleInit,
  'FAST PROC: listeners de drag-and-drop devem iniciar antes do ModuleInit e dos demais módulos'
)
expect(
  !source.includes("if (options.CheckTypes.includes('incluirdocaoarrastar'))"),
  'FAST PROC: anexos por arraste não podem depender da configuração local antiga'
)
expect(
  source.includes("data-sei-protocolistas-dropzone', 'ready'"),
  'FAST PROC: inicialização do dropzone deve deixar marcador de diagnóstico'
)
expect(
  source.includes('sem preventDefault no drop, o navegador abre'),
  'FAST PROC: regressão de abertura do PDF deve permanecer documentada'
)

if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}

console.log('FAST PROC dropzone: OK')
