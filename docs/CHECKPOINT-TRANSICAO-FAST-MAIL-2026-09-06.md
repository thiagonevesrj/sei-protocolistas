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

## Certidão de Identificação Civil — VALIDADA / CONGELADA

Em 06/09/2026, a Certidão de Identificação Civil foi validada de ponta a ponta em ambiente real.

Confirmado por Thiago:

- `ORIENTAR` = **OK**;
- `COBRAR DOCUMENTOS` = **OK**;
- `ABRIR PROCESSO` = **OK**;
- processo criado com o tipo SEI correto;
- destino real retornado pelo fluxo: `DETRAN/DIVCA`;
- devolutiva do processo inserida no Webmail em HTML;
- rótulo interno `⚡ REQUERIMENTO RÁPIDO` removido da resposta ao cidadão;
- assunto final preserva obrigatoriamente `TRIAGEM - FECHADO`.

Commits funcionais de referência:

- `bdb6d041c994f7dd01449e7041120a3a1a9eb486` — `fix: integrar certidão civil sem alterar o manifest`;
- `4b3874f28992122b5688918d5700d94fc2f52a94` — `fix: preservar TRIAGEM e remover rótulo interno no fechamento`.

A validação automática dos commits passou com `SUCCESS` e o comportamento final foi confirmado por Thiago com:

`TUDO LINDO E PERFEITO!`

Estado: **VALIDADO / CONGELADO**.

Não reabrir Certidão, fechamento de assunto ou limpeza do rótulo interno sem regressão concreta.

## Estado operacional relacionado

- inserção segura no corpo do OWA: validada;
- HTML automático: validado e congelado;
- checklist de documentos faltantes: validado em múltiplos serviços;
- caminho visual de fase → serviço → ação: validado em múltiplos serviços;
- assunto automático de TRIAGEM: validado no fluxo operacional;
- fechamento do assunto em `TRIAGEM - FECHADO`: validado;
- rótulos internos não devem aparecer na devolutiva ao cidadão;
- `Perícia Médica`: validada no fluxo testado;
- `Desistência de Categoria`: validada e permanece referência de padrão;
- `Transferência de Prontuário`: validada no FAST MAIL;
- `Devolução de Taxas`: fluxo de cobrança documental validado;
- `Certidão de Identificação Civil`: validada de ponta a ponta;
- Bcc não deve ser reaberto sem regressão concreta.

## Próxima fila de trabalho

Não reabrir os itens acima. A próxima rodada deve priorizar fluxos ainda não congelados ou pendências fora desse mecanismo central, especialmente:

1. `Troca de Clínica` — validar fluxo e manter a resposta curada; não inventar URL de formulário ausente;
2. `Leilão` — validar o fluxo e eventuais pendências específicas;
3. `Genérico Habilitação` e `Genérico Veículos` — validar roteamento/conteúdo sem alterar scripts do Trello/Trellinho;
4. `Ofícios` — validar os cenários de triagem já mapeados;
5. FAST PROC / `Transferência de Prontuário` — permanece separada a pendência de validação real da automação de destino `NUCRA` na tela Enviar Processo.

## Modo de trabalho

- sempre usar o topo remoto da branch;
- nunca resetar para commit antigo;
- não usar ZIP;
- não pedir PowerShell para atualização normal;
- não fazer merge sem autorização explícita;
- não alterar `desenvolvimento`;
- corrigir causas estruturais em lote, não serviço por serviço;
- quando Thiago validar algo, congelar até existir regressão concreta.
