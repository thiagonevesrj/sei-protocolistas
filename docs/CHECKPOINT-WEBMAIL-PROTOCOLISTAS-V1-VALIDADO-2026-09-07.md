# Checkpoint — WEBMAIL PROTOCOLISTAS V1 validado

Data: 07 de setembro de 2026.

Este documento registra o estado visual aprovado do Tema WEBMAIL PROTOCOLISTAS sobre o OWA legado, preservando integralmente o runtime funcional já blindado do FAST MAIL / FAST PROC.

## Ponto exato validado em ambiente real

Commit de runtime aprovado:

`e399903bc7aef028eddc56ac405b0e1a34c79e27`

Mensagem:

`fix: substituir asset completo do logo Webmail Protocolistas`

Branch de segurança criada para este estado:

`checkpoint/webmail-protocolistas-v1-validado-2026-09-07`

**Esta branch deve permanecer imóvel por convenção. Não fazer merge nela e não movê-la para commits posteriores.**

Ela é o ponto de retorno exato do WEBMAIL PROTOCOLISTAS V1 aprovado por Thiago em 07/09/2026.

## Relação com a blindagem funcional anterior

O runtime operacional de ouro do FAST MAIL / FAST PROC continua sendo:

`4b3874f28992122b5688918d5700d94fc2f52a94`

Branch:

`checkpoint/golden-runtime-2026-09-06`

A camada visual aprovada neste checkpoint foi construída sobre a blindagem definida em:

- `docs/BLINDAGEM-ESTADO-VALIDADO-2026-09-06.md`;
- `docs/CHECKPOINT-TRANSICAO-FAST-MAIL-2026-09-06.md`;
- `docs/RUNBOOK-SOLUCOES-VALIDADAS.md`.

As regras de congelamento desses documentos continuam válidas.

## Estado visual aprovado — WEBMAIL PROTOCOLISTAS V1

Considerar **VALIDADO / CONGELADO** neste ponto:

- cabeçalho institucional azul-marinho/preto com linha dourada;
- identidade visual WEBMAIL PROTOCOLISTAS aplicada ao OWA;
- logo oficial completo do WEBMAIL PROTOCOLISTAS no topo;
- `BY THIAGO NEVES DESIGN` visível por completo;
- tamanho e posição atuais do logo aprovados;
- área `terminar sessão | Protocolista 31` livre de sobreposição;
- rótulo nativo `Outlook Web App` substituído visualmente pela identidade Protocolistas;
- opção de retornar ao OWA original preservada;
- conceito do Easter egg no floco de neve do logo como acesso discreto às opções do tema;
- FAST MAIL permanece funcional e independente da camada visual.

## Decisão explícita de congelamento visual

Após várias rodadas de refinamento do cabeçalho, Thiago decidiu encerrar a lapidação estética neste ponto para evitar um ciclo infinito de microajustes.

Portanto, **não iniciar nova rodada de refinamento visual sem regressão concreta ou pedido explícito posterior**.

Ficam deliberadamente fora desta V1, sem constituir defeito bloqueante:

- substituir o amarelo nativo da mensagem selecionada;
- redesenhar integralmente a lista de e-mails;
- unificar visualmente todas as subdivisões da lateral esquerda;
- modernizar profundamente busca, toolbar e demais controles legados do OWA.

Esses itens são backlog visual futuro, não pendência para publicação da V1.

## Regra absoluta de preservação operacional

Nenhuma migração desta V1 para a versão online pode alterar ou reconstruir, sem regressão concreta:

- `#divBdy`;
- `#txtBdy`;
- `iframe#ifBdy` e o body interno do compositor;
- `compose-html-guard-v1.js`;
- inserção segura de respostas;
- checklists;
- COBRAR DOCUMENTOS / INSERIR EXIGÊNCIA;
- assunto / TRIAGEM / `TRIAGEM - FECHADO`;
- Bcc;
- handoff FAST MAIL → FAST PROC;
- fluxos já marcados como VALIDADO / CONGELADO na blindagem de 06/09.

A publicação deve transportar o estado validado; não deve reconstruí-lo manualmente.

## Plano de migração para versão online

Objetivo: disponibilizar este estado validado para teste controlado dos protocolistas na semana de 14/09/2026.

Antes de publicar:

1. identificar inequivocamente qual branch/linha corresponde à versão online atualmente distribuída;
2. comparar a versão online com `e399903bc7aef028eddc56ac405b0e1a34c79e27`;
3. preservar qualquer mecanismo próprio de distribuição/atualização da versão online;
4. migrar somente os commits necessários, sem reescrever o runtime validado;
5. não alterar `desenvolvimento` sem autorização explícita;
6. não fazer merge genérico da branch de trabalho inteira sem revisar o diff;
7. executar validação automática antes da disponibilização;
8. realizar teste mínimo em OWA real antes de liberar ao grupo.

## Teste mínimo pré-publicação

Confirmar no ambiente real imediatamente antes da liberação:

1. OWA abre normalmente;
2. logo WEBMAIL PROTOCOLISTAS aparece inteiro;
3. `terminar sessão` e identificação do protocolista continuam utilizáveis;
4. nova resposta abre/prepara em HTML;
5. FAST MAIL abre ao responder e mantém navegação/ações;
6. Orientação é inserida no corpo correto;
7. COBRAR DOCUMENTOS mantém checkboxes e exigência;
8. Bcc continua correto;
9. assunto de TRIAGEM continua correto;
10. FAST MAIL → FAST PROC continua funcional em cenário já validado;
11. opção OWA Original não desativa o FAST MAIL;
12. nenhuma mensagem recebida sofre alteração destrutiva de conteúdo.

## Estratégia para teste com os protocolistas

A primeira publicação deve ser tratada como teste controlado, não como autorização para novas mudanças durante o expediente.

Orientação:

- liberar a mesma build validada para o grupo selecionado;
- coletar somente regressões concretas e observações de uso;
- separar `BUG` de `SUGESTÃO VISUAL`;
- não corrigir sugestão estética imediatamente durante o piloto;
- regressão operacional tem prioridade máxima;
- sugestão visual entra em backlog para uma V2 posterior;
- qualquer regressão crítica deve permitir retorno rápido ao ponto anterior da versão online.

## Estado final deste checkpoint

**WEBMAIL PROTOCOLISTAS V1: APROVADO / CONGELADO PARA PREPARAÇÃO DE PILOTO ONLINE.**

Runtime exato a preservar:

`e399903bc7aef028eddc56ac405b0e1a34c79e27`

Branch de segurança:

`checkpoint/webmail-protocolistas-v1-validado-2026-09-07`

Próxima ação permitida: identificar a linha online atual, comparar os estados e preparar uma migração controlada para o piloto da próxima semana.