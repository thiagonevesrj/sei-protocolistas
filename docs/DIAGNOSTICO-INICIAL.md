# Diagnóstico inicial

## Como ler este documento

Uma extensão do Chrome funciona como uma equipe que entra em páginas específicas:

- `manifest.json` é a escala de serviço: define quem entra, em qual página e com quais permissões;
- `cs_modules` contém os trabalhadores que modificam as telas do SEI;
- `storage.local` é o armário onde ficam as preferências de cada protocolista;
- `background` contém tarefas que continuavam trabalhando fora da tela principal;
- `browser_action` é a pequena janela aberta ao clicar no ícone da extensão.

## Decisões da primeira etapa

| Classificação | Funcionalidades |
| --- | --- |
| Manter | Clique Menos, arrastar documentos externos, informações do interessado, atribuição na árvore, anotações e documento como modelo |
| Adaptar | Pesquisa de informações, que hoje filtra somente processos já visíveis |
| Ocultar provisoriamente | Prazos, quantidade de dias, filtros por atribuição e blocos, sobrestamento, blocos de assinatura, especificações, marcadores e ponto de controle |
| Remover do carregamento | Notificações experimentais e suas permissões de navegador |
| Investigar | Tema escuro e ajustes automáticos executados sem opção visível |

Ocultar antes de excluir permite testar a versão enxuta no SEI-RJ sem perder rapidamente um código que
possa alimentar outra ferramenta.

## Qualidade herdada

Antes das alterações, o ESLint 8.57.1 encontrou 50 erros na base original. A maior parte está ligada ao
modelo de scripts globais usado pelo SEI++, no qual uma função é declarada em um arquivo e chamada por
outro arquivo carregado na mesma página.

Essa contagem é a linha de base do projeto. Os erros serão reduzidos progressivamente, sem tratar código
herdado como se fosse defeito criado pelo SEI Protocolistas.

## Primeira configuração padrão

Ativada para novas instalações:

- pesquisa de informações;
- informações do interessado;
- copiar número e link quando aplicável à versão do SEI;
- anotações;
- Clique Menos;
- inclusão de documentos ao arrastar;
- documento como modelo;
- identificação da atribuição na árvore.

As opções legadas ocultas também são filtradas durante a inicialização, evitando que configurações antigas
reativem módulos fora do escopo.
