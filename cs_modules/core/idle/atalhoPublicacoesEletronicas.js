/* global GetBaseUrl, __mconsole */

// atalhoPublicacoesEletronicas
// eslint-disable-next-line no-unused-vars
function atalhoPublicacoesEletronicas (BaseName) {
  const mconsole = new __mconsole(BaseName + '.atalhoPublicacoesEletronicas')

  // Verifica se o link existe.
  const url = 'publicacoes/controlador_publicacoes.php?acao=publicacao_pesquisar&id_orgao_publicacao=0'
  const txtitle = 'Publicações Eletrônicas'
  const containerClass = 'nav-item d-md-flex seipp-atalho-publicacoes-eletronicas'

  fetch(GetBaseUrl() + url).then(response => {
    if (!response.ok) {
      mconsole.log('Página de publicações não existe')
      return null
    } else {
      mconsole.log('Página de publicações existe')
      AdicionarAtalho()
    }
  }).catch(e => mconsole.log(e.message))

  function AdicionarAtalho () {
    const a = document.createElement('a')
    a.href = url
    a.title = txtitle
    a.target = '_blank'
    a.textContent = txtitle

    const div = document.createElement('div')
    div.className = containerClass
    div.appendChild(a)

    const barra = document.querySelector('#divInfraBarraSistemaPadraoD')
    if (barra) {
      barra.prepend(div)
    }
  }
}
