(() => {
  'use strict'

  if (window.top !== window) return

  const originalFetch = window.fetch.bind(window)
  const PROCESS_CATALOG_PATTERN = /\/data\/catalogo-processos\.json(?:[?#]|$)/i
  const PROCESS_ID = 'certidao-identificacao-civil'
  const TOPIC_ID = 'certidao-identificacao-civil'
  const SCRIPT_ID = 'trello-64e2a71210e1a7e149276334'
  const FORM_URL = 'https://www.detran.rj.gov.br/images/formularios/Formul%C3%A1rio_solicita%C3%A7%C3%A3o_certidao_dic_05-02-25.pdf'

  const missingDocuments = [
    {
      id: 'certidao-form',
      label: 'Formulário de Solicitação de Certidão de Identificação Civil',
      text: 'Formulário de Solicitação de Certidão de Identificação Civil devidamente preenchido e assinado a caneta ou por Certificação Digital.',
      link: FORM_URL,
      linkLabel: 'Acessar o Formulário de Solicitação de Certidão de Identificação Civil'
    },
    {
      id: 'requester-identification',
      label: 'Documento de identidade do solicitante/requerente',
      text: 'Documento de identidade do solicitante/requerente.'
    },
    {
      id: 'direct-relative-proof',
      label: 'Ascendente/descendente — comprovação do grau de parentesco',
      text: 'Para ascendentes ou descendentes diretos do(a) pesquisado(a): documentação oficial que comprove o grau de parentesco com o pesquisado.'
    },
    {
      id: 'direct-relative-death-certificate',
      label: 'Ascendente/descendente — Certidão de Óbito com filiação',
      text: 'Para ascendentes ou descendentes diretos do(a) pesquisado(a): Certidão de Óbito com filiação.'
    },
    {
      id: 'spouse-marriage-certificate',
      label: 'Cônjuge — Certidão de Casamento',
      text: 'Para cônjuge do(a) pesquisado(a): Certidão de Casamento.'
    },
    {
      id: 'spouse-death-certificate',
      label: 'Cônjuge — Certidão de Óbito com filiação',
      text: 'Para cônjuge do(a) pesquisado(a): Certidão de Óbito com filiação.'
    },
    {
      id: 'partner-death-certificate',
      label: 'Companheiro(a) — Certidão de Óbito com filiação',
      text: 'Para companheiro(a) do(a) pesquisado(a): Certidão de Óbito com filiação.'
    },
    {
      id: 'partner-stable-union-proof',
      label: 'Companheiro(a) — comprovação da União Estável',
      text: 'Para companheiro(a) do(a) pesquisado(a): Certidão de nascimento de filho(s) menor(es) registrado(s) pelo casal OU Sentença Judicial que comprove a União Estável + União Estável lavrada em cartório, com comparecimento das partes contratadas.'
    },
    {
      id: 'lawyer-power-of-attorney',
      label: 'Representação por advogado — Procuração Simples',
      text: 'Procuração Simples, caso representado por Advogado.'
    },
    {
      id: 'lawyer-oab',
      label: 'Representação por advogado — Carteira da OAB',
      text: 'Carteira da Ordem dos Advogados do Brasil, caso representado por Advogado.'
    },
    {
      id: 'documentary-agent-asd',
      label: 'Despachante Documentalista — ASD',
      text: 'Anotação de Serviço Documental - ASD, caso representado por Despachante Documentalista.'
    },
    {
      id: 'documentary-agent-card',
      label: 'Despachante Documentalista — Carteira do Conselho Regional',
      text: 'Carteira do Conselho Regional dos Despachantes Documentalistas do Estado do Rio de Janeiro.'
    },
    {
      id: 'public-agent-certificate',
      label: 'Despachante Público — Certificado Analítico',
      text: 'Certificado Analítico, caso representado por Despachante Público.'
    },
    {
      id: 'public-agent-card',
      label: 'Despachante Público — Carteira do Sindicato',
      text: 'Carteira do Sindicato dos Despachantes.'
    },
    {
      id: 'other-representation-power-of-attorney',
      label: 'Outro procurador — Procuração Pública',
      text: 'Procuração Pública, caso representado, exceto por Advogado/Despachante.'
    },
    {
      id: 'other-representation-id-cpf',
      label: 'Outro procurador — Documento de Identidade e CPF',
      text: 'Documento de Identidade e CPF do procurador, caso representado, exceto Advogado/Despachante.'
    }
  ]

  const topic = {
    id: TOPIC_ID,
    label: 'Certidão de Identificação Civil',
    area: 'outros',
    recentUsageCount: 0,
    searchQuery: 'certidão identificação civil',
    processId: PROCESS_ID,
    canOpenProcess: true,
    scriptId: SCRIPT_ID,
    responseScriptIds: [SCRIPT_ID]
  }

  function patchCatalog (catalog) {
    if (!catalog || typeof catalog !== 'object') return catalog

    const processes = Array.isArray(catalog.processTypes) ? catalog.processTypes : []
    const process = processes.find((item) => item?.id === PROCESS_ID)

    if (process && !Array.isArray(process.missingDocuments)) {
      process.documentsStatus = 'trello-current-card'
      process.missingDocuments = missingDocuments
      process.source = {
        board: 'SCRIPTS - FASE02 - Orientação',
        card: 'Certidão de Identificação Civil',
        cardId: '64e2a71210e1a7e149276334',
        lastActivity: '2026-07-27'
      }
    }

    if (!Array.isArray(catalog.fastMailPriorityTopics)) catalog.fastMailPriorityTopics = []
    if (!catalog.fastMailPriorityTopics.some((item) => item?.id === TOPIC_ID)) {
      catalog.fastMailPriorityTopics.push(topic)
    }

    return catalog
  }

  window.fetch = async (...args) => {
    const response = await originalFetch(...args)
    const requestUrl = String(
      typeof args[0] === 'string'
        ? args[0]
        : args[0]?.url || response.url || ''
    )

    if (!PROCESS_CATALOG_PATTERN.test(requestUrl) || !response.ok) return response

    try {
      const catalog = patchCatalog(await response.clone().json())
      const headers = new Headers(response.headers)
      headers.set('content-type', 'application/json; charset=utf-8')
      return new Response(JSON.stringify(catalog), {
        status: response.status,
        statusText: response.statusText,
        headers
      })
    } catch (error) {
      console.warn('[SEI Protocolistas] Não foi possível aplicar o complemento da Certidão de Identificação Civil:', error)
      return response
    }
  }
})()
