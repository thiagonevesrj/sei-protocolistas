# Baixa de Restrição: seleção do caso no Fast Mail

## Problema confirmado

O atalho V3 desviava da navegação V2 que monta o seletor visível. Além disso,
a ponte de apresentação tentava decidir se mostrava o painel medindo filhos
do próprio painel oculto. O seletor não reaparecia. O teste no Chromium com
todos os scripts e estilos do Webmail do manifest reproduziu a falha antes
da correção, embora os 20 testes anteriores passassem.

## Correção

- Atalho e pesquisa de Baixa de Restrição usam a navegação padrão.
- “Qual é o caso?” mostra Geral, Inventário — Herdeiros e Inventário — Terceiros.
- As ações só aparecem depois da escolha; trocar ou limpar o caso descarta a
  ação anterior e seus controles.
- O painel considera o estado dos controles, sem depender da geometria de
  um ancestral oculto.
- Baixa de Restrição foi vinculada à navegação de Veículos; faltava esse vínculo
  para carregar o checklist e preparar o processo do caso Geral.
- Inventários preservam os modelos presenciais existentes. A cobrança abre
  a orientação/checklist do caso, nunca a cobrança genérica por e-mail. O
  checklist detalhado de terceiros continua no script oficial, como antes.
  A abertura por e-mail permanece indisponível para os dois inventários.

## Verificação

- `npm run validate`: 20 verificações aprovadas.
- `npm run test:browser`: Chromium, todos os módulos do manifest aplicáveis à
  composição no Webmail, dados fictícios e rede externa bloqueada. Valida
  seletor visível, três casos e scripts correspondentes, cobrança, preparação
  do processo, limpeza, pesquisa e alternância com Taxas, Desistência e Perícia.
  Também insere uma cobrança Geral no editor HTML simulado e preserva o histórico.
- Teste novo incluído na validação do GitHub; requer `npm ci` e
  `npx playwright install --with-deps chromium`. Para Chrome instalado no Windows,
  definir `CHROME_PATH` com o caminho do executável.
- `npm run lint`: os mesmos 36 erros já presentes no HEAD anterior. Confirmado
  executando o mesmo lint sobre o conteúdo anterior dos arquivos. Nenhum erro
  adicional; o novo teste passa individualmente no ESLint.
- O teste usa um editor OWA simulado e APIs da extensão simuladas. Não envia
  e-mails, não abre processos reais e não substitui a validação no OWA autenticado.

## Atualização

Na branch `agent/catalogo-fast-mail-amanha`, fazer Fetch/Pull, recarregar a
extensão e atualizar a janela de composição do Webmail. Em Orientação, abrir
Baixa de Restrição e escolher o caso antes da ação.
