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
expect(source.includes('findNativeOrderControl'), 'Árvore Inteligente: ação nativa Ordenar Árvore do Processo não contemplada')
expect(source.includes('Ordenar Árvore do Processo'), 'Árvore Inteligente: fluxo deve depender da ação nativa do SEI')
expect(source.includes('findMoveControl'), 'Árvore Inteligente: controles nativos de mover acima/abaixo não tratados')
expect(source.includes('findSaveControl'), 'Árvore Inteligente: botão nativo Salvar não tratado')
expect(source.includes('clickNativeControl(save)'), 'Árvore Inteligente: confirmação nativa do SEI não acionada')
expect(source.includes('id_documento'), 'Árvore Inteligente: documento deve ser identificado pelo id_documento')
expect(source.includes('O SEI não disponibilizou'), 'Árvore Inteligente: fallback seguro deve informar ausência da ação nativa')
expect(!source.includes('Nome na Árvore'), 'Árvore Inteligente: renomeação na árvore deve permanecer desativada')
expect(css.includes('#sp-arvore-context-menu'), 'Árvore Inteligente: estilo do menu ausente')

if (errors.length) {
  console.error('Falhas na validação da Árvore Inteligente:')
  errors.forEach((error) => console.error(`- ${error}`))
  process.exit(1)
}

console.log('Árvore Inteligente validada.')
