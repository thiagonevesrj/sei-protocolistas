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
const categoryWithdrawal = (catalog.processTypes || []).find((item) => item.id === 'desistencia-categoria-primeira-habilitacao')
assert(categoryWithdrawal?.destinationUnit === 'SERVECH', 'FAST PROC destino: Desistência de Categoria deve sugerir SERVECH')
assert(fastMail.includes('return manualDestination || cleanValue(processType?.destinationUnit) || scriptDestination'), 'FAST PROC destino: alteração manual deve poder substituir o destino sugerido')
assert(fastMail.includes('updateDestinationField(true)'), 'FAST PROC destino: tipo de processo deve carregar inicialmente o destino oficial do catálogo')
assert(clique.includes('destino: initialData.destination'), 'FAST PROC destino: formulário deve receber o destino escolhido no FAST MAIL')
assert(clique.includes("const PROCESS_CATALOG_PATH = 'data/catalogo-processos.json'"), 'FAST PROC destino: abertura direta deve carregar a tabela de destinos')
assert(clique.includes('catalogDestinationForProcess'), 'FAST PROC destino: abertura direta deve consultar o destino pelo tipo selecionado')
assert(clique.includes("placeholder: 'Sugerida pela tabela; pode ser alterada'"), 'FAST PROC destino: sugestão deve permanecer editável')
assert(handoff.includes("const CONTEXT_KEY = 'cliqueProtocolistaContexto'"), 'FAST PROC destino: deve reutilizar o contexto persistido da abertura')
assert(handoff.includes("action() !== 'procedimento_enviar'"), 'FAST PROC destino: automação deve aguardar a tela Enviar Processo')
assert(handoff.includes("if (action() === 'procedimento_enviar')"), 'FAST PROC destino: preenchimento deve iniciar somente no formulário de envio')
assert(handoff.includes('else if (window.top === window)'), 'FAST PROC destino: continuação do FAST MAIL deve permanecer restrita ao frame principal')
assert(handoff.includes('context.destino || context.destination'), 'FAST PROC destino: unidade escolhida deve vir do contexto')
assert(handoff.includes('function findUnitsInput ()'), 'FAST PROC destino: deve localizar o campo Unidades')
assert(handoff.includes('function selectDestinationOption'), 'FAST PROC destino: deve selecionar a unidade encontrada')
assert(handoff.includes('FAST PROC — CARREGANDO SETOR DE DESTINO:'), 'FAST PROC destino: deve mostrar que está carregando o setor')
assert(handoff.includes('FAST PROC — LOCALIZANDO $' + '{destination} NA LISTA DE UNIDADES…'), 'FAST PROC destino: deve informar a busca da unidade em tempo real')
assert(handoff.includes('✓ SETOR CARREGADO: $' + '{destination} — VOCÊ PODE SUBSTITUIR OU ADICIONAR OUTRA UNIDADE.'), 'FAST PROC destino: deve confirmar o setor e permitir substituir ou adicionar outra unidade')
assert(handoff.includes("box.setAttribute('aria-live', 'polite')"), 'FAST PROC destino: status operacional deve ser atualizado de forma acessível')
assert(handoff.includes('function findSendButton ()'), 'FAST PROC destino: deve localizar o botão Enviar para o próximo clique guiado')
assert(handoff.includes('[350, 800, 1400]'), 'FAST PROC destino: botão Enviar deve receber guia progressiva após o setor carregar')

if (failures.length) {
  console.error('Falhas na validação do destino automático do FAST PROC:')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('Destino automático do FAST PROC validado.')
