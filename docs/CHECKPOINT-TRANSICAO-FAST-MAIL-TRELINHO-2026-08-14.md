# Checkpoint de transição — FAST MAIL e Trellinho

Data do fechamento: 14 de agosto de 2026.

Este documento é o ponto oficial de continuidade após a validação da autenticação nativa e dos atalhos do FAST PROC. O próximo chat deve começar por este arquivo, por `AGENTS.md` e pelo topo remoto da branch indicada abaixo. Não reconstruir funcionalidades já validadas, não usar ZIP e não repetir diagnósticos encerrados sem uma regressão concreta.

## Fonte única de verdade

- Repositório: `thiagonevesrj/sei-protocolistas`
- Pull request: `#3 — Consolidar FAST MAIL e FAST PROC para teste operacional`
- Branch de trabalho: `agent/catalogo-fast-mail-amanha`
- Base da PR: `agent/integracao-fast-mail-fast-proc`
- Commit funcional mínimo deste checkpoint: `b1db54505ae8a7779d79bfbb28969c784936c3d4`
- Estado remoto conferido: PR aberta, em rascunho, não integrada e mergeável.

O topo remoto ficará à frente do commit mínimo por causa deste próprio checkpoint. Nunca retornar a branch para um commit anterior.

## Confirmações operacionais desta etapa

Thiago testou no ambiente real e confirmou como funcionando:

1. FAST PROC novamente operacional após a restauração da base estável.
2. Botão `SALVAR` do documento externo visível na área útil, sem exigir rolagem horizontal.
3. Central com botão `REABRIR SISTEMAS`, abrindo Webmail e SEI sem finalizar nem reiniciar o expediente e sem perder as métricas correntes.
4. FAST MAIL voltou a inserir a exigência no corpo da resposta, e não no campo de destinatário.
5. Automação da autenticação pelo botão nativo do SEI:
   - não existe mais botão/carimbo verde personalizado;
   - a extensão não tenta adivinhar qual ícone nativo recebeu o clique;
   - a presença da janela `Autenticação de Documento` é o gatilho;
   - o formulário recebe a senha salva na Central;
   - o comando nativo `Assinar` é acionado uma única vez;
   - o aviso `✓ AUTENTICADO COM SUCESSO` permanece por 2 segundos.
6. FAST PROC presencial com cinco atalhos de tipo de processo, todos confirmados em teste real:
   - `DEV. TAXAS`;
   - `DESIST. 1ª HAB.`;
   - `PERÍCIA MÉDICA`;
   - `GERAL VEÍCULOS`;
   - `GERAL HABILITAÇÃO`.

Esses itens são estáveis. Não pedir nova validação deles se o código correspondente não for alterado.

## Arquivos sensíveis e responsabilidades atuais

### FAST MAIL

- `cs_modules/fast_mail/index.js`: interface, navegação, preenchimento do e-mail, exigências, abertura do FAST PROC e retorno ao e-mail original.
- `cs_modules/fast_mail/styles.css`: apresentação da lateral do FAST MAIL.
- `data/catalogo-processos.json`: procedimentos, tipos SEI, destinos, checklists e mapeamento dos assuntos prioritários.
- `data/catalogo-scripts.json`: catálogo gerado com os scripts importados do Trello.
- `data/respostas-curadas.json`: respostas confirmadas pelo operador que devem prevalecer sobre versões antigas ou incorretas importadas.

### Importação dos scripts

- `scripts/build-script-catalog.js`: atualmente lê exportações `.json` de quatro quadros do Trello e anexos `.txt` locais.
- `scripts/test-script-catalog.js`: valida quantidade, conteúdo e buscas essenciais.
- `scripts/validate-extension.js`: protege integrações, catálogo, respostas curadas e regras operacionais.

Regras já implementadas e que devem ser preservadas:

- anexos `.txt` podem fornecer o corpo real do script;
- `DESTINO DO PROCESSO.txt` é configuração de roteamento e nunca pode virar resposta ao cidadão;
- destinos extraídos podem atualizar `data/catalogo-processos.json`;
- IDs dos cartões são preservados como origem dos scripts;
- respostas curadas prevalecem sobre a importação automática;
- nenhum dado de cidadão, documento ou credencial pode ser enviado a serviço externo.

### FAST PROC e autenticação

- `cs_modules/clique_protocolista/index.js`: modal, pesquisa do tipo, cinco atalhos e preenchimento do FAST PROC.
- `cs_modules/clique_protocolista/styles.css`: layout e atalhos do FAST PROC.
- `cs_modules/autenticacao_nativa/index.js`: observação da janela nativa, senha, assinatura e aviso de sucesso.
- `cs_modules/documento_receber/autopreencherDocumentoExterno.js`: preenchimento do documento externo e posicionamento do botão `SALVAR`.

Não alterar esses módulos durante a primeira análise do Trellinho.

## Estado atual do catálogo

- 181 cartões ativos na origem antiga.
- 5 versões duplicadas aposentadas de forma explícita.
- 176 scripts vigentes no catálogo.
- 175 respostas com conteúdo utilizável.
- 1 cartão ativo sem corpo de resposta.
- 16 assuntos operacionais na navegação prioritária do FAST MAIL.
- 11 assuntos permitem abrir processo e possuem checklist.
- 5 assuntos são somente orientação/atendimento presencial e não podem abrir processo indevidamente.

O gerador atual interrompe a importação se a quantidade final for diferente de 176. Essa trava foi útil para proteger a importação antiga, mas precisará ser revista de modo controlado quando chegar a nova estrutura do Trellinho. Não remover a trava antes de comparar as duas fontes e criar validações substitutas.

## Arquivo Trellinho mencionado por Thiago

Referência informada no computador do usuário:

`trellinho0708.html`

O caminho `file:///C:/Users/.../trellinho0708.html` é local ao computador de Thiago e não pode ser acessado pelo chat. No novo chat, Thiago deve anexar diretamente:

1. o `trellinho0708.html` atual, para estudo da estrutura;
2. quando estiver pronta, a exportação atualizada do Trellinho que será a fonte futura.

Não inferir o formato do arquivo apenas pelo nome. Ler o HTML real antes de alterar o importador.

## Objetivo autorizado para a próxima etapa

Adequar o FAST MAIL ao Trellinho e permitir atualizações futuras dos scripts sem reconstrução manual da interface ou perda das respostas já validadas.

A ordem obrigatória do trabalho é:

1. **Receber e inspecionar o HTML real do Trellinho.** Identificar cartões, listas/fases, IDs estáveis, descrições, anexos, datas, status e destinos.
2. **Comparar a fonte nova com o catálogo atual.** Produzir um diagnóstico de incluídos, alterados, removidos/arquivados, vazios, duplicados e destinos modificados.
3. **Definir a fonte única de atualização.** Separar claramente dados importados, regras de negócio e respostas curadas.
4. **Adaptar o importador.** A atualização futura deve ser executável novamente sobre novos arquivos, sem edição manual espalhada no FAST MAIL.
5. **Criar proteções contra regressão.** A importação não pode apagar silenciosamente respostas curadas, trocar destinos confirmados nem reativar versões aposentadas.
6. **Gerar relatório de atualização.** Antes de substituir o catálogo, mostrar as diferenças e bloquear alterações estruturalmente suspeitas.
7. **Só então reorganizar a interface do FAST MAIL.** A tela deve ser simplificada com base na estrutura real e atualizada dos scripts.

## Resultado arquitetural desejado

- O FAST MAIL consome dados estruturados e não contém cópias dispersas dos textos do Trellinho.
- Uma nova exportação pode atualizar o catálogo por um comando documentado.
- O importador preserva IDs estáveis para não romper os mapeamentos existentes.
- Mudanças do Trellinho ficam auditáveis em um relatório antes da aplicação.
- Respostas curadas continuam tendo precedência explícita.
- A interface pode ser reorganizada sem misturar importação, regra operacional e apresentação.
- Contagens como `176` deixam de ser a única proteção e passam a ser acompanhadas por validações de integridade, diferenças e cobertura dos fluxos essenciais.

## Limites para o próximo chat

- Diagnosticar antes de alterar.
- Pedir a Thiago o arquivo ou o elemento real quando a estrutura não estiver acessível; não adivinhar seletores, botões ou formato.
- Não mexer ao mesmo tempo no importador e na interface do FAST MAIL.
- Não alterar FAST PROC, autenticação, Central ou documento externo durante a primeira fase.
- Não usar ZIP nem pedir comandos PowerShell.
- Não fazer merge da PR #3 nem alterar `desenvolvimento` sem autorização explícita.
- Trabalhar em lotes pequenos, publicar na branch atual e orientar apenas `Fetch origin` → `Pull origin`.
- Não fazer chamadas ao Trello nem enviar dados para fora sem autorização explícita; trabalhar primeiro com os arquivos anexados.

## Validação do checkpoint

Executada em 14 de agosto de 2026, após os testes reais de Thiago:

- `git diff --check` — aprovado;
- `node scripts/validate-extension.js` — aprovado;
- `node scripts/test-fast-proc-flow.js` — aprovado;
- `node scripts/test-script-catalog.js` — aprovado;
- lint oficial dos arquivos mantidos — aprovado.

O lint total do legado não é critério deste checkpoint. O módulo antigo do FAST PROC ainda possui dívida de estilo anterior às mudanças atuais; não iniciar uma reformatação ampla durante a integração do Trellinho.

## Primeiro pedido do novo chat

O novo chat deve receber este texto junto do arquivo `trellinho0708.html`:

> Continue o projeto SEI Protocolistas pelo arquivo `docs/CHECKPOINT-TRANSICAO-FAST-MAIL-TRELINHO-2026-08-14.md`, no repositório `thiagonevesrj/sei-protocolistas`, PR #3 e branch `agent/catalogo-fast-mail-amanha`. O commit funcional mínimo validado é `b1db54505ae8a7779d79bfbb28969c784936c3d4`; use o topo remoto, que estará à frente por causa do checkpoint. Meu foco agora é adequar o FAST MAIL ao Trellinho e permitir atualizações futuras dos scripts. Antes de alterar qualquer código, leia o HTML anexado, compare sua estrutura com `scripts/build-script-catalog.js`, `data/catalogo-scripts.json`, `data/catalogo-processos.json` e `data/respostas-curadas.json`, e apresente um diagnóstico objetivo. Não mexa ainda na interface, no FAST PROC, na autenticação, na Central nem no documento externo. Preserve tudo que consta como validado, não use ZIP ou PowerShell e não faça merge nem altere `desenvolvimento` sem minha ordem.
