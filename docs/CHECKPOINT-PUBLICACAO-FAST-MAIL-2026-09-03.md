# CHECKPOINT — FAST MAIL PARA PUBLICAÇÃO — 03/09/2026

## Estado seguro

- Repositório: `thiagonevesrj/sei-protocolistas`
- Branch de trabalho: `agent/catalogo-fast-mail-amanha`
- PR #3: `Consolidar FAST MAIL e FAST PROC para teste operacional`
- PR continua em **draft** e **não deve ser mergeada sem autorização explícita de Thiago**.
- `desenvolvimento` não deve ser alterada sem autorização explícita.
- Topo validado antes deste checkpoint: `d3d410bd29a81df6762fcc385671f0442d56e73f`.
- GitHub Actions / `npm run validate`: **VERDE** neste topo.

## Correções de segurança feitas antes do checkpoint

1. `50bb742` — restaura uma aba recente do Webmail antes de criar outra quando a Central abre/reabre sistemas. Usa `chrome.sessions`, move a aba restaurada para a janela correta e preserva a reutilização da sessão. Objetivo adicional: reduzir criação desnecessária de novas sessões OWA diante do problema `MapiExceptionSessionLimit / TooManyObjectsOpenedException`.
2. `e996a81` — preserva as invariantes confirmadas da resposta curada de Troca de Clínica.
3. `d3d410b` — alinha o teste da Árvore Inteligente ao comportamento atual: mover usando a ação nativa `Ordenar Árvore do Processo`; renomeação continua desativada.

## O que já está implementado e não deve ser refeito

- FAST MAIL V2 com navegação progressiva e catálogo completo.
- Regra global de **próximo clique guiado**, com destaque visual mais longo.
- Devolução de Taxas prioriza Pessoa Física e DUDA quando aplicável.
- Ofícios possui triagem guiada para documento correto, documento ausente e ofício não direcionado ao DETRAN.RJ.
- Transferência de Prontuário possui checklist; protocolista marca somente as pendências, mas o cidadão é orientado a **reenviar toda a documentação necessária em um único e-mail**.
- Perícia Médica Fase 1 foi enxugada mantendo a regra da CI DETRAN/NUCAPHAB nº 24/2024.
- Troca de Clínica permanece resposta curada e confirmada pelo operador; processo por e-mail/presencial; destino SERVMT.
- Certidão de Identificação Civil foi liberada para abertura: `Detran: Solicitação de Certidão de Identificação Civil` / DIRIC.
- Leilão Geral (COMISLE) foi liberado operacionalmente; destino COMISLE conhecido; tipologia SEI ainda não confirmada.
- Camada Trellinho/Trello em lote existe e aplica estado operacional e etiquetas do Trello à Fase 2.
- Overlay não roda na tela de login do OWA.
- Novo JSON de estado da Fase 2 está exposto corretamente no manifest.
- Renomeação de item na Árvore continua desativada e não deve voltar.

# PENDÊNCIAS DE CÓDIGO DEFINIDAS NESTE CHAT

## P0 — obrigatório para o FAST MAIL ficar utilizável em produção

### 1. Identidade do requerente antes de desmontar o assunto

Regra funcional:

- O FAST MAIL precisa trabalhar com **nome completo + CPF confiáveis**.
- **Nunca considerar o nome extraído do endereço de e-mail como identidade válida.**
- Fontes aceitáveis: informação expressa no corpo do atendimento ou documento/requerimento efetivamente lido/confirmado pelo operador.
- Não criar cliques extras desnecessários.

Quando não houver identidade suficiente:

- mostrar estado claro `IDENTIDADE NÃO CONFIRMADA`;
- botão rápido e destacado: **SOLICITAR IDENTIFICAÇÃO**;
- um único clique deve:
  1. abrir/selecionar o `SCRIPT DE IDENTIFICAÇÃO COMPLETO` da Fase 1;
  2. preparar/inserir a resposta;
  3. indicar `AGUARDANDO IDENTIFICAÇÃO DO REQUERENTE`;
  4. impedir `undefined` no assunto;
  5. não tentar adivinhar o nome do cidadão pelo remetente.

Esse será um dos comandos mais usados do sistema.

### 2. Identificado, mas serviço não identificado

Segundo caso frequente:

- já temos nome/CPF confiáveis;
- o cidadão não explicou o que deseja ou a solicitação é ambígua.

Ação rápida: **IDENTIFICAR SERVIÇO**.

Um clique deve selecionar/preparar o script existente de **identificação do serviço**, sem obrigar o protocolista a navegar manualmente pelo catálogo.

Fluxo mental:

1. Quem é? Se não sabemos → `SOLICITAR IDENTIFICAÇÃO`.
2. O que quer? Se não sabemos → `IDENTIFICAR SERVIÇO`.
3. Sabemos quem é + sabemos o serviço → seguir ao assunto operacional.

### 3. Regra correta do ASSUNTO

Não usar a palavra `FASE` no formato do assunto.

Formato definido pelo operador:

`NOME - DDMMAA<NUMERO_DO_PROTOCOLISTA> - SETOR_DE_DESTINO - TRIAGEM`

Quando encerrado:

`NOME - DDMMAA<NUMERO_DO_PROTOCOLISTA> - SETOR_DE_DESTINO - FECHADO`

Quando a operação efetivamente usar a transição prevista no Trello/Trellinho, respeitar `TRIAGEM - FECHADO` conforme a regra da fonte, sem inventar variação.

Regras obrigatórias:

- `31` era apenas o exemplo do usuário atual.
- Número do protocolista deve ser **dinâmico**, obtido do operador validado na Central (`fastMailOperadorValidado`).
- Exemplo em 03/09/2026 para Protocolista 31: `03092631`.
- Nenhuma parte do assunto pode virar `undefined`.
- Se identidade ou destino ainda não existirem, usar estado provisório claro e não fabricar o assunto definitivo.

### 4. BAIXA DE RESTRIÇÃO deve ser a porta de entrada, não INVENTÁRIO

Problema encontrado em teste real: o protocolista não encontrou uma forma natural de responder uma solicitação de baixa de restrição por inventário.

Regra nova:

**VEÍCULOS → BAIXA DE RESTRIÇÃO**

Depois o FAST MAIL ramifica pelos tipos de baixa existentes nas fontes atuais.

Obrigatório incluir ao menos o fluxo de Inventário já conhecido:

`BAIXA DE RESTRIÇÃO → INVENTÁRIO → HERDEIROS / BAIXA DA RESTRIÇÃO`

`BAIXA DE RESTRIÇÃO → INVENTÁRIO → TERCEIROS / VENDA APÓS INVENTÁRIO`

O botão principal `Inventário` não deve ser a única porta de entrada. O chooser atual em `action-cue-v2.js` deve ser reaproveitado/refatorado para a nova hierarquia, não duplicado.

Também levantar no Trellinho/Trello os **demais tipos de baixa de restrição** e expô-los como ramificações coerentes.

### 5. Pendência documental em procedimento SOMENTE PRESENCIAL

Hoje o sistema tem lógica forte de pendência documental para abertura por e-mail. Para processos marcados `PRESENCIAL SOMENTE`, a semântica precisa mudar.

Não dizer ao cidadão para reenviar tudo por e-mail.

A ação deve ser algo como:

**DOCUMENTOS FALTANTES PARA LEVAR AO POSTO**

Funcionamento:

- protocolista marca somente o que está faltando;
- resposta automática informa quais documentos estão faltando **para o atendimento presencial**;
- orienta reunir a documentação completa;
- inclui o link oficial de agendamento quando o fluxo exigir;
- informa a necessidade de originais/retidos quando a fonte trouxer essa marcação;
- não oferece `ABRIR PROCESSO` por e-mail em fluxo `PRESENCIAL SOMENTE`.

Caso real que originou a regra: baixa de restrição por inventário para herdeiros.

### 6. Inventário — Herdeiros no atendimento presencial

No caso discutido, além do Requerimento Geral, a orientação do Trello contempla documentos como CRLV, identificação, CPF, residência e declaração dos demais herdeiros abrindo mão da propriedade, conforme o card vigente.

Regra de UX:

- a **declaração dos herdeiros** precisa aparecer como item selecionável de pendência;
- se houver formulário/anexo oficial vinculado ao card, o FAST MAIL deve disponibilizá-lo de forma direta;
- se for declaração de próprio punho e não houver formulário oficial público, **não inventar link ou arquivo**;
- para baixa isolada de restrição por inventário, **não cobrar DUDA automaticamente sem confirmação na fonte específica**. O DUDA 014-0 encontrado em material de transferência por inventário não deve ser extrapolado sem confirmação para a baixa isolada.

### 7. Leilão Geral — handoff manual da tipologia SEI

Estado conhecido:

- Leilão Geral ativo;
- COMISLE confirmado;
- formulário DRV0079 e resposta disponíveis;
- abertura por e-mail/presencial indicada nas fontes;
- **nome exato da tipologia SEI ainda não confirmado**.

Pendência técnica:

- quando `manualSeiTypeSelection === true`, o FAST PROC não pode usar `procedureName` (`Leilão - Geral (COMISLE)`) como tentativa de nome do Tipo de Processo;
- campo de tipologia deve chegar **em branco / aguardando seleção manual**;
- destino COMISLE deve permanecer carregado;
- próximo clique deve guiar o operador somente para escolher o Tipo do Processo;
- não bloquear o atendimento inteiro por causa desse único campo.

### 8. Estado atual do Trello também para Fase 1 e EX/AG

Arquivos enviados neste chat mostraram:

- Fase 1: 29 cards totais / 22 ativos;
- Fase 2: 102 totais / 100 ativos;
- EX/AG: 62 totais / 54 ativos;
- os dois JSONs EX/AG enviados eram cópias idênticas.

A integração atual criou `data/trello-fase02-estado-atual.json` somente para a Fase 2.

Pendência:

- consolidar o estado vigente também da **Fase 1** e **EX/AG**;
- `closed=true` deve retirar a opção operacional;
- card aberto entra;
- preservar etiquetas relevantes quando existirem;
- não duplicar o arquivo EX enviado duas vezes.

A Fase 3 permanece com a fonte já documentada até receber exportação visual/JSON mais atual.

## P1 — fazer logo após os bloqueadores de produção

### 9. Formulários associados a documentos faltantes

Quando um documento faltante possui formulário/link oficial conhecido, o sistema deve apresentar o formulário junto da pendência automaticamente. Não exigir que o protocolista procure no Trello.

Não fabricar formulário quando a fonte só exigir declaração livre/próprio punho.

### 10. Curadoria editorial em lote das respostas

Objetivo inicial deste chat era `deixar lisos os scripts das respostas`.

Já feito:

- Perícia Médica — TRIAGEM;
- Troca de Clínica;
- Comunicação de Venda já estava suficientemente curta.

Ainda pendente:

- varredura editorial do restante dos scripts ativos, **sem mudar regra operacional, documentação, links, destino ou modalidade**;
- priorizar os scripts mais usados;
- respostas curadas prevalecem e não podem ser sobrescritas por importação.

## Regra de exigência documental por e-mail — CONGELADA

Não alterar novamente:

- protocolista marca **somente o que está faltando**;
- a resposta informa a pendência;
- cidadão deve **reenviar TODA a documentação necessária novamente em um único e-mail**, inclusive os documentos que já havia enviado;
- o próprio Trello EX possui scripts confirmando essa regra.

## Fonte operacional consolidada

Ordem de confiança:

1. Trello visual / JSON atual para vigência (`closed`, labels, cards efetivamente publicados);
2. Trellinho para texto, formulários, regras, destino, tipologias e automações extraídas;
3. manuais oficiais do SEI para registro;
4. catálogo interno para integração FAST MAIL ↔ FAST PROC;
5. respostas curadas confirmadas pelo operador prevalecem contra regressões.

Não copiar o Trellinho como interface. FAST MAIL precisa continuar enxuto, visual e guiado.

## UX global — CONGELADA

Princípio: **próximo clique guiado**.

- durante automação: `AGUARDE / PREENCHENDO`;
- quando pronto: destacar exatamente a ação permitida;
- sem deixar o protocolista parado procurando o que fazer;
- evitar etapas intermediárias desnecessárias;
- um caso comum deve exigir o mínimo possível de decisões.

## OWA / SessionLimit

Problema externo recorrente da conta do usuário:

- `MapiExceptionSessionLimit`;
- `TooManyObjectsOpenedException`;
- mailbox Protocolista 31.

GREDINFO já foi acionada. Não atribuir esse erro ao FAST MAIL.

A extensão foi ajustada para:

- reutilizar uma aba OWA válida;
- ignorar aba com erro/login/logoff;
- restaurar aba OWA recentemente fechada antes de criar uma nova;
- evitar overlay Trellinho/Trello na tela de login.

## Publicação

O repositório possui workflow de **validação**, não um workflow de deploy/publicação da extensão.

Portanto:

- commit na branch não significa automaticamente `modo publicado`;
- antes de promover para o modo publicado é necessário identificar o mecanismo real usado pelo ambiente distribuído;
- não mover `desenvolvimento`, não mergear PR #3 e não promover branch sem autorização explícita de Thiago;
- usuário declarou intenção de usar o **modo publicado ainda em 03/09/2026**, sem depender de teste na extensão local.

## Ordem recomendada para o próximo chat

1. Ler este checkpoint e confirmar o topo atual da branch.
2. Não revalidar decisões já congeladas.
3. Implementar P0.1 + P0.2 (identidade / identificar serviço) com poucos cliques.
4. Implementar P0.3 (assunto dinâmico por operador, sem `undefined`).
5. Implementar P0.4 (BAIXA DE RESTRIÇÃO e ramificações).
6. Implementar P0.5/P0.6 (pendências para atendimento presencial / inventário).
7. Implementar P0.7 (Leilão com tipologia manual e COMISLE preservado).
8. Consolidar P0.8 (estado F1 + EX/AG).
9. Rodar `npm run validate` via GitHub Actions e exigir verde.
10. Identificar caminho de promoção para o modo publicado; só então solicitar autorização explícita para a ação que altera o ambiente publicado.

## Restrições

- Sem ZIP.
- Sem PowerShell para o usuário.
- Fluxo preferido de atualização local, quando necessário: GitHub Desktop `Fetch origin → Pull origin`.
- Não reconstruir funcionalidades já validadas.
- Não reativar renomeação na árvore.
- Não mexer no RQ validado.
- Não automatizar SALVAR no FAST PROC; continuar guiando o clique do protocolista.
