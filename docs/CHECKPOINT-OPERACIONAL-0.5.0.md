# Checkpoint operacional — SEI Protocolistas 0.5.0

> **Checkpoint posterior:** para trabalhos iniciados após 14 de agosto de 2026, use primeiro `docs/CHECKPOINT-TRANSICAO-FAST-MAIL-TRELINHO-2026-08-14.md`.

Data do fechamento: 10 de agosto de 2026.

Este é o ponto oficial de continuidade do projeto. Um novo chat deve começar por este documento e pelo topo remoto da PR indicada abaixo. Não deve reconstruir o sistema, usar ZIP, trabalhar sobre cópias antigas nem repetir diagnósticos já encerrados.

## Fonte única de verdade

- Repositório: `thiagonevesrj/sei-protocolistas`
- Pull request: `#3 — Consolidar FAST MAIL e FAST PROC para teste operacional`
- Branch da PR: `agent/catalogo-fast-mail-amanha`
- Base da PR: `agent/integracao-fast-mail-fast-proc`
- Commit mínimo seguro: `e7438b70b133b4d087b8bf05e9021443fe72d122`
- Versão: `0.5.0`
- Estado esperado: PR aberta, em rascunho, mergeável e não integrada.

O commit mínimo seguro contém o endurecimento de privacidade da Central. O topo da branch pode estar à frente dele por causa deste próprio checkpoint ou de correções posteriores. Nunca voltar a branch para um commit anterior.

## Estado funcional consolidado

- Central do Protocolista com acessos ao Webmail e ao SEI.
- `INICIAR EXPEDIENTE` abre Webmail e SEI e inicia métricas locais.
- Métricas individuais: tempo total, e-mails atendidos, processos abertos e exigências enviadas.
- Números ficam ocultos durante o expediente e aparecem somente ao finalizar.
- Relatório fica disponível apenas no dia, no perfil local, com exportação CSV.
- FAST MAIL com navegação por área, assunto e ação.
- Dezesseis assuntos operacionais, com sete prioridades centrais.
- Onze fluxos permitem abertura pelo FAST PROC e possuem checklist.
- Cinco fluxos são somente orientação, sem abertura indevida de processo.
- Catálogo com 176 scripts vigentes e 175 respostas utilizáveis.
- FAST MAIL transporta os dados disponíveis para o FAST PROC.
- Após a criação do processo, a extensão retorna ao e-mail original e prepara a resposta institucional adequada.
- Canal `Sugestões e bugs` envia o relatório pelo Webmail institucional do próprio protocolista ao responsável pelo projeto.

## Confirmações operacionais já realizadas

- Thiago confirmou que `INICIAR EXPEDIENTE` voltou a abrir Webmail e SEI.
- Thiago enviou um relato real de teste e confirmou o recebimento no Gmail.
- O envio de relato ficou isolado em uma aba exclusiva do Webmail.
- A tentativa antiga do FormSubmit foi removida.
- Relatos concluídos, com sucesso, erro ou expiração, são descartados do armazenamento temporário.

Essas confirmações não devem ser solicitadas novamente sem que o código correspondente seja alterado ou surja uma regressão nova.

## Segurança e privacidade no checkpoint

- O manifesto concede somente `storage` e acesso aos hosts do SEI-RJ e do OWA institucional.
- Não há FormSubmit, telemetria, analytics nem serviço externo de envio no código operacional.
- O endereço do responsável não aparece na interface, embora não seja tratado como segredo criptográfico em um projeto aberto.
- O clique em `ENVIAR RELATO` é a autorização explícita do protocolista para o envio.
- O relato é bloqueado quando aparenta conter e-mail, CPF ou número de processo.
- A interface também orienta a não incluir dados de cidadãos, documentos ou processos.
- As métricas ficam no navegador e não são enviadas ao responsável nem compartilhadas em painel coletivo.
- A visualização das métricas é vinculada à conta institucional salva, não apenas ao número digitado.
- Relatórios e expedientes de dias anteriores são removidos globalmente ao abrir a Central.
- O bloco redundante `Administração e manutenção` foi removido.
- A exclusão individual de credenciais exige confirmação.
- Senhas já salvas não voltam a ser exibidas no campo da Central.

### Limitação conhecida das credenciais

Para permitir login automático, as credenciais continuam armazenadas localmente no perfil do navegador pela API da extensão. Esse armazenamento não equivale a um cofre criptográfico. Cada protocolista deve usar perfil próprio do Chrome e sessão do Windows bloqueada; um perfil compartilhado não oferece isolamento forte entre pessoas.

## Validações concluídas

Executadas sobre uma árvore idêntica ao commit `e7438b7`:

- `npm run validate` — aprovado;
- fluxo FAST MAIL → SEI → FAST PROC → e-mail original — aprovado;
- catálogo de 176 scripts e buscas prioritárias — aprovado;
- `npm run lint` — aprovado, agora incluindo `central_protocolista/main.js`;
- `git diff --check` — aprovado;
- varredura por chaves, tokens, código dinâmico, FormSubmit, telemetria e analytics — nenhum achado no código operacional;
- GitHub Actions no topo anterior `f270ec0` — aprovado.

O comando `npm run lint:all` não é critério deste marco: ele encontra grande dívida de estilo no código legado herdado do SEI++ e em bibliotecas compactadas. Não iniciar saneamento amplo desse legado dentro da PR #3.

O repositório não possui `package-lock.json`. A validação oficial usa scripts Node sem dependências externas, e o GitHub Actions executa `npm run validate`. A ausência do lockfile é uma melhoria de infraestrutura futura, não um bloqueio operacional da extensão.

## Regras para o próximo chat

1. Ler este checkpoint e `AGENTS.md` antes de agir.
2. Consultar a PR #3 e confirmar apenas se o topo remoto está no commit mínimo seguro ou à frente dele.
3. Criar uma cópia ou worktree limpa do topo remoto. Não usar as cópias locais antigas como fonte.
4. Não pedir a Thiago que copie comandos PowerShell, extraia ZIP ou valide hashes.
5. Fetch, pull, commits verificados e publicação fast-forward na branch da PR estão autorizados sem confirmações repetidas.
6. Não fazer merge da PR #3 nem alterar `desenvolvimento` sem pedido explícito de Thiago.
7. Não repetir testes já registrados quando o código correspondente não mudou.
8. Para cada novo lote, testar somente a área alterada e a regressão essencial relacionada; ao final, rodar `npm run validate` e `npm run lint` uma vez.
9. Preservar regras operacionais, identidade visual, autoria `Thiago Neves` com H e licença GPL-3.0.
10. Nunca enviar dados de cidadãos, documentos ou credenciais para serviços externos.

## Próxima etapa autorizada

Aguardar testes dos demais protocolistas. Novos bugs e sugestões devem chegar pelo canal da Central e ser tratados em lotes pequenos, sobre o topo da PR #3. A integração em `desenvolvimento` só deve ocorrer quando Thiago encerrar a fase de testes.

## Texto curto para iniciar o novo chat

> Continue o projeto SEI Protocolistas a partir de `docs/CHECKPOINT-OPERACIONAL-0.5.0.md`, no repositório `thiagonevesrj/sei-protocolistas`, PR #3, branch `agent/catalogo-fast-mail-amanha`. O commit mínimo seguro é `e7438b70b133b4d087b8bf05e9021443fe72d122`. Use exclusivamente o topo remoto da PR, preserve o que já foi validado e não repita diagnósticos ou testes registrados sem mudança correspondente. Fetch, pull, commits verificados e publicação fast-forward na própria PR estão autorizados sem confirmações repetidas. Não use ZIP ou comandos PowerShell e não faça merge nem altere `desenvolvimento` sem minha ordem.
