/* eslint-env node */
'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const root = path.resolve(__dirname, '..')
const source = fs.readFileSync(path.join(root, 'cs_modules/clique_protocolista/external-access.js'), 'utf8')
const values = new Map()
const context = {
  URL,
  sessionStorage: {
    getItem: key => values.get(key) || null,
    setItem: (key, value) => values.set(key, value)
  },
  location: new URL('https://sei.rj.gov.br/controlador.php?acao=procedimento_trabalhar&id_procedimento=123&acao_origem=procedimento_gerar'),
  document: { referrer: '' }
}
context.window = context
context.top = context
vm.runInNewContext(source.replace('  if (readPending()) {', '  globalThis.api = { readPending, pageContext, bindProcess, fillFields, fieldByLabel, showStatus, fillSavedPassword, reconcile, findAccessLink };\n  if (readPending()) {'), context)
const { api } = context
const pending = { name: 'REQUERENTE TESTE', email: 'teste@example.org', createdAt: Date.now(), processId: '' }
assert.strictEqual(api.readPending(), null)
assert.strictEqual(api.bindProcess(pending, { processId: '999', fromCreation: false }), false)
assert.strictEqual(api.bindProcess(pending, api.pageContext()), true)
assert.strictEqual(pending.processId, '123')
assert.strictEqual(api.bindProcess(pending, { processId: '999', fromCreation: true }), false)
assert.strictEqual(api.bindProcess(pending, { processId: '' }), false)
const key = 'spFastProcExternalAccess'
assert.strictEqual(api.readPending().email, pending.email)
values.set(key, JSON.stringify({ ...pending, createdAt: Date.now() - 16 * 60 * 1000 }))
assert.strictEqual(api.readPending(), null)
values.set(key, JSON.stringify({ ...pending, email: '' }))
assert.strictEqual(api.readPending(), null)
context.top = { location: new URL('https://sei.rj.gov.br/controlador.php?id_procedimento=999') }
assert.strictEqual(api.pageContext(), null)
context.top = context

const events = []
class Input {
  constructor () { this.value = ''; this.tagName = 'INPUT'; this.ownerDocument = { defaultView: view } }
  dispatchEvent (event) { events.push(event.type) }
}
const view = { HTMLInputElement: Input, HTMLSelectElement: Input, HTMLTextAreaElement: Input, Event: class { constructor (type) { this.type = type } } }
const fields = Object.fromEntries(['sender', 'name', 'email', 'reason', 'days'].map(key => [key, new Input()]))
fields.sender.tagName = 'SELECT'
fields.sender.options = [{ value: '', textContent: 'Selecione' }, { value: 'first', textContent: 'Primeira <unidade@example.org>' }, { value: 'second', textContent: 'Outra <outra@example.org>' }]
fields.integral = { checked: false, click () { this.checked = true } }
assert.strictEqual(api.fillFields({ ...fields, reason: null }, pending), false)
assert.strictEqual(events.length, 0, 'Campos incompletos não devem provocar preenchimento parcial')
fields.name.value = 'OUTRA PESSOA'
assert.strictEqual(api.fillFields(fields, pending), false)
assert.strictEqual(events.length, 0)
fields.name.value = ''
assert.strictEqual(api.fillFields(fields, pending), true)
assert.strictEqual(fields.sender.value, 'first')
assert.strictEqual(fields.name.value, pending.name)
assert.strictEqual(fields.email.value, pending.email)
assert.strictEqual(fields.reason.value, 'Vistas ao processo')
assert.strictEqual(fields.days.value, '365')
assert.strictEqual(fields.integral.checked, true)
assert.strictEqual(events.length, 10)
fields.days.readOnly = true
assert.strictEqual(api.fillFields(fields, pending), false)

// O mesmo quadro muda de espera para pronto e pode ser recolhido sem cobrir o SEI.
let box
function element () {
  return { style: {}, setAttribute () {}, children: [], append (...items) { this.children.push(...items) }, addEventListener (name, callback) { this.listener = callback }, querySelector () { return this.children[0] } }
}
context.document.getElementById = () => box
context.document.createElement = element
const anchor = { insertAdjacentElement (position, value) { assert.strictEqual(position, 'afterend'); box = value } }
api.showStatus(anchor, 'Aguarde')
assert.strictEqual(box.style.backgroundColor, '#fff4ce')
api.showStatus(anchor, 'Dados preenchidos', true)
assert.strictEqual(box.children[0].textContent, 'Dados preenchidos')
assert.strictEqual(box.style.backgroundColor, '#e6f4ea')
assert.strictEqual(box.children.length, 2)
box.children[1].listener()
assert.strictEqual(box.children[0].hidden, true)
box.children[1].listener()
assert.strictEqual(box.children[0].hidden, false)

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json')))
assert.ok(manifest.content_scripts.some(entry => entry.all_frames && entry.js?.includes('cs_modules/clique_protocolista/external-access.js')))
assert.ok(!source.includes('.submit('))
assert.ok(source.includes('Dados e senha preenchidos'))
async function testSavedPassword () {
  const password = new Input()
  let reads = 0
  let credentials = { remember: true, password: 'senha-ficticia-para-teste' }
  context.chrome = {
    runtime: {},
    storage: {
      local: {
        get (key, deliver) {
          assert.strictEqual(key, 'centralProtocolistaSeiCredentials')
          reads++
          deliver({ [key]: credentials })
        }
      }
    }
  }
  assert.strictEqual(await api.fillSavedPassword(password), true)
  assert.strictEqual(password.value, credentials.password)
  password.value = 'digitada-pelo-operador'
  assert.strictEqual(await api.fillSavedPassword(password), true)
  assert.strictEqual(reads, 1)
  assert.strictEqual(password.value, 'digitada-pelo-operador')
  password.value = ''
  credentials = { remember: false, password: 'nao-usar' }
  assert.strictEqual(await api.fillSavedPassword(password), false)
  assert.strictEqual(password.value, '')
  context.chrome.runtime.lastError = { message: 'Indisponível' }
  assert.strictEqual(await api.fillSavedPassword(password), false)
  assert.strictEqual(await api.fillSavedPassword(null), false)
  assert.ok(!JSON.stringify(Array.from(values.values())).includes('senha-ficticia'))

  // Percorrer o preenchimento completo: amarelo durante a espera, verde só ao fim.
  credentials = { remember: true, password: 'senha-ficticia-para-teste' }
  context.chrome.runtime = {}
  fields.days.readOnly = false
  values.set(key, JSON.stringify({ ...pending, filled: false }))
  context.getComputedStyle = () => ({ display: 'block', visibility: 'visible' })
  context.setTimeout = resolve => setImmediate(resolve)
  const visible = { closest: () => null, getBoundingClientRect: () => ({ width: 100, height: 25 }) }
  const accessLink = {
    ...visible,
    href: 'https://sei.rj.gov.br/sei/controlador.php?acao=acesso_externo_gerenciar&id_procedimento=123',
    getAttribute: () => '',
    querySelectorAll: () => [{ alt: 'Gerenciar Disponibilizações de Acesso Externo', title: '' }]
  }
  context.document.querySelectorAll = selector => {
    assert.strictEqual(selector, '#divArvoreAcoes a[href]')
    return [accessLink]
  }
  assert.strictEqual(api.findAccessLink(), accessLink)
  accessLink.href = 'https://example.org/?acao=acesso_externo_gerenciar'
  assert.strictEqual(api.findAccessLink(), null)
  const heading = { ...visible, ...anchor, textContent: 'Gerenciar Disponibilizações de Acesso Externo' }
  const labels = [
    ['E-mail da Unidade:', fields.sender], ['Destinatário:', fields.name],
    ['E-mail do Destinatário:', fields.email], ['Motivo:', fields.reason],
    ['Validade (dias):', fields.days], ['Acompanhamento integral do processo', fields.integral], ['Senha:', password]
  ].map(([textContent, control]) => {
    Object.assign(control, visible, { matches: () => true })
    return { textContent, control }
  })
  context.document.querySelectorAll = selector => selector.startsWith('h1') ? [heading] : labels
  box = undefined
  const completing = api.reconcile()
  assert.strictEqual(box.style.backgroundColor, '#fff4ce')
  await completing
  assert.strictEqual(box.style.backgroundColor, '#e6f4ea')
  assert.ok(box.children[0].textContent.includes('clique em Disponibilizar'))
  assert.strictEqual(password.value, credentials.password)
  fields.reason.value = 'Ajuste manual posterior'
  await api.reconcile()
  assert.strictEqual(fields.reason.value, 'Ajuste manual posterior')
  assert.ok(!values.get(key).includes(credentials.password))
  console.log('FAST PROC: acesso externo, vínculo do processo, aviso e senha da Central verificados.')
}
testSavedPassword().catch(error => { console.error(error); process.exitCode = 1 })
