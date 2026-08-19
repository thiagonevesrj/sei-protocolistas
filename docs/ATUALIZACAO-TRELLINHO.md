# Atualização segura do FAST MAIL pelo Trellinho

## Objetivo

O FAST MAIL deve consumir o catálogo do Trellinho sem exigir a recriação manual de cada botão ou resposta. A importação separa três responsabilidades:

1. o HTML do Trellinho fornece fases, grupos, títulos, respostas, marcações de atendimento e roteamento disponível;
2. `data/catalogo-processos.json` mantém regras operacionais confirmadas, como tipo SEI, destino e checklist;
3. `data/respostas-curadas.json` prevalece sobre qualquer resposta antiga ou incorreta recebida do Trellinho.

## Fluxo de atualização

O importador `scripts/import-trellinho-html.js` lê a constante `SCRIPTS` incorporada ao HTML e sempre gera primeiro `data/relatorio-importacao-trellinho.json`.

Uma atualização somente pode ser aplicada quando o relatório registrar `safeToApply: true`. A aplicação é bloqueada quando houver:

- fases desconhecidas;
- cartões com a mesma fase, grupo e título, mas conteúdos ou metadados diferentes;
- perda de um script usado por atalho prioritário;
- perda de uma resposta curada;
- IDs duplicados;
- variação estrutural suspeita na quantidade de cartões.

Cartões idênticos duplicados são consolidados automaticamente. Um cartão antigo que desapareça da fonte não é apagado: permanece com o estado `fonte-ausente-pendente-revisao` até decisão explícita.

## Identidade e proteção

- Scripts já existentes preservam o ID do cartão do Trello quando fase, grupo e título continuam correspondentes.
- Scripts novos recebem um ID determinístico derivado de sua chave estrutural.
- Renomeações ou mudanças de grupo podem ser ligadas ao ID anterior por `aliases` em `data/trellinho-import-rules.json`.
- Duplicidades conflitantes só podem ser resolvidas por uma escolha explícita de `bodyHash` em `duplicateChoices`.
- Destinos divergentes são relatados, mas nunca substituem automaticamente um destino confirmado pelo operador.
- Respostas curadas são relatadas como protegidas e continuam prevalecendo no FAST MAIL.

## Estrutura consumida

O Trellinho atual fornece:

- `fase` → fase do atendimento;
- `lista` → grupo do script;
- `nome` → título do atendimento;
- `texto` → resposta ao cidadão;
- `presencial` → atendimento presencial;
- `nao_abre` → serviço que não abre processo;
- `destino_processo` → destino informado na fonte;
- `tipologia_processual` → nomenclatura e link do tipo de processo, quando disponíveis.

Esses dados tornam todas as respostas pesquisáveis de forma dinâmica. O botão de abertura no FAST PROC continua condicionado à existência de processo, destino e checklist confirmados no catálogo operacional.

## Validação

O teste `scripts/test-trellinho-import.js` protege a leitura do HTML, a preservação dos IDs, a retenção segura de registros ausentes, a precedência das respostas curadas, a detecção de destinos divergentes e o bloqueio de duplicidades conflitantes.
