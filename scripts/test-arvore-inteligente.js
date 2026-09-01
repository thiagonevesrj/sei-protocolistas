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
const source = readText('cs_modules/procedimento_visualizar/arvore-inteligente.js')
const css = readText('cs_modules/procedimento_visualizar/arvore-inteligente.css')

const entry = (manifest.content_scripts || []).find((item) =>
  (item.matches || []).includes('*://sei.rj.gov.br/*controlador.php?acao=procedimento_visualizar*')
)

expect(Boolean(entry), 'Árvore Inteligente: entrada procedimento_visualizar ausente no manifest')
expect((entry?.js || []).includes('cs_modules/procedimento_visualizar/arvore-inteligente.js'), 'Árvore Inteligente: JS não carregado no manifest')
expect((entry?.css || []).includes('cs_modules/procedimento_visualizar/arvore-inteligente.css'), 'Árvore Inteligente: CSS não carregado no manifest')
expect(source.includes("document.addEventListener('contextmenu'"), 'Árvore Inteligente: menu de contexto não registrado')
expect(source.includes('documento_(?:alterar|alterar_recebido)'), 'Árvore Inteligente: ações nativas de alteração do SEI não contempladas')
expect(source.includes('Nome na Árvore'), 'Árvore Inteligente: campo Nome na Árvore não tratado')
expect(source.includes('saveControl.click()'), 'Árvore Inteligente: confirmação nativa do SEI não acionada')
expect(source.includes('id_documento'), 'Árvore Inteligente: documento deve ser identificado pelo id_documento')
expect(source.includes('Nada foi alterado') || source.includes('Nada foi enviado'), 'Árvore Inteligente: fallback seguro deve informar ausência de alteração')
expect(css.includes('#sp-arvore-context-menu'), 'Árvore Inteligente: estilo do menu ausente')
expect(css.includes('#sp-arvore-rename-dialog'), 'Árvore Inteligente: estilo do diálogo ausente')

if (errors.length) {
  console.error('Falhas na validação da Árvore Inteligente:')
  errors.forEach((error) => console.error(`- ${error}`))
  process.exit(1)
}

console.log('Árvore Inteligente validada.')
