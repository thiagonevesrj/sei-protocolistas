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
assert(handoff.includes('FAST PROC — CARREGANDO SETOR DE DESTINO:'), 'FAST PROC destino: deve mostrar que está carregando o setor')
assert(handoff.includes('FAST PROC — LOCALIZANDO ${destination} NA LISTA DE UNIDADES…'), 'FAST PROC destino: deve informar a busca da unidade em tempo real')
assert(handoff.includes('✓ SETOR CARREGADO: ${destination} — CONFIRA E CLIQUE EM ENVIAR.'), 'FAST PROC destino: deve confirmar quando o setor estiver pronto')
assert(handoff.includes("box.setAttribute('aria-live', 'polite')"), 'FAST PROC destino: status operacional deve ser atualizado de forma acessível')
assert(handoff.includes('function findSendButton ()'), 'FAST PROC destino: deve localizar o botão Enviar para o próximo clique guiado')
assert(handoff.includes('[350, 800, 1400]'), 'FAST PROC destino: botão Enviar deve receber guia progressiva após o setor carregar')

if (failures.length) {
  console.error('Falhas na validação do destino automático do FAST PROC:')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('Destino automático do FAST PROC validado.')
