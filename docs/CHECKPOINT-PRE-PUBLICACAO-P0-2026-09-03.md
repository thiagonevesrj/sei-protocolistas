# CHECKPOINT PRÉ-PUBLICAÇÃO — FAST MAIL P0 — 03/09/2026

## Objetivo

Congelar uma candidata operacional recuperável imediatamente antes da promoção ao modo publicado, sem depender de ZIP no fluxo de desenvolvimento, sem reescrever funcionalidades já validadas e sem alterar `desenvolvimento` ou mergear a PR #3 sem autorização explícita de Thiago.

## Estado da branch

- Repositório: `thiagonevesrj/sei-protocolistas`
- Branch de desenvolvimento/teste local: `agent/catalogo-fast-mail-amanha`
- PR #3: `Consolidar FAST MAIL e FAST PROC para teste operacional`
- PR permanece em draft e sem merge.
- Commit funcional P0 de referência: `1670836ef5cd3f9840696f7f0ce1df31f745d134`.
- Checkpoint pré-publicação registrado em `ef8c40312a086a00a5355d939083f281a952e98d`.
- Manifest: versão `0.5.0`.

## Dois trilhos obrigatórios a partir deste checkpoint

### TRILHO 1 — LOCAL / LABORATÓRIO

A branch `agent/catalogo-fast-mail-amanha` continua sendo o laboratório vivo.

Fluxo do operador:

1. GitHub Desktop → `Fetch origin`;
2. `Pull origin` quando houver atualização;
3. Chrome de desenvolvimento → `chrome://extensions`;
4. recarregar a extensão descompactada que aponta para a pasta local do repositório;
5. testar FAST MAIL / FAST PROC localmente;
6. alterações validadas seguem sendo commitadas nesta branch.

Este fluxo **não altera a extensão publicada** e não interfere nos trusted testers da Chrome Web Store.

Recomendação operacional: usar um perfil de Chrome exclusivo para desenvolvimento local. Não deixar simultaneamente a extensão da Chrome Web Store e a extensão descompactada ativas no mesmo perfil durante os testes, porque ambas possuem content scripts para SEI/OWA e poderiam executar sobre as mesmas páginas.

### TRILHO 2 — PUBLICADO / CHROME WEB STORE

A versão publicada permanece independente do laboratório local.

- nenhuma publicação é automática;
- nenhum push na branch local envia versão para os protocolistas;
- a promoção para a Chrome Web Store só ocorre após validação local e autorização explícita de Thiago;
- a versão `0.5.0` possui empacotamento automático no GitHub Actions;
- o workflow `Empacotar Chrome Web Store` valida a candidata e gera um artefato ZIP pronto para upload no painel da Chrome Web Store;
- gerar o pacote **não significa publicar**.

## P0 fechado neste ciclo

### 1. Identidade antes da triagem

Regra operacional congelada:

- identidade confiável exige **nome completo + CPF**;
- nunca usar nome presumido a partir do endereço de e-mail;
- quando faltar identidade, exibir `IDENTIDADE NÃO CONFIRMADA`;
- atalho principal `SOLICITAR IDENTIFICAÇÃO` usa o `SCRIPT DE IDENTIFICAÇÃO COMPLETO`;
- fluxo de um clique seleciona e insere a resposta;
- estado final da ação: `AGUARDANDO IDENTIFICAÇÃO DO REQUERENTE`.

### 2. Identificado, mas serviço não identificado

- atalho `IDENTIFICAR SERVIÇO` usa `SCRIPT DE IDENTIFICAÇÃO DO SERVIÇO`;
- também funciona em um clique para selecionar e inserir a resposta;
- estado: `AGUARDANDO IDENTIFICAÇÃO DO SERVIÇO`.

### 3. Assunto operacional

Formato definido:

`NOME - DDMMAA<NUMERO_DO_PROTOCOLISTA> - SETOR_DE_DESTINO - TRIAGEM`

ou

`NOME - DDMMAA<NUMERO_DO_PROTOCOLISTA> - SETOR_DE_DESTINO - FECHADO`

Regras:

- número do protocolista é dinâmico (`fastMailOperadorValidado`), nunca `31` fixo;
- ano usa dois dígitos;
- `undefined` não pode permanecer no assunto;
- quando o destino ainda não estiver disponível, usar estado explícito de destino pendente em vez de fabricar setor;
- a camada P0 normaliza a ordem antiga `NOME - DESTINO - DATA/OPERADOR - STATUS` para a ordem operacional correta.

### 4. BAIXA DE RESTRIÇÃO como porta principal

- `Inventário` deixa de ser porta principal da Fase 1;
- FAST MAIL recebe o atalho destacado `BAIXA DE RESTRIÇÃO`;
- a partir dele são exibidos os scripts vigentes de baixa de restrição;
- Inventário aparece como ramificação:
  - `INVENTÁRIO — HERDEIROS`;
  - `INVENTÁRIO — TERCEIROS`.

### 5. Inventário / Herdeiros — atendimento presencial

O card vigente está marcado `PRESENCIAL SOMENTE`, `DOCUMENTO ORIGINAL RETIDO`, `OBRIGATÓRIO INCLUIR ANEXOS` e `DUDA`.

O FAST MAIL agora trata o caso como atendimento presencial e não como exigência de reenvio por e-mail.

Checklist operacional para marcar **somente o que estiver faltando** antes do comparecimento:

- Requerimento Geral;
- CRV original ou Código de Segurança do CRV;
- Declaração de Perda/Extravio de ATPV-e/Código de Segurança, quando aplicável;
- DUDA 003-5 + comprovante **somente na hipótese condicional ligada à ausência do CRV/Código de Segurança**;
- CRLV;
- Declaração dos demais herdeiros abrindo mão da propriedade;
- documento oficial de identificação;
- CPF;
- comprovante de residência;
- documentos de representação, quando aplicáveis.

A resposta gerada:

- informa que o atendimento é presencial;
- lista somente as pendências marcadas;
- orienta levar a documentação completa e os originais aplicáveis;
- inclui o link oficial de agendamento de Recursos e Protocolo;
- não pede reenvio da documentação por e-mail.

A declaração dos herdeiros possui anexo no card do Trello, mas não foi exposto link interno do Trello ao cidadão por não haver URL pública confirmada.

### 6. Regra de exigência por e-mail permanece congelada

Para procedimentos aceitos por e-mail:

- protocolista marca **somente os documentos faltantes**;
- cidadão é orientado a reenviar **TODOS os documentos necessários novamente em um único e-mail**, inclusive os já enviados anteriormente;
- não alterar essa regra sem nova confirmação operacional.

### 7. Leilão Geral / COMISLE

- Leilão Geral permanece liberado operacionalmente;
- destino confirmado: `COMISLE`;
- formulário DRV0079 permanece como fonte do fluxo;
- tipologia SEI exata continua não confirmada;
- `manualSeiTypeSelection: true` é preservado;
- a camada P0 limpa `seiProcessName` e `procedureName` do handoff quando a tipologia é manual, impedindo que `Leilão - Geral (COMISLE)` seja tratado como nome de Tipo de Processo no SEI;
- destino COMISLE é preservado;
- operador escolhe manualmente somente a tipologia no FAST PROC.

### 8. Vigência Fase 1 / Fase 2 / Fase 3 / EX-AG

Verificação realizada contra os exports atuais enviados pelo operador:

- Fase 1: **22 ativos**;
- Fase 2: **100 ativos**;
- Fase 3: **5 ativos**;
- EX/AG: **54 ativos**;
- total ativo nas quatro fontes: **181**;
- `catalogo-scripts.json` aposenta 5 duplicidades cronológicas e expõe **176 scripts**, 175 com corpo utilizável.

Conclusão: Fase 1 e EX/AG já estavam filtradas pelo estado `closed` desses mesmos exports na geração do catálogo. Não criar overlay redundante para essas fases. O overlay de estado atual da Fase 2 continua necessário porque a camada Trellinho operacional pode acrescentar/alterar rotas em runtime e precisa respeitar os cartões fechados do Trello atual.

## UX congelada

Princípio global: **próximo clique guiado**.

- durante automação: `AGUARDE / PREENCHENDO`;
- quando pronto: destacar o próximo controle permitido;
- sem criar decisão intermediária sem necessidade;
- casos comuns devem exigir o mínimo possível de cliques;
- não reativar renomeação da Árvore Inteligente.

## Itens já validados que não devem ser reconstruídos

- drag/drop do FAST PROC;
- resgate conservador do Requerimento Rápido;
- confirmação automática restrita de inclusão de interessado;
- guia de próximo clique do FAST PROC;
- Transferência de Prontuário / NUCRA;
- Troca de Clínica / SERVMT e resposta curada;
- Certidão de Identificação Civil / DIRIC;
- Ofícios / DIJUR;
- Devolução de Taxas / DIVAF;
- Perícia Médica;
- reutilização/restauração da aba do Webmail pela Central;
- proteção do overlay Trellinho/Trello na tela de login do OWA.

## OWA / Exchange

O erro `MapiExceptionSessionLimit / TooManyObjectsOpenedException` é problema de sessão do Exchange/OWA da conta e não deve ser tratado como regressão do FAST MAIL.

A GREDINFO já foi acionada. A Central foi ajustada para reutilizar/restaurar abas do Webmail e reduzir criação desnecessária de sessões.

## O que NÃO foi feito neste checkpoint

- PR #3 não foi mergeada;
- `desenvolvimento` não foi alterada;
- nenhuma branch de publicação foi promovida;
- a Chrome Web Store não foi atualizada automaticamente;
- não foi exigido PowerShell do usuário.

## Próximo passo operacional

### Agora — teste local

1. Fazer `Fetch origin` → `Pull origin` no GitHub Desktop, mantendo `agent/catalogo-fast-mail-amanha` selecionada.
2. Recarregar a extensão descompactada no perfil de Chrome de desenvolvimento.
3. Executar validação operacional curta:
   - Solicitar Identificação;
   - Identificar Serviço;
   - assunto dinâmico;
   - Baixa de Restrição → Inventário → Herdeiros;
   - Leilão → COMISLE com tipologia manual.
4. Corrigir qualquer regressão encontrada localmente na mesma branch.

### Depois — publicação

1. Só após os testes locais verdes, usar o artefato da versão `0.5.0` gerado pelo workflow `Empacotar Chrome Web Store`.
2. Fazer o upload no item privado da Chrome Web Store.
3. Publicar somente após autorização explícita de Thiago.
4. Fazer smoke test curto na versão da loja depois que a atualização chegar.
5. Continuar mantendo a branch e a extensão local para o próximo ciclo de desenvolvimento.

## Regra de recuperação

Se uma futura promoção publicada apresentar regressão, o estado P0 pode ser rastreado a partir do commit funcional `1670836ef5cd3f9840696f7f0ce1df31f745d134`, do checkpoint `ef8c40312a086a00a5355d939083f281a952e98d` e dos commits posteriores exclusivamente de CI/documentação. Não reconstruir a solução a partir de versões antigas.