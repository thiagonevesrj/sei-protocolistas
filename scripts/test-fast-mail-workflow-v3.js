const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'))
const workflow = fs.readFileSync(path.join(root, 'cs_modules/fast_mail/workflow-v3.js'), 'utf8')
const bridge = fs.readFileSync(path.join(root, 'cs_modules/fast_mail/workflow-v3-bridge.js'), 'utf8')

const failures = []
const assert = (condition, message) => {
  if (!condition) failures.push(message)
}

const owaEntry = manifest.content_scripts.find((entry) =>
  Array.isArray(entry.matches) && entry.matches.includes('https://venus2.detran.rj.gov.br/owa/*')
)
const scripts = owaEntry?.js || []
const workflowIndex = scripts.indexOf('cs_modules/fast_mail/workflow-v3.js')
const bridgeIndex = scripts.indexOf('cs_modules/fast_mail/workflow-v3-bridge.js')
const p0Index = scripts.indexOf('cs_modules/fast_mail/operational-p0-v3.js')
const cleanupIndex = scripts.indexOf('cs_modules/fast_mail/identity-shortcut-cleanup-v1.js')

assert(workflowIndex >= 0, 'FAST MAIL V3: workflow-v3.js deve estar carregado no OWA')
assert(bridgeIndex === workflowIndex + 1, 'FAST MAIL V3: a ponte deve carregar imediatamente após workflow-v3.js')
assert(p0Index === bridgeIndex + 1, 'FAST MAIL V3: operational-p0-v3.js deve carregar após a ponte')
assert(cleanupIndex === p0Index + 1, 'FAST MAIL V3: limpeza visual deve continuar imediatamente após a camada operacional')

;['identificacao', 'orientacao', 'exigencias'].forEach((stage) => {
  assert(workflow.includes(`data-spfm-workflow-stage="${stage}"`), `FAST MAIL V3: etapa ${stage} deve existir`)
})

assert(bridge.includes("const TRANSFER_PROCESS_ID = 'transferencia-prontuario-habilitacao'"), 'FAST MAIL V3: Transferência de Prontuário deve estar protegida como atalho principal')
assert(bridge.includes("button.textContent = 'Transferência de Prontuário'"), 'FAST MAIL V3: botão de Transferência de Prontuário deve ser criado')
assert(bridge.includes("document.querySelector('#spfm-p0-baixa-chooser')"), 'FAST MAIL V3: escolha de Baixa de Restrição deve ser trazida para a área visível')
assert(bridge.includes("document.querySelector('#spfm-v2-variant-field')"), 'FAST MAIL V3: variantes de atendimento devem ser trazidas para a área visível')
assert(bridge.includes("document.querySelector('#spfm-v2-special-actions')"), 'FAST MAIL V3: ações especiais devem ser trazidas para a área visível')
assert(bridge.includes("document.querySelector('#spfm-p0-presential-panel')"), 'FAST MAIL V3: painel presencial deve ser trazido para a área visível')

if (failures.length) {
  console.error('Falhas na validação do fluxo V3 do FAST MAIL:')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('Fluxo por etapas do FAST MAIL V3 validado.')
