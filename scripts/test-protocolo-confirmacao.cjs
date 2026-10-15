/* eslint-disable n/no-callback-literal -- mocks da API Chrome usam callbacks com resultado, não error-first */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require('playwright')
const source = fs.readFileSync(path.join(__dirname, '../cs_modules/protocolo_cliente/index.js'), 'utf8')
const card = '#sp-protocolo-cliente-card'
const sendKey = 'sp-protocolo-envio-v1'
const context = { createdAt: Date.now(), expiresAt: Date.now() + 3600000, modalidade: 'email', attendanceId: 'teste-local', email: 'teste@example.invalid' }
let checks = 0

async function main () {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) })
  try {
    const page = await browser.newPage()
    let html = ''
    await page.route('https://sei.rj.gov.br/**', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: html }))
    await page.addInitScript(context => {
      const storageKey = '__spTestChromeStorage'
      const stored = JSON.parse(sessionStorage.getItem(storageKey) || 'null') || { cliqueProtocolistaContexto: context }
      const listeners = new Set()
      window.chrome = {
        runtime: { getURL: p => 'https://sei.rj.gov.br/' + p, sendMessage: (m, cb) => cb({ ok: true }) },
        storage: {
          onChanged: { addListener: f => listeners.add(f), removeListener: f => listeners.delete(f) },
          local: {
            get: (keys, cb) => cb(stored),
            set: (items, cb) => {
              const changes = Object.fromEntries(Object.entries(items).map(([key, newValue]) => [key, { oldValue: stored[key], newValue }]))
              Object.assign(stored, items)
              sessionStorage.setItem(storageKey, JSON.stringify(stored))
              listeners.forEach(f => f(changes, 'local'))
              cb?.()
            }
          }
        }
      }
    }, context)
    const load = async (action, text, id = '123', body = '') => {
      html = `<body><div id="native">${text}</div><p>SEI-150001/000123/2026</p><p>TIPO DO PROCESSO Teste INTERESSADO(S) Pessoa Teste ATRIBUÍDO PARA</p>${body}</body>`
      await page.goto(`https://sei.rj.gov.br/sei/controlador.php?acao=${action}&id_procedimento=${id}`)
      await page.addScriptTag({ content: source })
      // Espera duas rodadas para concluir leituras assíncronas/MutationObserver.
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    }
    const count = async (expected, label) => {
      assert.equal(await page.locator(card).count(), expected, label)
      checks++
    }
    const send = async (destinations = ['DETRAN/DIVMED']) => {
      await load('procedimento_enviar', 'Processo aberto somente na unidade DETRAN/SERVPROT.', '123',
        `<form onsubmit="event.preventDefault()"><select id="selUnidades" name="selUnidades" multiple>${destinations.map((d, i) => `<option selected value="${i + 1}">${d}</option>`).join('')}</select><button type="submit">Enviar</button></form>`)
      await page.getByRole('button', { name: 'Enviar', exact: true }).click()
      await page.evaluate(() => window.dispatchEvent(new Event('pagehide')))
      await count(0, 'clique/submit não confirma encaminhamento')
      assert.equal((await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)), sendKey)).processId, '123')
    }
    await load('procedimento_trabalhar', 'Processo aberto somente na unidade DETRAN/DIVMED.')
    await count(0, 'unidade já aberta, sem envio, não confirma')
    await load('procedimento_trabalhar', 'Processo encaminhado para a unidade DETRAN/DIVMED.')
    await count(0, 'mensagem antiga sem tentativa da aba não confirma')
    await send()
    await load('procedimento_trabalhar', 'Processo aberto somente na unidade DETRAN/SERVPROT.', '123', '<p>Erro ao enviar processo</p>')
    await count(0, 'falha/cancelamento e localização inalterada não confirmam')
    await load('procedimento_trabalhar', 'Processo aberto somente na unidade DETRAN/DIVMED.')
    await count(1, 'mudança retornada pelo SEI para destino selecionado confirma')
    assert.match(await page.locator(card).innerText(), /DETRAN\/DIVMED/)
    await page.locator('#native').evaluate(e => { e.textContent = 'Processo aberto somente na unidade DETRAN/SERVPROT.' })
    await count(0, 'perda de confirmação remove cartão')
    await send()
    await load('procedimento_trabalhar', 'Processo encaminhado com sucesso para a unidade DETRAN/DIVMED.')
    await count(1, 'mensagem explícita posterior confirma')
    await load('procedimento_trabalhar', 'Processo aberto somente na unidade DETRAN/DIVMED.', '456')
    await count(0, 'outro processo não herda cartão')
    assert.equal(await page.evaluate(key => sessionStorage.getItem(key), sendKey), null)
    await send()
    await page.evaluate(key => { const p = JSON.parse(sessionStorage.getItem(key)); p.at -= 11 * 60000; sessionStorage.setItem(key, JSON.stringify(p)) }, sendKey)
    await load('procedimento_trabalhar', 'Processo aberto somente na unidade DETRAN/DIVMED.')
    await count(0, 'tentativa expirada não confirma')
    await send()
    await load('procedimento_trabalhar', 'Processo aberto somente na unidade DETRAN/DIRRV.')
    await count(0, 'destino diferente do selecionado não confirma')
    await send(['DETRAN/DIVMED', 'DETRAN/DIRRV'])
    await load('procedimento_trabalhar', 'Processo aberto somente na unidade DETRAN/DIVMED.')
    await count(0, 'confirmação parcial de múltiplos destinos não confirma')
    await load('procedimento_trabalhar', 'Processo aberto nas unidades DETRAN/DIVMED e DETRAN/DIRRV.')
    await count(1, 'todos os destinos confirmados exibem cartão único')
    assert.match(await page.locator(card).innerText(), /DETRAN\/DIVMED E DETRAN\/DIRRV/)
    assert.equal(await page.locator(card + ' [data-action="email"]').count(), 0, 'contexto global sem vínculo não oferece email de outro processo')
    await load('procedimento_escolher_tipo', '')
    await load('procedimento_gerar', '', '123')
    await load('procedimento_trabalhar', 'Processo aberto somente na unidade DETRAN/SERVPROT.')
    await send()
    await load('procedimento_trabalhar', 'Processo aberto somente na unidade DETRAN/DIVMED.')
    await count(1, 'envio válido confirma mesmo sem vínculo de e-mail')
    assert.equal(await page.locator(card + ' [data-action="email"]').count(), 0, 'contexto de e-mail antigo não pode ser associado a processo manual')
    await load('procedimento_escolher_tipo', '')
    await load('procedimento_gerar', '', '123')
    const freshContext = { ...context, attendanceId: 'atendimento-novo', createdAt: Date.now(), expiresAt: Date.now() + 3600000 }
    await page.evaluate(value => chrome.storage.local.set({ cliqueProtocolistaContexto: value }), freshContext)
    await load('procedimento_trabalhar', 'Processo aberto somente na unidade DETRAN/SERVPROT.')
    await send()
    await load('procedimento_trabalhar', 'Processo aberto somente na unidade DETRAN/DIVMED.')
    await count(1, 'atendimento recém-criado na mesma aba confirma')
    assert.equal(await page.locator(card + ' [data-action="email"]').count(), 1, 'retorno por e-mail preservado para o atendimento recém-vinculado')
    const popupPromise = page.waitForEvent('popup')
    await page.locator(card + ' [data-action="print"]').click()
    const popup = await popupPromise
    assert.match(await popup.locator('body').innerText(), /SEI-150001\/000123\/2026/)
    assert.match(await popup.locator('body').innerText(), /DETRAN\/DIVMED/)
    await popup.close()
    await page.locator(card + ' [data-action="email"]').click()
    assert.equal(await page.locator(card + ' [data-action="email"]').innerText(), 'E-MAIL ORIGINAL ABERTO')
    checks += 4
    // Outra aba não deve herdar a tentativa mesmo tendo o contexto global.
    const other = await browser.newPage()
    await other.route('https://sei.rj.gov.br/**', route => route.fulfill({ contentType: 'text/html', body: '<body><p>Processo aberto somente na unidade DETRAN/DIVMED.</p></body>' }))
    await other.goto('https://sei.rj.gov.br/sei/controlador.php?acao=procedimento_trabalhar&id_procedimento=123')
    await other.evaluate(() => { window.chrome = { runtime: {}, storage: { local: { get: (k, cb) => cb({}) } } } })
    await other.addScriptTag({ content: source })
    assert.equal(await other.locator(card).count(), 0)
    checks++
    // No SEI a tela de envio substitui o quadro que exibia as unidades abertas.
    // A origem precisa sobreviver à troca do quadro, antes do clique em Enviar.
    await load('procedimento_trabalhar', 'Processo aberto somente na unidade DETRAN/SERVPROT.')
    await load('procedimento_enviar', '', '123', '<form onsubmit="event.preventDefault()"><select id="selUnidades" multiple><option value="1" selected>DETRAN/DIVCA</option></select><button type="submit">Enviar</button></form>')
    await page.getByRole('button', { name: 'Enviar', exact: true }).click()
    await count(0, 'tela de envio sem indicação de origem não exibe sucesso')
    await load('procedimento_trabalhar', 'Processo aberto somente na unidade DETRAN/DIVCA.')
    await count(1, 'origem preservada ao sair da visualização permite confirmar destino DIVCA')
    await send()
    await load('procedimento_trabalhar', '', '123', '<iframe id="confirmation-frame" srcdoc="&lt;p&gt;Processo aberto somente na unidade DETRAN/DIVMED.&lt;/p&gt;"></iframe>')
    const nestedFrame = page.frames().find(frame => frame !== page.mainFrame())
    assert.ok(nestedFrame, 'quadro nativo de confirmação carregado')
    assert.equal(await nestedFrame.locator(card).count(), 1, 'a confirmação em frame filho deve exibir o cartão')
    checks++
    console.log(`CONFIRMAÇÃO LOCAL: ${checks} verificações de comportamento passaram em Chromium.`)
  } finally {
    await browser.close()
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
