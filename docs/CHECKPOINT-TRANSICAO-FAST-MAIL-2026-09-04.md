# Checkpoint de transição — FAST MAIL / FAST PROC

Data do fechamento: 4 de setembro de 2026, fim do expediente de testes.

Este é o ponto oficial de continuidade do projeto PROTOCOLISTAS para um novo chat. O novo chat deve começar por este arquivo, usar o topo remoto da branch indicada abaixo e **não revalidar do zero** funcionalidades já confirmadas. Não reconstruir a extensão, não usar ZIP, não pedir PowerShell e não fazer merge sem autorização explícita de Thiago.

## 1. Fonte única de verdade do código

- Repositório: `thiagonevesrj/sei-protocolistas`
- Pull request: `#3 — Consolidar FAST MAIL e FAST PROC para teste operacional`
- Estado da PR no fechamento: aberta, draft, não integrada, mergeável.
- Branch de trabalho: `agent/catalogo-fast-mail-amanha`
- Base da PR: `agent/integracao-fast-mail-fast-proc`
- Commit técnico imediatamente anterior a este checkpoint: `11b36cf70f85da95d5924a6bbc0337868c13d066`
- A branch `desenvolvimento` não foi alterada.

O topo remoto ficará à frente de `11b36cf` por causa do commit deste próprio checkpoint. **Sempre trabalhar sobre o topo remoto; nunca resetar a branch para um commit anterior.**

## 2. Modo de trabalho exigido por Thiago

- Fluxo local: **GitHub Desktop → Fetch origin → Pull origin → Recarregar extensão → F5 no Webmail/SEI quando necessário**.
- Não usar ZIP.
- Não pedir comandos PowerShell para atualização normal.
- Não fazer testes botão por botão. Corrigir causas estruturais em lote e validar com 2 ou 3 cenários representativos.
- Se Thiago confirmar que algo funciona, congelar o comportamento e não “otimizar” sem necessidade.
- A versão local de Thiago e a versão publicada/online usada por outros protocolistas são ambientes diferentes. Pull/reload local não altera a versão publicada.
- Não publicar nem integrar automaticamente. A publicação será uma etapa separada após a versão local ficar redonda.

## 3. Princípio global de UX

Regra do projeto: **próximo clique guiado**.

O protocolista não deve ficar parado procurando o que fazer:

- enquanto a automação trabalha: mostrar estado do tipo `AGUARDE`, `PREENCHENDO`, `CARREGANDO`;
- quando o próximo passo estiver disponível: rolar até ele e destacar/piscar visualmente;
- não automatizar cliques finais que exigem confirmação humana, como `SALVAR`, `ENVIAR`, `INSERIR RESPOSTA` ou autenticação;
- o clique guiado deve ser padrão global, não exceção por serviço.

A implementação existe, mas Thiago ainda considera o clique guiado inconsistente em alguns fluxos. Melhorar sem desmontar o restante.

## 4. Estrutura atual desejada do FAST MAIL

A primeira tela do FAST MAIL deve ser o seletor de etapa:

- `IDENTIFICAÇÃO`
- `ORIENTAÇÃO`
- `EXIGÊNCIAS`

### Identificação

Atalhos principais:

- Identificação Completa;
- Identificar Serviço;
- Não é Conosco;
- Ouvidoria;
- Simples Identificação.

Regra importante já definida:

**selecionar um script NÃO pode inserir automaticamente a resposta.**

Fluxo correto da Identificação Completa:

1. selecionar o fluxo;
2. levar para `DADOS DO REQUERENTE`;
3. nome + CPF quando existirem, ou opção `REQUERENTE SEM DADOS`;
4. somente depois liberar `INSERIR RESPOSTA`;
5. apenas esse clique explícito escreve no e-mail.

O nome do requerente **não pode ser deduzido do endereço de e-mail**. Deve vir de documento ou informação expressa do requerente.

### Orientação

Atendimentos principais atualmente expostos:

- Baixa de Restrição;
- Devolução de Taxas;
- Perícia Médica;
- Desistência de Categoria;
- Genérico Habilitação;
- Genérico Veículos;
- Leilão;
- Troca de Clínica;
- Ofícios;
- Transferência de Prontuário.

Thiago aprovou o fluxo de **Desistência de Categoria** como referência de padrão visual/operacional. Usar esse comportamento como modelo para os demais.

### Exigências

Deve permitir localizar scripts de exigência/finalização sem poluir a Orientação.

## 5. Estado dos principais atendimentos

### Desistência de Categoria — REFERÊNCIA VALIDADA

Thiago informou que a sequência está “padrão demais” e elogiou o comportamento. Preservar.

### Transferência de Prontuário

Mapeamento confirmado:

- procedimento: `transferencia-prontuario-habilitacao`;
- tipo SEI: `Detran: Solicitação Geral - Habilitação`;
- destino: `NUCRA`;
- trigger: `TRANSF-PRONT`;
- formulário: `https://www.detran.rj.gov.br/images/formularios/requerimento_transferencia_prontuario.pdf`;
- DUDA: código 206-2 + comprovante;
- pode abrir por e-mail.

Transferência de Prontuário foi adicionada aos atalhos principais da Orientação.

Foi implementada tentativa de preencher automaticamente `NUCRA` na tela `Enviar Processo` do FAST PROC, com estados visuais de carregamento e orientação para `Enviar`, mas **a validação real final dessa automação ainda está pendente**.

### Baixa de Restrição / Inventário

Fluxo correto desejado:

`Baixa de Restrição` → `QUAL É O CASO?`

- `BAIXA DE RESTRIÇÃO — GERAL`
- `INVENTÁRIO — HERDEIROS`
- `INVENTÁRIO — TERCEIROS`

O fluxo direto foi implementado em `cs_modules/fast_mail/baixa-restricao-direct-v1.js`.

#### Inventário — Herdeiros

Card correto do Trello:

`Baixa de restrição referente a inventário (PARA HERDEIROS)` — grupo DRV02.

Regra do card:

- transferência por inventário para herdeiros pode ser feita em Posto de Vistoria;
- se a solicitação for **somente BAIXA DE RESTRIÇÃO REFERENTE AO INVENTÁRIO**, a abertura de processo administrativo é **SOMENTE PRESENCIAL**;
- capital: agendamento Recursos e Protocolo;
- demais municípios: CIRETRAN/SAT;
- script já possui agendamento e toda a documentação necessária;
- inclui declaração dos herdeiros abrindo mão da propriedade, com retenção dos originais.

No FAST MAIL, ao escolher `INVENTÁRIO — HERDEIROS`, não deve aparecer `ABRIR PROCESSO`; deve localizar esse script, indicar `SOMENTE PRESENCIAL` e disponibilizar `INSERIR RESPOSTA`.

### Devolução de Taxas

Regras definidas:

- Pessoa Física é o caso padrão operacional;
- DUDA é o cenário predominante;
- deve continuar permitindo alteração para GRT/PJ/exceções;
- o fluxo deve chegar às ações normais após a variante.

Foi implementada continuidade para o seletor de variante, mas a validação funcional ficou interrompida pelo bug P0 de inserção descrito abaixo.

### Perícia Médica

O fluxo precisa exibir imediatamente `QUAL É O CASO?` e depois liberar as ações adequadas.

A continuidade foi implementada, mas a validação funcional também ficou interrompida pelo bug P0 de inserção.

### Troca de Clínica

Resposta curada deve ser preservada.

Mapeamento confirmado:

- destino `SERVMT`;
- resposta curada em `data/respostas-curadas.json`;
- formulário específico é exigido pelo script.

Pendência: a base atual não contém URL oficial confiável do **FORMULÁRIO DE TROCA DE CLÍNICA**. Não inventar link. Só adicionar quando fonte oficial/Trello/Trellinho fornecer a URL correta.

### Ofícios

Triagem já implementada:

- documento correto/endereçado ao DETRAN.RJ;
- falta ofício/documento oficial;
- documento não endereçado ao DETRAN.RJ.

Mapeamento do processo de mero expediente:

- `oficio-mero-expediente`;
- tipo SEI `Administrativo: Elaboração de Ofício de Mero Expediente`;
- destino DIJUR.

## 6. REGRA DE DOCUMENTOS FALTANTES

Regra confirmada por Thiago:

- o operador marca somente os documentos que **estão faltando**, para que a resposta diga quais foram identificados como pendentes;
- porém o cidadão deve ser orientado a **reenviar TODOS os documentos necessários em uma única mensagem, inclusive os que já havia enviado anteriormente**;
- não cobrar novamente como “faltante” o que já foi recebido, mas pedir o reenvio do conjunto completo para prosseguimento.

A resposta de exigência já foi ajustada em `index.js` com esse aviso.

## 7. Regra do assunto do e-mail

Padrão definido por Thiago:

`NOME - DDMMAA[protocolista] - SETOR DE DESTINO - TRIAGEM/FECHADO`

Exemplo:

`ENZO CUNHA DE ARAUJO - 04092631 - SERVECH - FECHADO`

O `31` é o número do protocolista que está preparando o e-mail e varia conforme o operador.

O rótulo interno `⚡ REQUERIMENTO RÁPIDO` **NÃO pode aparecer no assunto do cidadão**. Foi criada proteção para removê-lo do assunto operacional. Preservar o Requerimento Rápido internamente; remover apenas seu rótulo do assunto.

## 8. P0 ATUAL — RESPOSTA SENDO INSERIDA NO CAMPO `PARA...`

Este é o **primeiro problema que o novo chat deve resolver antes de continuar outros serviços**.

### Sintoma confirmado em teste real

Em alguns fluxos novos, ao clicar em `INSERIR RESPOSTA` ou `ORIENTAR`, o texto do script está sendo inserido no campo **Para...** do OWA em vez do corpo da mensagem.

Confirmado por Thiago em pelo menos:

1. `Baixa de Restrição → Inventário — Herdeiros → INSERIR RESPOSTA`;
2. `Devolução de Taxas → ORIENTAR`.

Portanto **não é um bug exclusivo da Baixa** e pode existir em outros fluxos.

### Estado visual que prova o problema

Nos prints finais o seletor de formato do OWA continua mostrando `Texto simp` / `Texto simples` mesmo após as tentativas de correção. O texto grande do script aparece no campo superior de destinatários (`Para...`).

### Diagnóstico técnico já localizado

Arquivo principal:

`cs_modules/fast_mail/index.js`

Função atual:

`findMessageBodyEditor()`

Ela hoje procura principalmente:

- `[contenteditable="true"]`;
- `body[contenteditable="true"]`;
- `doc.body` quando `designMode === 'on'`.

Ela **ignora explicitamente `input,textarea`**.

No OWA em **Texto simples**, o corpo real pode ser um `textarea`, enquanto o cabeçalho/destinatário permanece como região editável. Assim, o algoritmo pode escolher a região errada.

Trecho conceitual atual:

- candidatos contenteditable;
- área mínima;
- exclusão por `aria-label/title` apenas;
- maior área vence.

Isso não é seguro o bastante para o OWA antigo.

### Bug adicional encontrado no fluxo customizado da Baixa

Arquivo:

`cs_modules/fast_mail/baixa-restricao-direct-v1.js`

A função própria `ensureHtmlComposer()` tenta mudar `Texto simples → HTML`, mas considera sucesso quando `hasHtmlEditor()` encontra **qualquer** contenteditable grande ou iframe editável. Isso pode dar falso positivo mesmo quando o seletor continua em `Texto simples`.

Logo, a tentativa específica da Baixa não é uma solução confiável.

### Tentativas recentes que NÃO resolveram

Arquivo criado e carregado no manifest:

`cs_modules/fast_mail/compose-html-guard-v1.js`

Objetivo: interceptar inserções e mudar para HTML antes de inserir.

Commits relacionados mais recentes:

- `860ab9567c6973d493839281586e94be43233093` — carregamento do guard;
- `11b36cf70f85da95d5924a6bbc0337868c13d066` — tentativa de preparar HTML antes das ações do FAST MAIL.

CI passou, mas o teste real mostrou que **o problema permanece**. Não adicionar outra camada parecida por cima.

### Próxima correção recomendada

1. Inspecionar o DOM real do OWA em `Texto simples` e identificar inequivocamente:
   - textarea/campo do corpo;
   - regiões `Para`, `Cc`, `Bcc`, `Assunto`;
   - relação geométrica/estrutural entre cabeçalho e corpo.
2. Corrigir o **núcleo** `findMessageBodyEditor()` para:
   - suportar o corpo real em `textarea` no modo Texto simples;
   - excluir de forma absoluta campos/containers de destinatário e assunto;
   - preferir editor do corpo pela estrutura do compositor, não apenas por maior área;
   - falhar fechado: se o corpo não for localizado com segurança, não inserir nada.
3. Fazer `insertResponseBeforeHistory()` suportar corretamente editor HTML **e** textarea/plain text, sem usar `innerHTML` em textarea.
4. Depois disso, remover ou simplificar as tentativas paralelas de forçar HTML (`compose-html-guard-v1.js` e `ensureHtmlComposer()` da Baixa), para que todos os fluxos usem o mesmo mecanismo central.
5. Validar apenas dois cenários representativos:
   - Baixa de Restrição / Inventário — Herdeiros;
   - Devolução de Taxas / Orientar.
6. Se ambos inserirem no corpo, considerar a correção estrutural validada em lote e seguir adiante.

**Não corrigir modal por modal.**

## 9. FAST PROC — itens congelados/validados

Não reabrir estes pontos sem regressão concreta:

- drag & drop de documento externo validado (`ANEXOU ARRASTANDO`);
- resgate conservador do Requerimento Rápido validado e rápido;
- fluxo de Iniciar Processo com próximo clique guiado e destaque de `SALVAR` validado e elogiado;
- renomear árvore foi DESATIVADO porque o SEI já faz nativamente; não reativar;
- automação ampla de confirmação de interessado é proibida; manter apenas o escopo já implementado;
- autenticação só no fluxo presencial; abertura por e-mail não autentica.

### Árvore Inteligente

Há investigação separada sobre reordenação da árvore. O perfil de Thiago não recebe a ação nativa `Ordenar Árvore do Processo`, indicando ACL do servidor. Não tentar bypass de permissão. Só usar endpoints normais se expostos e autorizados.

## 10. Destino automático no FAST PROC

Objetivo já implementado parcialmente:

- quando o processo possui destino validado no catálogo, preencher automaticamente a unidade na tela `Enviar Processo`;
- mostrar acompanhamento em tempo real:
  - `CARREGANDO SETOR DE DESTINO...`;
  - `SETOR CARREGADO: XXXX`;
  - `PRONTO — CONFIRA E CLIQUE EM ENVIAR`;
- destacar o botão `Enviar` quando pronto;
- nunca enviar automaticamente;
- destino não validado continua manual.

Transferência de Prontuário deve usar `NUCRA`.

Validação real final ainda pendente.

## 11. Hierarquia de fontes dos scripts

Usar nesta ordem:

1. **Trello público/visual** — define quais cartões estão operacionalmente publicados/visíveis;
2. **Trellinho offline 28/08** — texto, automação, formulários, destinos e tipologias já extraídos;
3. **manuais oficiais** — tipologia/registro no SEI;
4. **catálogos curados da extensão** — preservar IDs estáveis e respostas validadas.

Trello/Trellinho são balizadores e fontes de dados. **Não transformar o FAST MAIL em um clone do Trello/Trellinho.**

Conteúdos duplicados, ocultos ou desativados não devem virar atalho operacional só porque existem no HTML/JSON.

## 12. Fase 3

Cinco cartões públicos confirmados:

- Protocolo Padrão;
- DAF;
- DRV;
- AGEM;
- DIVMED.

Fase 3 deve ser automática após abertura de processo quando possível, com fallback manual. Assunto de fase 3 termina em `FECHADO`.

## 13. OWA / Exchange — problema externo conhecido

Erro recorrente da conta `protocolista31@detran.rj.gov.br`:

- `MapiExceptionSessionLimit`;
- `TooManyObjectsOpenedException`.

Diagnóstico: saturação de sessão/objetos no backend Exchange, não simples cookie ou extensão.

Foi enviado e-mail à GREDINFO pedindo verificação/reset das sessões. O erro é intermitente e pode ocorrer inclusive no primeiro login da manhã.

Central → `Reabrir sistemas` já ajudou em ocasião anterior.

Não confundir esse erro de servidor com regressão do FAST MAIL.

Ao recarregar a extensão local, abas antigas do OWA podem registrar `Extension context invalidated`; nesse caso fechar/reabrir resposta ou dar F5 após reload é esperado.

## 14. Commits recentes relevantes

Referências úteis da sequência atual:

- `da14aea` — separação Inventário herdeiros/terceiros;
- `4e812a6` — PF como preferência em Devolução de Taxas;
- `db5bfff` / `6d51ad3` — próximo clique guiado global;
- `d68f78a9` — triagem de Ofícios;
- `320d342` — orientação de documentos faltantes;
- `32b8dba` — fluxo inicial por etapas;
- `519a63f` — ponte global + Transferência de Prontuário nos principais;
- `4253c0a` — isolamento de estado + destino automático no Enviar Processo;
- `aec4e11` — destaque forte do atendimento selecionado + estados do destino;
- `2d394fb` — Identificação com inserção manual;
- `c03510c` — sanitização do rótulo `REQUERIMENTO RÁPIDO` no assunto;
- `4caff46` — fluxo direto de Baixa de Restrição;
- `49e8df6` — continuidade de Devolução de Taxas e Perícia Médica;
- `860ab95` / `11b36cf` — tentativas de guard do compositor que não resolveram o P0 real.

Usar o topo remoto, não esses SHAs como alvo de checkout.

## 15. Primeiro pedido do novo chat

Copiar e colar no novo chat:

> Continue o projeto PROTOCOLISTAS pelo arquivo `docs/CHECKPOINT-TRANSICAO-FAST-MAIL-2026-09-04.md`, no repositório `thiagonevesrj/sei-protocolistas`, PR #3 e branch `agent/catalogo-fast-mail-amanha`. Use o TOPO REMOTO da branch; não volte para commits antigos. Não use ZIP ou PowerShell, não faça merge e não altere `desenvolvimento`. O P0 atual é o FAST MAIL inserir alguns scripts no campo `Para...` do OWA em vez do corpo, confirmado em Baixa de Restrição/Inventário e Devolução de Taxas/Orientar. Leia primeiro a seção P0 do checkpoint e os arquivos `cs_modules/fast_mail/index.js`, `baixa-restricao-direct-v1.js` e `compose-html-guard-v1.js`. Não crie mais uma camada de workaround. Corrija o mecanismo central `findMessageBodyEditor()`/inserção para suportar corretamente o OWA em Texto simples e excluir destinatário/assunto de forma absoluta. Depois valide apenas Baixa/Inventário e Devolução/Orientar como cenários representativos. Preserve tudo que o checkpoint marca como validado ou congelado e siga a regra global de próximo clique guiado.

## 16. Critério para sair do checkpoint

O novo chat pode avançar para os demais serviços quando:

1. Baixa de Restrição / Inventário insere no corpo correto;
2. Devolução de Taxas / Orientar insere no corpo correto;
3. nenhum campo `Para`, `Cc`, `Bcc` ou `Assunto` é candidato a editor;
4. a correção é central e vale para todos os scripts;
5. CI continua verde;
6. Thiago confirma um teste real representativo.

Depois disso, retomar em lote:

- Perícia Médica;
- Devolução de Taxas completa;
- destino automático NUCRA;
- clique guiado;
- demais atalhos principais;
- revisão institucional final;
- só então preparar publicação.
