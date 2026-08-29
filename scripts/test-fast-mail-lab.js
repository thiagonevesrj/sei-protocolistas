/* eslint-env node */
'use strict'

const fs = require('fs')
const path = require('path')
const vm = require('vm')

const root = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, '..')
const errors = []

function expect (condition, message) {
  if (!condition) errors.push(message)
}

function read (relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

const labHtmlPath = 'tools/fast-mail-lab/index.html'
const labCssPath = 'tools/fast-mail-lab/lab.css'
const labJsPath = 'tools/fast-mail-lab/lab.js'
const popupPath = 'browser_action/index.html'

;[labHtmlPath, labCssPath, labJsPath].forEach((relativePath) => {
  expect(fs.existsSync(path.join(root, relativePath)), `FAST MAIL LAB: arquivo ausente: ${relativePath}`)
})

if (!errors.length) {
  const html = read(labHtmlPath)
  const labJs = read(labJsPath)
  const popup = read(popupPath)

  const labScriptIndex = html.indexOf('src="lab.js"')
  const mainScriptIndex = html.indexOf('src="../../cs_modules/fast_mail/index.js"')
  const navigationScriptIndex = html.indexOf('src="../../cs_modules/fast_mail/navigation-v2.js"')
  const actionStateScriptIndex = html.indexOf('src="../../cs_modules/fast_mail/action-state-v2.js"')

  expect(html.includes('../../cs_modules/fast_mail/styles.css'), 'FAST MAIL LAB: styles.css real do FAST MAIL não está carregado')
  expect(html.includes('../../cs_modules/fast_mail/navigation-v2.css'), 'FAST MAIL LAB: navigation-v2.css real não está carregado')
  expect(html.includes('../../cs_modules/fast_mail/action-state-v2.css'), 'FAST MAIL LAB: action-state-v2.css real não está carregado')
  expect(labScriptIndex >= 0 && mainScriptIndex > labScriptIndex, 'FAST MAIL LAB: mock deve carregar antes do motor principal')
  expect(navigationScriptIndex > mainScriptIndex, 'FAST MAIL LAB: navegação V2 deve carregar após o motor principal')
  expect(actionStateScriptIndex > navigationScriptIndex, 'FAST MAIL LAB: estados operacionais devem carregar após a navegação V2')

  expect(/globalThis\.browser\s*=/.test(labJs), 'FAST MAIL LAB: APIs da extensão não estão isoladas por mock')
  expect(/chrome\.runtime\.getURL/.test(labJs), 'FAST MAIL LAB: catálogos devem ser carregados dos mesmos arquivos da extensão')
  expect(/window\.open\s*=/.test(labJs), 'FAST MAIL LAB: abertura real do SEI deve ser interceptada')
  expect(/fastMailOperadorValidado/.test(labJs), 'FAST MAIL LAB: operador fictício não foi configurado')
  expect(/centralProtocolistaAtendimento/.test(labJs), 'FAST MAIL LAB: atendimento fictício não foi configurado')

  expect(popup.includes('../tools/fast-mail-lab/index.html?ae=Item&amp;a=Reply'), 'FAST MAIL LAB: acesso pelo popup da extensão não foi configurado')
  expect(/id="open-fast-mail-lab"[^>]*target="_blank"/.test(popup), 'FAST MAIL LAB: link deve abrir em nova aba')

  try {
    new vm.Script(labJs, { filename: labJsPath })
  } catch (error) {
    errors.push(`FAST MAIL LAB: lab.js possui erro de sintaxe: ${error.message}`)
  }
}

if (errors.length) {
  console.error('Falhas na validação do FAST MAIL LAB:')
  errors.forEach((error) => console.error(`- ${error}`))
  process.exit(1)
}

console.log('FAST MAIL LAB validado.')
