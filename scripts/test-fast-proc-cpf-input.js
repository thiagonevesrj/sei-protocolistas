/* eslint-env node */
'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const source = fs.readFileSync(
  path.join(__dirname, '../cs_modules/clique_protocolista/index.js'),
  'utf8'
)
const start = source.indexOf('  function bindCpfInput (')
const end = source.indexOf('\n  function processLookupUrl', start)
assert.ok(start >= 0 && end > start, 'A função de entrada do CPF deve existir')

const context = {}
vm.runInNewContext(
  `${source.slice(start, end)}\nthis.bindCpfInput = bindCpfInput`,
  context
)

function createField (value = '') {
  const listeners = {}
  return {
    value,
    selectionStart: value.length,
    inputMode: '',
    maxLength: 0,
    pattern: '',
    title: '',
    addEventListener (name, listener) { listeners[name] = listener },
    setSelectionRange (start, end) { this.selectionStart = start; this.selectionEnd = end },
    input () { listeners.input() }
  }
}

const pasted = createField('012.345.678-90')
context.bindCpfInput(pasted)
assert.strictEqual(pasted.value, '01234567890', 'A colagem deve manter os 11 dígitos e zeros iniciais')
assert.strictEqual(pasted.inputMode, 'numeric')
assert.strictEqual(pasted.maxLength, 20, 'Deve aceitar a colagem de CPF formatado antes de remover a pontuação')
assert.strictEqual(pasted.pattern, '[0-9]{11}')

pasted.value = '01a234-567.890999'
pasted.selectionStart = pasted.value.length
pasted.input()
assert.strictEqual(pasted.value, '01234567890', 'Letras, pontuação e dígitos excedentes devem ser removidos')

const leadingZero = createField('00123456789')
context.bindCpfInput(leadingZero)
assert.strictEqual(leadingZero.value, '00123456789', 'Zeros à esquerda devem ser preservados')

console.log('FAST PROC: CPF somente números, limitado a 11 dígitos e com zeros iniciais preservados.')

