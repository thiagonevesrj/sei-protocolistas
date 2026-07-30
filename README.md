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

Consulte [docs/DIAGNOSTICO-INICIAL.md](docs/DIAGNOSTICO-INICIAL.md) para acompanhar o inventário técnico.
As decisões operacionais obrigatórias estão registradas em
[docs/REGRAS-FUNCIONAIS.md](docs/REGRAS-FUNCIONAIS.md).

## Licença e créditos

Este projeto é distribuído sob a licença [GPL-3.0](LICENSE). O histórico do fork e os avisos de autoria do
SEI++ são preservados.

A compatibilidade do fluxo de envio de documentos externos no SEI-RJ também foi estudada com base no
comportamento e na documentação pública do [SEI Pro](https://github.com/SEI-Pro/sei-pro), projeto de
Pedro Henrique Soares licenciado sob a AGPL-3.0. A implementação do SEI Protocolistas foi escrita dentro
da arquitetura deste projeto, sem incorporar os arquivos distribuídos pelo SEI Pro.
