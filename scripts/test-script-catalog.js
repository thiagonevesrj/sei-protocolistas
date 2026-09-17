/* eslint-env node */
'use strict'

const assert = require('assert')
const catalog = require('../data/catalogo-scripts.json')

function normalize (value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function search (query, phase = '') {
  const terms = normalize(query).split(' ').filter(Boolean)
  return catalog.scripts.filter((script) => {
    if (!script.body) return false
    if (phase && script.phase !== phase) return false
    const haystack = normalize([script.title, script.group, script.body].join(' '))
    return terms.every((term) => haystack.includes(term))
  })
}

assert.strictEqual(catalog.scripts.length, 176)
assert.strictEqual(catalog.actionableScripts, 175)
assert.strictEqual(catalog.emptyCards.length, 1)

catalog.retiredDuplicateCards.forEach((cardId) => {
  assert.ok(!catalog.scripts.some((script) => script.source.cardId === cardId))
})

;[
  ['motor', 'orientacao'],
  ['troca motor', 'orientacao'],
  ['regularização chassi', 'orientacao'],
  ['ipva', ''],
  ['processo aberto', ''],
  ['habilitação', '']
].forEach(([query, phase]) => {
  assert.ok(search(query, phase).length > 0, `Busca sem resultado: ${query}`)
})

console.log('Catálogo de 176 scripts e buscas prioritárias validados.')
