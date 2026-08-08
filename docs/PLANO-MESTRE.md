# Plano Mestre — SEI Protocolistas

> Documento vivo do projeto  
> Última consolidação: 8 de agosto de 2026
> Linha de base funcional: `0.3.2`
> Branch de desenvolvimento: `desenvolvimento`
> Marco do anexo: `be7f026` — reconhecimento da confirmação de upload do SEI-RJ
> Marco funcional consolidado: `88cdbdc` — Central, FAST MAIL e FAST PROC

## 1. Visão do projeto

O **SEI Protocolistas** é uma extensão gratuita, local e de código aberto, idealizada por
**Thiago Neves**, para reduzir cliques, retrabalho e erros na rotina dos protocolistas do
DETRAN-RJ.

O projeto nasceu como uma versão especializada e enxuta do SEI++, preservando os créditos e as
obrigações da licença GPL-3.0. Ele não pretende apenas mudar a aparência do SEI. Sua finalidade é
acompanhar o atendimento desde a triagem do pedido até a conclusão, reutilizando os mesmos dados
durante todo o fluxo.

### Meta operacional

Transformar um atendimento que pode consumir de cinco a dez minutos em um fluxo guiado de poucos
cliques, capaz de suportar uma rotina de aproximadamente 50 a 60 solicitações diárias sem exigir
cópias repetidas entre Trello, editor de texto, SEI e webmail.

### Princípio central

> O protocolista informa os dados uma vez; o sistema reutiliza esses dados até o encerramento do
> atendimento.

## 2. Identidade e princípios permanentes

- Nome do produto: **SEI Protocolistas**.
- Nome do idealizador: **Thiago Neves**, sempre com `H`.
- Assinatura visual: **by Thiago Neves Design**.
- Paleta principal: azul-marinho e dourado.
- Modos de visualização: claro e escuro.
- O cabeçalho, o menu lateral azul-marinho e os detalhes dourados devem ser preservados nos dois
  modos.
- A faixa dourada do cabeçalho deve atravessar a tela e ter presença visual maior que a linha
  original.
- O símbolo e as letras douradas da marca devem usar o mesmo tom da faixa.
- O projeto continuará gratuito, local e de código aberto.
- Os créditos do SEI++ e as obrigações da GPL-3.0 devem ser preservados.
- A compatibilidade estudada com o SEI Pro deve ser documentada sem copiar arquivos ou código de
  forma incompatível com as licenças.

## 3. Forma de trabalho

- Diagnosticar primeiro. Alterar depois. Nunca o contrário.
- Avisar Thiago antes de cada bloco importante.
- Explicar objetivo, arquivos alterados, funcionamento e testes em linguagem acessível.
- Trabalhar na branch `desenvolvimento`.
- Integrar em `main` somente após verificação.
- Registrar uma linha de base antes de corrigir problemas herdados.
- Desativar e testar antes de excluir módulos legados.
- Não enviar dados de cidadãos, documentos ou credenciais a serviços externos.
- Manter uma confirmação humana antes de operações definitivas no SEI ou no webmail.
- Validar o manifesto, executar o lint possível e testar o carregamento da extensão antes de
  integrar alterações.

## 4. Problema operacional que o projeto resolve

O fluxo atual utiliza várias ferramentas desconectadas:

1. O requerente envia documentos por e-mail ou comparece presencialmente.
2. O protocolista verifica a documentação.
3. Quando faltam documentos, procura um texto no Trello, edita a pendência e cola no webmail.
4. Quando a documentação está completa, abre o processo no SEI.
5. Digita informações repetidas em diferentes telas.
6. Inclui ou autentica documentos conforme a origem.
7. Pesquisa manualmente a unidade de destino.
8. Volta ao Trello para localizar o texto de conclusão.
9. Edita assunto, número do processo e corpo do e-mail.
10. No atendimento presencial, escreve manualmente o número em um comprovante de acompanhamento.

O Trello é útil como acervo inicial, mas não executa regras nem reaproveita dados. O objetivo é
substituí-lo na operação diária por uma **Central Protocolista** integrada à extensão.

## 5. Estado atual comprovado

### 5.1 Fundação do projeto

- Fork próprio criado em `thiagonevesrj/sei-protocolistas`.
- Repositório clonado localmente.
- Branch `desenvolvimento` criada e publicada.
- Extensão carregada sem compactação no modo de desenvolvedor do Chrome.
- SEI++ e SEI Pro foram desativados durante os testes isolados.
- Projeto renomeado para **SEI Protocolistas**.
- README, manifesto, pacote e documentação inicial adaptados.
- Licença GPL-3.0 e créditos do projeto original preservados.

### 5.2 Versão enxuta

Foram mantidas ou priorizadas as funções relacionadas à produtividade:

- Clique Menos, evoluído para **Clique Protocolista**;
- arrastar arquivos para o processo;
- informações do interessado;
- identificação de atribuição na árvore;
- anotações;
- copiar número e link;
- uso de documento como modelo;
- pesquisa de informações, ainda limitada;
- recursos essenciais à abertura e manipulação de processos.

Foram ocultadas ou desativadas por padrão várias opções fora do escopo inicial:

- prazo de atendimento;
- quantidade de dias;
- filtros por atribuição e blocos;
- reabertura e retirada de sobrestamento;
- checagem de blocos de assinatura;
- especificações em visualizações;
- marcadores;
- notificações experimentais;
- cores de ponto de controle;
- outras opções herdadas que não fazem parte da rotina dos protocolistas.

Esses módulos ainda não devem ser apagados indiscriminadamente. Primeiro devem permanecer
desativados até a conclusão dos testes da versão enxuta.

### 5.3 Identidade visual

Já foram implementados:

- nome SEI Protocolistas no cabeçalho;
- marca visual `protocolistas`;
- assinatura **by Thiago Neves Design**;
- cabeçalho azul-marinho;
- detalhes dourados;
- menu lateral azul-marinho;
- identidade aplicada aos modos claro e escuro;
- versão `0.1.x` inicial substituída pelas evoluções atuais.

Pendências visuais conhecidas:

- remover definitivamente a linha verde que ainda pode aparecer no modo escuro;
- remover definitivamente a linha azul-clara que ainda pode aparecer no modo claro;
- uniformizar o dourado da marca e da faixa;
- engrossar a faixa dourada;
- revisar proporção, nitidez e alinhamento final da marca;
- deixar a assinatura pequena e com aparência cursiva padronizada;
- fazer a revisão estética final somente depois das funções prioritárias.

### 5.4 Clique Protocolista

O botão **CLICK PROTOCOLISTA** já aparece na abertura de novo processo.

Ele oferece:

- escolha entre `Abertura presencial` e `Abertura via e-mail`;
- tipo do processo;
- nome do interessado;
- CPF;
- telefone;
- e-mail;
- número do DUDA;
- placa;
- chassi;
- Renavam;
- prévia da especificação;
- prévia das observações.

O rascunho é guardado temporariamente no armazenamento local da extensão e reaproveitado na tela
seguinte.

Na tela de geração do processo, a extensão já tenta:

- preencher a especificação;
- preencher as observações;
- preencher o nome do interessado;
- selecionar o nível `Restrito`;
- selecionar a hipótese legal `Informação Pessoal`;
- destacar o campo do interessado para revisão e confirmação;
- manter o botão `Salvar` sob o controle do protocolista.

Quando o SEI não expõe um endereço seguro para selecionar automaticamente o tipo, a extensão filtra,
localiza e destaca a opção para que o protocolista dê um clique de confirmação.

### 5.5 Tipos prioritários já cadastrados no Clique Protocolista

1. Devolução de Taxas;
2. Desistência de Categoria na 1ª Habilitação;
3. Solicitação Geral - Habilitação;
4. Solicitações Gerais - Veículos;
5. Cancelamento de Comunicação de Venda;
6. Certidão de Identificação Civil;
7. Solicitação de Perícia Médica;
8. Isenção de Taxa;
9. Averbação de CNH Estrangeira;
10. Elaboração de Ofício de Mero Expediente.

Além dos favoritos, o Clique Protocolista lê dinamicamente os demais tipos exibidos pelo próprio SEI
e os disponibiliza em um segundo grupo.

### 5.6 Arrastar e anexar arquivos

O fluxo de arrastar PDFs foi recuperado, adaptado ao SEI-RJ e testado com vários arquivos.

Marco confirmado em produção:

- o upload chega a 100%;
- o arquivo é criado como documento externo;
- o tipo documental selecionado é `Anexo`;
- o formato é `Nato-digital`;
- o nível é `Restrito`;
- a hipótese legal é `Informação Pessoal`;
- o documento aparece corretamente na árvore do processo.

Essa função foi confirmada por Thiago com vários PDFs na versão `0.2.21`.

#### Histórico resumido da correção

Durante o diagnóstico surgiram, em sequência:

- tipo `Externo` não encontrado;
- caminho interno de cadastro não informado;
- URL de upload não localizada;
- formulário devolvido sem confirmação;
- mensagem incorreta de caracteres especiais;
- incompatibilidades de codificação e contrato do upload.

O fluxo do SEI Pro foi usado como referência comportamental. A implementação final permaneceu na
arquitetura do SEI Protocolistas e passou a reconhecer a confirmação específica devolvida pelo
SEI-RJ.

Esse caminho agora é uma linha de base de regressão: futuras alterações não podem quebrá-lo.

### 5.7 Requerimento presencial

Existe implementação para orientar o fluxo do primeiro documento presencial:

`Externo` → `Requerimento` → `Digitalizado nesta Unidade` → `Original`.

Também existe preenchimento de:

- interessado;
- observações da unidade;
- nível `Restrito`;
- hipótese `Informação Pessoal`.

Essa automação deve passar por uma rodada completa de validação depois que a fundação da Central
Protocolista estiver definida.

### 5.8 Linha de base funcional 0.3.2

Em 8 de agosto de 2026, a versão funcional validada no computador de Thiago foi preservada,
publicada e alinhada com a branch `desenvolvimento`. A consolidação contém:

- Central Protocolista aberta pelo ícone da extensão;
- configuração local do operador e das credenciais;
- FAST MAIL no OWA institucional, com navegação por área, triagem, exigências e respostas;
- assuntos `TRIAGEM`, `UNDEFINED` e `FECHADO`;
- FAST PROC na abertura de processos do SEI;
- identificação do e-mail do atendimento e retorno do SEI ao webmail;
- catálogo schema 4 com 12 procedimentos prioritários;
- fluxo legado de anexação preservado.

Limites conhecidos da linha de base:

- `ABRIR PROCESSO` ainda não navega automaticamente até o SEI;
- o handoff FAST MAIL → FAST PROC transporta somente o e-mail;
- login automático ainda não está implementado;
- credenciais lembradas ficam legíveis no armazenamento local do navegador;
- os registros temporários ainda não possuem identificador individual por atendimento;
- o módulo legado de background permanece fora do manifesto até revisão específica, para não
  reativar notificações e alarmes sem validação.

Esses limites devem ser corrigidos em patches separados. O saneamento técnico da versão `0.3.2`
não pode alterar o comportamento funcional acima.

## 6. Regras funcionais obrigatórias

### 6.1 Processo aberto por e-mail

- Os documentos recebidos por e-mail são tratados como **nato-digitais**.
- O tipo documental é **Anexo**.
- Eles podem ser incluídos pela função de arrastar e soltar.
- Eles não devem ser marcados como `Digitalizado nesta Unidade`, `Original` ou `Requerimento`.

### 6.2 Processo aberto presencialmente

- A primeira folha normalmente é o requerimento físico preenchido pelo cliente.
- Esse requerimento segue:
  `Externo` → `Requerimento` → `Digitalizado nesta Unidade` → `Original`.
- A regra de `Original` aplica-se ao requerimento físico original.
- Os demais documentos devem respeitar sua origem real.
- Cópias e documentos nato-digitais não devem ser transformados automaticamente em originais.

### 6.3 Nível de acesso

- Processo: sempre `Restrito`.
- Documento: sempre `Restrito` nos fluxos mapeados.
- Hipótese legal: sempre `Informação Pessoal`.
- Nunca selecionar automaticamente `Sigilo Bancário`.

### 6.4 Campos do processo

- A classificação por assuntos já vem do tipo escolhido e não deve ser alterada pelo Clique
  Protocolista.
- Prioridade não deve ser preenchida automaticamente.
- Protocolo permanece automático.
- O interessado pode ser digitado livremente.
- Quando o nome ainda não está cadastrado, o SEI pede confirmação para incluí-lo.
- A primeira versão não deve tentar contornar silenciosamente essa confirmação.

### 6.5 Especificação

A especificação reúne somente os valores informados e separa-os por espaço, sem rótulos e sem
pontuação adicional:

`CPF DUDA TELEFONE EMAIL PLACA CHASSI RENAVAM`

Campos vazios são ignorados.

### 6.6 Observações

As observações começam pela modalidade e repetem os dados da especificação:

- `Abertura presencial CPF DUDA TELEFONE EMAIL PLACA CHASSI RENAVAM`; ou
- `Abertura via e-mail CPF DUDA TELEFONE EMAIL PLACA CHASSI RENAVAM`.

Essas observações também devem alimentar o requerimento presencial quando aplicável.

### 6.7 Confirmação humana

A extensão pode:

- preencher;
- selecionar;
- localizar;
- destacar;
- preparar textos;
- preparar o encaminhamento.

O protocolista deve revisar e confirmar:

- inclusão do interessado;
- salvamento do processo ou documento;
- unidade de destino;
- envio definitivo do processo;
- envio definitivo do e-mail.

## 7. Três fluxos operacionais definitivos

### 7.1 E-mail com documentação incompleta

Não é aberto processo.

Fluxo desejado:

1. abrir a Central Protocolista;
2. escolher o tipo de solicitação;
3. informar o nome do requerente;
4. marcar, por checkbox, os documentos ausentes;
5. usar campo `Outros` quando necessário;
6. gerar o assunto de triagem;
7. gerar a resposta completa;
8. copiar ou preencher o webmail;
9. revisar e enviar.

Possíveis pendências já mencionadas:

- CNH ou documento de habilitação;
- CPF;
- comprovante de residência;
- DUDA;
- comprovante de pagamento do DUDA;
- comprovante de conta bancária;
- requerimento preenchido e assinado;
- outros documentos específicos de cada serviço.

O botão de copiar resposta só deve ser habilitado depois que ao menos uma pendência for marcada ou
descrita.

### 7.2 E-mail com documentação completa

Fluxo desejado:

1. iniciar pelo Clique Protocolista na modalidade `Abertura via e-mail`;
2. preencher os dados uma única vez;
3. abrir e revisar o processo;
4. incluir os arquivos como `Anexo` e `Nato-digital`;
5. identificar automaticamente a unidade de destino;
6. preparar o encaminhamento;
7. confirmar o envio no SEI;
8. capturar o número final do processo;
9. gerar assunto de conclusão;
10. gerar corpo de resposta;
11. preencher ou copiar para o webmail;
12. revisar e enviar.

### 7.3 Atendimento presencial

Fluxo desejado:

1. iniciar pelo Clique Protocolista na modalidade `Abertura presencial`;
2. preencher os dados uma única vez;
3. abrir e revisar o processo;
4. incluir o primeiro requerimento como documento externo, digitalizado na unidade e original;
5. incluir os demais arquivos conforme a origem real;
6. identificar automaticamente a unidade de destino;
7. preparar o encaminhamento;
8. confirmar o envio no SEI;
9. gerar uma folha única de acompanhamento;
10. imprimir e entregar ao requerente.

## 8. Assuntos de e-mail

### 8.1 Processo concluído

Formato:

`NOME DO REQUERENTE - SIGLA - DDMMAAAANÚMERO_DO_PROTOCOLISTA - FECHADO`

Exemplo para Thiago, protocolista 31:

`SERGIO RODRIGO DA SILVA - DAF - 3007202631 - FECHADO`

### 8.2 Documentação pendente

Formato:

`NOME DO REQUERENTE - SIGLA - DDMMAAAANÚMERO_DO_PROTOCOLISTA - TRIAGEM`

Exemplo:

`SERGIO RODRIGO DA SILVA - DAF - 3007202631 - TRIAGEM`

### 8.3 Configuração do protocolista

- O número é configurado uma única vez no navegador.
- Para Thiago, o número padrão de teste é `31`.
- A data deve ser gerada automaticamente, sem barras.
- A configuração deve ser editável para os demais protocolistas.
- O sistema não depende de login próprio na primeira versão.

## 9. Catálogo operacional

Cada tipo de processo precisa ter um registro estruturado:

- identificador interno;
- nome amigável;
- nome exato usado pelo SEI;
- aliases encontrados no SEI;
- documentos obrigatórios;
- documentos opcionais;
- opções de pendência;
- unidade de destino pesquisada no SEI;
- sigla usada no assunto do e-mail;
- modelo de triagem;
- modelo de conclusão;
- contatos específicos;
- informações específicas para o protocolo impresso;
- observações e exceções.

### 9.1 Mapeamento confirmado

| Tipo de processo | Unidade no SEI | Sigla do assunto | Modelo |
| --- | --- | --- | --- |
| Devolução de Taxas | DIVAF | DAF | Protocolo DAF |

### 9.2 Modelos já identificados

- Protocolo Padrão;
- Protocolo DAF;
- Protocolo DRV;
- Protocolo AGEM;
- Protocolo DIVMED.

Os textos originais já foram fornecidos por Thiago e devem ser transformados em blocos reutilizáveis:

1. abertura com número do processo;
2. instruções comuns da Pesquisa Pública;
3. bloco específico do setor;
4. canais gerais;
5. orientação de exigências;
6. aviso para não responder ao e-mail, quando aplicável;
7. assinatura do Serviço de Protocolo.

### 9.3 Informações especiais já conhecidas

#### DAF

- Unidade: DIVAF.
- Sigla no assunto: DAF.
- Telefones de pagamento e exigências.
- E-mail `DAF.ANL@DETRAN.RJ.GOV.BR`.
- Orientação sobre devolução por crédito em conta bancária em nome do requerente.

#### DRV

- Usa contato específico `atendimento.drv@detran.rj.gov.br`.
- Tipo de processo e unidade exata ainda precisam ser confirmados.

#### AGEM

- Usa contato específico `agem@detran.rj.gov.br`.
- Tipos de processo e unidade exata ainda precisam ser confirmados.

#### DIVMED

- Relacionado ao fluxo de perícia médica.
- Usa WhatsApp específico `https://wa.me/552123320206`.
- Unidade exata no SEI ainda precisa ser confirmada.

### 9.4 Levantamento ainda necessário

Para cada processo prioritário, o chefe ou a equipe deve confirmar:

1. nome exato do tipo no SEI;
2. unidade de destino pesquisada no SEI;
3. sigla utilizada no assunto;
4. modelo de resposta;
5. documentos obrigatórios;
6. exceções.

## 10. Respostas já recebidas

### 10.1 Componentes comuns

- número completo do processo, incluindo `SEI-`;
- endereço da Pesquisa Pública;
- selecionar `ERJ` em Municípios;
- preencher o captcha;
- pesquisar;
- clicar no número azul;
- orientar que exigências sejam tratadas com o setor onde o processo se encontra;
- canais gerais do DETRAN-RJ;
- assinatura do Serviço de Protocolo.

### 10.2 Canais gerais já fornecidos

- Teleatendimento: `(21) 3460-4040` e `(21) 3460-4041`;
- Ouvidoria: `(21) 2332-0438` e `(21) 2321-0450`;
- WhatsApp geral:
  `https://api.whatsapp.com/send/?phone=552134604040&text&type=phone_number&app_absent=0`.

### 10.3 Regra de composição

Não duplicar cinco textos longos dentro do código. A implementação deve usar:

- base comum;
- bloco específico do setor;
- fechamento comum;
- variação própria para e-mail;
- variação própria para impressão.

## 11. Protocolo impresso presencial

### Decisões fechadas

- Será uma folha inteira, em um único lado.
- Não será frente e verso.
- Deve ser mais explicativa que o cartão atual.
- Deve inserir automaticamente o número completo do processo.
- Deve inserir o nome do requerente.
- Deve conter instruções de consulta.
- Deve conter os contatos adequados ao setor.
- Deve informar que a documentação foi digitalizada e devolvida, quando isso refletir o
  atendimento.
- Deve conter as orientações sobre guarda ou apresentação de documentos originais.
- Deve utilizar o QR Code oficial.

### QR Code

- O conteúdo oficial não deve ser alterado.
- Não arredondar ou estilizar os módulos do código.
- Melhorias permitidas: nitidez, tamanho, margem, alinhamento e contraste.
- Preferência: usar o arquivo digital original do QR Code.
- Alternativa: regenerar o QR Code a partir do endereço oficial exato e testar a leitura.

### Pendência de formato

Confirmar se a impressão será:

- A4, `210 × 297 mm`; ou
- papel Ofício/Legal utilizado pela unidade.

## 12. Central Protocolista — substituição operacional do Trello

A Central Protocolista será uma aplicação interna da própria extensão.

### 12.1 Objetivos

- concentrar triagem, abertura, conclusão e impressão;
- armazenar modelos e regras;
- eliminar busca manual em cartões;
- evitar editar arquivos TXT;
- reutilizar os dados do atendimento;
- funcionar gratuitamente e sem servidor próprio;
- funcionar mesmo quando não houver processo aberto no SEI.

### 12.2 Módulos planejados

#### Nova triagem

- escolha do serviço;
- documentos ausentes;
- assunto de `TRIAGEM`;
- resposta gerada;
- copiar ou preencher no webmail.

#### Abrir processo

- acesso ao Clique Protocolista;
- dados do requerente;
- tipo de processo;
- modalidade;
- prévia dos campos do SEI.

#### Concluir atendimento

- leitura do número do processo;
- identificação do tipo;
- identificação da unidade de destino;
- preparação do encaminhamento;
- assunto de `FECHADO`;
- corpo do e-mail ou protocolo impresso.

#### Catálogo

- processos;
- documentos obrigatórios;
- destinos;
- siglas;
- modelos;
- contatos;
- exceções.

#### Configurações

- número do protocolista;
- nome opcional do protocolista;
- preferências visuais;
- importação e exportação do catálogo.

### 12.3 Armazenamento

Primeira versão:

- catálogo padrão dentro da extensão, versionado no GitHub;
- preferências em `chrome.storage.local`;
- contexto temporário do atendimento em `chrome.storage.local`;
- nenhum banco externo;
- nenhum custo de hospedagem;
- nenhum envio de dados pessoais para a internet.

Evolução possível:

- editor do catálogo;
- importar e exportar JSON;
- arquivo central de atualização sem dados pessoais;
- configuração institucional gerenciada, se o DETRAN futuramente apoiar o projeto.

### 12.4 Papel do Trello

O Trello será fonte de migração, não dependência diária.

Fluxo recomendado:

1. exportar o quadro como JSON;
2. extrair cartões, títulos, listas, descrições e anexos úteis;
3. classificar os modelos;
4. cadastrar os dados no catálogo;
5. validar com protocolistas;
6. aposentar o copiar e colar do Trello.

Não criar integração permanente com a API do Trello na primeira versão.

## 13. Integração com o webmail

### Decisão arquitetural

Não criar uma segunda extensão. O módulo de webmail deve fazer parte do próprio SEI Protocolistas.

### Funcionamento desejado

Ao abrir uma composição ou resposta no webmail, aparecerá:

**Respostas Protocolistas**

O painel poderá oferecer:

- tipo de processo;
- processo aberto ou documentação pendente;
- nome do requerente;
- número do processo;
- unidade e sigla;
- checkboxes de pendências;
- seleção entre 10 e 15 respostas iniciais;
- prévia do assunto;
- prévia da mensagem;
- `Preencher assunto e mensagem`;
- `Copiar assunto`;
- `Copiar resposta`.

O clique final em `Enviar` continua sob controle do protocolista.

### Reaproveitamento de dados

O contexto criado no Clique Protocolista deve atravessar o atendimento:

`Clique Protocolista → SEI → conclusão → webmail`

Dados temporários possíveis:

- modalidade;
- tipo de processo;
- nome;
- número do processo;
- setor;
- sigla;
- assunto;
- corpo gerado.

### Pré-requisitos para implementar

- endereço exato ou domínio inicial do webmail;
- print de uma composição vazia;
- identificação do editor do assunto;
- identificação do editor do corpo;
- confirmação de uso de frames ou editor dinâmico;
- teste com e-mail fictício e sem dados pessoais.

### Correção técnica necessária

O manifesto atual carrega módulos centrais em páginas muito amplas, usando `*://*.br/*`.

Antes da integração:

1. restringir os módulos do SEI aos endereços e rotas do SEI;
2. criar um módulo separado para o domínio exato do webmail;
3. solicitar somente as permissões necessárias;
4. impedir que tema e scripts do SEI alterem outras páginas brasileiras.

## 14. Encaminhamento do processo

### Objetivo

Quando o processo estiver pronto, a extensão deve:

1. identificar seu tipo;
2. consultar o catálogo;
3. apontar a unidade correta;
4. preencher ou localizar a unidade no SEI;
5. exibir a unidade para conferência;
6. deixar a confirmação final de envio com o protocolista;
7. reconhecer quando o processo já estiver na unidade de destino;
8. liberar o encerramento por e-mail ou impressão.

### Primeiro piloto

`Devolução de Taxas → DIVAF → DAF`

O piloto deve cobrir processo já enviado e processo ainda na unidade de protocolo.

## 15. Pesquisa de processos

A pesquisa atual do SEI é um problema operacional relevante.

Estado atual:

- a função herdada chamada “pesquisa de informações” filtra processos que já estão visíveis;
- ela não resolve sozinha a busca ampla de um processo perdido;
- ainda não existe um mecanismo confiável de busca por nome, CPF, e-mail, placa, Renavam ou outros
  dados em todo o acervo permitido ao usuário.

Direção futura:

- documentar casos reais de pesquisa;
- verificar quais telas e filtros o SEI-RJ fornece;
- melhorar a experiência sem ampliar indevidamente as permissões;
- nunca criar uma base paralela de dados pessoais apenas para facilitar pesquisas.

Essa frente deve começar depois do piloto completo de produtividade.

## 16. Dívidas e riscos conhecidos

### Técnicos

- 50 erros de lint foram registrados na linha de base herdada do SEI++.
- O modelo global de scripts herdado dificulta validação isolada.
- Os seletores do SEI podem variar entre versões e unidades.
- Algumas rotas usam links `javascript:` bloqueados pela política de segurança do navegador.
- O manifesto precisa permanecer restrito ao SEI-RJ e ao OWA institucional.
- A interação com editores de webmail pode mudar quando o fornecedor atualiza a interface.
- O fluxo presencial precisa de nova validação integral.

### Operacionais

- falta o mapa completo `processo → unidade → sigla → modelo`;
- faltam checklists documentais validados por tipo;
- falta confirmar o papel exato de DRV, AGEM e DIVMED;
- falta confirmar o tamanho do papel do protocolo presencial;
- falta o QR Code oficial em arquivo digital;
- os textos devem passar por revisão ortográfica e institucional antes de distribuição ampla;
- a equipe precisa testar com casos reais sem expor dados pessoais no GitHub.

### De regressão

- arrastar/anexar não pode voltar a falhar;
- `Informação Pessoal` não pode voltar para `Sigilo Bancário`;
- e-mail não pode ser classificado como documento presencial;
- requerimento presencial não pode ser tratado como mero anexo nato-digital;
- módulos ocultos não devem ser reativados por configurações antigas;
- scripts do SEI não devem invadir o webmail ou outras páginas.

## 17. Roteiro de desenvolvimento

### Fase 0 — Consolidar e proteger a linha de base

Objetivo: preservar o que já funciona antes de abrir novas frentes.

Tarefas:

- manter `0.2.21` como marco estável do anexo;
- criar checklist manual de regressão;
- documentar versões do Chrome e SEI-RJ usadas no teste;
- registrar PDFs de teste sem dados pessoais;
- revisar manifesto e dependências;
- manter SEI++ e SEI Pro desativados durante os testes isolados.

Critério de conclusão:

- extensão carrega sem falha;
- Clique Protocolista abre;
- processo é preenchido;
- PDF arrastado aparece como Anexo na árvore;
- Restrito + Informação Pessoal permanecem corretos.

### Fase 1 — Fundação da Central Protocolista

Objetivo: criar a aplicação interna que substituirá o Trello.

Tarefas:

- desenhar a tela principal;
- criar catálogo local;
- criar configuração do número do protocolista;
- persistir modalidade e contexto até o final;
- criar editor inicial de modelos;
- criar importação e exportação JSON;
- separar dados permanentes de dados temporários;
- restringir os endereços do manifesto ao SEI-RJ e ao OWA institucional.

Critério de conclusão:

- a Central abre pelo ícone da extensão;
- número `31` pode ser configurado e alterado;
- catálogo DAF pode ser consultado;
- dados pessoais temporários expiram;
- nenhuma página fora do SEI-RJ ou do OWA institucional é alterada.

Status técnico na versão `0.3.2`:

- estrutura visual da Central criada;
- número do protocolista salvo localmente;
- catálogo prioritário e cinco modelos iniciais carregados de arquivos locais;
- editor de modelos e importação/exportação de preferências implementados;
- exportação exclui os dados temporários do atendimento;
- limpeza automática por validade e limpeza manual implementadas;
- contexto do Clique Protocolista ampliado para acompanhar o atendimento até a conclusão;
- FAST MAIL e FAST PROC integrados parcialmente pelo e-mail do atendimento;
- validação operacional completa no Chrome, OWA e SEI-RJ ainda necessária antes de encerrar a fase.

### Fase 2 — Piloto DAF: triagem sem processo

Objetivo: eliminar o Trello no primeiro fluxo de e-mail.

Tarefas:

- cadastrar documentos exigidos para Devolução de Taxas;
- criar checkboxes;
- criar campo `Outros`;
- montar assunto `TRIAGEM`;
- montar resposta com pendências;
- criar botões de copiar;
- impedir resposta vazia;
- testar textos e pluralização.

Critério de conclusão:

- uma pendência DAF é respondida sem abrir Trello ou TXT;
- assunto e corpo ficam prontos em segundos;
- nenhuma informação pessoal fica gravada permanentemente.

Status técnico na versão `0.3.2`:

- triagem DAF disponível no FAST MAIL;
- pendências, links úteis e resposta preparados no OWA;
- validação operacional final no Chrome ainda necessária.

### Fase 3 — Piloto DAF: processo completo

Objetivo: ligar abertura, anexos, destino e encerramento.

Tarefas:

- preservar o contexto do Clique Protocolista;
- validar requerimento presencial;
- localizar DIVAF automaticamente;
- preparar o encaminhamento;
- reconhecer processo já enviado;
- capturar número do processo;
- montar assunto `FECHADO`;
- montar resposta DAF;
- preparar protocolo impresso DAF.

Critério de conclusão:

- DAF por e-mail percorre o fluxo completo;
- DAF presencial percorre o fluxo completo;
- o protocolista apenas revisa e confirma operações definitivas.

### Fase 4 — Integração com o webmail

Objetivo: preencher respostas diretamente no webmail.

Tarefas:

- obter domínio e print da composição;
- criar permissão específica;
- criar módulo isolado;
- localizar assunto e corpo;
- criar painel `Respostas Protocolistas`;
- preencher texto simples;
- avaliar preenchimento HTML com links clicáveis;
- manter fallback de copiar;
- manter envio manual.

Critério de conclusão:

- assunto e corpo DAF são inseridos corretamente;
- a resposta permanece editável;
- botão nativo de enviar não é acionado automaticamente;
- nenhuma parte visual do SEI é injetada indevidamente no webmail.

Status técnico na versão `0.3.2`:

- FAST MAIL injetado somente no OWA institucional;
- assuntos e respostas de triagem e conclusão implementados;
- envio permanece manual;
- abertura automática do SEI e handoff completo ainda pendentes.

### Fase 5 — Protocolo impresso

Objetivo: substituir o preenchimento manual do cartão SEI.

Tarefas:

- confirmar A4 ou Ofício;
- obter QR Code oficial;
- criar layout de uma página;
- inserir processo, requerente, data e orientações;
- aplicar contatos por setor;
- criar modo de impressão sem elementos do navegador;
- testar em impressora real.

Critério de conclusão:

- processo presencial gera uma folha legível;
- QR Code é lido por diferentes celulares;
- nenhuma informação é cortada na impressão.

### Fase 6 — Expandir o catálogo

Objetivo: replicar o piloto validado.

Ordem inicial:

1. Solicitação Geral - Habilitação;
2. Solicitações Gerais - Veículos;
3. Solicitação de Perícia Médica / DIVMED;
4. Cancelamento de Comunicação de Venda;
5. Desistência de Categoria na 1ª Habilitação;
6. Certidão de Identificação Civil;
7. Isenção de Taxa;
8. Averbação de CNH Estrangeira;
9. Elaboração de Ofício de Mero Expediente;
10. demais serviços confirmados pela equipe.

Para cada item:

- confirmar documentos;
- confirmar unidade;
- confirmar sigla;
- confirmar resposta;
- testar triagem;
- testar e-mail completo;
- testar presencial quando aplicável.

### Fase 7 — Melhorar a pesquisa

Objetivo: reduzir o tempo gasto para localizar processos sem número.

Tarefas:

- mapear buscas disponíveis;
- documentar limitações de acesso;
- testar nome, CPF, placa, Renavam e interessado;
- criar atalhos e filtros somente sobre dados autorizados;
- medir melhora real.

### Fase 8 — Qualidade e distribuição

Objetivo: permitir uso seguro por dezenas de protocolistas.

Tarefas:

- criar suíte de testes possível para os módulos próprios;
- reduzir progressivamente erros herdados de lint;
- documentar instalação e atualização;
- criar notas de versão;
- definir fluxo simples de atualização;
- testar em máquinas diferentes;
- criar canal para relatos;
- preparar versão candidata;
- integrar em `main` depois da validação.

## 18. Checklist do próximo encontro

### Informações que Thiago pode fornecer

- [ ] domínio inicial do webmail;
- [ ] print de uma composição vazia;
- [ ] exportação JSON do Trello;
- [ ] lista DAF de documentos obrigatórios;
- [ ] lista DAF de pendências mais frequentes;
- [ ] confirmação do texto DAF final;
- [ ] confirmação A4 ou Ofício;
- [ ] arquivo digital do QR Code oficial;
- [ ] mapa de setores fornecido pelo chefe;
- [ ] exemplos fictícios para testes.

### Próximo bloco técnico recomendado

1. concluir o saneamento técnico da linha de base `0.3.2`;
2. criar identificador individual por atendimento;
3. completar o handoff com nome, CPF, e-mail, procedimento e destino;
4. implementar Central → login SEI → Iniciar Processo → FAST PROC;
5. implementar FAST MAIL → localizar/abrir SEI → FAST PROC preenchido;
6. tratar o armazenamento de credenciais em patch separado;
7. executar a regressão final no Chrome, OWA e SEI-RJ.

## 19. Indicadores de sucesso

Registrar antes e depois:

- tempo médio de triagem incompleta;
- tempo médio de abertura por e-mail;
- tempo médio de abertura presencial;
- quantidade de cliques;
- quantidade de cópias e colagens manuais;
- erros de destino;
- respostas devolvidas por assunto incorreto;
- falhas de anexação;
- quantidade de atendimentos concluídos por turno.

Metas iniciais:

- eliminar o Trello e o TXT da operação diária;
- reduzir drasticamente a digitação repetida;
- transformar respostas padronizadas em poucos cliques;
- manter revisão humana nos pontos definitivos;
- garantir que a melhoria de velocidade não reduza a segurança.

## 20. Definição do produto

O SEI Protocolistas será composto por três partes integradas:

1. **Automação do SEI**  
   Abre, preenche, anexa, localiza destinos e prepara o encerramento.

2. **Central Protocolista**  
   Guarda regras, documentos, destinos, modelos e configurações.

3. **Assistente do webmail**  
   Gera e insere assuntos e respostas de triagem ou conclusão.

O resultado desejado não é uma coleção de botões isolados. É um fluxo único:

`Pedido → Triagem → Processo → Documentos → Destino → Resposta ou impressão`
