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
const mergeDestinationsSource = source.match(/const mergeDestinations=[\s\S]*?\n};/)
assert.ok(mergeDestinationsSource, 'combinador de destinos não localizado')
vm.runInNewContext(mergeDestinationsSource[0].replace('const mergeDestinations=', 'globalThis.mergeDestinations='), context)

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
assert.strictEqual(
  context.mergeDestinations('DETRAN/DIVAF', ['DETRAN/DIRRV', 'DETRAN/DIVAF']),
  'DETRAN/DIVAF E DETRAN/DIRRV'
)
assert.ok(source.includes('pending.destinos'), 'o cartão deve usar os destinos desta tentativa de envio')

const selectedUnitsSource = source.match(/function selectedUnits\(\)\{[\s\S]*?\n\}/)
assert.ok(selectedUnitsSource, 'leitor de destinos selecionados não localizado')
const selected = { value: '1', textContent: 'DETRAN/DIVCA - Divisão de Comunicações Administrativas' }
const unselected = { value: '2', textContent: 'DETRAN/DIVAF' }
const selectedContext = {
  document: {
    querySelectorAll: () => [{ id: 'selUnidades', name: 'selUnidades', multiple: true, size: 2, options: [selected, unselected], selectedOptions: [selected] }]
  },
  norm: value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim(),
  units: value => context.mergeDestinations(value).split(' E ').filter(Boolean)
}
vm.runInNewContext(selectedUnitsSource[0].replace('function selectedUnits()', 'globalThis.selectedUnits = function selectedUnits()'), selectedContext)
assert.deepStrictEqual(
  Array.from(selectedContext.selectedUnits()),
  ['DETRAN/DIVCA'],
  'o cartão deve validar somente as unidades selecionadas, ignorando opções não selecionadas'
)
const confirmSource = source.match(/function confirmedSend\(pending,id,text,now=Date\.now\(\)\)\{[\s\S]*?\n\}/)
assert.ok(confirmSource, 'verificador do envio não localizado')
Object.assign(selectedContext, {
  action: () => 'procedimento_trabalhar',
  SEND_MAX_AGE: 600000,
  performance: { getEntriesByType: () => [{ type: 'navigate' }] },
  unitId: value => value.replace(/^DETRAN\//, ''),
  sameUnits: (left, right) => left.length === right.length && left.every(unit => right.some(value => value.replace(/^DETRAN\//, '') === unit.replace(/^DETRAN\//, ''))),
  messageUnits: value => context.destination(value).split(' E ').filter(Boolean)
})
vm.runInNewContext(confirmSource[0].replace('function confirmedSend(', 'globalThis.confirmedSend = function confirmedSend('), selectedContext)
const sendPending = { processId: '123', at: 100, leftSendFormAt: 150, before: ['DETRAN/SERVPROT'], beforeText: 'Processo aberto somente na unidade DETRAN/SERVPROT.', destinos: ['DETRAN/DIVCA'] }
assert.strictEqual(selectedContext.confirmedSend({ ...sendPending, leftSendFormAt: 0 }, '123', 'Processo aberto somente na unidade DETRAN/DIVCA.', 200), false, 'clique sem saída da tela de envio não confirma o envio')
assert.strictEqual(selectedContext.confirmedSend(sendPending, '123', 'Processo aberto somente na unidade DETRAN/SERVPROT.', 200), false, 'a unidade de origem não pode liberar o cartão')
assert.strictEqual(selectedContext.confirmedSend(sendPending, '123', 'Processo aberto somente na unidade DETRAN/DIVCA.', 200), true, 'a confirmação do SEI no destino após sair do envio libera o cartão')
const multiPending = { ...sendPending, destinos: ['DETRAN/DIVAF', 'DETRAN/NUCRA'] }
assert.strictEqual(selectedContext.confirmedSend(multiPending, '123', 'Processo aberto nas unidades DETRAN/DIVAF e DETRAN/NUCRA.', 200), true, 'a confirmação deve preservar e validar todos os destinos selecionados')
selectedContext.action = () => 'procedimento_enviar'
assert.strictEqual(selectedContext.confirmedSend(sendPending, '123', 'Processo aberto somente na unidade DETRAN/DIVCA.', 200), false)
selectedContext.action = () => 'procedimento_trabalhar'
selectedContext.performance.getEntriesByType = () => [{ type: 'back_forward' }]
assert.strictEqual(selectedContext.confirmedSend(sendPending, '123', 'Processo aberto somente na unidade DETRAN/DIVCA.', 200), false)
console.log('PROTOCOLO CLIENTE: quadro único, impressão por e-mail e múltiplos destinos verificados.')
