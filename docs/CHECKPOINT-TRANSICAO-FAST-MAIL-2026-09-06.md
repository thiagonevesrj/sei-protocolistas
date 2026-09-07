# Checkpoint de transição — FAST MAIL / FAST PROC

Data: 06 de setembro de 2026.

Este checkpoint complementa `docs/CHECKPOINT-TRANSICAO-FAST-MAIL-2026-09-04.md` e passa a ser o ponto de continuidade mais recente do projeto PROTOCOLISTAS.

## LEITURA OBRIGATÓRIA ANTES DE QUALQUER INVESTIGAÇÃO

1. `docs/CHECKPOINT-TRANSICAO-FAST-MAIL-2026-09-04.md`
2. `docs/RUNBOOK-SOLUCOES-VALIDADAS.md`
3. topo remoto da branch `agent/catalogo-fast-mail-amanha`

**Não recomeçar investigação de problema já documentado no runbook.** Primeiro comparar o estado atual com a solução validada e procurar regressão.

## Regra permanente de conhecimento técnico

Sempre que um problema relevante exigir investigação extensa e for resolvido em teste real:

- registrar o sintoma;
- registrar a causa raiz;
- registrar tentativas que falharam;
- registrar a solução validada;
- registrar commit/arquivos de referência;
- registrar teste mínimo de regressão;
- marcar como `VALIDADO / CONGELADO`.

Arquivo oficial para isso:

`docs/RUNBOOK-SOLUCOES-VALIDADAS.md`

## Solução validada — OWA Texto simples → HTML

Problema: respostas do FAST MAIL eram inseridas em `Texto simp`, destruindo a apresentação HTML.

Evidência decisiva: ao trocar manualmente o OWA para HTML, a mesma resposta ficava corretamente formatada. Logo, o renderer não era a causa; o gargalo era a troca de formato do compositor.

Solução validada:

- arquivo: `cs_modules/fast_mail/compose-html-guard-v1.js`;
- commit funcional: `90a5cf5fe2f8ab886c1713b56cee763fdcf78bd9`;
- estratégia: reproduzir por clique nativo a interação visual `Texto simp → HTML`, aguardar `iframe#ifBdy` tornar-se editor HTML seguro e só então liberar a inserção;
- fallback seguro para Texto simples permanece disponível caso o OWA excepcionalmente não consiga ativar HTML.

Validação real de Thiago em 06/09/2026:

`FICOU PERFEITO, JA ABRIU O RESPONDER COMO HTML`

Estado: **VALIDADO / CONGELADO**.

Detalhes completos estão em `docs/RUNBOOK-SOLUCOES-VALIDADAS.md`.

## Validação em lote do padrão global do FAST MAIL

Em 06/09/2026, Thiago testou em ambiente real:

- `Perícia Médica`;
- `Desistência de Categoria`;
- `Transferência de Prontuário`;
- `Devolução de Taxas` já havia sido usada durante a correção do checklist/exigência.

Resultado confirmado:

`TESTEI PERICIA, TESTEI DESISTENCIA DE CAT, TRANSF DE PRONTUARIO, TUDO DEU CERTO E MELHOR, JA EM HTML`

Com isso, considerar **VALIDADO / CONGELADO** o padrão central compartilhado por esses fluxos:

- caminho visual de fase → serviço → ação permanece marcado;
- checkboxes de documentos faltantes persistem;
- `COBRAR DOCUMENTOS` funciona como ação global para procedimentos com checklist;
- `INSERIR EXIGÊNCIA` lê os documentos selecionados e insere no corpo correto;
- respostas são preparadas em HTML automaticamente;
- assunto de TRIAGEM é preparado automaticamente;
- TRIAGEM parcial pode ser promovida posteriormente ao padrão completo quando nome + CPF estiverem disponíveis;
- Bcc permanece fora de novas alterações sem regressão concreta.

Não continuar testando todos os serviços botão por botão quando eles usam a mesma infraestrutura central. Reabrir apenas diante de falha concreta.

## Certidão de Identificação Civil — validação parcial concluída

Em 06/09/2026, após integrar a Certidão ao fluxo nativo do FAST MAIL e transcrever o checklist documental do card oficial, Thiago confirmou em ambiente real:

- `ORIENTAR` = **OK**;
- `COBRAR DOCUMENTOS` = **OK**.

Commit funcional de referência:

`bdb6d041c994f7dd01449e7041120a3a1a9eb486` — `fix: integrar certidão civil sem alterar o manifest`.

A validação automática desse commit passou com `SUCCESS`.

Pendência única para fechar a Certidão de ponta a ponta:

- validar `ABRIR PROCESSO` e confirmar tipo SEI / destino `DIRIC` no handoff para o FAST PROC.

Até regressão concreta, não reabrir a lógica de `ORIENTAR` nem o checklist de `COBRAR DOCUMENTOS` da Certidão.

## Estado operacional relacionado

- inserção segura no corpo do OWA: validada;
- HTML automático: validado e congelado;
- checklist de documentos faltantes: validado em múltiplos serviços;
- caminho visual de fase → serviço → ação: validado em múltiplos serviços;
- assunto automático de TRIAGEM: validado no fluxo operacional;
- `Perícia Médica`: validada no fluxo testado;
- `Desistência de Categoria`: validada e permanece referência de padrão;
- `Transferência de Prontuário`: validada no FAST MAIL;
- `Devolução de Taxas`: fluxo de cobrança documental validado;
- `Certidão de Identificação Civil`: ORIENTAR e COBRAR DOCUMENTOS validados; ABRIR PROCESSO pendente;
- Bcc não deve ser reaberto sem regressão concreta.

## Próxima fila de trabalho

Não reabrir os itens acima. A próxima rodada deve priorizar fluxos ainda não congelados ou pendências fora desse mecanismo central, especialmente:

1. `Certidão de Identificação Civil` — validar apenas `ABRIR PROCESSO`, conferindo tipo SEI e destino `DIRIC`;
2. `Troca de Clínica` — validar fluxo e manter a resposta curada; não inventar URL de formulário ausente;
3. `Leilão` — validar o fluxo e eventuais pendências específicas;
4. `Genérico Habilitação` e `Genérico Veículos` — validar roteamento/conteúdo sem alterar scripts do Trello/Trellinho;
5. `Ofícios` — validar os cenários de triagem já mapeados;
6. FAST PROC / `Transferência de Prontuário` — permanece separada a pendência de validação real da automação de destino `NUCRA` na tela Enviar Processo.

## Modo de trabalho

- sempre usar o topo remoto da branch;
- nunca resetar para commit antigo;
- não usar ZIP;
- não pedir PowerShell para atualização normal;
- não fazer merge sem autorização explícita;
- não alterar `desenvolvimento`;
- corrigir causas estruturais em lote, não serviço por serviço;
- quando Thiago validar algo, congelar até existir regressão concreta.
