# Checklist de regressão

Use este roteiro antes de considerar uma nova versão pronta para testes com outros protocolistas.

## Preparação

- [ ] Confirmar que a branch ativa é `desenvolvimento`.
- [ ] Confirmar que SEI++ e SEI Pro estão desativados.
- [ ] Recarregar o SEI Protocolistas em `chrome://extensions`.
- [ ] Confirmar que não existe alerta de carregamento da extensão.
- [ ] Usar somente dados e PDFs fictícios ou previamente descaracterizados.
- [ ] Registrar a versão do Chrome utilizada.
- [ ] Registrar a versão do SEI exibida na unidade.

## Carregamento e identidade

- [ ] Abrir o SEI-RJ.
- [ ] Confirmar o cabeçalho do SEI Protocolistas.
- [ ] Confirmar a assinatura `by Thiago Neves Design`.
- [ ] Confirmar que o modo claro abre.
- [ ] Confirmar que o modo escuro abre.
- [ ] Abrir uma página brasileira que não seja o SEI e confirmar que a extensão não altera a tela.

## Central Protocolista

- [ ] Clicar no ícone da extensão.
- [ ] Abrir a Central Protocolista.
- [ ] Confirmar que a versão exibida é a mesma do manifesto.
- [ ] Salvar um número de protocolista fictício.
- [ ] Fechar e reabrir a Central.
- [ ] Confirmar que a configuração permaneceu no navegador.
- [ ] Confirmar que o catálogo mostra os dez processos prioritários.
- [ ] Confirmar `Devolução de Taxas → DIVAF → DAF`.
- [ ] Abrir cada um dos cinco modelos de resposta.
- [ ] Editar um modelo, salvar e confirmar que ele permanece após reabrir a Central.
- [ ] Restaurar o texto-base do modelo.
- [ ] Exportar a configuração em JSON.
- [ ] Confirmar que o JSON não contém nome, CPF, telefone ou e-mail de cidadão.
- [ ] Importar o JSON e confirmar número do protocolista e modelos.
- [ ] Criar um rascunho fictício no Clique Protocolista.
- [ ] Confirmar que a Central sinaliza a existência de atendimento temporário.
- [ ] Limpar os dados temporários pela Central.

## Clique Protocolista

- [ ] Abrir `Iniciar Processo`.
- [ ] Confirmar a presença do botão `CLICK PROTOCOLISTA`.
- [ ] Abrir o painel.
- [ ] Alternar entre presencial e e-mail.
- [ ] Selecionar `Devolução de Taxas`.
- [ ] Preencher nome, CPF, telefone, e-mail e DUDA fictícios.
- [ ] Confirmar a prévia da especificação.
- [ ] Confirmar que as observações começam pela modalidade.
- [ ] Continuar.
- [ ] Confirmar que o tipo de processo foi aberto ou destacado.
- [ ] Confirmar o preenchimento da especificação.
- [ ] Confirmar o preenchimento das observações.
- [ ] Confirmar o preenchimento do interessado.
- [ ] Confirmar `Restrito`.
- [ ] Confirmar `Informação Pessoal`.
- [ ] Confirmar que o botão `Salvar` não foi acionado automaticamente.

## Arrastar e anexar — marco 0.2.21

- [ ] Abrir um processo fictício ou autorizado para teste.
- [ ] Arrastar um PDF com nome simples.
- [ ] Aguardar o upload chegar a 100%.
- [ ] Confirmar que o arquivo aparece na árvore.
- [ ] Confirmar tipo documental `Anexo`.
- [ ] Confirmar formato `Nato-digital`.
- [ ] Confirmar nível `Restrito`.
- [ ] Confirmar hipótese `Informação Pessoal`.
- [ ] Repetir com um segundo PDF.
- [ ] Confirmar que não aparece `Sigilo Bancário`.
- [ ] Confirmar que o documento não foi tratado como requerimento presencial.

## Requerimento presencial

- [ ] Iniciar pelo Clique Protocolista em `Abertura presencial`.
- [ ] Abrir a inclusão de novo documento.
- [ ] Confirmar tipo geral `Externo`.
- [ ] Confirmar tipo documental `Requerimento`.
- [ ] Confirmar `Digitalizado nesta Unidade`.
- [ ] Confirmar `Original`.
- [ ] Confirmar interessado e observações.
- [ ] Confirmar `Restrito`.
- [ ] Confirmar `Informação Pessoal`.
- [ ] Confirmar que o botão `Salvar` permanece manual.

## Critério de interrupção

Parar o teste e não distribuir a versão se ocorrer qualquer um destes casos:

- o PDF não aparecer na árvore;
- o tipo não for `Anexo` no fluxo de e-mail;
- o requerimento presencial for tratado como nato-digital;
- aparecer `Sigilo Bancário`;
- o nível ficar público;
- a extensão alterar páginas fora do SEI-RJ;
- qualquer operação definitiva for executada sem confirmação.
