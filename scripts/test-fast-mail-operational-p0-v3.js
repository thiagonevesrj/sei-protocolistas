/* eslint-env node */
'use strict'

const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const errors = []
const sourcePath = 'cs_modules/fast_mail/operational-p0-v3.js'
const source = fs.readFileSync(path.join(root, sourcePath), 'utf8')
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'))

function expect (condition, message) {
  if (!condition) errors.push(message)
}

try {
  // Valida apenas a sintaxe. O script não é executado no Node.
  // eslint-disable-next-line no-new-func
  new Function(source)
} catch (error) {
  errors.push(`FAST MAIL P0: erro de sintaxe: ${error.message}`)
}

const owaEntry = (manifest.content_scripts || []).find((entry) =>
  (entry.matches || []).includes('https://venus2.detran.rj.gov.br/owa/*')
)
const owaScripts = owaEntry?.js || []

expect(owaScripts.includes(sourcePath), 'FAST MAIL P0: camada operacional não carregada no OWA')
expect(owaScripts[owaScripts.length - 1] === sourcePath, 'FAST MAIL P0: camada operacional deve carregar por último')

// Identificação e serviço.
expect(source.includes('SOLICITAR IDENTIFICAÇÃO'), 'FAST MAIL P0: atalho de solicitar identificação ausente')
expect(source.includes('IDENTIFICAR SERVIÇO'), 'FAST MAIL P0: atalho de identificar serviço ausente')
expect(source.includes('IDENTIDADE NÃO CONFIRMADA'), 'FAST MAIL P0: estado de identidade pendente ausente')
expect(source.includes("cpf.length === 11"), 'FAST MAIL P0: nome e CPF não estão sendo exigidos para confirmar identidade')
expect(source.includes("document.querySelector('#spfm-insert-script')"), 'FAST MAIL P0: scripts rápidos não inserem a resposta em um clique')

// Assunto e operador.
expect(source.includes("String(now.getFullYear()).slice(-2)"), 'FAST MAIL P0: assunto não usa ano com dois dígitos')
expect(source.includes('DESTINO PENDENTE'), 'FAST MAIL P0: fallback para evitar UNDEFINED ausente')
expect(source.includes("const OPERATOR_KEY = 'fastMailOperadorValidado'"), 'FAST MAIL P0: número do protocolista não vem da identidade operacional')
expect(source.includes('setNativeFieldValue'), 'FAST MAIL P0: campos do OWA não usam atualização compatível com setter nativo')

// Baixa de restrição.
expect(source.includes("inventory.hidden = true"), 'FAST MAIL P0: Inventário ainda aparece como porta principal da Fase 1')
expect(source.includes("button.textContent = 'BAIXA DE RESTRIÇÃO'"), 'FAST MAIL P0: Baixa de Restrição não virou porta principal')
expect(source.includes('INVENTÁRIO — HERDEIROS'), 'FAST MAIL P0: ramificação de inventário para herdeiros ausente')
expect(source.includes('INVENTÁRIO — TERCEIROS'), 'FAST MAIL P0: ramificação de inventário para terceiros ausente')

// Inventário/herdeiros — somente presencial e documentos faltantes para o posto.
expect(source.includes('SOMENTE PRESENCIAL'), 'FAST MAIL P0: estado presencial não está explícito')
expect(source.includes('MARQUE O QUE ESTÁ FALTANDO'), 'FAST MAIL P0: checklist presencial de pendências ausente')
expect(source.includes('PREPARAR ORIENTAÇÃO PRESENCIAL'), 'FAST MAIL P0: ação de preparar orientação presencial ausente')
expect(source.includes('Não é possível abrir este processo administrativo por e-mail.'), 'FAST MAIL P0: fluxo presencial ainda pode sugerir abertura por e-mail')
expect(source.includes('DUDA 003-5'), 'FAST MAIL P0: condição do DUDA 003-5 para perda de CRV/Código não foi preservada')
expect(source.includes('Caso não possua o CRV original ou o Código de Segurança'), 'FAST MAIL P0: DUDA 003-5 não está condicionado à falta de CRV/Código')
expect(source.includes('originais dessas declarações ficam retidos no processo'), 'FAST MAIL P0: retenção das declarações dos herdeiros não foi informada')
expect(source.includes('agendamento-recursos-e-protocolo.html'), 'FAST MAIL P0: link de agendamento presencial ausente')
expect(source.includes('lista-de-ciretrans-sats.html'), 'FAST MAIL P0: orientação para demais municípios ausente')
expect(source.includes('data-sei-protocolistas="presential-missing-documents"'), 'FAST MAIL P0: resposta presencial não tem proteção contra inserção duplicada')

// Estabilidade da camada dinâmica.
expect(source.includes('scheduleReconcile'), 'FAST MAIL P0: MutationObserver não está conciliado por agendamento')
expect(source.includes('box.dataset.spfmP0State'), 'FAST MAIL P0: estado de identidade pode reescrever o DOM sem necessidade')

// Leilão — destino automático com tipologia SEI manual.
expect(source.includes("seiProcessName: ''"), 'FAST MAIL P0: tipologia manual do SEI não é preservada')
expect(source.includes("procedureName: ''"), 'FAST MAIL P0: nome do procedimento ainda pode selecionar tipologia indevida')
expect(source.includes('manualSeiTypeSelection: true'), 'FAST MAIL P0: handoff não sinaliza seleção manual de tipologia')

if (errors.length) {
  console.error('Falhas na validação operacional P0 do FAST MAIL:')
  errors.forEach((error) => console.error(`- ${error}`))
  process.exit(1)
}

console.log('FAST MAIL regras operacionais P0: OK')
