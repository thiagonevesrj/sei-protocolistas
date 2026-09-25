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
assert.ok(source.includes("if(action()==='procedimento_enviar'){armFinalSend();insertCard()"), 'a tela de envio deve ser armada antes de procurar o cartão')
assert.ok(source.includes("const SEND_PENDING_KEY='seiProtocolistasEnvioProcessoPendente'"), 'o cartão deve controlar se o envio final foi solicitado')
assert.ok(source.includes('function armFinalSend()'), 'o clique no Enviar final deve armar a geração do cartão')
assert.ok(source.includes('function message(){if(!sendPending())return null;'), 'a mera abertura da tela de destinos não pode gerar cartão')
assert.ok(source.includes('(?:encaminhado|enviado).{0,140}(?:sucesso|'), 'somente uma confirmação real de envio deve gerar cartão')
assert.ok(source.includes('clearSendPending();'), 'o estado pendente deve ser limpo depois que o cartão for criado')

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
