/* eslint-env node */
'use strict'

const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const source = fs.readFileSync(
  path.join(root, 'cs_modules/clique_protocolista/next-click-guide.js'),
  'utf8'
)
const manifest = fs.readFileSync(
  path.join(root, 'manifest.json'),
  'utf8'
)

const errors = []
const expect = (condition, message) => {
  if (!condition) errors.push(message)
}

expect(
  source.includes("const STORAGE_KEY = 'cliqueProtocolistaRascunho'"),
  'FAST PROC próximo clique: deve observar o rascunho operacional existente'
)
expect(
  source.includes('flowFinished') &&
    source.includes('isPersonalInformationSelected()'),
  'FAST PROC próximo clique: SALVAR só pode ser liberado após fim do fluxo e hipótese legal válida'
)
expect(
  source.includes("saveButton.addEventListener('click', blockSave, true)"),
  'FAST PROC próximo clique: SALVAR deve ficar protegido enquanto a automação trabalha'
)
expect(
  source.includes("saveButton.removeEventListener('click', blockSave, true)"),
  'FAST PROC próximo clique: proteção deve ser removida quando o fluxo estiver pronto'
)
expect(
  source.includes('FAST PROC PRONTO — CLIQUE EM SALVAR'),
  'FAST PROC próximo clique: deve indicar explicitamente o próximo clique'
)
expect(
  source.includes("behavior: 'smooth'") &&
    source.includes('sp-fast-proc-save-ready'),
  'FAST PROC próximo clique: deve levar visualmente o operador ao SALVAR'
)
expect(
  !source.includes('saveButton.click()'),
  'FAST PROC próximo clique: nunca deve clicar em SALVAR automaticamente'
)

const mainIndex = manifest.indexOf('cs_modules/clique_protocolista/index.js')
const guideIndex = manifest.indexOf('cs_modules/clique_protocolista/next-click-guide.js')
expect(
  mainIndex >= 0 && guideIndex > mainIndex,
  'FAST PROC próximo clique: guia deve carregar depois do preenchimento principal'
)

if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}

console.log('FAST PROC próximo clique: OK')
