# Blindagem do estado validado — 06/09/2026

Este documento estabelece a fronteira de segurança do projeto antes da implementação do Tema Protocolista / Guia inicial do OWA.

## Estado de ouro funcional

Commit funcional validado em ambiente real:

`4b3874f28992122b5688918d5700d94fc2f52a94`

Mensagem:

`fix: preservar TRIAGEM e remover rótulo interno no fechamento`

Branch de segurança imutável por convenção:

`checkpoint/golden-runtime-2026-09-06`

Este é o ponto de retorno técnico do comportamento em produção/teste real. Não mover esta branch e não fazer merge nela.

## Estado validado + documentação

Commit:

`93a54b3e0bc1b67d852668071e2a0fa7db883e4c`

Branch:

`checkpoint/fast-mail-validado-2026-09-06`

Inclui o runtime validado acima + checkpoint/runbook atualizados com a Certidão de Identificação Civil e o fechamento já aprovados.

## Snapshot imediatamente anterior à ativação do tema

Commit:

`b38c3f7d6396912d827933f1e9c7fffb46a45534`

Branch:

`checkpoint/pre-tema-2026-09-06`

Este snapshot contém os protótipos de arquivos do Tema Protocolista / Guia inicial criados após a validação funcional, mas ainda sem ligação no `manifest.json` e sem alteração do comportamento operacional validado.

## O que está VALIDADO / CONGELADO

Não alterar sem regressão concreta observada em teste real:

- inserção segura exclusivamente no corpo do OWA;
- proteção contra inserção em Para/Cc/Bcc/Assunto;
- preparação automática do compositor em HTML;
- fallback seguro quando HTML não estiver disponível;
- apresentação HTML das respostas/exigências;
- caminho visual fase → serviço → ação permanecendo marcado;
- checkboxes de documentos faltantes e leitura da seleção;
- `INSERIR EXIGÊNCIA` global;
- preparação automática do assunto de TRIAGEM;
- TRIAGEM parcial podendo ser promovida ao padrão completo;
- fechamento preservando `TRIAGEM - FECHADO`;
- remoção de rótulos internos como `REQUERIMENTO RÁPIDO` da devolutiva ao cidadão;
- Bcc, que não deve ser reaberto sem regressão concreta;
- Perícia Médica validada;
- Desistência de Categoria validada;
- Transferência de Prontuário validada no FAST MAIL;
- Devolução de Taxas / cobrança documental validada;
- Certidão de Identificação Civil validada de ponta a ponta: ORIENTAR, COBRAR DOCUMENTOS, ABRIR PROCESSO e devolutiva;
- fluxo FAST MAIL → FAST PROC já aprovado nos cenários testados;
- regra de próximo clique guiado: a extensão pode preparar/orientar, mas cliques finais operacionais permanecem humanos.

## Regra para Tema Protocolista / Guia do Protocolista

Toda implementação visual nova deve ser aditiva e isolada.

Obrigatório:

1. usar arquivos próprios para tema/onboarding;
2. não modificar o corpo das mensagens (`#divBdy`, `#txtBdy`, `iframe#ifBdy` ou body interno) por CSS de tema;
3. não alterar `compose-html-guard-v1.js`, inserção segura, checklists, assunto, Bcc ou handoff FAST PROC para implementar estética;
4. o tema deve poder ser desligado sem desativar as funções da extensão;
5. o Guia deve usar estado próprio/versionado em storage;
6. alterações visuais devem ser reversíveis sem mover a branch principal para trás;
7. se surgir regressão, comparar primeiro com `checkpoint/golden-runtime-2026-09-06` antes de criar workaround.

## Teste mínimo obrigatório após qualquer alteração visual

Antes de considerar um tema/guia aprovado, confirmar em ambiente real:

1. nova resposta do OWA abre/prepara em HTML automaticamente;
2. resposta de Orientação entra formatada no corpo correto;
3. `COBRAR DOCUMENTOS` mantém caminho visual e checkboxes;
4. `INSERIR EXIGÊNCIA` reconhece documentos selecionados;
5. nome + CPF geram assunto completo de TRIAGEM;
6. sem nome/CPF, TRIAGEM parcial continua possível e atualizável depois;
7. fechamento gera `... - TRIAGEM - FECHADO`;
8. nenhum rótulo interno aparece no corpo enviado ao cidadão;
9. Certidão de Identificação Civil continua com ORIENTAR / COBRAR DOCUMENTOS / ABRIR PROCESSO;
10. o botão recolher/expandir do FAST MAIL continua funcional;
11. o corpo de mensagens antigas e recebidas não sofre estilização destrutiva;
12. desligar o Tema Protocolista restaura o OWA original sem desativar o FAST MAIL.

Se qualquer um desses itens falhar, a alteração visual não é considerada aprovada.

## Política de recuperação

Não resetar a branch ativa para commits antigos.

Em caso de regressão:

- comparar a alteração atual com a branch `checkpoint/golden-runtime-2026-09-06`;
- identificar apenas os commits/arquivos visuais responsáveis;
- reverter ou corrigir somente a camada nova;
- manter o motor validado intacto;
- registrar a causa e a solução no `RUNBOOK-SOLUCOES-VALIDADAS.md` se a investigação for relevante.

## Regra final

O Tema Protocolista e o Guia do Protocolista podem evoluir livremente como camada de experiência, mas o runtime validado do FAST MAIL / FAST PROC passa a ser tratado como infraestrutura crítica e congelada até existir regressão concreta.