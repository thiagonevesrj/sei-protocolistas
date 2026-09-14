# Runbook de soluções validadas — PROTOCOLISTAS

Este arquivo existe para evitar retrabalho técnico. Sempre que o projeto enfrentar um problema relevante, passar por investigação extensa e chegar a uma solução confirmada em teste real, o caminho deve ser registrado aqui.

## Regra de manutenção

Para cada problema relevante resolvido, registrar obrigatoriamente:

1. **Sintoma observado em produção/teste real**;
2. **Impacto operacional**;
3. **Diagnóstico / causa raiz**;
4. **Tentativas que falharam ou geraram regressão**;
5. **Solução validada**;
6. **Arquivos e commits de referência**;
7. **Teste mínimo de regressão**;
8. **Estado final: VALIDADO / CONGELADO**.

Não reabrir uma solução marcada como **VALIDADA / CONGELADA** sem regressão concreta observada em teste real.

---

# 001 — OWA legado abrindo resposta em Texto simples e destruindo a formatação HTML

## Estado

**VALIDADO / CONGELADO em 06/09/2026**

Validação real feita por Thiago no OWA do DETRAN: após a correção, ao abrir/responder uma mensagem com FAST MAIL, o compositor passou a abrir/preparar em **HTML** automaticamente e as respostas passaram a preservar a formatação visual.

## Sintoma

O FAST MAIL inseria corretamente o conteúdo da resposta/exigência, mas o compositor do OWA permanecia em **Texto simp / Texto simples**.

Consequências:

- listas perdiam apresentação;
- links ficavam visualmente pobres;
- blocos de ATENÇÃO, títulos, negritos e espaçamento eram perdidos;
- o mesmo conteúdo, quando o operador trocava manualmente o OWA para **HTML**, ficava corretamente formatado.

Isso provou que o renderer da resposta estava funcionando; o gargalo era a troca do modo do compositor.

## DOM já conhecido do OWA

Corpo em Texto simples:

```html
<div id="divBdy" class="messageBody brd">
  <iframe id="ifBdy" class="w100" style="display:none"></iframe>
  <textarea id="txtBdy" class="whPlainText txtBdy"></textarea>
</div>
```

Corpo em HTML:

- `#txtBdy` fica oculto;
- `iframe#ifBdy` torna-se o editor ativo;
- o `body` interno do iframe fica editável/designMode.

Regra de segurança já existente: corpo do e-mail só pode ser considerado seguro quando estiver dentro de `#divBdy`; cabeçalho (`#divHdrMessage`, Para, Cc, Bcc, Assunto) nunca pode ser alvo de inserção.

## Diagnóstico / causa raiz

A automação estava tentando tratar o controle visual `Texto simp / HTML` como um `<select>` convencional e alterar programaticamente:

- `selectedIndex`;
- `value`;
- eventos `input`/`change`;
- eventual `onchange`.

No OWA legado isso não reproduzia de maneira confiável o comportamento da interação humana. Em teste real, o seletor visual continuava em **Texto simp**, enquanto a inserção seguia normalmente e caía no `textarea#txtBdy`.

A evidência decisiva foi:

1. FAST MAIL inserindo em Texto simples => visual pobre;
2. operador trocando manualmente `Texto simp → HTML` antes da inserção => mesma resposta ficava corretamente formatada.

Portanto, não era necessário reescrever o conteúdo nem o renderer. Era necessário reproduzir o **comportamento nativo da interface do OWA**.

## Tentativas que NÃO devem ser repetidas como solução principal

### 1. Apenas alterar o valor interno de `<select>`

Alterar `value`, `selectedIndex` e disparar `input/change` não foi confiável no OWA legado.

### 2. Aumentar indefinidamente tempos de espera

Esperar mais tempo pelo `iframe#ifBdy` sem acionar corretamente o mecanismo nativo não resolve a causa.

### 3. Bloquear atendimento até HTML aparecer

Já gerou travamento operacional em `INSERIR EXIGÊNCIA`. HTML é preferência de apresentação, mas uma falha excepcional não pode impedir o atendimento. Deve existir fallback seguro para Texto simples.

### 4. Pedir investigação manual repetida no DevTools

DevTools pode ser usado apenas se surgir uma regressão nova e objetiva. Para este problema específico, o caminho já foi descoberto e documentado. Não repetir a investigação do zero.

## Solução validada

Arquivo principal:

`cs_modules/fast_mail/compose-html-guard-v1.js`

Commit validado:

`90a5cf5fe2f8ab886c1713b56cee763fdcf78bd9`

Mensagem:

`fix: trocar formato do OWA por clique nativo`

### Estratégia

1. Detectar primeiro se o editor HTML seguro já está ativo (`#divBdy > iframe#ifBdy` com body editável).
2. Se estiver em Texto simples, localizar o **controle visual de formato na barra do OWA**, fora do FAST MAIL e fora de `#divBdy`.
3. Priorizar a reprodução da interação nativa:
   - clicar no controle `Texto simp`;
   - aguardar a opção visual `HTML` aparecer;
   - clicar em `HTML`;
   - aguardar `iframe#ifBdy` se tornar o editor HTML seguro.
4. Somente depois liberar o clique final de inserção que havia sido interceptado.
5. Manter a estratégia antiga baseada em `<select>` apenas como **fallback**, nunca como caminho principal.
6. Se o OWA excepcionalmente não conseguir entrar em HTML, permitir inserção segura em `textarea#txtBdy` para não bloquear o atendimento.

### Proteções importantes da implementação

- não procurar controles dentro do FAST MAIL;
- não tratar elementos dentro de `#divBdy` como controle de formato;
- restringir candidatos à barra superior do compositor;
- confirmar sucesso pela existência do **editor HTML real**, não apenas pelo texto visual do controle;
- preservar o clique humano final em `INSERIR RESPOSTA / INSERIR EXIGÊNCIA`;
- manter fallback para Texto simples sem inserir em destinatário/cabeçalho.

## Teste mínimo de regressão

Não refazer investigação completa. Testar somente:

1. abrir uma **nova resposta** no OWA com a extensão atualizada;
2. não trocar manualmente o formato;
3. abrir FAST MAIL;
4. escolher um fluxo que insira resposta formatada, por exemplo:
   - `ORIENTAÇÃO → Devolução de Taxas → COBRAR DOCUMENTOS`, ou
   - `ORIENTAÇÃO → Perícia Médica`;
5. clicar no botão final de inserção;
6. verificar:
   - seletor do OWA ficou em **HTML** automaticamente;
   - resposta entrou no corpo;
   - listas, links, negritos/blocos visuais foram preservados;
   - campos Para/Cc/Bcc/Assunto não foram usados como corpo.

Se esses itens passarem, **não alterar o mecanismo**.

## Resultado confirmado

Em 06/09/2026, após Pull + reload da extensão, Thiago confirmou:

> "FICOU PERFEITO, JA ABRIU O RESPONDER COMO HTML"

Com isso, a solução está **VALIDADA / CONGELADA**.

---

# 002 — Padrão global de ORIENTAÇÃO / COBRAR DOCUMENTOS / HTML

## Estado

**VALIDADO / CONGELADO em 06/09/2026**

Após a correção estrutural dos checkboxes, do caminho visual e da preparação HTML, Thiago realizou validação real em múltiplos serviços diferentes e confirmou comportamento consistente.

Serviços confirmados no mesmo ciclo de teste:

- **Perícia Médica**;
- **Desistência de Categoria**;
- **Transferência de Prontuário**;
- **Devolução de Taxas** já havia sido usada como cenário-base durante a correção.

Thiago confirmou que os fluxos funcionaram corretamente e, adicionalmente, as respostas já abriram/prepararam em **HTML** automaticamente.

## Padrão operacional validado

Para atendimentos de Orientação que ofereçam cobrança documental, preservar o padrão:

`ORIENTAÇÃO ✓ → SERVIÇO ✓ → COBRAR DOCUMENTOS ✓ → checklist → INSERIR EXIGÊNCIA`

Regras congeladas:

- a etapa/fase selecionada permanece visualmente marcada;
- o serviço escolhido permanece visualmente marcado;
- `COBRAR DOCUMENTOS` permanece visualmente marcado quando essa foi a ação escolhida;
- `ABRIR PROCESSO` não pode parecer selecionado apenas por estar disponível;
- checkboxes representam os documentos efetivamente faltantes;
- seleção dos checkboxes deve persistir até a inserção;
- marcar checkbox não pode deslocar/rolar o painel para outro campo;
- `INSERIR EXIGÊNCIA` deve ler exatamente os documentos visualmente selecionados;
- a resposta orienta o requerente a reenviar o conjunto completo necessário em um único e-mail, sem classificar como faltante o que já foi recebido;
- o compositor deve ser preparado em HTML automaticamente pelo mecanismo validado no item 001;
- o assunto de TRIAGEM é preparado automaticamente conforme disponibilidade de nome + CPF;
- `TRIAGEM` parcial não bloqueia futuro upgrade para o padrão completo;
- Bcc não deve ser reaberto sem regressão concreta.

## Critério de validação em lote

Não testar todos os serviços botão por botão quando todos utilizarem a mesma infraestrutura central.

Se dois ou mais procedimentos distintos, com estruturas diferentes, passarem pelo mesmo mecanismo central sem regressão, considerar o padrão validado em lote e só reabrir diante de falha concreta.

Em 06/09/2026, **Perícia Médica, Desistência de Categoria e Transferência de Prontuário** passaram no teste real, além da validação anterior de **Devolução de Taxas**.

## Teste mínimo de regressão

Se houver suspeita futura de regressão nesse padrão:

1. testar um serviço com checklist, preferencialmente `Devolução de Taxas` ou `Desistência de Categoria`;
2. testar um segundo serviço de estrutura diferente, preferencialmente `Perícia Médica` ou `Transferência de Prontuário`;
3. conferir somente:
   - caminho visual permanece marcado;
   - checklist persiste;
   - botão final insere;
   - corpo abre em HTML;
   - assunto é preparado conforme regra atual.

Se os dois passarem, **não reabrir o mecanismo global**.

## Resultado confirmado

Thiago confirmou em 06/09/2026:

> "TESTEI PERICIA, TESTEI DESISTENCIA DE CAT, TRANSF DE PRONTUARIO, TUDO DEU CERTO E MELHOR, JA EM HTML"

Estado final: **VALIDADO / CONGELADO**.

---

# Política geral para futuras soluções

## 003 — Novo atendimento em conversa já respondida e preparação HTML — 14/09/2026

**Estado: correção coberta por testes automatizados; confirmação no OWA real pendente.**
Não declarar VALIDADO / CONGELADO em produção antes da confirmação operacional.

- **Sintoma:** responder novamente uma conversa antiga podia ser bloqueado como duplicata; relato de FAST MAIL abrir e fechar e de retorno a Texto simples.
- **Impacto:** impossibilidade de nova orientação, exigência ou devolutiva na mesma conversa.
- **Linha de base:** `879b1059ef41f8a02749c30c803ffb1fa92296c4`, branch `agent/catalogo-fast-mail-amanha`. Validação anterior à alteração passou. No Windows, os testes existentes exigem checkout com LF; CRLF causou falso negativo em uma busca literal no teste FAST PROC, sem defeito no runtime.
- **Causas identificadas no código:** a inserção consultava marcadores em todo o histórico HTML ou trechos de texto no histórico simples; o guard antigo limpava somente `catalog-script` e contava cliques antes de confirmar inserção. A troca de formato tentava irmãos/vizinhos do controle, expondo botões alheios ao formato a cliques. O temporizador repetia tentativas indefinidamente. A apresentação e a limpeza de devolutivas também percorriam mensagens históricas. O fechamento relatado ainda precisa ser confirmado no OWA; não foi reproduzido em sessão real nesta tarefa.
- **Tentativas a não repetir:** apagar o conteúdo anterior, remover HTML automático, usar histórico como trava permanente ou explorar botões vizinhos para achar o menu HTML.
- **Solução:** estado temporário em memória por editor, conteúdo da resposta e inserção efetivamente concluída. Somente a repetição idêntica, no mesmo corpo inalterado, em menos de 1.500 ms é duplicata. Outro editor, edição/desfazer, outra resposta ou fim do intervalo libera nova inserção. Antes de inserir, retirar apenas `data-sei-protocolistas` e `data-script-id` dos elementos anteriormente marcados; preservar texto, links e estilos. Formatar e limpar somente os nós registrados pela inserção atual.
- **HTML:** preservar clique nativo Texto simp → HTML e confirmação pelo iframe editável real. Clicar somente no próprio controle, com propagação normal; nunca em irmãos. Consolidar duplo clique durante a preparação em um único replay. Uma tentativa automática por editor; clique explícito de inserção pode tentar novamente. Preservar fallback seguro se o OWA não ativar HTML, sem tornar falha de formato um bloqueio de atendimento.
- **Escopo preservado:** regras de assunto, Bcc, checklists, textos/modelos, FAST PROC, tema e manifesto. Em `subject-sanitizer-v1.js`, somente restringir a limpeza do corpo à devolutiva atual; nenhuma regra de assunto foi alterada.
- **Referências:** `script-repeat-guard-v1.js`, pontos de inserção em `index.js` e `operational-p0-v3.js`, `compose-html-guard-v1.js`, filtro de histórico em `subject-sanitizer-v1.js`, todos em `cs_modules/fast_mail/`. Teste: `scripts/test-fast-mail-repeat-guard.js`, incluído em `npm run validate` e no lint.
- **Validação automatizada:** histórico HTML e Texto simples não bloqueia; exigência/devolutiva/presencial inserem novamente; anti-duplo clique, edição/desfazer e novo editor; remoção somente de atributos técnicos; apresentação ignora histórico; replay único com sucesso ou falha de HTML; tentativas automáticas limitadas; nenhuma seleção de botão vizinho. Executar `npm run validate` e `npm run lint` e conferir CI do commit.
- **Resultado local:** `npm run validate` passou integralmente, incluindo o novo teste. Lint comparado com o conteúdo do commit-base nos mesmos arquivos: 37 erros preexistentes, 37 após a alteração, sem diagnósticos novos; teste novo e guard de repetição sem erros. Não corrigir esses problemas herdados nos fluxos congelados como parte desta tarefa. A CI existente executa a validação, não o lint.

### Retorno operacional de 14/09 — HTML ainda em Texto simp

Thiago confirmou que `3ee90d8` liberou respostas repetidas, mas a resposta antiga
continuou abrindo em Texto simp. Portanto, **HTML deste cenário NÃO está validado**.
A captura mostra o seletor em Texto simp; não prova qual evento interno falhou.
O registro anterior confirma que o seletor visual não era um `select` comum.

Correção complementar em `compose-html-guard-v1.js`: restaurar o alvo ancestral
acionável do rótulo (inclusive célula TD, como no caminho anteriormente funcional),
somente enquanto o texto exato continuar sendo Texto simp/Plain text/HTML, dentro
das dimensões de um controle e fora do corpo e FAST MAIL. Nunca subir à barra inteira
nem testar irmãos. Priorizar o texto visível sobre o tooltip. Não consumir a tentativa
automática enquanto o OWA ainda não tiver construído o controle de formato.

Teste novo simula rótulo SPAN dentro de célula TD para abrir menu e selecionar HTML,
e recusa a barra e botão Fechar como alvos. Também testa a barra carregando depois do
editor. A validação automatizada passa; confirmação no OWA real continua pendente.
O anti-duplo clique e a liberação de respostas históricas não foram alterados.

### Teste operacional mínimo após Fetch / Pull / recarregar extensão

Retorno subsequente: `7efc03c` também permaneceu em Texto simp ao inserir exigência.
Comparação direta com `90a5cf5` identificou outra diferença: a versão validada
tentava a seta vizinha ao rótulo; a correção por ancestral não cobria seletor cuja
seta recebe seu próprio clique. Recuperado esse caminho somente para descendentes
vazios na extremidade direita do mesmo controle compacto, com alinhamento e tamanho
de seta. Não recuperar a exploração irrestrita de irmãos da barra. Teste executável
cobre menu que abre apenas pela seta e exclusão de botão externo. Trata-se de
correção baseada na diferença com o código validado; sem acesso ao DOM da sessão real,
a causa específica dessa captura e o resultado operacional permanecem pendentes.

1. Abrir Responder em conversa antiga com resposta do Protocolista, incluindo uma orientação e uma exigência históricas.
2. Confirmar que FAST MAIL/compositor permanece aberto e é preparado em HTML; inserir nova orientação e conferir a formatação.
3. Dar duplo clique imediato: somente uma inserção. Após 1,5 segundo, nova inserção explícita é permitida. Reabrir Responder permite novo atendimento.
4. Testar COBRAR DOCUMENTOS em um serviço já validado: checklist e exigência preservados. Conferir que o histórico mantém texto, links e aparência.
5. Se o OWA não oferecer HTML, verificar fallback sem loop; esse cenário não confirma HTML automático no ambiente real.

Quando surgir uma regressão parecida:

- começar por este runbook;
- verificar se o sintoma já possui solução validada;
- comparar primeiro o código atual com o commit validado;
- procurar regressão antes de criar uma nova camada ou workaround;
- preferir correção estrutural em ponto central, aplicável em lote;
- registrar aqui qualquer novo problema relevante que tenha solução confirmada em teste real.
