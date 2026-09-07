(() => {
  'use strict'

  if (window.top !== window) return
  if (/\/owa\/auth\/logon\.aspx/i.test(window.location.pathname)) return

  const api = typeof browser === 'undefined' ? chrome : browser
  const GUIDE_VERSION = '1'
  const STORAGE_KEY = `spProtocolistaGuideDismissedV${GUIDE_VERSION}`

  const steps = [
    {
      tag: 'PASSO 1 DE 5',
      title: 'Bem-vindo ao SEI Protocolistas',
      lead: 'A extensão foi criada para reduzir cliques, padronizar atendimentos e manter o protocolista no controle das decisões finais.',
      cards: [
        ['FAST MAIL', 'Orienta respostas, cobra documentos, prepara assunto e mantém o atendimento organizado no OWA.'],
        ['FAST PROC', 'Leva os dados do atendimento para o SEI e guia a abertura do processo sem substituir a conferência humana.'],
        ['Próximo clique guiado', 'A extensão destaca o próximo passo, mas ENVIAR, SALVAR e demais cliques finais continuam com o protocolista.'],
        ['Tema Protocolista', 'O OWA recebe uma camada visual mais limpa e integrada à identidade do SEI Protocolistas.']
      ],
      callout: 'Regra principal: a extensão ajuda a decidir o caminho e preparar o trabalho; a conferência final continua sendo sua.'
    },
    {
      tag: 'PASSO 2 DE 5',
      title: 'Como começar um atendimento',
      lead: 'No FAST MAIL, siga o caminho visual. Cada etapa selecionada fica marcada para você saber exatamente por onde passou.',
      cards: [
        ['1. Escolha a fase', 'IDENTIFICAÇÃO, ORIENTAÇÃO ou EXIGÊNCIAS.'],
        ['2. Escolha o serviço', 'Use os atendimentos principais ou pesquise em OUTRO SERVIÇO.'],
        ['3. Escolha a ação', 'ORIENTAR, COBRAR DOCUMENTOS ou ABRIR PROCESSO, conforme o atendimento permitir.'],
        ['4. Confira os dados', 'Nome, CPF, destino e procedimento aparecem antes das ações que dependem deles.']
      ],
      callout: 'Os botões mais usados ficam no topo. OFÍCIOS aparece destacado porque exige atenção especial.'
    },
    {
      tag: 'PASSO 3 DE 5',
      title: 'Respostas e cobrança de documentos',
      lead: 'Quando houver checklist configurado, marque somente os documentos que realmente estão faltando.',
      cards: [
        ['COBRAR DOCUMENTOS', 'Marque os itens faltantes e clique em INSERIR EXIGÊNCIA. O checklist selecionado é usado na resposta.'],
        ['HTML automático', 'O FAST MAIL prepara o compositor em HTML antes da inserção para preservar títulos, listas, links e blocos de atenção.'],
        ['Assunto TRIAGEM', 'O assunto é preparado automaticamente. Com nome + CPF disponíveis, o padrão completo pode ser montado.'],
        ['Sem dados suficientes', 'Quando uma ação não puder avançar, o painel deve indicar o campo ou requisito que está faltando.']
      ],
      callout: 'Não altere manualmente o texto dos scripts operacionais sem necessidade: os cards do Trello/Trellinho são a referência de conteúdo.'
    },
    {
      tag: 'PASSO 4 DE 5',
      title: 'Abrindo processo no SEI',
      lead: 'Quando ABRIR PROCESSO estiver disponível, o FAST MAIL entrega o contexto ao FAST PROC e abre o SEI para continuar o atendimento.',
      cards: [
        ['Handoff automático', 'Nome, CPF, tipo de processo, destino e contexto do atendimento seguem para o FAST PROC.'],
        ['FAST PROC', 'A extensão orienta os campos e os próximos cliques do processo no SEI.'],
        ['Devolutiva ao cidadão', 'Depois da abertura, o resultado volta ao Webmail com número, data, tipo, destino e orientação de acompanhamento.'],
        ['TRIAGEM - FECHADO', 'No encerramento, TRIAGEM permanece no assunto e o estado FECHADO é acrescentado.']
      ],
      callout: 'Informações internas da extensão, como rótulos de operação, não devem aparecer na mensagem enviada ao cidadão.'
    },
    {
      tag: 'PASSO 5 DE 5',
      title: 'Atalhos que vale lembrar',
      lead: 'Algumas funções existem para ganhar tempo sem esconder o que está acontecendo.',
      cards: [
        ['REQUERIMENTO RÁPIDO', 'Atalho do FAST PROC para acelerar a inclusão do requerimento quando o fluxo permitir.'],
        ['Buscar outro atendimento', 'Se o serviço não estiver entre os principais, use a busca completa do FAST MAIL.'],
        ['Rever este guia', 'O botão REVER GUIA fica no FAST MAIL e pode abrir este tutorial a qualquer momento.'],
        ['Problema conhecido?', 'Antes de reinventar uma solução, o projeto consulta o runbook de soluções validadas para evitar retrabalho.']
      ],
      callout: 'Se marcar “Não exibir novamente”, este guia deixa de abrir sozinho. Você ainda poderá reabri-lo pelo botão REVER GUIA.'
    }
  ]

  const storageGet = (key) => new Promise((resolve) => {
    try {
      const result = api.storage.local.get(key, (items) => resolve(items || {}))
      if (result?.then) result.then((items) => resolve(items || {}), () => resolve({}))
    } catch (_) {
      resolve({})
    }
  })

  const storageSet = (items) => new Promise((resolve) => {
    try {
      const result = api.storage.local.set(items, resolve)
      if (result?.then) result.then(resolve, resolve)
    } catch (_) {
      resolve()
    }
  })

  function escapeHtml (value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  function createGuide () {
    if (document.querySelector('#sp-protocolista-guide-overlay')) return document.querySelector('#sp-protocolista-guide-overlay')

    const overlay = document.createElement('div')
    overlay.id = 'sp-protocolista-guide-overlay'
    overlay.hidden = true
    overlay.setAttribute('role', 'dialog')
    overlay.setAttribute('aria-modal', 'true')
    overlay.setAttribute('aria-label', 'Guia do SEI Protocolistas')

    overlay.innerHTML = `
      <section id="sp-protocolista-guide">
        <header class="sp-guide-header">
          <div class="sp-guide-brand">
            <strong>SEI PROTOCOLISTAS</strong>
            <span>GUIA RÁPIDO</span>
          </div>
          <button class="sp-guide-close" type="button" aria-label="Fechar guia" title="Fechar">×</button>
        </header>
        <div class="sp-guide-body"></div>
        <footer class="sp-guide-footer">
          <div class="sp-guide-footer-row">
            <label class="sp-guide-no-show">
              <input id="sp-guide-no-show" type="checkbox">
              <span>Não exibir novamente</span>
            </label>
            <span class="sp-guide-progress"></span>
          </div>
          <div class="sp-guide-actions">
            <button id="sp-guide-prev" class="sp-guide-secondary" type="button">ANTERIOR</button>
            <button id="sp-guide-next" class="sp-guide-primary" type="button">PRÓXIMO</button>
          </div>
        </footer>
      </section>`

    document.body.appendChild(overlay)
    return overlay
  }

  let currentStep = 0

  function renderStep () {
    const overlay = createGuide()
    const body = overlay.querySelector('.sp-guide-body')
    const progress = overlay.querySelector('.sp-guide-progress')
    const prev = overlay.querySelector('#sp-guide-prev')
    const next = overlay.querySelector('#sp-guide-next')
    const step = steps[currentStep]

    body.innerHTML = `
      <div class="sp-guide-step-tag">${escapeHtml(step.tag)}</div>
      <h2 class="sp-guide-title">${escapeHtml(step.title)}</h2>
      <p class="sp-guide-lead">${escapeHtml(step.lead)}</p>
      <div class="sp-guide-card-grid">
        ${step.cards.map(([title, text]) => `
          <article class="sp-guide-card">
            <strong>${escapeHtml(title)}</strong>
            <span>${escapeHtml(text)}</span>
          </article>`).join('')}
      </div>
      <div class="sp-guide-callout">${escapeHtml(step.callout)}</div>`

    progress.textContent = `${currentStep + 1} / ${steps.length}`
    prev.hidden = currentStep === 0
    next.textContent = currentStep === steps.length - 1 ? 'COMEÇAR' : 'PRÓXIMO'
    body.scrollTop = 0
  }

  async function closeGuide () {
    const overlay = createGuide()
    const noShow = overlay.querySelector('#sp-guide-no-show')
    if (noShow?.checked) {
      await storageSet({ [STORAGE_KEY]: true })
    }
    overlay.hidden = true
  }

  function openGuide ({ manual = false } = {}) {
    const overlay = createGuide()
    currentStep = 0
    renderStep()
    if (manual) {
      const noShow = overlay.querySelector('#sp-guide-no-show')
      if (noShow) noShow.checked = false
    }
    overlay.hidden = false
    window.setTimeout(() => overlay.querySelector('#sp-guide-next')?.focus(), 30)
  }

  function bindGuide () {
    const overlay = createGuide()
    if (overlay.dataset.bound === 'true') return
    overlay.dataset.bound = 'true'

    overlay.querySelector('.sp-guide-close')?.addEventListener('click', closeGuide)
    overlay.querySelector('#sp-guide-prev')?.addEventListener('click', () => {
      if (currentStep > 0) {
        currentStep -= 1
        renderStep()
      }
    })
    overlay.querySelector('#sp-guide-next')?.addEventListener('click', async () => {
      if (currentStep < steps.length - 1) {
        currentStep += 1
        renderStep()
        return
      }
      await closeGuide()
    })

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) closeGuide()
    })

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !overlay.hidden) closeGuide()
    })
  }

  function installReviewButton () {
    const panel = document.querySelector('#sei-protocolistas-fast-mail-status')
    const body = panel?.querySelector('#spfm-panel-body')
    if (!body || body.querySelector('#spfm-review-guide')) return false

    const button = document.createElement('button')
    button.id = 'spfm-review-guide'
    button.type = 'button'
    button.textContent = 'REVER GUIA'
    button.title = 'Abrir novamente o Guia do Protocolista'
    button.addEventListener('click', () => openGuide({ manual: true }))
    body.appendChild(button)
    return true
  }

  async function init () {
    document.documentElement.classList.add('sp-protocolista-theme')
    bindGuide()

    const observer = new MutationObserver(() => installReviewButton())
    observer.observe(document.documentElement, { childList: true, subtree: true })
    installReviewButton()

    const stored = await storageGet(STORAGE_KEY)
    if (!stored[STORAGE_KEY]) {
      window.setTimeout(() => openGuide(), 650)
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true })
  } else {
    init()
  }
})()
