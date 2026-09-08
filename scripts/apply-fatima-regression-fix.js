const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const indexPath = path.join(root, 'cs_modules/fast_mail/index.js')
const guardPath = path.join(root, 'cs_modules/fast_mail/compose-html-guard-v1.js')
const workflowPath = path.join(root, '.github/workflows/apply-fatima-regression-fix.yml')

function replaceRange (source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker)
  if (start < 0) throw new Error(`${label}: marcador inicial não encontrado`)
  const end = source.indexOf(endMarker, start)
  if (end < 0) throw new Error(`${label}: marcador final não encontrado`)
  return source.slice(0, start) + replacement + source.slice(end)
}

let fastMail = fs.readFileSync(indexPath, 'utf8')
let htmlGuard = fs.readFileSync(guardPath, 'utf8')

fastMail = replaceRange(
  fastMail,
  '  function messageBodyContainsResponse (editor, selector, responseHtml) {',
  '  function selectedMissingDocuments () {',
  `  function currentPlainTextReply (value) {
    const text = String(value || '').replace(/\\r\\n/g, '\\n')
    const historyIndex = text.indexOf(HISTORY_SEPARATOR)
    return historyIndex >= 0 ? text.slice(0, historyIndex) : text
  }

  function messageBodyContainsResponse (editor, selector, responseHtml) {
    assertSafeMessageBodyEditor(editor)

    if (!isPlainTextMessageBody(editor)) {
      return Boolean(editor.querySelector?.(selector))
    }

    const responseText = htmlToPlainText(responseHtml, editor.ownerDocument)
    const probe = responseText
      .split(/\\n+/)
      .map(cleanValue)
      .find((line) => line.length >= 24) || cleanValue(responseText).slice(0, 80)
    const currentReply = currentPlainTextReply(editor.value)

    return Boolean(probe && currentReply.includes(probe))
  }

`,
  'index.js / duplicidade Fátima'
)

htmlGuard = htmlGuard.replace('  let lastPrepareAttempt = 0\n', '')

htmlGuard = replaceRange(
  htmlGuard,
  '  function formatSelect () {',
  '  function deterministicPlainTextEditor () {',
  `  function owaFormatCombo () {
    for (const doc of allDocuments()) {
      const combo = doc.querySelector('#divCmbFrmt')
      if (combo && visible(combo) && !insideFastMail(combo) && !combo.closest?.('#divBdy')) {
        return combo
      }
    }
    return null
  }

  function owaFormatValue (combo) {
    return clean(combo?.getAttribute?.('oV') || combo?.getAttribute?.('ov'))
  }

  function owaHtmlListItem (combo) {
    if (!combo) return null
    return combo.querySelector('#divCmbList [oV="0"], #divCmbList [ov="0"]') ||
      Array.from(combo.querySelectorAll('#divCmbList [oV], #divCmbList [ov]'))
        .find((item) => clean(item.getAttribute('oV') || item.getAttribute('ov')) === '0') ||
      null
  }

`,
  'compose-html-guard / controle de formato OWA'
)

htmlGuard = replaceRange(
  htmlGuard,
  '  function nativeControlClickTargets (control) {',
  '  async function ensureHtmlComposer () {',
  `  async function triggerOwaNativeHtml () {
    const combo = await waitFor(owaFormatCombo, 1800, 80)
    if (!combo) return null

    if (owaFormatValue(combo) === '0') {
      return await waitFor(deterministicHtmlEditor, 2200, 80)
    }

    const opener = combo.querySelector('#divCmbDd') || combo.querySelector('#spanCmbSel') || combo
    nativeClick(opener)

    const htmlOption = await waitFor(() => {
      const option = owaHtmlListItem(combo)
      return option && visible(option) ? option : null
    }, 1200, 50)

    if (!htmlOption) return null

    nativeClick(htmlOption)
    return await waitFor(deterministicHtmlEditor, 5200, 90)
  }

`,
  'compose-html-guard / clique nativo OWA'
)

htmlGuard = replaceRange(
  htmlGuard,
  '  async function ensureHtmlComposer () {',
  '  function isInsertionControl (target) {',
  `  async function ensureHtmlComposer () {
    if (preparing) return preparing

    preparing = (async () => {
      const existingEditor = deterministicHtmlEditor()
      if (existingEditor) return true
      if (!deterministicPlainTextEditor()) return false

      setStatus('FAST MAIL — preparando e-mail formatado…')
      const editor = await triggerOwaNativeHtml()

      if (editor) {
        setStatus('FAST MAIL — e-mail formatado pronto.')
        return true
      }

      return false
    })()

    try {
      return await preparing
    } finally {
      preparing = null
    }
  }

`,
  'compose-html-guard / preparação única'
)

htmlGuard = replaceRange(
  htmlGuard,
  '  async function normalizeWhenPanelAppears () {',
  '})()',
  `  document.addEventListener('click', async (event) => {
    const control = isInsertionControl(event.target)
    if (!control) return

    if (bypass.has(control)) {
      bypass.delete(control)
      return
    }

    if (deterministicHtmlEditor()) return
    if (!deterministicPlainTextEditor()) return

    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()

    const ready = await ensureHtmlComposer()
    if (!ready) {
      setStatus('HTML não foi ativado pelo OWA. Inserindo em Texto simples para não bloquear o atendimento.')
    }

    bypass.add(control)
    control.click()
  }, true)

  const observer = new MutationObserver(() => {
    if (scheduled) return
    scheduled = true
    window.setTimeout(() => {
      scheduled = false
      formatPendingResponses()
    }, 120)
  })

  observer.observe(document.documentElement, { childList: true, subtree: true })
  window.setTimeout(formatPendingResponses, 400)
`,
  'compose-html-guard / remoção de gatilhos automáticos'
)

fs.writeFileSync(indexPath, fastMail)
fs.writeFileSync(guardPath, htmlGuard)

// Este aplicador é deliberadamente descartável: a correção final não deve
// carregar ferramenta de migração nem workflow temporário.
try { fs.unlinkSync(workflowPath) } catch (_) {}
try { fs.unlinkSync(__filename) } catch (_) {}

console.log('Correção Fátima Félix aplicada de forma determinística.')
