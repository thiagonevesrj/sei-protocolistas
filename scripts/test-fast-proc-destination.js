'use strict'

const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const handoff = fs.readFileSync(path.join(root, 'cs_modules/fast_proc_handoff/index.js'), 'utf8')
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'data/catalogo-processos.json'), 'utf8'))

const failures = []
const assert = (condition, message) => {
  if (!condition) failures.push(message)
}

const transfer = (catalog.processTypes || []).find((item) => item.id === 'transferencia-prontuario-habilitacao')

assert(transfer, 'FAST PROC destino: Transferência de Prontuário deve existir no catálogo')
assert(transfer?.destinationUnit === 'NUCRA', 'FAST PROC destino: Transferência de Prontuário deve apontar para NUCRA')
assert(handoff.includes("const CONTEXT_KEY = 'cliqueProtocolistaContexto'"), 'FAST PROC destino: deve reutilizar o contexto persistido da abertura')
assert(handoff.includes("action() !== 'procedimento_trabalhar'"), 'FAST PROC destino: automação deve atuar na tela Enviar Processo')
assert(handoff.includes('context.destino || context.destination'), 'FAST PROC destino: unidade deve vir do destino salvo no contexto')
assert(handoff.includes('function findUnitsInput ()'), 'FAST PROC destino: deve localizar o campo Unidades')
assert(handoff.includes('function selectDestinationOption'), 'FAST PROC destino: deve selecionar a unidade encontrada')
assert(handoff.includes('Destino selecionado automaticamente:'), 'FAST PROC destino: deve avisar o operador antes do envio')
assert(handoff.includes('function findSendButton ()'), 'FAST PROC destino: deve localizar o botão Enviar para o próximo clique guiado')

if (failures.length) {
  console.error('Falhas na validação do destino automático do FAST PROC:')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('Destino automático do FAST PROC validado.')
