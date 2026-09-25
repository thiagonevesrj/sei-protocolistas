/* eslint-env node */
'use strict'

const fs = require('fs')
const path = require('path')

const root = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, '..')
const errors = []

function readJson (relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'))
}

function readText (relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function expect (condition, message) {
  if (!condition) errors.push(message)
}

const manifest = readJson('manifest.json')
const source = readText('cs_modules/fast_mail/action-cue-v2.js')
const styles = readText('cs_modules/fast_mail/action-cue-v2.css')

const webmailEntry = (manifest.content_scripts || []).find((entry) =>
  (entry.matches || []).includes('https://venus2.detran.rj.gov.br/owa/*')
)

expect(Boolean(webmailEntry), 'FAST MAIL cue V2: entrada do Webmail ausente no manifest')
expect((webmailEntry?.js || []).includes('cs_modules/fast_mail/action-cue-v2.js'), 'FAST MAIL cue V2: JS não está carregado')
expect((webmailEntry?.css || []).includes('cs_modules/fast_mail/action-cue-v2.css'), 'FAST MAIL cue V2: CSS não está carregado')
expect(source.includes('spfm-v2-action-cue'), 'FAST MAIL cue V2: classe de destaque ausente')
expect(source.includes("#spfm-v2-orientation .spfm-v2-quick-button"), 'FAST MAIL cue V2: atalho da orientação não dispara o destaque')
expect(source.includes('#spfm-v2-variant'), 'FAST MAIL cue V2: escolha de variante não dispara o destaque')
expect(source.includes('scrollIntoView'), 'FAST MAIL cue V2: próxima ação deve ser trazida ao campo de visão')
expect(styles.includes('@keyframes spfm-v2-action-cue'), 'FAST MAIL cue V2: animação principal ausente')
expect(styles.includes('prefers-reduced-motion'), 'FAST MAIL cue V2: deve respeitar preferência de redução de movimento')

if (errors.length) {
  console.error('Falhas na validação do destaque de próxima ação do FAST MAIL V2:')
  errors.forEach((error) => console.error(`- ${error}`))
  process.exit(1)
}

console.log('Destaque de próxima ação do FAST MAIL V2 validado.')
