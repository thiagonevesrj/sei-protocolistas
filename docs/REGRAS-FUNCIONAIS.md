# Regras funcionais do protocolo

Este documento registra decisões operacionais que devem ser preservadas no desenvolvimento do
SEI Protocolistas.

## Origem do atendimento e documentos

### Processo aberto por e-mail

- Todos os documentos recebidos por e-mail são considerados **nato-digitais**.
- O tipo de documento usado para esses arquivos é **Anexo**.
- Esses arquivos podem ser incluídos pela função de arrastar e soltar.
- O fluxo por e-mail não deve marcar documentos como `Digitalizado nesta Unidade`,
  `Original` ou `Requerimento`.

### Processo aberto presencialmente

- A primeira folha é o requerimento físico preenchido pelo cliente durante o atendimento.
- Esse primeiro documento deve seguir o caminho:
  `Externo` → `Requerimento` → `Digitalizado nesta Unidade` → `Original`.
- A regra de documento original aplica-se exclusivamente a esse requerimento presencial.
- Os demais arquivos não devem ser marcados automaticamente como originais; sua classificação
  deve respeitar a origem real do documento.

## Acesso

- Os processos e documentos tratados por estes fluxos devem permanecer como **Restrito**.
- A hipótese legal deve ser **Informação Pessoal**.

## Segurança operacional

- A extensão pode preencher e selecionar campos, mas não deve acionar `Salvar` automaticamente.
- O protocolista deve revisar os dados e confirmar a operação no SEI.

## Continuidade entre FAST MAIL e FAST PROC

- O perfil configurado na Central identifica o operador a partir do e-mail institucional.
- O navegador mantém as sessões ativas; quando a tela de login reaparecer, a extensão pode
  preencher e enviar as credenciais que o operador escolheu manter neste perfil do navegador.
- `ABRIR PROCESSO` deve transportar os dados disponíveis no FAST MAIL, abrir o SEI, localizar
  `Iniciar Processo` e apresentar o FAST PROC preenchido para revisão.
- Nome, CPF, e-mail, procedimento, área, objetivo, destino e operador devem ser reaproveitados
  quando disponíveis. Informação ausente deve permanecer visível para preenchimento manual.
- A automação não pode criar, salvar ou encaminhar o processo sem a confirmação do protocolista.
