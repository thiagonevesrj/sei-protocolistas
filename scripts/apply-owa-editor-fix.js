'use strict'

const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const indexPath = path.join(root, 'cs_modules/fast_mail/index.js')
const baixaPath = path.join(root, 'cs_modules/fast_mail/baixa-restricao-direct-v1.js')
const manifestPath = path.join(root, 'manifest.json')
const packagePath = path.join(root, 'package.json')
const guardPath = path.join(root, 'cs_modules/fast_mail/compose-html-guard-v1.js')
const testPath = path.join(root, 'scripts/test-fast-mail-owa-editor.js')

function replaceOnce (source, pattern, replacement, label) {
  const matches = source.match(pattern)
  if (!matches) throw new Error(`Trecho não encontrado: ${label}`)
  return source.replace(pattern, replacement)
}

let source = fs.readFileSync(indexPath, 'utf8')

const deterministicEditor = `  function isPlainMessageBodyEditor (editor) {
    return editor?.tagName === 'TEXTAREA' && editor?.id === 'txtBdy'
  }

  function editorFrameElement (editor) {
    try {
      return editor?.ownerDocument?.defaultView?.frameElement || null
    } catch (_) {
      return null
    }
  }

  function assertValidMessageBodyEditor (editor) {
    if (!editor) throw new Error('Editor do corpo do e-mail não localizado.')

    const frame = editorFrameElement(editor)
    const boundaryTarget = frame || editor

    if (boundaryTarget.closest?.('#divHdrMessage')) {
      throw new Error('Editor inválido: cabeçalho do e-mail.')
    }

    if (isPlainMessageBodyEditor(editor)) {
      const container = editor.ownerDocument?.querySelector('#divBdy')
      if (!container?.contains(editor)) {
        throw new Error('Editor inválido: textarea fora da região do corpo do e-mail.')
      }
      return true
    }

    if (frame) {
      if (frame.id !== 'ifBdy' || !frame.closest?.('#divBdy')) {
        throw new Error('Editor inválido: iframe fora da região do corpo do e-mail.')
      }
      return true
    }

    if (!editor.closest?.('#divBdy')) {
      throw new Error('Editor inválido: elemento fora da região do corpo do e-mail.')
    }

    return true
  }

  function findMessageBodyEditor () {
    for (const doc of allDocuments()) {
      const bodyContainer = doc.querySelector('#divBdy')
      if (!bodyContainer || bodyContainer.closest?.('#divHdrMessage')) continue

      const plainBody = bodyContainer.querySelector('textarea#txtBdy')
      if (plainBody && isVisible(plainBody)) {
        assertValidMessageBodyEditor(plainBody)
        return plainBody
      }

      const htmlFrame = bodyContainer.querySelector('iframe#ifBdy')
      if (!htmlFrame || !isVisible(htmlFrame)) continue

      try {
        const htmlDocument = htmlFrame.contentDocument
        const htmlBody = htmlDocument?.body
        const editable = htmlDocument?.designMode?.toLowerCase() === 'on' ||
          htmlBody?.isContentEditable ||
          htmlBody?.getAttribute?.('contenteditable') === 'true'

        if (htmlBody && editable) {
          assertValidMessageBodyEditor(htmlBody)
          return htmlBody
        }
      } catch (_) {}
    }

    return null
  }

  function htmlToPlainText (html, doc) {
    const container = doc.createElement('div')
    container.innerHTML = String(html || '')

    container.querySelectorAll('a[href]').forEach((link) => {
      const href = String(link.getAttribute('href') || '').trim()
      const text = String(link.textContent || '').trim()
      const replacement = !href || text === href
        ? (text || href)
        : `${text} — ${href}`
      link.replaceWith(doc.createTextNode(replacement))
    })

    container.querySelectorAll('br').forEach((br) => {
      br.replaceWith(doc.createTextNode('\\n'))
    })

    container.querySelectorAll('li').forEach((item) => {
      item.insertBefore(doc.createTextNode('- '), item.firstChild)
      item.appendChild(doc.createTextNode('\\n'))
    })

    container.querySelectorAll('p,div,h1,h2,h3,h4,h5,h6,ul,ol').forEach((block) => {
      block.appendChild(doc.createTextNode('\\n'))
    })

    return String(container.textContent || '')
      .replace(/\\u00a0/g, ' ')
      .replace(/[ \\t]+\\n/g, '\\n')
      .replace(/\\n[ \\t]+/g, '\\n')
      .replace(/\\n{3,}/g, '\\n\\n')
      .trim()
  }

  function messageBodyContainsProtocolistaInsertion (editor, marker) {
    assertValidMessageBodyEditor(editor)
    if (isPlainMessageBodyEditor(editor)) {
      return String(editor.value || '').includes(HISTORY_SEPARATOR)
    }
    return Boolean(editor.querySelector?.(`[data-sei-protocolistas="${marker}"]`))
  }
`

source = replaceOnce(
  source,
  /  function findMessageBodyEditor \(\) \{[\s\S]*?\n  \}\n\n  function selectedMissingDocuments/,
  `${deterministicEditor}\n  function selectedMissingDocuments`,
  'findMessageBodyEditor'
)

const insertionCore = `  function insertRequirementIntoBody (editor, responseHtml) {
    if (messageBodyContainsProtocolistaInsertion(editor, 'missing-documents-requirement')) {
      throw new Error('A exigência já foi inserida nesta resposta.')
    }

    insertResponseBeforeHistory(editor, responseHtml)
  }

  function insertResponseBeforeHistory (editor, responseHtml) {
    assertValidMessageBodyEditor(editor)
    editor.focus()

    if (isPlainMessageBodyEditor(editor)) {
      const oldText = String(editor.value || '')
      const responseText = htmlToPlainText(responseHtml, editor.ownerDocument)
      const separator = `\\n\\n${HISTORY_SEPARATOR}\\n\\n`
      editor.value = `${responseText}${separator}${oldText}`
    } else {
      const oldHtml = editor.innerHTML || ''
      const separator = `<div data-sei-protocolistas="history-separator" style="margin:22px 0 14px 0;padding-top:10px;border-top:1px solid #a7a7a7;color:#666;font-family:Arial,sans-serif;font-size:11px;font-weight:bold;letter-spacing:.04em;">${HISTORY_SEPARATOR}</div>`
      editor.innerHTML = `${responseHtml}${separator}${oldHtml}`
    }

    editor.dispatchEvent(new Event('input', { bubbles: true }))
    editor.dispatchEvent(new Event('change', { bubbles: true }))
  }
`

source = replaceOnce(
  source,
  /  function insertRequirementIntoBody \(editor, responseHtml\) \{[\s\S]*?\n  \}\n\n  function renderMissingDocumentsOptions/,
  `${insertionCore}\n  function renderMissingDocumentsOptions`,
  'insertResponseBeforeHistory'
)

const processInsertion = `  function insertProcessCompletedResponse (editor, responseHtml) {
    if (messageBodyContainsProtocolistaInsertion(editor, 'process-completed-response')) {
      throw new Error('A resposta do processo já foi inserida neste e-mail.')
    }

    insertResponseBeforeHistory(editor, responseHtml)
  }
`

source = replaceOnce(
  source,
  /  function insertProcessCompletedResponse \(editor, responseHtml\) \{[\s\S]*?\n  \}\n\n  function shortDestinationForSubject/,
  `${processInsertion}\n  function shortDestinationForSubject`,
  'insertProcessCompletedResponse'
)

const bodyTextSetter = `  function setMessageBodyText (field, text) {
    assertValidMessageBodyEditor(field)
    field.focus()

    if (isPlainMessageBodyEditor(field)) field.value = text
    else field.textContent = text

    field.dispatchEvent(new Event('input', { bubbles: true }))
    field.dispatchEvent(new Event('change', { bubbles: true }))
    field.blur()
  }
`

source = replaceOnce(
  source,
  /  function setMessageBodyText \(field, text\) \{[\s\S]*?\n  \}\n\n  function feedbackReportText/,
  `${bodyTextSetter}\n  function feedbackReportText`,
  'setMessageBodyText'
)

source = source.replace(
  "if (editor.querySelector?.('[data-sei-protocolistas=\"catalog-script\"]')) {",
  "if (messageBodyContainsProtocolistaInsertion(editor, 'catalog-script')) {"
)
source = source.replace(
  "if (!editor.querySelector?.('[data-sei-protocolistas=\"process-completed-response\"]')) {",
  "if (!messageBodyContainsProtocolistaInsertion(editor, 'process-completed-response')) {"
)

if (!source.includes("bodyContainer.querySelector('textarea#txtBdy')")) {
  throw new Error('A correção determinística de #txtBdy não foi aplicada.')
}
if (!source.includes("bodyContainer.querySelector('iframe#ifBdy')")) {
  throw new Error('A correção determinística de #ifBdy não foi aplicada.')
}
if (!source.includes("boundaryTarget.closest?.('#divHdrMessage')")) {
  throw new Error('A trava de segurança do cabeçalho não foi aplicada.')
}
if (source.includes('const candidates = []\n\n    for (const doc of allDocuments()) {\n      const elements = Array.from(doc.querySelectorAll(\'[contenteditable="true"], body[contenteditable="true"]\'))')) {
  throw new Error('A heurística antiga de editor ainda está presente.')
}

fs.writeFileSync(indexPath, source)

let baixa = fs.readFileSync(baixaPath, 'utf8')
baixa = replaceOnce(
  baixa,
  /\n  function sleep \(ms\) \{[\s\S]*?\n  \}\n/,
  '\n',
  'sleep da Baixa'
)
baixa = replaceOnce(
  baixa,
  /\n  function findFormatSelect \(\) \{[\s\S]*?\n  \}\n\n  function removeLegacyBaixaState/,
  '\n  function removeLegacyBaixaState',
  'ensureHtmlComposer da Baixa'
)
baixa = replaceOnce(
  baixa,
  /    insert\?\.addEventListener\('click', async \(\) => \{[\s\S]*?\n    \}\)\n    cue\(insert\)/,
  `    insert?.addEventListener('click', () => {
      const nativeInsert = document.querySelector('#spfm-insert-script')
      if (!nativeInsert || nativeInsert.disabled) {
        setStatus('A resposta foi selecionada, mas o botão de inserção ainda não está disponível.')
        return
      }

      nativeInsert.click()
    })
    cue(insert)`,
  'inserção customizada da Baixa'
)

if (baixa.includes('ensureHtmlComposer')) throw new Error('A Baixa ainda força conversão para HTML.')
fs.writeFileSync(baixaPath, baixa)

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
manifest.content_scripts.forEach((entry) => {
  if (Array.isArray(entry.js)) {
    entry.js = entry.js.filter((item) => item !== 'cs_modules/fast_mail/compose-html-guard-v1.js')
  }
})
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

if (fs.existsSync(guardPath)) fs.unlinkSync(guardPath)

const testSource = `'use strict'\n\nconst fs = require('fs')\nconst path = require('path')\n\nconst root = path.resolve(__dirname, '..')\nconst index = fs.readFileSync(path.join(root, 'cs_modules/fast_mail/index.js'), 'utf8')\nconst baixa = fs.readFileSync(path.join(root, 'cs_modules/fast_mail/baixa-restricao-direct-v1.js'), 'utf8')\nconst manifest = fs.readFileSync(path.join(root, 'manifest.json'), 'utf8')\n\nconst start = index.indexOf('function findMessageBodyEditor ()')\nconst end = index.indexOf('function selectedMissingDocuments', start)\nconst editorBlock = index.slice(start, end)\n\nfunction assert (condition, message) {\n  if (!condition) throw new Error(message)\n}\n\nassert(start >= 0 && end > start, 'Não localizei o detector do corpo do OWA.')\nassert(editorBlock.includes("querySelector('#divBdy')"), 'Detector não está preso a #divBdy.')\nassert(editorBlock.includes("querySelector('textarea#txtBdy')"), 'Texto simples não usa #txtBdy.')\nassert(editorBlock.includes("querySelector('iframe#ifBdy')"), 'HTML não usa #ifBdy.')\nassert(index.includes("closest?.('#divHdrMessage')"), 'Cabeçalho do OWA não está bloqueado explicitamente.')\nassert(!editorBlock.includes('candidates.sort'), 'Detector voltou a usar score/heurística.')\nassert(!editorBlock.includes('area < 12000'), 'Detector voltou a usar área como heurística.')\nassert(index.includes('editor.value = `${responseText}${separator}${oldText}`'), 'Inserção em Texto simples não grava em .value.')\nassert(index.includes("messageBodyContainsProtocolistaInsertion(editor, 'catalog-script')"), 'Resposta padrão não usa a trava central.')\nassert(!baixa.includes('ensureHtmlComposer'), 'Baixa de Restrição ainda tenta forçar HTML.')\nassert(!manifest.includes('compose-html-guard-v1.js'), 'Manifesto ainda carrega o guard antigo.')\n\nconsole.log('FAST MAIL OWA editor: OK')\n`
fs.writeFileSync(testPath, testSource)

const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
if (!pkg.scripts.validate.includes('test-fast-mail-owa-editor.js')) {
  pkg.scripts.validate += ' && node scripts/test-fast-mail-owa-editor.js'
}
if (!pkg.scripts.lint.includes('scripts/test-fast-mail-owa-editor.js')) {
  pkg.scripts.lint += ' scripts/test-fast-mail-owa-editor.js'
}
fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`)

console.log('Correção determinística do editor OWA aplicada.')
