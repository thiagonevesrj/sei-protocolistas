# Fontes operacionais — Trello, Trellinho e cadastro no SEI

Data da consolidação: 28 de agosto de 2026.

Este documento complementa `docs/CHECKPOINT-FAST-MAIL-FASES-1-2-2026-08-28.md`. Ele registra as evidências visuais do Trello público enviadas por Thiago Neves, o conteúdo do Trellinho offline de 28/08/2026 e as regras dos manuais de cadastro no SEI.

O objetivo é permitir que outro chat continue o projeto sem reinterpretar prints, reativar cartões antigos ou copiar inconsistências do Trellinho para o FAST MAIL.

## Estado da branch ao receber estas fontes

- Branch: `agent/catalogo-fast-mail-amanha`.
- PR: `#3 — Consolidar FAST MAIL e FAST PROC para teste operacional`.
- Checkpoint-base: `92863da`.
- A navegação V2 das Fases 1 e 2 já foi implementada e ativada no topo `d0e87ed`.
- Este documento é uma consolidação de fontes para conferência e próximos ajustes; não substitui teste real de Thiago.
- A pendência de restauração da sessão do OWA continua no backlog e não faz parte deste lote.

## Materiais consolidados

### Evidência visual do Trello público

Thiago enviou capturas diretas dos quadros visíveis:

- `SCRIPTS - FASE01 - Identificação`;
- `SCRIPTS - FASE02 - Orientação`, incluindo rolagem vertical das listas HAB02 e DRV02 e rolagem horizontal pelos demais setores;
- `SCRIPTS - EX - Exigências / AG - Agendamento`;
- quadro `PROCEDIMENTOS`.

Estas capturas têm precedência para decidir quais listas e cartões estavam publicados aos usuários naquele momento.

### Arquivos de apoio

- `trellinho2808.html` — versão offline do Trellinho, com changelog `v9 — 28/08/2026`;
- `SIGLAS_DOS_SETORES_DETRAN.pdf` — tabela de siglas antigas e novas das unidades;
- `GUIA_CADASTRO_OFICIO_NO_SEI.pdf` — regras específicas para cadastro de ofícios;
- `Padronizacao_de_Cadastro_de_Processos_no_SEI_1.0.pdf` — regras gerais para abertura e cadastro de processos.

Os arquivos acima servem como fonte de comparação e regra. Eles não devem ser incluídos na extensão sem revisão de tamanho, licença, atualização e necessidade operacional.

## Hierarquia obrigatória das fontes

| Prioridade | Fonte | Pode decidir | Não pode decidir sozinha |
|---|---|---|---|
| 1 | Trello visível ao usuário | quais cartões/listas estão publicados e qual versão está operacionalmente visível | metadados que não aparecem no cartão ou no print |
| 2 | Trellinho offline de 28/08 | texto, automações, formulários, destino/tipologia já extraídos, estrutura por fase/lista e ideias de interface | se um registro interno está público, oculto, arquivado ou substituído |
| 3 | Manuais oficiais anexados | padronização do cadastro no SEI, campos obrigatórios e tratamento de exceções | destino e tipo processual de um atendimento específico não citado no manual |
| 4 | Catálogos curados da extensão | IDs estáveis, respostas protegidas e metadados previamente confirmados | promover automaticamente conteúdo invisível ou resolver conflito por suposição |

Regra central confirmada por Thiago:

> Somente cartões efetivamente publicados e visíveis aos usuários no Trello podem alimentar a oferta operacional do FAST MAIL.

Consequências:

- cartão oculto, arquivado, desativado ou histórico é lixo para a navegação operacional;
- o importador não pode reativar uma versão antiga apenas porque ela existe no HTML;
- duplicidade invisível nunca deve ser resolvida por data, tamanho do texto ou suposição;
- se a fonte não comprovar visibilidade, o item deve ficar fora da oferta até revisão;
- respostas já curadas continuam protegidas;
- o ideal é uma exportação do Trello que traga ID do cartão e estado explícito de publicação/arquivamento.

## Comparação: Trello público × Trellinho offline

### O que o Trello público resolve melhor

- mostra somente o conteúdo disponibilizado à equipe;
- não apresentou as duplicidades internas encontradas no HTML;
- representa a organização real por fase e setor;
- permite confirmar visualmente o cartão vigente.

### O que o Trellinho resolve melhor

- funciona offline;
- reúne pesquisa, filtros e navegação por fase/lista;
- possui favoritos e últimos oito acessos;
- memoriza o número do protocolista;
- mantém histórico recente de assuntos;
- possui painel local de atendimentos e SLA;
- gera o assunto com data automática;
- preenche o número do processo no retorno da Fase 3;
- possui formulário de agendamento;
- gera exigências por checkboxes de documentos;
- reúne formulários, procedimentos, alterações e regras de cadastro no SEI;
- mantém dados localmente no navegador.

### Conclusão da comparação

O desenho seguro é híbrido:

1. o Trello visível fornece a lista pública de cartões válidos;
2. o Trellinho fornece automações e metadados reaproveitáveis;
3. a extensão mantém a camada curada e protegida;
4. um relatório de comparação bloqueia conflitos antes da atualização.

Não importar integralmente a constante `SCRIPTS` do HTML.

## Diagnóstico do `trellinho2808.html`

### Versão e recursos

O changelog interno identifica a versão mais recente como `v9 — 28/08/2026`.

Principais evoluções registradas:

- v9: autor em caixa alta, DDD 21 pré-preenchido, data automática, interessados ilimitados, campo `OUTRA INFORMAÇÃO` e novas fases de assunto;
- v8: gerador de Cadastro SEI baseado nos dois manuais anexados;
- v7: memorização correta do protocolista de 00 a 40;
- v6: procedimentos e histórico de alterações;
- v5: catálogo de formulários;
- v4: preservação de destino por fallback;
- v3: 42 rotas com destino e tipologia;
- v2: favoritos, recentes, histórico de assunto, SLA e preferências locais;
- v1: catálogo offline, assistente, exigências, agendamento e formatação dos scripts.

### Contagem interna

| Fase | Registros internos |
|---|---:|
| Fase 1 — Identificação | 29 |
| Fase 2 — Orientação | 101 |
| Fase 3 — Protocolos | 5 |
| Extras | 61 |
| **Total** | **196** |

Metadados encontrados:

- 13 registros marcados como presenciais;
- 5 marcados como “não abre processo”;
- 42 com destino;
- 40 com tipologia processual.

Cada registro da constante interna possui apenas fase, lista, nome, texto, marcação presencial, marcação de não abertura, destino e tipologia. Não existe campo `ativo`, `publicado`, `visível`, `oculto` ou `arquivado`.

### Duplicidades internas

O HTML ainda contém os seguintes títulos repetidos:

| Título | Situação interna |
|---|---|
| Defesa Prévia e Recursos de Infrações de Trânsito | duas cópias com texto idêntico |
| REVISÃO DE ATO - AGEM02 | duas cópias com texto idêntico |
| Devolução / Ressarcimento de multa | aparece em fases diferentes com textos diferentes |
| NP - ATUALIZAÇÃO DE APLICATIVO - LICENCIAMENTO ANUAL VEICULAR | duas versões com textos diferentes |
| MULTAS / ORIENTAÇÃO GENERICA | duas versões com textos diferentes |
| CREDENCIAMENTO DE EMPRESA ESPECIALIZADA NA REALIZAÇÃO DOS SERVIÇOS DE MONITORAMENTO ONLINE | versões em COMISPL e DIVAPREND com textos diferentes |
| CRITICA - JA EXISTE PROCESSO ABERTO | versões em duas listas de Extras com textos diferentes |

Essas duplicidades confirmam que o HTML é uma cópia operacional rica, mas não comprova sozinho qual versão está publicada.

## Fase 1 — evidência do Trello público

Listas visíveis nas capturas:

| Lista/setor | Quantidade visível | Exemplos confirmados |
|---|---:|---|
| SCRIPT | 5 | Identificação Completa; Identificação do Serviço; Simples Identificação; Este Serviço Não É Conosco; Ouvidoria |
| DAF | 1 | Triagem — Devolução de Taxas |
| DIVMED | 1 | Triagem — Perícia Médica |
| DRV | 1 | Identificação — Inventário |
| Ressarcimento/Devolução de Multa | 1 | Devolução/Ressarcimento de multa |
| Orientação sobre Aplicativo | pelo menos 2 no recorte | renovação/troca de PPD; atualização do aplicativo de licenciamento |
| IPVA — SEFAZ | 1 | IPVA |
| TRI/Multa/Suspensão/Cassação/Revisão | 5 | orientação genérica; outros órgãos; recurso; revisão; pedido de vistas |

No HTML existem também dez registros na lista `Infrações de Trânsito` e quatro em `ORIENTAÇÃO SOBRE APLICATIVO`. Como nem todos foram comprovados integralmente nas capturas, sua visibilidade individual não deve ser presumida.

### Organização indicada para o FAST MAIL

- atalhos imediatos para os seis scripts principais já definidos no checkpoint;
- `Ainda não sei o assunto` usando Identificação Completa;
- demais scripts filtrados por lista/setor;
- pesquisa dentro da Fase 1;
- nenhum carregamento de registro interno não comprovado como público.

## Fase 2 — evidência do Trello público

As capturas confirmam a organização pública abaixo:

| Lista/setor | Quantidade visível indicada no Trello |
|---|---:|
| PROMOVIDO DIRETO | 1 |
| COMUNICAÇÃO DE OUTRO ÓRGÃO/ENTIDADE | 1 |
| PROTOCOLO | 5 |
| DAF02 — TRIAGEM — PESSOA FÍSICA | 4 |
| DAF02 — PESSOA JURÍDICA | 2 |
| HAB02 — TRIAGEM | 21 |
| COOGP | 1 |
| DRV02 — TRIAGEM | 24 |
| CVDIVDCI | 6 |
| SETCHASS | 3 |
| Leilão | 1 |
| DIRIC | 1 |
| DIVMED — Perícia Médica | 6 |
| DIVMED — Clínicas | 3 |
| ASSGEM | 1 |
| CORREG | 4 |
| DIVRI | 1 |
| COMISPL | 4 |
| GENERICO — TRATATIVA EXTRAORDINARIA | 2 |
| SERVNPDA — Funcionários CFC | 2 |
| SERVNPDA — Autônomo | 1 |
| SERVNPDA — CFC | 4 |
| DIRAPOIO | 1 |
| CIDADANIA SOBRE RODAS | 1 |

O HTML também contém `DIVAPREND` com um registro. A captura panorâmica recebida não comprova de forma inequívoca essa lista; manter em revisão até confirmação visual.

### Atalhos principais definidos

- Devolução de Taxas;
- Perícia Médica;
- Desistência de Categoria;
- Genérico de Habilitação;
- Genérico de Veículos;
- Leilão de Veículos;
- Troca de Clínica;
- Certidão de Identificação Civil;
- Ofícios.

A navegação V2 já implementada no topo `d0e87ed` expõe esses atalhos e mantém os demais por área/setor.

## Fase 3 — situação atual

Não foi recebida, neste conjunto, uma captura direta do quadro público da Fase 3. O HTML contém cinco modelos candidatos:

- Protocolo — Padrão;
- Protocolo — DAF;
- Protocolo — DRV;
- Protocolo — AGEM;
- Protocolo — DIVMED.

Tratar os cinco como referência provisória até a evidência visual do Trello público.

Regra de produto já decidida:

- a Fase 3 deve ser acionada automaticamente após a abertura do processo;
- o atendente informa ou recebe o número SEI e o modelo substitui `(número do processo SEI)`;
- manter acesso manual apenas como fallback discreto.

## Extras — evidência do Trello público e HTML

Grupos confirmados nas capturas e completados pelo HTML:

| Grupo | Quantidade no HTML |
|---|---:|
| Agendamento | 7 |
| Exigência | 4 |
| DAF | 2 |
| Crítica — Mensagem | 7 |
| Crítica — Erros Nossos | 1 |
| Crítica — Diversos | 7 |
| Crítica — Processo Já Aberto | 12 |
| Crítica — Possível Dificuldade com Leitura | 3 |
| Crítica — Dificuldade em Enviar Arquivos | 11 |
| Crítica — Não Seguiu Regras | 4 |
| Finalização — Não Quer Prosseguir | 2 |
| Crítica Provisória — Quer Mesmo Desistir? | 1 |

Automação relevante:

- Agendamento: cinco campos — protocolo, dia, horário, local e tipo processual;
- Exigência: vinte checkboxes padronizados e campo livre `Outros`;
- alguns scripts de exigência separam documentos não localizados de documentos com digitalização ruim;
- Extras deve permanecer como catálogo de exceções, sem competir com as Fases 1 e 2.

## Metodologia do campo Assunto

### Regra descrita no cartão do Trellinho

Formato obrigatório:

`Nome – Protocolo – Fase – TRIAGEM`

Na Fase 3:

`Nome – Protocolo – Fase – FECHADO`

O protocolo é formado por:

`DDMMAAAA` + número do protocolista de `00` a `40`.

Exemplo fornecido:

`0706202611`

### Comportamento do gerador principal do HTML

O gerador principal segue a composição:

`Nome – DDMMAAAAPP – CódigoDaFase – TRIAGEM`

Para códigos contendo `03`, usa apenas `FECHADO` no final.

### Inconsistência interna localizada

O assistente guiado do próprio Trellinho mostra uma prévia com CPF:

`Nome – CPF – Protocolo – Fase`

Além disso, a prévia do assistente forma a Fase 3 como `03 – TRIAGEM - FECHADO`, enquanto o gerador principal usa apenas `FECHADO`.

Portanto:

- não copiar a prévia do assistente para o FAST MAIL;
- não incluir CPF no assunto sem decisão explícita;
- não usar simultaneamente `TRIAGEM` e `FECHADO` na Fase 3;
- validar com Thiago a migração da regra atual do FAST MAIL, que hoje também carrega a rota operacional, por exemplo `COMISLE`.

### Códigos disponíveis no Trellinho v9

- Fase 1: `QUEST01`, `HAB01`, `DAF01`, `DRV01`, `DIVMED01`, `CORREG01`, `DIRIC01`, `CJC01`, `DIV01`;
- Fase 2: `HAB02`, `DAF02`, `DRV02`, `DIVMED02`, `DIV02`, `QUEST02`;
- Exigências: `HAB02-EX`, `DAF02-EX`, `DRV02-EX`;
- Agendamentos: `HAB02-AG`, `DAF02-AG`, `DRV02-AG`;
- Fase 3: `HAB03`, `DAF03`, `DRV03`, `DIVMED03`, `DIJUR03`.

## Siglas relevantes confirmadas no PDF

O PDF registra sigla antiga, nova sigla e nome da unidade. Para a extensão, usar a nova sigla quando ela for a unidade vigente confirmada.

| Referência antiga | Nova sigla | Unidade |
|---|---|---|
| DETRAN/LEILAO | DETRAN/COMISLE | Comissão de Leilão |
| DETRAN/DIC | DETRAN/DIRIC | Diretoria de Identificação Civil |
| DETRAN/DAF | DETRAN/DIVAF | Divisão de Administração Financeira |
| DETRAN/SMT | DETRAN/SERVMT | Serviço de Medicina para o Trânsito |
| DETRAN/PERMED | DETRAN/SERVPMED | Serviço de Perícias Médicas e Psicológicas |
| DETRAN/DIJUR | DETRAN/PROTDIRJUR | Protocolo da Diretoria Jurídica |
| DETRAN/DAOP | DETRAN/DIRAPOIO | Diretoria de Apoio Operacional |
| DETRAN/SAP | DETRAN/SERVAP | Serviço de Acompanhamento de Processos |
| DETRAN/SECPROC | DETRAN/SERVPROT | Serviço de Protocolo |
| DETRAN/POSTDCA | DETRAN/SERVPOST | Serviço de Postagens |
| DETRAN/DSDDCA | DETRAN/SERVDSDDCA | Serviço de Protocolo Descentralizado/Expediente Externo |
| DETRAN/DRI | DETRAN/DIVRI | Divisão de Recursos de Infrações |
| DETRAN/CPL | DETRAN/COMISPL | Comissão Permanente de Licitação |
| DETRAN/DRV/DCI/CV | DETRAN/CVDIVDCI | Comunicação de Vendas da DRV |

### Cores do PDF

Há células e linhas coloridas, mas o arquivo não apresenta uma legenda que permita concluir tecnicamente que a cor significa “setor mais usado”. As cores podem ser usadas como pista visual, nunca como critério automático de prioridade, até Thiago ou a fonte do documento confirmar seu significado.

## Leilão de Veículos

Confirmações novas:

- o PDF de siglas confirma `COMISLE` como Comissão de Leilão;
- o Trello público confirma o cartão `Leilão - Geral (COMISLE)`;
- o Trellinho contém a orientação e o formulário `DRV0079`;
- o catálogo preserva `COMISLE` para preparar o assunto.

O material novo não informa, de forma inequívoca, o tipo de processo a selecionar no SEI. O guia geral também não define essa tipologia específica.

Por isso, Leilão continua assim:

- `Responder`: liberado;
- preparar assunto com `COMISLE`: liberado enquanto a metodologia do assunto não for alterada;
- `Abrir processo`: bloqueado até confirmar o nome exato do tipo SEI e validar o checklist operacional.

O PDF de siglas confirma o destino, não a tipologia.

## Certidão de Identificação Civil

As novas evidências fortalecem o cadastro:

- o Trello público mostra a lista `DIRIC` e o cartão `Certidão de Identificação Civil`;
- o PDF confirma `DIRIC` como Diretoria de Identificação Civil;
- o catálogo possui o tipo `Detran: Solicitação de Certidão de Identificação Civil`;
- o catálogo possui destino `DIRIC`;
- o script possui formulário e relação documental.

Estado seguro atual:

- acesso rápido: necessário e já contemplado na navegação V2;
- resposta/orientação: liberada;
- abertura de processo: manter bloqueada até Thiago validar que o checklist extraído corresponde integralmente à rotina vigente.

## Regras gerais do cadastro no SEI

Estas regras são para um lote futuro do FAST PROC. Não misturar com a primeira reorganização visual do FAST MAIL.

### Especificação

- processos de veículos: placa e CPF/CNPJ são obrigatórios como chaves de busca;
- demais processos: CPF/CNPJ é obrigatório;
- incluir outros números relevantes quando existirem;
- remover pontos, traços e barras dos números, exceto barras em datas.

### Interessado

- cidadão ou pessoa jurídica requerente como interessado principal;
- cadastrar todos os solicitantes quando houver mais de um;
- usar maiúsculas ou iniciais maiúsculas;
- reaproveitar registro já existente no SEI para evitar duplicidade;
- verificar, quando possível, se já há processo idêntico em andamento.

### Observações da unidade

Campos previstos:

- modalidade de atendimento;
- CPF/CNPJ;
- data do e-mail;
- telefone;
- e-mail;
- DUDA;
- placa;
- registro de qualquer exceção operacional.

### Direito de petição — impacto importante no FAST PROC

O manual determina que a documentação completa do Trello é o ideal, mas documentos acessórios faltantes não devem impedir indefinidamente a abertura quando:

- existe identificação mínima;
- existe pedido básico assinado e endereçado ao DETRAN-RJ;
- o requerente deseja protocolar mesmo assim.

Nessa situação:

- abrir e encaminhar o processo;
- a área técnica poderá emitir exigência formal;
- registrar nas observações que o usuário escolheu abrir com os documentos apresentados.

Impacto de produto: checklists do FAST PROC não devem virar bloqueio absoluto sem uma rota de exceção consciente e registrada. Essa alteração exige desenho e teste próprios antes de implementação.

### Nível de acesso

- o padrão normativo parte de processo público;
- como a maioria contém dados pessoais, o manual orienta configurar como restrito e selecionar a hipótese legal apropriada antes de salvar;
- o FAST PROC pode futuramente lembrar essa conferência, mas não deve escolher fundamento legal por adivinhação.

## Regras específicas para ofícios

### Especificação

- copiar integralmente a linha que contém o número do ofício;
- se não houver ofício, copiar integralmente a linha do procedimento, despacho, decisão ou processo;
- preservar fidelidade ao documento original.

### Interessados

- cadastrar a hierarquia completa do órgão em ordem decrescente;
- incluir o autor/solicitante como segundo interessado quando houver;
- nunca cadastrar o réu como interessado por essa regra;
- sempre que possível, utilizar dois ou mais interessados.

### Observações

- modalidade;
- CPF/CNPJ;
- placa;
- número do processo;
- número do ofício;
- e-mail;
- data do e-mail;
- outro número relevante.

Remover pontuação dos números, preservando barra em datas e número de ofício.

## Formatação e armazenamento local

O Trellinho declara:

- Times New Roman 12 pt;
- espaçamento 1,5;
- recuo de 1,25 cm;
- preferências, favoritos, assuntos, protocolista e casos em aberto guardados no `localStorage`.

Na extensão, manter a mesma finalidade visual quando aplicável, mas usar o mecanismo local já adotado pelo projeto (`chrome.storage.local` ou equivalente). Não enviar dados de cidadãos a servidores externos.

## Próximas decisões para Thiago

1. Confirmar por captura do Trello público os cinco cartões da Fase 3.
2. Confirmar se as cores do PDF realmente indicam frequência/uso ou possuem outro significado.
3. Escolher a regra final do campo Assunto e resolver a diferença entre fase e destino operacional.
4. Validar o checklist da Certidão de Identificação Civil para liberar FAST PROC.
5. Informar o tipo SEI exato de Leilão de Veículos para liberar FAST PROC.
6. Em lote futuro, desenhar a exceção de direito de petição no FAST PROC.

## Orientação para o próximo chat

Antes de qualquer novo ajuste:

1. usar o topo remoto da branch;
2. ler `AGENTS.md`;
3. ler o checkpoint principal;
4. ler este complemento;
5. conferir o estado da navegação V2 já ativada;
6. não alterar FAST PROC, Central, autenticação ou OWA só por causa destas novas fontes;
7. não promover conteúdo interno do HTML sem comprovação de visibilidade no Trello.

Pedido resumido sugerido:

> Continue pelo topo remoto da branch `agent/catalogo-fast-mail-amanha`. Leia `docs/CHECKPOINT-FAST-MAIL-FASES-1-2-2026-08-28.md` e `docs/FONTES-TRELLO-TRELLINHO-SEI-2026-08-28.md`. O Trello visível decide quais cartões estão vigentes; o Trellinho de 28/08 fornece automações e metadados, mas não comprova publicação. Confira a navegação V2 já ativada e use as novas fontes somente para diagnóstico e refinamento seguro. Não retome a pendência do OWA nem altere FAST PROC sem novo lote e autorização.
