# FAST MAIL — novos atendimentos COOGP

## Serviços incluídos

Os atendimentos **Solicitação de pagamento, Meritocracia** e **Conversão em pecúnia de férias e/ou licenças-prêmio não gozadas** foram adicionados à fase Orientação, no grupo COOGP. Eles aparecem na busca **Outro serviço** e também no catálogo completo.

A Meritocracia preserva a condição provisória indicada no cartão de origem. Ambos os serviços encaminham para COOGP.

## Formulários

Os PDFs fornecidos foram empacotados em `data/anexos/` e declarados como recursos acessíveis ao FAST MAIL:

- Meritocracia: requerimento Anexo I e declaração de não ajuizamento.
- Conversão: requerimento próprio para férias/licença-prêmio e declaração de não ajuizamento.
- A declaração é o mesmo arquivo fornecido para os dois cartões e é compartilhada no pacote.

Ao selecionar um script no catálogo completo, o painel mostra links para baixar os formulários. Os links ficam no Protocolistas, não na mensagem ao cidadão; o servidor baixa os PDFs e os anexa ao e-mail.

## Validação local e operacional — 16/10/2026

- `node scripts/test-script-catalog.js` confirma a busca parcial `meri`, os dois atendimentos, o grupo/destino COOGP e a existência dos PDFs.
- `node scripts/validate-extension.js` confirma a estrutura da extensão e os arquivos declarados no manifesto.
- `node scripts/test-fast-mail-navigation-v2.js` e `node scripts/test-fast-mail-workflow-v3.js` passaram após a correção do fluxo de seleção.
- O requerimento de conversão foi conferido visualmente; identifica-se como Anexo I e inclui documentação para servidor, cônjuge e filho(a).
- Teste real no OWA com a extensão local: a busca localizou “Conversão em pecúnia de férias e/ou licenças-prêmio não gozadas”; o painel exibiu os links dos dois formulários; “INSERIR RESPOSTA” colocou a orientação no corpo do e-mail. Evidência recebida em captura de tela em 16/10/2026.

## Falhas encontradas e correções

1. Ao declarar os PDFs no `web_accessible_resources` do manifesto, a lista existente do FAST MAIL foi substituída. Isso removeu `data/respostas-curadas.json` e outros recursos usados pelo painel. Como o carregamento do catálogo espera em conjunto o catálogo de scripts e as respostas curadas, a falha impediu a renderização das fases. A lista original foi restaurada e os três PDFs foram acrescentados sem remover os recursos anteriores.
2. A busca da Orientação selecionava um script no fluxo visual, mas tentava abrir o catálogo interno sem ativar primeiro a fase nativa correspondente. O botão de inserir permanecia bloqueado pela mensagem “Selecione primeiro a fase do atendimento.” A seleção agora ativa a fase do script antes de abrir o catálogo; os testes locais passaram e a captura operacional confirmou a inserção da resposta de Conversão.

## Ponto de validação

Em 16/10/2026, o usuário confirmou no OWA local a localização do script de Conversão, a exibição dos formulários e a inserção do texto no corpo do e-mail. Em 28/10/2026, confirmou que Meritocracia e Conversão estão funcionando na base local. A validação automatizada completa da extensão também passou em 28/10/2026.

