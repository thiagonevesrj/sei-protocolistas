'use strict'

const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const handoff = fs.readFileSync(path.join(root, 'cs_modules/fast_proc_handoff/index.js'), 'utf8')
const fastMail = fs.readFileSync(path.join(root, 'cs_modules/fast_mail/index.js'), 'utf8')
const clique = fs.readFileSync(path.join(root, 'cs_modules/clique_protocolista/index.js'), 'utf8')
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'data/catalogo-processos.json'), 'utf8'))

const failures = []
const assert = (condition, message) => {
  if (!condition) failures.push(message)
}

const transfer = (catalog.processTypes || []).find((item) => item.id === 'transferencia-prontuario-habilitacao')
const taxRefund = (catalog.processTypes || []).find((item) => item.id === 'devolucao-taxas')

assert(transfer, 'FAST PROC destino: Transferência de Prontuário deve existir no catálogo')
assert(transfer?.destinationUnit === 'NUCRA', 'FAST PROC destino: Transferência de Prontuário deve apontar para NUCRA')
assert(taxRefund, 'FAST PROC destino: Devolução de Taxas deve existir no catálogo')
assert(taxRefund?.destinationUnit === 'DIVAF', 'FAST PROC destino: Devolução de Taxas deve apontar para DIVAF')
assert(fastMail.includes('return cleanValue(processType?.destinationUnit) || manualDestination || scriptDestination'), 'FAST PROC destino: catálogo do tipo de processo deve prevalecer sobre texto manual')
assert(fastMail.includes('catalogDestination: cleanValue(processType.destinationUnit)'), 'FAST PROC destino: handoff deve registrar separadamente o destino oficial do catálogo')
assert(clique.includes('initialData.catalogDestination || initialData.destination'), 'FAST PROC destino: formulário deve preferir o destino oficial do catálogo')
assert(clique.includes('cleanValue(initialData.catalogDestination)'), 'FAST PROC destino: contexto deve preservar o destino oficial até a tela de envio')
assert(handoff.includes("const CONTEXT_KEY = 'cliqueProtocolistaContexto'"), 'FAST PROC destino: deve reutilizar o contexto persistido da abertura')
assert(handoff.includes("action() !== 'procedimento_enviar'"), 'FAST PROC destino: automação deve aguardar a tela Enviar Processo')
assert(handoff.includes("if (action() === 'procedimento_enviar')"), 'FAST PROC destino: preenchimento deve iniciar somente no formulário de envio')
assert(handoff.includes('else if (window.top === window)'), 'FAST PROC destino: continuação do FAST MAIL deve permanecer restrita ao frame principal')
assert(handoff.includes('context.catalogDestination || context.destino || context.destination'), 'FAST PROC destino: unidade oficial do catálogo deve prevalecer no contexto')
assert(handoff.includes('function findUnitsInput ()'), 'FAST PROC destino: deve localizar o campo Unidades')
assert(handoff.includes('function selectDestinationOption'), 'FAST PROC destino: deve selecionar a unidade encontrada')
assert(handoff.includes('FAST PROC — CARREGANDO SETOR DE DESTINO:'), 'FAST PROC destino: deve mostrar que está carregando o setor')
assert(handoff.includes('FAST PROC — LOCALIZANDO $' + '{destination} NA LISTA DE UNIDADES…'), 'FAST PROC destino: deve informar a busca da unidade em tempo real')
assert(handoff.includes('✓ SETOR CARREGADO: $' + '{destination} — CONFIRA E CLIQUE EM ENVIAR.'), 'FAST PROC destino: deve confirmar quando o setor estiver pronto')
assert(handoff.includes("box.setAttribute('aria-live', 'polite')"), 'FAST PROC destino: status operacional deve ser atualizado de forma acessível')
assert(handoff.includes('function findSendButton ()'), 'FAST PROC destino: deve localizar o botão Enviar para o próximo clique guiado')
assert(handoff.includes('[350, 800, 1400]'), 'FAST PROC destino: botão Enviar deve receber guia progressiva após o setor carregar')

if (failures.length) {
  console.error('Falhas na validação do destino automático do FAST PROC:')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('Destino automático do FAST PROC validado.')
