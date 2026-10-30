/* eslint-env node */
'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const root = path.resolve(__dirname, '..')
const source = fs.readFileSync(path.join(root, 'cs_modules/protocolo_cliente/index.js'), 'utf8')

assert.ok(source.includes('if(isTreeFrame())return;'), 'o cartão deve ser recusado no quadro da árvore')
assert.ok(source.includes('data-action="email"'), 'atendimento por e-mail deve manter o retorno ao OWA')
assert.ok(source.includes('data-action="print"'), 'atendimento por e-mail deve oferecer impressão do protocolo')
assert.ok(source.includes("'AS UNIDADES SELECIONADAS'"), 'múltiplos destinos devem manter o cartão mesmo sem texto reconhecível')

const destinationSource = source.match(/const destination=t=>\{[\s\S]*?\n\};/)
assert.ok(destinationSource, 'extrator de destinos não localizado')
const context = {}
vm.runInNewContext(destinationSource[0].replace('const destination=', 'globalThis.destination='), context)
const mergeDestinationsSource = source.match(/const mergeDestinations=[\s\S]*?\n};/)
assert.ok(mergeDestinationsSource, 'combinador de destinos não localizado')
vm.runInNewContext(mergeDestinationsSource[0].replace('const mergeDestinations=', 'globalThis.mergeDestinations='), context)

assert.strictEqual(
  context.destination('Processo aberto somente na unidade DETRAN/DIVMED.'),
  'DETRAN/DIVMED'
)
assert.strictEqual(
  context.destination('Processo aberto nas unidades DETRAN/DIVMED e DETRAN/DIRRV.'),
  'DETRAN/DIVMED E DETRAN/DIRRV'
)
assert.strictEqual(
  context.destination('Processo encaminhado para as unidades: DIVAP, DIRRV'),
  'DIVAP E DIRRV'
)
assert.strictEqual(
  context.mergeDestinations('DETRAN/DIVAF', ['DETRAN/DIRRV', 'DETRAN/DIVAF']),
  'DETRAN/DIVAF E DETRAN/DIRRV'
)
assert.ok(source.includes('pending.destinos'), 'o cartão deve usar os destinos desta tentativa de envio')

const selectedUnitsSource = source.match(/function selectedUnits\(\)\{[\s\S]*?\n\}/)
assert.ok(selectedUnitsSource, 'leitor de destinos selecionados não localizado')
const selected = { value: '1', textContent: 'DETRAN/DIVCA - Divisão de Comunicações Administrativas' }
const unselected = { value: '2', textContent: 'DETRAN/DIVAF' }
const selectedContext = {
  document: {
    querySelectorAll: () => [{ id: 'selUnidades', name: 'selUnidades', multiple: true, size: 2, options: [selected, unselected], selectedOptions: [selected] }]
  },
  norm: value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim(),
  units: value => context.mergeDestinations(value).split(' E ').filter(Boolean)
}
vm.runInNewContext(selectedUnitsSource[0].replace('function selectedUnits()', 'globalThis.selectedUnits = function selectedUnits()'), selectedContext)
assert.deepStrictEqual(
  Array.from(selectedContext.selectedUnits()),
  ['DETRAN/DIVCA'],
  'o cartão deve validar somente as unidades selecionadas, ignorando opções não selecionadas'
)
const confirmSource = source.match(/function confirmedSend\(pending,id,text,now=Date\.now\(\)\)\{[\s\S]*?\n\}/)
assert.ok(confirmSource, 'verificador do envio não localizado')
Object.assign(selectedContext, {
  action: () => 'procedimento_trabalhar',
  SEND_MAX_AGE: 600000,
  performance: { getEntriesByType: () => [{ type: 'navigate' }] },
  unitId: value => value.replace(/^DETRAN\//, ''),
  sameUnits: (left, right) => left.length === right.length && left.every(unit => right.some(value => value.replace(/^DETRAN\//, '') === unit.replace(/^DETRAN\//, ''))),
  messageUnits: value => context.destination(value).split(' E ').filter(Boolean)
})
vm.runInNewContext(confirmSource[0].replace('function confirmedSend(', 'globalThis.confirmedSend = function confirmedSend('), selectedContext)
const sendPending = { processId: '123', at: 100, leftSendFormAt: 150, before: ['DETRAN/SERVPROT'], beforeText: 'Processo aberto somente na unidade DETRAN/SERVPROT.', destinos: ['DETRAN/DIVCA'] }
assert.strictEqual(selectedContext.confirmedSend({ ...sendPending, leftSendFormAt: 0 }, '123', 'Processo aberto somente na unidade DETRAN/DIVCA.', 200), false, 'clique sem saída da tela de envio não confirma o envio')
assert.strictEqual(selectedContext.confirmedSend(sendPending, '123', 'Processo aberto somente na unidade DETRAN/SERVPROT.', 200), false, 'a unidade de origem não pode liberar o cartão')
assert.strictEqual(selectedContext.confirmedSend(sendPending, '123', 'Processo aberto somente na unidade DETRAN/DIVCA.', 200), true, 'a confirmação do SEI no destino após sair do envio libera o cartão')
const multiPending = { ...sendPending, destinos: ['DETRAN/DIVAF', 'DETRAN/NUCRA'] }
assert.strictEqual(selectedContext.confirmedSend(multiPending, '123', 'Processo aberto nas unidades DETRAN/DIVAF e DETRAN/NUCRA.', 200), true, 'a confirmação deve preservar e validar todos os destinos selecionados')
selectedContext.action = () => 'procedimento_enviar'
assert.strictEqual(selectedContext.confirmedSend(sendPending, '123', 'Processo aberto somente na unidade DETRAN/DIVCA.', 200), false)
selectedContext.action = () => 'procedimento_trabalhar'
selectedContext.performance.getEntriesByType = () => [{ type: 'back_forward' }]
assert.strictEqual(selectedContext.confirmedSend(sendPending, '123', 'Processo aberto somente na unidade DETRAN/DIVCA.', 200), false)
console.log('PROTOCOLO CLIENTE: quadro único, impressão por e-mail e múltiplos destinos verificados.')

// Executa o módulo completo, inclusive o callback de saída que só roda depois.
// A recarga da extensão pode retirar storage ou invalidar métodos já existentes.
async function testAttendanceLifecycle () {
  async function load (action, options = {}) {
    const tabValues = new Map()
    const listeners = new Set()
    const handlers = new Map()
    const warnings = []
    const sessionStorage = {
      getItem: key => tabValues.get(key) || null,
      setItem: (key, value) => tabValues.set(key, value),
      removeItem: key => tabValues.delete(key)
    }
    const api = {
      runtime: {},
      storage: {
        local: { get: (keys, onResult) => onResult({}) },
        onChanged: {
          addListener: callback => listeners.add(callback),
          removeListener: callback => {
            if (options.removeError) throw new Error(options.removeError)
            listeners.delete(callback)
          }
        }
      }
    }
    if (options.withoutStorage) delete api.storage
    const location = { search: '?acao=' + action }
    const window = {
      name: '',
      frameElement: null,
      sessionStorage,
      location,
      addEventListener: (name, callback) => handlers.set(name, callback)
    }
    window.top = window
    const sandbox = {
      chrome: api,
      window,
      location,
      URLSearchParams,
      document: { querySelector: () => null, querySelectorAll: () => [] },
      console: { warn: (...args) => warnings.push(args) }
    }
    vm.runInNewContext(source, sandbox, { filename: 'protocolo_cliente/index.js' })
    await new Promise(resolve => setImmediate(resolve))
    return {
      api,
      listeners,
      warnings,
      leave: () => handlers.get('pagehide')?.(),
      flow: () => JSON.parse(tabValues.get('sp-protocolo-atendimento-v1') || 'null')
    }
  }

  for (const action of ['procedimento_escolher_tipo', 'procedimento_gerar']) {
    const normal = await load(action)
    assert.strictEqual(normal.listeners.size, 1, action + ': registra o observador')
    const attendance = { createdAt: Date.now() + 1, expiresAt: Date.now() + 60000, attendanceId: 'atendimento-teste' }
    normal.listeners.forEach(listener => listener({ cliqueProtocolistaContexto: { newValue: attendance } }, 'local'))
    assert.strictEqual(normal.flow().attendanceId, attendance.attendanceId, action + ': vincula o atendimento novo')
    normal.leave()
    assert.strictEqual(normal.listeners.size, 0, action + ': remove o observador na saída normal')
    assert.strictEqual(normal.warnings.length, 0)

    const reloaded = await load(action)
    delete reloaded.api.storage
    assert.doesNotThrow(reloaded.leave, action + ': sair após perder storage não pode gerar TypeError')
    assert.strictEqual(reloaded.warnings.length, 0)

    const invalidated = await load(action, { removeError: 'Extension context invalidated.' })
    assert.doesNotThrow(invalidated.leave, action + ': contexto invalidado na remoção não pode interromper a saída')
    assert.strictEqual(invalidated.warnings.length, 0)

    const unexpected = await load(action, { removeError: 'Falha inesperada de remoção' })
    assert.doesNotThrow(unexpected.leave)
    assert.strictEqual(unexpected.warnings.length, 1, 'falhas diferentes devem continuar diagnosticáveis')
    assert.match(String(unexpected.warnings[0][1]), /Falha inesperada de remoção/)

    const unavailable = await load(action, { withoutStorage: true })
    assert.doesNotThrow(unavailable.leave)
    assert.strictEqual(unavailable.listeners.size, 0)
    assert.ok(unavailable.warnings.some(args => /Não foi possível ler o contexto/.test(args[0])), 'indisponibilidade inicial precisa ser registrada')
  }
  console.log('CICLO DO PROTOCOLO: vínculo normal, saída após recarga, contexto invalidado e diagnóstico de falhas verificados nas duas telas de abertura.')
}

testAttendanceLifecycle().catch(error => {
  console.error(error)
  process.exitCode = 1
})
