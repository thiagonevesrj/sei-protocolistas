/* eslint-env node */
'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const root = path.resolve(__dirname, '..')
const source = fs.readFileSync(path.join(root, 'cs_modules/protocolo_cliente/index.js'), 'utf8')

assert.ok(source.includes('if(isTreeFrame())return;'), 'o cartão deve ser recusado no quadro da árvore')
assert.ok(source.includes('data-action="email"'), 'atendimento por e-mail deve manter o retorno ao OWA')
assert.ok(source.includes('data-action="print"'), 'atendimento por e-mail deve oferecer impressão do protocolo')
assert.ok(source.includes("'AS UNIDADES SELECIONADAS'"), 'múltiplos destinos devem manter o cartão mesmo sem texto reconhecível')

const destinationSource = source.match(/const destination=t=>\{[\s\S]*?\n\};/)
assert.ok(destinationSource, 'extrator de destinos não localizado')
const context = {}
vm.runInNewContext(destinationSource[0].replace('const destination=', 'globalThis.destination='), context)

assert.strictEqual(
  context.destination('Processo aberto somente na unidade DETRAN/DIVMED.'),
  'DETRAN/DIVMED'
)
assert.strictEqual(
  context.destination('Processo aberto nas unidades DETRAN/DIVMED e DETRAN/DIRRV.'),
  'DETRAN/DIVMED E DETRAN/DIRRV'
)
assert.strictEqual(
  context.destination('Processo encaminhado para as unidades: DIVAP, DIRRV'),
  'DIVAP E DIRRV'
)

console.log('PROTOCOLO CLIENTE: quadro único, impressão por e-mail e múltiplos destinos verificados.')
