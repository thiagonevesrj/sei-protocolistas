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
    const texto = String(value || '').replace(/&amp;/g, '&')
    const resultado = texto.match(/(?:https?:\/\/[^'"\s)]+|controlador\.php\?[^'"\s)]+)/i)
    return resultado ? resultado[0].replace(/\\+$/, '') : null
  },

  resolverUrl: function (value) {
    try {
      return new URL(value, GetBaseUrl()).href
    } catch (error) {
      return null
    }
  },

  extrairUrlPorAcao: function (value, acao) {
    const texto = String(value || '')
      .replace(/&amp;/g, '&')
      .replace(/\\u0026|\\x26/gi, '&')
    const urls = texto.match(
      /(?:https?:\/\/[^'"\s)\\]+|controlador\.php\?[^'"\s)\\]+)/gi
    ) || []

    for (const candidate of urls) {
      const cleanCandidate = candidate.replace(/\\+$/, '')
      const resolved = dropzone.utils.resolverUrl(cleanCandidate)
      if (!resolved) continue
      try {
        if (new URL(resolved).searchParams.get('acao') === acao) {
          return cleanCandidate
        }
      } catch (error) {
        // Ignora candidatos que não sejam URLs válidas.
      }
    }
    return null
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
      const links = Array.from(document.querySelectorAll('a[href]'))
      const linkIncluirDocumento = links.find(function (element) {
        const href = element.getAttribute('href')
        return /acao=documento_escolher_tipo/i.test(href) ||
          /documento_escolher_tipo/i.test(element.getAttribute('onclick') || '')
      })
      if (linkIncluirDocumento) {
        const origem = [
          linkIncluirDocumento.getAttribute('href'),
          linkIncluirDocumento.getAttribute('onclick')
        ].filter(Boolean).join(' ')
        const url = dropzone.utils.extrairUrlControlador(origem)
        if (url) return url
      }

      const scripts = Array.from(document.getElementsByTagName('script'))
      for (const script of scripts) {
        if (!/Nos\[0\]\.acoes/.test(script.textContent)) continue
        const url = dropzone.utils.extrairUrlControlador(script.textContent)
        if (url) return url
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
        url: dropzone.utils.resolverUrl(urlDocExterno),
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
      const links = Array.from(documento.querySelectorAll(
        'a[href], a[onclick], a[data-url]'
      ))
      const linkExterno = links.find(function (element) {
        return element.textContent.trim().toLocaleLowerCase('pt-BR') === 'externo'
      })
      if (linkExterno) {
        const origem = [
          linkExterno.getAttribute('href'),
          linkExterno.getAttribute('onclick'),
          linkExterno.getAttribute('data-url')
        ].filter(Boolean).join(' ')
        const url = dropzone.utils.extrairUrlControlador(origem)
        if (url) return url
      }

      /*
       * O SEI-RJ também pode entregar as opções como trechos de HTML guardados
       * dentro de JavaScript. Uma requisição AJAX não executa esse JavaScript,
       * portanto o link ainda não existe no DOM analisado acima. Ler o trecho
       * como texto permite localizar a URL sem executar código da página.
       */
      const ancoraRegex = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi
      let ancora
      while ((ancora = ancoraRegex.exec(resposta)) !== null) {
        const texto = ancora[2]
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;|&#160;/gi, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .toLocaleLowerCase('pt-BR')
        if (texto !== 'externo') continue

        const url = dropzone.utils.extrairUrlControlador(ancora[1])
        if (url) return url
      }

      /*
       * No SEI-RJ atual, o endereço pode aparecer separado do rótulo “Externo”
       * dentro das estruturas JavaScript da lista. A ação documento_receber é
       * justamente o formulário que cria o tipo final Anexo.
       */
      return dropzone.utils.extrairUrlPorAcao(resposta, 'documento_receber')
    },

    abrirPagina: function (resposta) {
      const urlNovoDocExterno = this.passos['2'].obterUrl(resposta)
      if (urlNovoDocExterno === null) {
        this.falhar('Etapa 2: o SEI não informou o caminho interno para cadastrar o arquivo como Anexo.')
        return
      }
      $.ajax({
        url: dropzone.utils.resolverUrl(urlNovoDocExterno),
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
      const regex = /objUpload\s*=\s*new\s+infraUpload\s*\(\s*['"]frmAnexos['"]\s*,\s*['"](.+?)['"]\s*\)/m
      const resultado = regex.exec(resposta)
      if (resultado === null) return null
      return resultado[1]
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
        this.falhar('Etapa 3: a URL de upload não foi localizada no formulário atual do SEI.')
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

      const nomeDoDocumento = this.arquivoParaUpload.name.replace(/\.[^/.]+$/, '').slice(0, 49)
      postFields.selSerie = serie
      postFields.hdnIdSerie = serie
      postFields.txtDataElaboracao = dropzone.utils.hoje()
      postFields.rdoTextoInicial = 'N'
      postFields.txtNumero = nomeDoDocumento
      postFields.rdoFormato = 'N'
      postFields.hdnAnexos = hdnAnexos
      postFields.hdnFlagDocumentoCadastro = postFields.hdnFlagDocumentoCadastro || '2'
      postFields.rdoNivelAcesso = postFields.rdoNivelAcesso || '0'

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
    paginaRetornouCorretamente: function (resposta) {
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
        success: function (data, textStatus, xhr) {
          if (this.passos['4'].paginaRetornouCorretamente.call(this, data)) {
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
