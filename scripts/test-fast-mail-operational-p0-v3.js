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
expect(source.includes('SOLICITAR IDENTIFICAÇÃO'), 'FAST MAIL P0: atalho de solicitar identificação ausente')
expect(source.includes('IDENTIFICAR SERVIÇO'), 'FAST MAIL P0: atalho de identificar serviço ausente')
expect(source.includes('IDENTIDADE NÃO CONFIRMADA'), 'FAST MAIL P0: estado de identidade pendente ausente')
expect(source.includes("cpf.length === 11"), 'FAST MAIL P0: nome e CPF não estão sendo exigidos para confirmar identidade')
expect(source.includes("inventory.hidden = true"), 'FAST MAIL P0: Inventário ainda aparece como porta principal da Fase 1')
expect(source.includes("button.textContent = 'BAIXA DE RESTRIÇÃO'"), 'FAST MAIL P0: Baixa de Restrição não virou porta principal')
expect(source.includes('INVENTÁRIO — HERDEIROS'), 'FAST MAIL P0: ramificação de inventário para herdeiros ausente')
expect(source.includes('INVENTÁRIO — TERCEIROS'), 'FAST MAIL P0: ramificação de inventário para terceiros ausente')
expect(source.includes("String(now.getFullYear()).slice(-2)"), 'FAST MAIL P0: assunto não usa ano com dois dígitos')
expect(source.includes('DESTINO PENDENTE'), 'FAST MAIL P0: fallback para evitar UNDEFINED ausente')
expect(source.includes("seiProcessName: ''"), 'FAST MAIL P0: tipologia manual do SEI não é preservada')
expect(source.includes("procedureName: ''"), 'FAST MAIL P0: nome do procedimento ainda pode selecionar tipologia indevida')
expect(source.includes('manualSeiTypeSelection: true'), 'FAST MAIL P0: handoff não sinaliza seleção manual de tipologia')
expect(source.includes("document.querySelector('#spfm-insert-script')"), 'FAST MAIL P0: scripts rápidos não inserem a resposta em um clique')

if (errors.length) {
  console.error('Falhas na validação operacional P0 do FAST MAIL:')
  errors.forEach((error) => console.error(`- ${error}`))
  process.exit(1)
}

console.log('FAST MAIL regras operacionais P0: OK')
