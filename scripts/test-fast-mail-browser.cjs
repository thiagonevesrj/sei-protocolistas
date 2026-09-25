/* eslint-env node */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require('playwright')
const root = path.resolve(__dirname, '..')
const manifest = require('../manifest.json')

async function main () {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) })
  const page = await browser.newPage({ viewport: { width: 1366, height: 1000 } })
  page.setDefaultTimeout(7000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.pathname.startsWith('/extension/')) {
      const file = path.join(root, url.pathname.slice('/extension/'.length))
      return route.fulfill({ path: file })
    }
    if (url.pathname === '/owa/') {
      return route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><html><meta charset="utf-8"><body><input id="txtSubj" value="Teste"><input id="txtBcc"><div id="divBdy"><iframe id="ifBdy" srcdoc="<body contenteditable=\'true\'>Histórico de teste</body>"></iframe></div></body></html>' })
    }
    return route.abort()
  })
  await page.addInitScript(() => {
    const data = {}
    window.chrome = {
      runtime: {
        id: 'test-extension',
        getURL: file => `${location.origin}/extension/${file}`,
        onMessage: { addListener () {} },
        sendMessage (message, respond) { respond?.({ ok: true, tabId: 1 }); return Promise.resolve({ ok: true, tabId: 1 }) }
      },
      storage: {
        onChanged: { addListener () {} },
        local: {
          get (keys, callback) { callback?.(data); return Promise.resolve(data) },
          set (items, callback) { Object.assign(data, items); callback?.(); return Promise.resolve() },
          remove (keys, callback) { for (const key of [].concat(keys)) delete data[key]; callback?.(); return Promise.resolve() }
        }
      }
    }
  })
  try {
    await page.goto('https://venus2.detran.rj.gov.br/owa/?ae=PreFormAction&a=Reply&t=IPM.Note')
    const entries = manifest.content_scripts.filter(item => item.matches.includes('https://venus2.detran.rj.gov.br/owa/*') && !item.exclude_globs)
    for (const entry of entries) {
      for (const css of entry.css || []) await page.addStyleTag({ content: fs.readFileSync(path.join(root, css), 'utf8') })
      for (const js of entry.js) await page.addScriptTag({ content: fs.readFileSync(path.join(root, js), 'utf8') })
    }
    await page.locator('[data-spfm-workflow-stage="orientacao"]').click()
    await page.getByRole('button', { name: 'Baixa de Restrição', exact: true }).click()
    await page.locator('#spfm-v2-variant').waitFor({ state: 'visible', timeout: 4000 })
    assert.deepEqual(await page.locator('#spfm-v2-variant option').evaluateAll(options => options.map(option => option.value)), ['', 'geral', 'herdeiros', 'terceiros'])
    assert.equal(await page.locator('#spfm-action-step').isVisible(), false)
    const cases = [
      ['geral', 'trello-64fb42402e475bb276514702'],
      ['herdeiros', 'trello-6540fdf582f80285a553bc8f'],
      ['terceiros', 'trello-6540fde403de990b0588c29b']
    ]
    for (const [variant, scriptId] of cases) {
      await page.locator('#spfm-v2-variant').selectOption(variant)
      await page.locator('#spfm-action-step').waitFor({ state: 'visible' })
      await page.locator('#spfm-priority-reply').click()
      assert.equal(await page.locator('#spfm-script-result').inputValue(), scriptId, `${variant}: resposta do caso`)
      await page.locator('#spfm-priority-missing').click()
      if (variant === 'geral') {
        await page.locator('#spfm-missing-options input').first().waitFor({ state: 'visible' })
        await page.locator('#spfm-priority-open').click()
        await page.locator('#spfm-process-setup').waitFor({ state: 'visible' })
        assert.equal(await page.locator('#spfm-procedure').inputValue(), 'baixa-restricao')
      } else {
        await page.locator('#spfm-p0-presential-panel').waitFor({ state: 'visible' })
        assert.equal(await page.locator('#spfm-missing-box').isVisible(), false, 'Inventário não deve cobrar documentos do caso geral por e-mail')
        assert.equal(await page.locator('#spfm-priority-open').isDisabled(), true)
        assert.equal(await page.locator('#spfm-priority-open').textContent(), 'SOMENTE PRESENCIAL')
      }
      await page.locator('#spfm-v2-variant').selectOption('')
      assert.equal(await page.locator('#spfm-action-step').isVisible(), false)
      assert.equal(await page.locator('#spfm-process-setup').isVisible(), false)
      assert.equal(await page.locator('#spfm-missing-box').isVisible(), false)
      assert.equal(await page.locator('#spfm-script-catalog').isVisible(), false)
      await page.locator('#spfm-p0-presential-panel').waitFor({ state: 'hidden' })
    }
    for (const service of ['Devolução de Taxas', 'Desistência de Categoria', 'Perícia Médica']) {
      await page.getByRole('button', { name: service, exact: true }).click()
      await page.waitForFunction(() => document.querySelector('#spfm-priority-topic').value !== 'baixa-restricao' && document.querySelector('#spfm-priority-topic').value !== '')
      await page.waitForFunction(() => !document.querySelector('#spfm-v2-variant option[value="terceiros"]'))
      if (service === 'Desistência de Categoria') {
        await page.locator('#spfm-action-step').waitFor({ state: 'visible' })
      } else {
        await page.locator('#spfm-v2-variant').waitFor({ state: 'visible' })
        const value = await page.locator('#spfm-v2-variant option').evaluateAll(options => options.find(option => option.value).value)
        await page.locator('#spfm-v2-variant').selectOption(value)
        await page.locator('#spfm-action-step').waitFor({ state: 'visible' })
      }
      await page.getByRole('button', { name: 'Baixa de Restrição', exact: true }).click()
      await page.locator('#spfm-v2-variant option[value="terceiros"]').waitFor({ state: 'attached' })
      assert.equal(await page.locator('#spfm-v2-variant').inputValue(), '')
      assert.equal(await page.locator('#spfm-action-step').isVisible(), false)
    }
    const body = page.frameLocator('#ifBdy').locator('body')
    assert.equal(await body.textContent(), 'Histórico de teste', 'Navegar e selecionar ações não deve inserir/enviar e-mail')
    await page.getByRole('button', { name: 'Desistência de Categoria', exact: true }).click()
    await page.locator('#spfm-v2-variant').waitFor({ state: 'hidden' })
    await page.locator('#spfm-workflow-v3-orientation-search').fill('baixa restrição')
    await page.locator('#spfm-workflow-v3-orientation-results button').first().click()
    await page.locator('#spfm-v2-variant').waitFor({ state: 'visible' })
    assert.equal(await page.locator('#spfm-v2-variant').inputValue(), '')
    await page.locator('#spfm-v2-variant').selectOption('geral')
    await page.locator('#spfm-priority-missing').click()
    await page.locator('#spfm-missing-options input[value="general-request"]').check()
    await page.locator('#spfm-insert-requirement').click()
    await page.waitForFunction(() => document.querySelector('#ifBdy').contentDocument.body.textContent.includes('Requerimento Geral'))
    assert.ok((await body.textContent()).includes('Histórico de teste'), 'Cobrança preserva histórico')
    const out = process.env.TEST_ARTIFACT_DIR || path.join(root, '..', 'browser-artifacts')
    fs.mkdirSync(out, { recursive: true })
    await page.locator('[data-spfm-workflow-stage="orientacao"]').click()
    await page.getByRole('button', { name: 'Baixa de Restrição', exact: true }).click()
    await page.locator('#spfm-v2-variant').waitFor({ state: 'visible' })
    await page.locator('#spfm-v2-variant').scrollIntoViewIfNeeded()
    await page.screenshot({ path: path.join(out, 'fast-mail-casos.png') })
    await page.locator('#spfm-v2-variant').selectOption('geral')
    await page.locator('#spfm-action-step').scrollIntoViewIfNeeded()
    await page.screenshot({ path: path.join(out, 'fast-mail-acoes.png') })
    console.log('FAST MAIL browser: três casos, respostas, cobrança, abertura, reinício e outros atendimentos verificados.')
    assert.deepEqual(errors, [])
  } catch (error) {
    const out = process.env.TEST_ARTIFACT_DIR || path.join(root, '..', 'browser-artifacts')
    fs.mkdirSync(out, { recursive: true })
    await page.screenshot({ path: path.join(out, 'fast-mail-failure.png'), fullPage: true })
    fs.writeFileSync(path.join(out, 'fast-mail-failure.html'), await page.content())
    console.error('Erros de página:', errors)
    throw error
  } finally {
    await browser.close()
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
