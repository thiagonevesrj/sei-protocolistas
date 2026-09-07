const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'))
const continuity = fs.readFileSync(path.join(root, 'cs_modules/fast_mail/service-continuity-v1.js'), 'utf8')

const failures = []
const assert = (condition, message) => {
  if (!condition) failures.push(message)
}

const owaEntry = manifest.content_scripts.find((entry) =>
  Array.isArray(entry.matches) && entry.matches.includes('https://venus2.detran.rj.gov.br/owa/*')
)
const scripts = owaEntry?.js || []
const continuityIndex = scripts.indexOf('cs_modules/fast_mail/service-continuity-v1.js')
const workflowIndex = scripts.indexOf('cs_modules/fast_mail/workflow-v3.js')

assert(continuityIndex >= 0, 'FAST MAIL: camada de continuidade deve estar carregada no OWA')
assert(continuityIndex < workflowIndex, 'FAST MAIL: continuidade deve observar o fluxo antes da montagem V3 sem quebrar a ordem protegida')
assert(continuity.includes("label === 'devolucao de taxas'"), 'FAST MAIL: Devolução de Taxas deve ter continuidade dedicada')
assert(continuity.includes("option.value === 'pessoa-fisica'"), 'FAST MAIL: Pessoa Física deve ser o padrão de Devolução de Taxas')
assert(continuity.includes('selectPersonFisicaDefault'), 'FAST MAIL: padrão de Pessoa Física deve ser aplicado automaticamente')
assert(continuity.includes("label === 'pericia medica'"), 'FAST MAIL: Perícia Médica deve ter continuidade dedicada')
assert(continuity.includes('exposePericiaCase'), 'FAST MAIL: Perícia Médica deve expor QUAL É O CASO?')
assert(continuity.includes("#spfm-v2-variant-field"), 'FAST MAIL: seletor de variante deve ser trazido para o fluxo visível')
assert(continuity.includes("#spfm-action-step button:not([disabled])"), 'FAST MAIL: após definir o caso, próxima ação deve ser guiada')

if (failures.length) {
  console.error('Falhas na continuidade de serviços do FAST MAIL:')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('Continuidade de Devolução de Taxas e Perícia Médica validada.')
