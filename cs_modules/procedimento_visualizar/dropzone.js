/* global __mconsole, GetBaseUrl, SavedOptions */
const dropzone = {}

/*
  Dropzone.utils
  Objeto com algumas funções úteis
*/
dropzone.utils = {

  formatarNumero: function (number) {
    return (number < 10 ? '0' : '') + number
  },

  hoje: function () {
    const dataHoje = new Date()
    return dropzone.utils.formatarNumero(dataHoje.getDate()) +
      '/' +
      dropzone.utils.formatarNumero((dataHoje.getMonth() + 1)) +
      '/' +
      dataHoje.getFullYear()
  },

  /* extraído do sei: InfraUtil.js */
  infraFormatarTamanhoBytes: function (numBytes) {
    let ret = null
    if (numBytes > 1099511627776) {
      ret = Math.round(numBytes / 1099511627776 * 100) / 100 + ' Tb'
    } else if (numBytes > 1073741824) {
      ret = Math.round(numBytes / 1073741824 * 100) / 100 + ' Gb'
    } else if (numBytes > 1048576) {
      ret = Math.round(numBytes / 1048576 * 100) / 100 + ' Mb'
    } else /* if (numBytes > 1024) */ {
      ret = Math.round(numBytes / 1024 * 100) / 100 + ' Kb'
    }
    return ret
  },

  // encodeURIComponent para ISO-8859-1
  escapeComponent: function (str) {
    return escape(str).replace(/\+/g, '%2B')
  },

  extrairUrlControlador: function (value) {
    const texto = dropzone.utils.normalizarUrlSei(value)
    const resultado = texto.match(/(?:https?:\/\/[^'"\s)]+|controlador\.php\?[^'"\s)]+)/i)
    return resultado ? resultado[0] : null
  },

  normalizarUrlSei: function (value) {
    let texto = String(value || '')
      .replace(/\\u0026|\\x26/gi, '&')
      .replace(/\\\//g, '/')
      .trim()

    /*
     * As URLs do SEI podem atravessar duas camadas de HTML: primeiro dentro de
     * um trecho JavaScript e depois dentro da resposta da página. Por isso,
     * "&" pode chegar como "&amp;amp;". Decodificar até estabilizar preserva
     * todos os parâmetros (unidade, sistema e hash) necessários à navegação.
     */
    for (let i = 0; i < 3; i++) {
      const anterior = texto
      texto = texto
        .replace(/&amp;|&#38;|&#x26;/gi, '&')
        .replace(/&quot;|&#34;|&#x22;/gi, '"')
      if (texto === anterior) break
    }

    return texto
  },

  resolverUrl: function (value) {
    try {
      return new URL(dropzone.utils.normalizarUrlSei(value), GetBaseUrl()).href
    } catch (error) {
      return null
    }
  },

  validarAcao: function (value, acaoEsperada) {
    const url = dropzone.utils.resolverUrl(value)
    if (!url) return null
    try {
      return new URL(url).searchParams.get('acao') === acaoEsperada ? url : null
    } catch (error) {
      return null
    }
  }
}

/*
  Dropzone.ui
  IIFE que controla o estado da view
*/

dropzone.ui = (function () {
  const ui = {}

  // Criação segura dos elementos com jQuery
  ui.wrapper = $('<div/>').addClass('dropzone-wrapper')
  const $bg = $('<div/>').addClass('dropzone-bg')
  const $ui = $('<div/>').addClass('dropzone-ui')
  const $icon = $('<img/>').addClass('dropzone-icon')
  const $label = $('<p/>').addClass('dropzone-label')

  $ui.append($icon, $label)
  ui.wrapper.append($bg, $ui)

  function mudarIcone (icone) {
    $icon.attr('src', currentBrowser.runtime.getURL(`icons/${icone}`))
  }

  function mudarTexto (texto) {
    $label.text(texto)
  }

  function mudarProgresso (progresso) {
    mudarTexto('Criando documentos...' + progresso + '%')
  }

  function ocultar () {
    ui.wrapper.hide()
  }

  function checkarContemArquivos (dataTransfer) {
    return (
      dataTransfer &&
      dataTransfer.files &&
      dataTransfer.types &&
      dataTransfer.types.indexOf('Files') > -1
    )
  }

  function adicionarDropzone () {
    mudarTexto('Arraste aqui...')
    mudarIcone('fileUpload.png')

    ui.wrapper.appendTo('body')

    window.addEventListener('drop', function (evt) {
      evt.preventDefault()
      if (!checkarContemArquivos(evt.dataTransfer)) return
      mudarIcone('aguarde.gif')
      mudarProgresso(0)
      for (let i = 0; i < evt.dataTransfer.files.length; i++) {
        dropzone.jobs.adicionar(evt.dataTransfer.files[i])
      }
      dropzone.jobs.executar()
    })

    window.addEventListener('dragover', function (evt) {
      evt.preventDefault()
    })

    window.addEventListener('dragenter', function (evt) {
      evt.preventDefault()
      if (!checkarContemArquivos(evt.dataTransfer)) return
      ui.wrapper.show()
    })

    window.addEventListener('dragleave', function (evt) {
      evt.preventDefault()
      if (evt.relatedTarget === null) {
        ui.wrapper.hide()
      }
    })
  }

  return {
    adicionarDropzone,
    mudarProgresso,
    ocultar
  }
})()

/*
  Dropzone.jobs
  IIFE que gerencia os jobs de inserção de documentos
*/

dropzone.jobs = (function () {
  const jobs = []

  function adicionar (arquivoParaUpload) {
    const job = {
      arquivo: arquivoParaUpload,
      nome: arquivoParaUpload.name,
      status: 'em_andamento',
      progresso: 0,
      erro: ''
    }
    jobs.push(job)
  }

  function executar () {
    jobs.forEach(function (job) {
      const http = new dropzone.Http(job.arquivo, function (novoStatus, novoProgresso, erro) {
        job.status = novoStatus
        job.progresso = novoProgresso || 0
        job.erro = erro || ''
        atualizaProgresso()
        verificarSeCompletou()
      })
      http.inserirDocumentoExterno()
    })
  }

  function atualizaProgresso () {
    const totalProgresso = jobs.reduce(function (anterior, job) {
      if (job.status === 'em_andamento') return anterior + job.progresso
      if (job.status === 'erro') return anterior + 1
      if (job.status === 'completo') return anterior + 1
      return anterior
    }, 0)
    const progresso = Math.trunc((totalProgresso / jobs.length) * 100)
    dropzone.ui.mudarProgresso(progresso)
  }

  function verificarSeCompletou () {
    const haEmAndamento = jobs.some(function (job) { return (job.status === 'em_andamento') })
    if (haEmAndamento) return /* jobs ainda em andamento */

    /* jobs terminaram */
    const jobsComErro = jobs.filter(function (job) { return (job.status === 'erro') })

    /* quando há algum erro */
    if (jobsComErro.length > 0) {
      const jobsStr = jobsComErro.map(function (job) {
        return `${job.nome}: ${job.erro || 'falha não identificada'}`
      }).join('\n')
      dropzone.ui.ocultar()
      alert('Não foi possível incluir o(s) documento(s):\n\n' + jobsStr)
      jobs.length = 0
      return
    }

    /* recarrega a página após todos os documentos serem incluídos */
    jobs.length = 0
    location.reload()
  }

  return {
    adicionar,
    executar
  }
})()

/*
  Dropzone.http
  Função que deve ser construída (new) para cada upload.
  Faz uma série de requisições AJAX que permite criar o documento externo com o anexo informado como parâmetro.
*/
dropzone.Http = function (arquivoParaUpload, fnNovoStatus) {
  this.arquivoParaUpload = arquivoParaUpload
  this.fnNovoStatus = fnNovoStatus
}

dropzone.Http.prototype.falhar = function (mensagem) {
  dropzone.log(mensagem)
  this.fnNovoStatus('erro', 0, mensagem)
}

dropzone.Http.prototype.passos = {

  /*
    1º passo:
      - ler a url que abre a página 'Incluir Documento'
      - abrir a página
  */
  1: {

    obterUrl: function () {
      const scripts = Array.from(document.getElementsByTagName('script'))

      for (const script of scripts) {
        const conteudo = script.innerHTML || script.textContent || ''
        if (!/Nos\[0\]\.acoes/.test(conteudo)) continue

        /*
         * A árvore guarda suas ações como fragmentos HTML dentro de JavaScript.
         * Em vez de depender da posição/tabindex de um ícone, examina todos os
         * links e escolhe a ação real de incluir documento.
         */
        const ancoraRegex = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi
        let ancora
        while ((ancora = ancoraRegex.exec(conteudo)) !== null) {
          const href = /\bhref\s*=\s*(["'])(.*?)\1/i.exec(ancora[1])
          if (!href) continue

          const url = dropzone.utils.validarAcao(href[2], 'documento_escolher_tipo')
          if (url) return url
        }
      }

      return null
    },

    abrirPagina: function () {
      const urlDocExterno = this.passos['1'].obterUrl()
      if (urlDocExterno === null) {
        this.falhar('Etapa 1: o SEI não disponibilizou a ação “Incluir Documento”. Confira se o processo está aberto na unidade.')
        return
      }
      $.ajax({
        url: urlDocExterno,
        success: function (resposta) {
          this.passos['2'].abrirPagina.call(this, resposta)
        }.bind(this),
        error: function () {
          this.falhar('Etapa 1: o SEI recusou a abertura da página “Incluir Documento”.')
        }.bind(this)
      })
    }

  },

  /*
    2º passo:
      - ler a url que aponta para o tipo de documento 'Externo'
      - abrir a página
  */
  2: {

    obterUrl: function (resposta) {
      const documento = new DOMParser().parseFromString(resposta, 'text/html')
      const links = Array.from(documento.querySelectorAll('#tblSeries a[href], a[href]'))

      for (const link of links) {
        const url = dropzone.utils.validarAcao(
          link.getAttribute('href'),
          'documento_receber'
        )
        if (url) return url
      }

      return null
    },

    obterPost: function (resposta) {
      const documento = new DOMParser().parseFromString(resposta, 'text/html')
      const form = documento.querySelector('form#frmDocumentoEscolherTipo')
      if (!form?.getAttribute('action')) return null

      const data = {}
      Array.from(form.querySelectorAll('input[type="hidden"][name]')).forEach(function (input) {
        data[input.name] = input.value
      })
      data.hdnIdSerie = '-1'

      return {
        url: dropzone.utils.resolverUrl(form.getAttribute('action')),
        data
      }
    },

    abrirPagina: function (resposta) {
      const urlNovoDocExterno = this.passos['2'].obterUrl(resposta)
      const postNovoDocExterno = this.passos['2'].obterPost(resposta)
      if (urlNovoDocExterno === null && postNovoDocExterno === null) {
        this.falhar('Etapa 2: o tipo de documento “Externo” não foi encontrado na lista do SEI.')
        return
      }
      $.ajax({
        url: urlNovoDocExterno || postNovoDocExterno.url,
        method: urlNovoDocExterno ? 'GET' : 'POST',
        data: urlNovoDocExterno ? undefined : postNovoDocExterno.data,
        success: function (resposta) {
          this.passos['3'].enviarArquivo.call(this, resposta)
        }.bind(this),
        error: function () {
          this.falhar('Etapa 2: o SEI recusou a abertura do formulário de documento externo.')
        }.bind(this)

      })
    }

  },

  /*
    3º passo:
      - extrair a url para submeter o upload
      - faz o upload do arquivo
  */
  3: {

    obterURLUpload: function (resposta) {
      /*
       * O construtor infraUpload ganhou parâmetros adicionais em versões mais
       * novas do SEI. Para obter a URL, basta ler o segundo argumento; não é
       * necessário exigir o fechamento do construtor logo depois dele.
       */
      const constructorRegex = /new\s+infraUpload\s*\(\s*(['"])frmAnexos\1\s*,\s*(['"])(.*?)\2/im
      const constructorResult = constructorRegex.exec(resposta)
      if (constructorResult !== null) {
        return constructorResult[3]
          .replace(/&amp;/g, '&')
          .replace(/\\u0026|\\x26/gi, '&')
          .replace(/\\\//g, '/')
      }

      const documento = new DOMParser().parseFromString(resposta, 'text/html')
      const formAnexos = documento.querySelector('form#frmAnexos')
      const formAction = formAnexos?.getAttribute('action')
      if (formAction && /upload/i.test(formAction)) return formAction

      const texto = String(resposta)
        .replace(/&amp;/g, '&')
        .replace(/\\u0026|\\x26/gi, '&')
        .replace(/\\\//g, '/')
      const urls = texto.match(
        /(?:https?:\/\/[^'"\s)]+|(?:controlador(?:_ajax)?\.php|infra_upload\.php)\?[^'"\s)]+)/gi
      ) || []
      return urls.find(function (url) {
        return /upload|acao_ajax=infra_upload/i.test(url)
      }) || null
    },

    diagnosticarFormularioUpload: function (resposta) {
      const documento = new DOMParser().parseFromString(resposta, 'text/html')
      const forms = Array.from(documento.querySelectorAll('form'))
        .map(function (form) { return form.id || form.getAttribute('name') || 'sem-id' })
        .slice(0, 5)
      const fileInputs = Array.from(documento.querySelectorAll('input[type="file"]'))
        .map(function (input) { return input.id || input.getAttribute('name') || 'sem-id' })
        .slice(0, 5)
      const titulo = String(documento.title || 'sem-título')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 80)
      const texto = String(resposta)

      return [
        `tamanho=${texto.length}`,
        `título=${titulo}`,
        `infraUpload=${/infraUpload/i.test(texto) ? 'sim' : 'não'}`,
        `frmAnexos=${/frmAnexos/i.test(texto) ? 'sim' : 'não'}`,
        `termoUpload=${/upload/i.test(texto) ? 'sim' : 'não'}`,
        `formulários=${forms.join(',') || 'nenhum'}`,
        `camposArquivo=${fileInputs.join(',') || 'nenhum'}`
      ].join('; ')
    },

    obterUsuarioEUnidade: function (resposta) {
      const regex = /infraFormatarTamanhoBytes\s*\(\s*arr\[['"]tamanho['"]\]\s*\)\s*,\s*['"](.+?)['"]\s*,\s*['"](.+?)['"]\s*]/m
      const resultado = regex.exec(resposta)
      if (resultado === null) return null
      return {
        usuario: resultado[1],
        unidade: resultado[2]
      }
    },

    gerarHdnAnexos: function (usuarioEUnidade, uploadIdentificador) {
      const uploadIdentificadores = uploadIdentificador.split('#')
      if (uploadIdentificadores.length < 5) return null
      const id = uploadIdentificadores[0]
      const nome = uploadIdentificadores[1]
      const dthora = uploadIdentificadores[4]
      const tamanho = uploadIdentificadores[3]
      const tamanhoFormatado = dropzone.utils.infraFormatarTamanhoBytes(Number.parseInt(tamanho))
      return `${id}±${nome}±${dthora}±${tamanho}±${tamanhoFormatado}±${usuarioEUnidade.usuario}±${usuarioEUnidade.unidade}`
    },

    enviarArquivo: function (resposta) {
      const urlUpload = this.passos['3'].obterURLUpload(resposta)
      if (urlUpload === null) {
        const diagnostico = this.passos['3'].diagnosticarFormularioUpload(resposta)
        this.falhar(
          'Etapa 3: a URL de upload não foi localizada no formulário atual do SEI.' +
          `\nDiagnóstico: ${diagnostico}`
        )
        return
      }
      const data = new FormData()
      data.append('filArquivo', this.arquivoParaUpload, this.arquivoParaUpload.name)
      $.ajax({
        url: dropzone.utils.resolverUrl(urlUpload),
        method: 'POST',
        contentType: false,
        processData: false,
        data,
        xhr: function () {
          const xhr = $.ajaxSettings.xhr()
          if (xhr.upload) {
            xhr.upload.onprogress = function (e) {
              if (e.lengthComputable) {
                this.fnNovoStatus('em_andamento', (e.loaded / e.total))
              }
            }.bind(this)
          }
          return xhr
        }.bind(this),
        success: function (uploadIdentificador) {
          const usuarioEUnidade = this.passos['3'].obterUsuarioEUnidade(resposta)
          if (usuarioEUnidade === null) {
            this.falhar('Etapa 3: os dados do usuário e da unidade não foram localizados no formulário de upload.')
            return
          }
          const hdnAnexos = this.passos['3'].gerarHdnAnexos(usuarioEUnidade, uploadIdentificador)
          if (hdnAnexos === null) {
            this.falhar('Etapa 3: o SEI devolveu um identificador de upload em formato inesperado.')
            return
          }
          this.passos['4'].submeterFormulario.call(this, hdnAnexos, resposta)
        }.bind(this),
        error: function () {
          this.falhar('Etapa 3: o SEI recusou o envio do arquivo.')
        }.bind(this)
      })
    }

  },

  /*
    4º passo:
      - setar os dados do formulário da página do novo documento externo
      - submeter o formulário
  */
  4: {

    /* dá preferência por documento que seja denominado Anexo. Se não, escolhe o primeiro. */
    escolherTipoDocumentoExterno: function (select) {
      const options = select.find('option')
      let tipoDocumento = null
      const tipoPadrao = SavedOptions.incluirDocAoArrastar_TipoDocPadrao || 'Anexo'
      options.each(function () {
        if ($(this).text().trim() === tipoPadrao) tipoDocumento = $(this).attr('value')
      })
      return !tipoDocumento ? options.eq(1).attr('value') : tipoDocumento
    },

    escolherHipoteseInformacaoPessoal: function (select) {
      let hipotese = null
      select.find('option').each(function () {
        const texto = $(this).text()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/\s+/g, ' ')
          .trim()
          .toLocaleLowerCase('pt-BR')
        if (texto.includes('informacao pessoal')) {
          hipotese = $(this).attr('value')
          return false
        }
      })
      return hipotese
    },

    obterDados: function (hdnAnexos, resposta) {
      const $resposta = $('<div/>').append($.parseHTML(resposta, document, true))
      const $form = $resposta.find('form#frmDocumentoCadastro')
      const urlParaEnvio = $form.attr('action')
      if (!$form.length || !urlParaEnvio) return null

      /*
        Parte dos campos do SEI muda entre versões. Preservar os campos que o
        próprio formulário entregou evita perder hashes, flags e validações
        acrescentadas pelo SEI-RJ.
      */
      const postFields = {}
      $form.serializeArray().forEach(function (field) {
        postFields[field.name] = field.value
      })

      const serie = this.passos['4'].escolherTipoDocumentoExterno($form.find('#selSerie'))
      if (!serie) return null
      const hipoteseInformacaoPessoal = this.passos['4']
        .escolherHipoteseInformacaoPessoal($form.find('#selHipoteseLegal'))

      const nomeDoDocumento = this.arquivoParaUpload.name.replace(/\.[^/.]+$/, '').slice(0, 49)
      postFields.selSerie = serie
      postFields.hdnIdSerie = serie
      postFields.txtDataElaboracao = dropzone.utils.hoje()
      postFields.rdoTextoInicial = 'N'
      postFields.txtNumero = nomeDoDocumento
      postFields.rdoFormato = 'N'
      postFields.hdnAnexos = hdnAnexos
      postFields.hdnFlagDocumentoCadastro = postFields.hdnFlagDocumentoCadastro || '2'
      postFields.rdoNivelAcesso = '1'
      postFields.hdnStaNivelAcessoLocal = '1'
      if (hipoteseInformacaoPessoal) {
        postFields.selHipoteseLegal = hipoteseInformacaoPessoal
        postFields.hdnIdHipoteseLegal = hipoteseInformacaoPessoal
        postFields.hdnIdHipoteseLegalSugestao = hipoteseInformacaoPessoal
      }

      /* montar post body */
      let postData = ''
      for (const k in postFields) {
        if (postData !== '') postData = postData + '&'
        const valor = dropzone.utils.escapeComponent(String(postFields[k] ?? ''))
        postData = postData + k + '=' + valor
      }

      return {
        url: urlParaEnvio,
        data: postData
      }
    },

    /* como o ajax não deteca um redirect (302), temos que verificar se a página que retornou é a correta */
    paginaRetornouCorretamente: function (resposta, responseURL) {
      try {
        const url = new URL(responseURL)
        if (
          url.searchParams.get('acao') === 'arvore_visualizar' &&
          url.searchParams.get('acao_origem') === 'documento_receber'
        ) {
          return true
        }
      } catch (error) {
        // Mantém a verificação por conteúdo para versões antigas do SEI.
      }
      const documento = new DOMParser().parseFromString(resposta, 'text/html')
      return documento.querySelector('#divArvoreHtml') !== null
    },

    submeterFormulario: function (hdnAnexos, resposta) {
      const dados = this.passos['4'].obterDados.call(this, hdnAnexos, resposta)
      if (!dados) {
        this.falhar('Etapa 4: o formulário atual de documento externo está incompleto ou incompatível.')
        return
      }
      $.ajax({
        url: dropzone.utils.resolverUrl(dados.url),
        method: 'POST',
        data: dados.data,
        contentType: 'application/x-www-form-urlencoded; charset=ISO-8859-1',
        success: function (data, textStatus, xhr) {
          if (this.passos['4'].paginaRetornouCorretamente.call(this, data, xhr.responseURL)) {
            this.fnNovoStatus('completo', 1)
          } else {
            this.falhar('Etapa 4: o SEI devolveu o formulário sem confirmar a criação do documento.')
          }
        }.bind(this),
        error: function () {
          this.falhar('Etapa 4: o SEI recusou a gravação final do documento externo.')
        }.bind(this)
      })
    }

  }

}

dropzone.Http.prototype.inserirDocumentoExterno = function () {
  this.passos['1'].abrirPagina.call(this)
}

/*
  Dropzone.log
  Função para tossir o log padrão sei++ no console
*/
dropzone.log = function (mconsole, texto) {
  mconsole.log(texto)
}

/*
  Dropzone.iniciar
  Função invocada para iniciar a dropzone
*/
dropzone.iniciar = function (baseName) {
  dropzone.ui.adicionarDropzone()

  const mconsole = new __mconsole(baseName + '.Dropzone')
  dropzone.log = dropzone.log.bind(this, mconsole)
}
