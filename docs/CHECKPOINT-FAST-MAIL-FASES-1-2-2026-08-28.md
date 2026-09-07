# Checkpoint de transição — FAST MAIL, Fases 1 e 2

Data do fechamento: 28 de agosto de 2026.

Este é o ponto oficial de continuidade do projeto após os testes reais do FAST MAIL e das tentativas de estabilização da abertura do Webmail pela Central. O próximo chat deve começar por este documento, por `AGENTS.md` e pelo topo remoto da branch. Não reconstruir funcionalidades validadas, não repetir a investigação do OWA neste primeiro lote e não trabalhar sobre cópias antigas.

## Fonte única de verdade

- Repositório: `thiagonevesrj/sei-protocolistas`
- Pull request: `#3 — Consolidar FAST MAIL e FAST PROC para teste operacional`
- Branch de trabalho: `agent/catalogo-fast-mail-amanha`
- Base da PR: `agent/integracao-fast-mail-fast-proc`
- Topo funcional anterior a este checkpoint: `b7b190bb05027383819786b494b254b54ab06701`
- Estado: PR aberta, em rascunho, não integrada e mergeável.
- Versão exibida pela Central: `0.5.0`.

O topo remoto ficará à frente do SHA acima por causa do commit deste checkpoint. Sempre usar o topo remoto; nunca retornar a branch para um commit anterior.

## Confirmações reais desta etapa

Thiago testou no ambiente real e confirmou:

1. O erro em que os campos Nome e CPF do FAST MAIL apagavam sozinhos parou de ocorrer.
2. O FAST MAIL não reinicializa mais o atendimento a cada varredura periódica do Webmail.
3. Quando o Webmail já está aberto, `REABRIR SISTEMAS` reutiliza a aba existente em vez de abrir uma segunda sessão.
4. FAST PROC, autenticação nativa, Central, documento externo e retorno ao e-mail original permanecem preservados.
5. A navegação atual do FAST MAIL possui:
   - Fase 1 — Identificação;
   - Fase 2 — Orientação;
   - Fase 3 — Protocolos;
   - Extras — Exigências e finalização.
6. Dentro de Orientação aparecem Habilitação, Perícia Médica, Veículos, Taxas e Ofícios.
7. Perícia Médica possui botão próprio.
8. Leilão de Veículos está disponível para resposta e usa a rota estruturada `COMISLE` na preparação do assunto.
9. Leilão ainda não pode abrir FAST PROC sem tipo SEI confirmado.

Não pedir novamente validação dos itens confirmados se seus arquivos não forem alterados.

## Pendência futura explícita — sessão do Webmail/OWA

O problema abaixo **não foi resolvido** e foi adiado por decisão de Thiago:

- se a aba principal do Webmail continua aberta, `REABRIR SISTEMAS` encontra e reutiliza a aba corretamente;
- se a aba principal do Webmail é fechada e a Central permanece aberta, clicar em `REABRIR SISTEMAS` ainda pode abrir/restaurar o endereço `venus2.detran.rj.gov.br/owa/` com a mensagem do Outlook Web App de que já existe sessão em outro separador;
- no último teste real, o erro continuou mesmo após a restauração ser direcionada para a mesma janela da Central.

Tentativas preservadas na branch:

- `94b835f` — reutilizar aba existente do OWA;
- `812e9e3` — manter sessão única também no envio de relatos;
- `7144c99` — restaurar aba fechada usando `chrome.sessions`;
- `b7b190b` — mover a aba restaurada para a janela da Central.

Resultado conhecido:

- reutilização de aba aberta: funciona;
- restauração após fechar a aba: falha no OWA real;
- validações automatizadas passaram, mas não reproduzem a trava interna de sessão do servidor OWA.

O próximo chat não deve tentar corrigir isso antes das Fases 1 e 2. Manter como backlog. Quando retomado, diagnosticar o ciclo de sessão do OWA e considerar que restaurar a aba fechada pode preservar uma sessão inválida; não declarar resolvido sem teste real de Thiago.

## Estado atual do FAST MAIL

A compactação visual reduziu o excesso de caixas, mas a hierarquia atual por fases ainda não ficou operacionalmente simples:

- a Fase 1 está difícil para localizar scripts;
- a Fase 2 ainda depende de escolhas demais;
- os principais atendimentos precisam aparecer de forma imediata;
- o catálogo completo deve continuar disponível sem competir com o fluxo rápido;
- Fase 3 é usada raramente de forma manual e deve ser preferencialmente automática/discreta.

O fluxo final deve reduzir cliques e refletir a rotina do protocolista, sem exibir uma lista enorme.

## Primeira tarefa autorizada do próximo chat

Organizar definitivamente as Fases 1 e 2 do FAST MAIL, mantendo a Fase 3 como etapa automática ou fallback discreto.

### Fase 1 — Identificação

Deve funcionar de forma semelhante à área de Orientação:

1. principais scripts de identificação expostos como atalhos;
2. demais scripts agrupados por setor/lista do Trellinho;
3. pesquisa para casos menos frequentes;
4. opção clara para quando o assunto ainda não foi identificado.

Principais scripts já reconhecidos no catálogo e candidatos aos atalhos:

- Script de Identificação Completo;
- Script de Identificação do Serviço;
- Script de Simples Identificação;
- Triagem — Devolução de Taxas;
- Triagem — Perícia Médica;
- Identificação — Inventário.

Grupos/setores conhecidos que podem organizar o restante:

- DAF;
- DIVMED;
- DRV;
- Infrações;
- Aplicativos;
- Scripts gerais.

Confirmar os nomes e a visibilidade no catálogo vigente antes de fixar a lista final.

### Fase 2 — Orientação

Deve expor os principais atendimentos já prontos para escolha e, depois do assunto, oferecer a ação adequada:

- Responder/orientar;
- Cobrar documentos/exigência;
- Abrir processo, somente quando houver metadados e checklist confirmados.

Principais atendimentos solicitados por Thiago:

- Devolução de Taxas;
- Perícia Médica, com botão exclusivo;
- Desistência de Categoria na Primeira Habilitação;
- Genérico de Habilitação;
- Genérico de Veículos;
- Leilão de Veículos;
- Troca de Clínica;
- Certidão de Identificação Civil;
- Ofícios.

Regras importantes:

- Transferência de Prontuário permanece coberta pelo Genérico de Habilitação, sem impedir atalho próprio se o fluxo justificar;
- Leilão responde com o script público e prepara o assunto com `COMISLE`, mas não abre FAST PROC enquanto faltar tipo SEI confirmado;
- Certidão de Identificação Civil deve ganhar acesso rápido próprio;
- não remover atendimentos atuais para inserir os novos;
- manter `Buscar outro atendimento` como catálogo completo;
- incluir um caminho simples para “ainda não sei o assunto”.

### Fase 3 — Protocolos

É posterior à abertura do processo e raramente deve ser acionada manualmente. Preservar os modelos atuais de retorno e automatizar a escolha quando os dados do processo já forem conhecidos. Manter apenas uma alternativa manual discreta para exceções.

Modelos conhecidos:

- Padrão/Habilitação;
- DAF;
- DIVMED;
- DRV;
- AGEM.

## Certidão de Identificação Civil

Situação conhecida:

- existe nos dados como `Certidão de Identificação Civil`;
- grupo/setor: `DIRIC`;
- tipo SEI cadastrado: `Detran: Solicitação de Certidão de Identificação Civil`;
- destino cadastrado: `DIRIC`;
- formulário específico registrado;
- checklist ainda marcado como `pending-validation`;
- ainda não aparece na navegação rápida.

Na primeira entrega, pode oferecer resposta/orientação. Não habilitar `Abrir processo` até o checklist documental ser validado por Thiago.

## Trellinho/Trello — regra de publicação

A fonte operacional válida não é todo registro encontrado na constante interna do HTML. A regra confirmada por Thiago é:

> Somente cards efetivamente publicados e visíveis aos usuários na interface atual do Trello/Trellinho podem alimentar o FAST MAIL.

Consequências obrigatórias:

- ignorar cards ocultos, arquivados, desativados e históricos;
- ignorar versões antigas que não aparecem ao público;
- não resolver duplicidades invisíveis por data, texto ou suposição;
- não promover automaticamente todos os 196 registros internos do HTML;
- respostas curadas continuam protegidas;
- card retirado da interface pública não deve continuar ofertado como atendimento;
- em caso de dúvida, bloquear a importação e pedir evidência da interface visível.

## Estado da importação dinâmica

Infraestrutura já publicada:

- leitura do `SCRIPTS` embutido no HTML;
- preservação de IDs antigos;
- proteção de respostas curadas;
- relatório de inclusões, alterações, ausências e conflitos;
- bloqueio de duplicidades com textos diferentes;
- preservação de destinos confirmados.

Contagens conhecidas:

- catálogo operacional atual: 176 scripts;
- base interna do HTML analisado: 196 registros;
- quatro fases;
- 42 registros com destino;
- 40 com tipologia.

Os 196 registros **não foram aplicados integralmente**, pois a base interna não informa publicação/visibilidade e contém lixo histórico invisível na interface pública.

## Arquivos principais

### FAST MAIL e catálogos

- `cs_modules/fast_mail/index.js`
- `cs_modules/fast_mail/styles.css`
- `data/catalogo-processos.json`
- `data/catalogo-scripts.json`
- `data/respostas-curadas.json`

### Importação e validações

- `scripts/build-script-catalog.js`
- `scripts/test-script-catalog.js`
- `scripts/test-fast-proc-flow.js`
- `scripts/validate-extension.js`
- `docs/ATUALIZACAO-TRELLINHO.md`

### Central e abertura de sistemas

- `background/service-worker.js`
- `central_protocolista/main.js`
- `manifest.json`

Não alterar Central/OWA durante o primeiro lote do próximo chat.

## Limites e forma de trabalho

- Não usar ZIP.
- Não pedir comandos PowerShell.
- Trabalhar na branch `agent/catalogo-fast-mail-amanha`.
- Publicar em lotes pequenos e orientar somente `Fetch origin` → `Pull origin`.
- Não fazer merge da PR #3 nem alterar `desenvolvimento` sem autorização explícita de Thiago.
- Não revalidar módulos estáveis sem mudança correspondente.
- Não mexer no FAST PROC, autenticação, Central ou documento externo durante a reorganização inicial das Fases 1 e 2.
- Não inventar destino, tipo SEI, checklist, formulário ou visibilidade de card.
- GitHub Actions deve passar antes de liberar qualquer Pull.

## Validação no topo anterior ao checkpoint

No commit `b7b190bb05027383819786b494b254b54ab06701`:

- validações locais do projeto: aprovadas;
- simulações automatizadas da abertura de sistemas: aprovadas;
- GitHub Actions `Validar extensão`: aprovado;
- teste real de restauração do OWA após fechar a aba: reprovado e registrado como pendência.

## Primeiro pedido para o novo chat

> Continue o projeto SEI Protocolistas pelo arquivo `docs/CHECKPOINT-FAST-MAIL-FASES-1-2-2026-08-28.md`, no repositório `thiagonevesrj/sei-protocolistas`, PR #3 e branch `agent/catalogo-fast-mail-amanha`. Use o topo remoto. A primeira tarefa é reorganizar definitivamente as Fases 1 e 2 do FAST MAIL: principais scripts visíveis, demais atendimentos agrupados por setor e busca como fallback; depois do assunto, oferecer Orientação, Exigência ou Abrir processo quando seguro. Preserve a Fase 3 como automática/discreta. Leia primeiro o checkpoint e os arquivos do FAST MAIL/catálogos. Não mexa no FAST PROC, autenticação, Central, documento externo nem na pendência do OWA neste lote. Use apenas cards públicos e visíveis do Trello/Trellinho, não use ZIP/PowerShell, não faça merge nem altere `desenvolvimento` sem minha ordem.
