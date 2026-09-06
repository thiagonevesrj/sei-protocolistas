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

## Solução recém-validada — OWA Texto simples → HTML

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

## Estado operacional relacionado

- inserção segura no corpo do OWA: validada;
- checklist de documentos faltantes: corrigido para persistir seleção;
- caminho visual de fase → serviço → ação: deve permanecer marcado;
- `COBRAR DOCUMENTOS` é padrão global para procedimentos com checklist;
- assunto de TRIAGEM é preparado automaticamente;
- `TRIAGEM` parcial não bloqueia upgrade posterior para assunto completo quando nome + CPF surgirem;
- Bcc não deve ser reaberto sem regressão concreta;
- HTML automático agora é comportamento validado e não deve ser reescrito sem necessidade.

## Modo de trabalho

- sempre usar o topo remoto da branch;
- nunca resetar para commit antigo;
- não usar ZIP;
- não pedir PowerShell para atualização normal;
- não fazer merge sem autorização explícita;
- não alterar `desenvolvimento`;
- corrigir causas estruturais em lote, não serviço por serviço;
- quando Thiago validar algo, congelar até existir regressão concreta.
