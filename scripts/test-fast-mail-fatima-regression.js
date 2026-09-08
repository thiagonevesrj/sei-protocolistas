const fs = require('fs')
const path = require('path')
const vm = require('vm')

const root = path.resolve(__dirname, '..')
const fastMail = fs.readFileSync(path.join(root, 'cs_modules/fast_mail/index.js'), 'utf8')
const htmlGuard = fs.readFileSync(path.join(root, 'cs_modules/fast_mail/compose-html-guard-v1.js'), 'utf8')

const failures = []
const assert = (condition, message) => {
  if (!condition) failures.push(message)
}

function extractFunction (source, name) {
  const marker = `function ${name} (`
  const start = source.indexOf(marker)
  if (start < 0) return ''

  const open = source.indexOf('{', start)
  if (open < 0) return ''

  let depth = 0
  let quote = ''
  let escaped = false

  for (let index = open; index < source.length; index += 1) {
    const char = source[index]

    if (quote) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === quote) quote = ''
      continue
    }

    if (char === "'" || char === '"' || char === '`') {
      quote = char
      continue
    }

    if (char === '{') depth += 1
    if (char === '}') {
      depth -= 1
      if (depth === 0) return source.slice(start, index + 1)
    }
  }

  return ''
}

// Regressão Fátima Félix: uma exigência existente apenas no histórico NÃO pode
// ser interpretada como conteúdo da resposta atual.
const currentReplyFunction = extractFunction(fastMail, 'currentPlainTextReply')
assert(Boolean(currentReplyFunction), 'FAST MAIL/Fátima: deve existir recorte explícito da resposta atual em Texto simples')

if (currentReplyFunction) {
  const context = {
    HISTORY_SEPARATOR: '----- HISTÓRICO DE MENSAGENS ANTERIORES -----'
  }
  vm.createContext(context)
  vm.runInContext(`${currentReplyFunction}; this.currentPlainTextReply = currentPlainTextReply`, context)

  const separator = context.HISTORY_SEPARATOR
  const oldRequirement = 'Após a análise da documentação encaminhada, identificamos a necessidade do envio dos seguintes documentos.'

  assert(
    context.currentPlainTextReply(`\n\n${separator}\n\n${oldRequirement}`).trim() === '',
    'FAST MAIL/Fátima: conteúdo existente somente no histórico deve ser invisível à verificação de duplicidade'
  )

  assert(
    context.currentPlainTextReply(`${oldRequirement}\n\n${separator}\n\nMensagem anterior`).includes(oldRequirement),
    'FAST MAIL/Fátima: conteúdo realmente inserido na resposta atual deve continuar detectável'
  )
}

assert(
  fastMail.includes('currentPlainTextReply(editor.value)'),
  'FAST MAIL/Fátima: verificação de duplicidade em Texto simples deve usar somente a resposta atual'
)

// O OWA Premium não renderiza o seletor de formato como <select>. O controle
// oficial é um DropDownList customizado com id divCmbFrmt e itens oV=0 (HTML)
// / oV=1 (Texto simples). A automação deve reproduzir esse controle nativo.
assert(
  htmlGuard.includes("#divCmbFrmt"),
  'FAST MAIL/Fátima: conversão HTML deve localizar o combo nativo #divCmbFrmt do OWA'
)
assert(
  /\[oV=["']0["']\]/.test(htmlGuard) || /getAttribute\?\.\(["']oV["']\).*0/.test(htmlGuard),
  'FAST MAIL/Fátima: conversão HTML deve escolher o item nativo oV=0 (HTML)'
)
assert(
  !htmlGuard.includes('triggerSelectFormatChange'),
  'FAST MAIL/Fátima: não deve existir fallback que force <select> por value/input/change'
)
assert(
  !htmlGuard.includes('normalizeWhenPanelAppears'),
  'FAST MAIL/Fátima: HTML não deve ser forçado automaticamente quando o painel aparece'
)
assert(
  !htmlGuard.includes('lastPrepareAttempt'),
  'FAST MAIL/Fátima: não deve existir loop periódico de tentativas de conversão HTML'
)
assert(
  !/setTimeout\s*\(\s*\(\)\s*=>\s*ensureHtmlComposer/.test(htmlGuard),
  'FAST MAIL/Fátima: etapas intermediárias não podem disparar conversão HTML por timeout'
)

if (failures.length) {
  console.error('Falhas na regressão Fátima Félix do FAST MAIL:')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('Regressão Fátima Félix validada: histórico isolado e conversão HTML pelo combo nativo do OWA.')
