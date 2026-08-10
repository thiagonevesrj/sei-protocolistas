# Checklist de regressão

Use este roteiro antes de considerar uma nova versão pronta para testes com outros protocolistas.

## Preparação

- [ ] Confirmar que a branch ativa é a branch isolada da alteração, baseada em `desenvolvimento`.
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
- [ ] Salvar o e-mail institucional e confirmar a identificação automática do protocolista.
- [ ] Salvar as credenciais fictícias/de teste do Webmail e do SEI com a opção de manter ativada.
- [ ] Encerrar as sessões de teste, usar `INICIAR EXPEDIENTE` e confirmar que as telas de login são retomadas.
- [ ] Salvar um número de protocolista fictício.
- [ ] Fechar e reabrir a Central.
- [ ] Confirmar que a configuração permaneceu no navegador.
- [ ] Confirmar que o FAST MAIL mostra 16 assuntos operacionais e destaca os sete principais.
- [ ] Confirmar `Devolução de Taxas → DIVAF → DAF`.
- [ ] Abrir cada um dos cinco modelos de resposta.
- [ ] Editar um modelo, salvar e confirmar que ele permanece após reabrir a Central.
- [ ] Restaurar o texto-base do modelo.
- [ ] Confirmar que o bloco redundante `Administração e manutenção` não aparece.
- [ ] Confirmar que apagar credenciais do Webmail ou do SEI exige confirmação.
- [ ] Confirmar que uma senha já salva aparece apenas como `Senha já salva`, sem voltar ao campo.
- [ ] Iniciar um expediente e confirmar que Webmail e SEI abrem.
- [ ] Confirmar que as métricas permanecem ocultas durante o expediente.
- [ ] Finalizar o expediente e confirmar tempo total, e-mails, processos e exigências.
- [ ] Exportar o relatório individual em CSV.
- [ ] Enviar um relato fictício sem dados de cidadão e confirmar o recebimento pelo responsável.
- [ ] Tentar incluir um e-mail, CPF ou número de processo fictício no relato e confirmar o bloqueio.
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

## FAST MAIL — webmail institucional

- [ ] Abrir `https://venus2.detran.rj.gov.br/owa/` com o SEI Protocolistas ativo.
- [ ] Confirmar que o painel FAST MAIL aparece somente no OWA institucional.
- [ ] Confirmar a identificação do e-mail e do protocolista.
- [ ] Testar as áreas Habilitação, Veículos, Taxas, Ofícios e Outros.
- [ ] Confirmar que Devolução de Taxas apresenta as pendências validadas.
- [ ] Marcar uma pendência fictícia e confirmar a prévia da resposta.
- [ ] Confirmar a geração dos assuntos `TRIAGEM`, `UNDEFINED` e `FECHADO` nos cenários previstos.
- [ ] Confirmar que `ABRIR PROCESSO` abre o SEI sem enviar o e-mail automaticamente.
- [ ] Confirmar que nome, CPF, e-mail, procedimento, área, objetivo, destino e operador disponíveis são transportados.
- [ ] Confirmar que nenhum dado de cidadão aparece no arquivo exportado de preferências.

## FAST PROC — abertura no SEI

- [ ] Partir de um atendimento fictício registrado pelo FAST MAIL.
- [ ] Confirmar que a extensão localiza `Iniciar Processo` sem novo clique do protocolista.
- [ ] Confirmar que o FAST PROC abre preenchido com todos os dados disponíveis no FAST MAIL.
- [ ] Repetir sem CPF e confirmar que o campo ausente fica destacado para preenchimento manual.
- [ ] Confirmar que o formulário do processo continua sob revisão do protocolista.
- [ ] Confirmar que `Salvar`, encaminhar e enviar permanecem ações manuais.
- [ ] Finalizar um processo fictício e clicar em `PREPARAR RESPOSTA POR E-MAIL`.
- [ ] Confirmar que a extensão volta automaticamente para a mesma aba e conversa que iniciou o atendimento.
- [ ] Confirmar que o histórico do cliente permanece visível e os dados do processo ficam disponíveis.
- [ ] Repetir com a aba original fechada e confirmar que a URL do atendimento é reaberta como recuperação.
- [ ] Repetir sem handoff anterior e confirmar que o Clique Protocolista continua funcional.

## Validação automática

- [ ] Executar `npm run validate` e confirmar a mensagem de sucesso.
- [ ] Executar `npm run lint` e confirmar a conclusão sem erros.
- [ ] Confirmar que a verificação do GitHub Actions foi concluída sem falhas.
- [ ] Confirmar que as versões do manifesto e do pacote são idênticas.
- [ ] Confirmar que somente SEI-RJ e OWA institucional estão autorizados no manifesto.
- [ ] Confirmar que o catálogo e a navegação do FAST MAIL não têm referências quebradas.

## Critério de interrupção

Parar o teste e não distribuir a versão se ocorrer qualquer um destes casos:

- o PDF não aparecer na árvore;
- o tipo não for `Anexo` no fluxo de e-mail;
- o requerimento presencial for tratado como nato-digital;
- aparecer `Sigilo Bancário`;
- o nível ficar público;
- a extensão alterar páginas fora do SEI-RJ;
- o FAST MAIL alterar páginas fora do OWA institucional;
- o e-mail de um atendimento ser reaproveitado em outro atendimento;
- qualquer operação definitiva for executada sem confirmação.
