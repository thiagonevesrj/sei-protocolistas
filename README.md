# SEI Protocolistas

Extensão gratuita e de código aberto voltada à produtividade de protocolistas no Sistema Eletrônico de
Informações (SEI).

O projeto está em desenvolvimento e parte do código do [SEI++](https://github.com/jonatasrs/sei), criado por
Jonatas Evaristo e seus colaboradores. As funcionalidades reaproveitadas e modificadas permanecem
licenciadas sob a GPL-3.0.

## Objetivo

Reduzir cliques, retrabalho e erros nos fluxos de protocolo, especialmente:

- abertura guiada de processos;
- inclusão rápida de documentos externos;
- triagem de e-mails com documentação pendente;
- geração de respostas padronizadas;
- pesquisa orientada pelos dados usados na rotina dos protocolistas.

## Estado atual

O projeto está na fase de validação dos fluxos de abertura rápida e inclusão de documentos. O código
legado que ainda precisa ser validado permanece no repositório, mas as opções fora do escopo inicial
estão ocultas e desativadas por padrão.

A versão `0.4.1` integra a **Central Protocolista**, o **FAST MAIL**
no webmail institucional e do **FAST PROC** no SEI-RJ. O catálogo local organiza os procedimentos
prioritários por área, a triagem prepara exigências e respostas, e o retorno do SEI ao e-mail
reaproveita o endereço do atendimento. O botão **ABRIR PROCESSO** transporta os dados disponíveis,
abre o SEI, retoma o login quando necessário, localiza **Iniciar Processo** e apresenta o FAST PROC
preenchido para revisão. Ao final, o card do processo devolve o foco à conversa original no Webmail
e disponibiliza os dados da resposta. O salvamento e a confirmação final permanecem manuais.

A Central pode ser aberta pelo ícone da extensão. Preferências e credenciais ficam armazenadas
localmente no navegador; não devem ser exportadas nem enviadas ao repositório.

Consulte [docs/DIAGNOSTICO-INICIAL.md](docs/DIAGNOSTICO-INICIAL.md) para acompanhar o inventário técnico.
As decisões operacionais obrigatórias estão registradas em
[docs/REGRAS-FUNCIONAIS.md](docs/REGRAS-FUNCIONAIS.md).
O histórico consolidado, as decisões de produto e o roteiro de desenvolvimento estão no
[Plano Mestre](docs/PLANO-MESTRE.md).
Antes de distribuir uma nova versão, siga o
[Checklist de Regressão](docs/CHECKLIST-REGRESSAO.md).

## Validação técnica

Execute `npm run validate` antes de publicar alterações. A verificação confere versões, arquivos
referenciados no manifesto, domínios autorizados, catálogo, navegação do FAST MAIL e modelos de
resposta. O mesmo comando é executado automaticamente pelo GitHub Actions.

Use `npm run lint` para os arquivos mantidos pela linha atual. O comando `npm run lint:all` preserva
o diagnóstico completo da dívida técnica herdada, sem aplicar correções automáticas nos módulos
legados.

## Licença e créditos

Este projeto é distribuído sob a licença [GPL-3.0](LICENSE). O histórico do fork e os avisos de autoria do
SEI++ são preservados.

A compatibilidade do fluxo de envio de documentos externos no SEI-RJ também foi estudada com base no
comportamento e na documentação pública do [SEI Pro](https://github.com/SEI-Pro/sei-pro), projeto de
Pedro Henrique Soares licenciado sob a AGPL-3.0. A implementação do SEI Protocolistas foi escrita dentro
da arquitetura deste projeto, sem incorporar os arquivos distribuídos pelo SEI Pro.
