# Validação local — impressão do andamento do processo

**Data:** 14/10/2026
**Projeto:** SEI Protocolistas 6.0.7
**Pasta funcional:** `C:\Projetos\Sei-Protocolistas\sei-protocolistas`
**Branch local:** `agent/catalogo-fast-mail-amanha`

## Resultado

A ação **Imprimir andamento do processo** foi validada na versão local pelo usuário. Após a correção, o botão ficou disponível na tela de histórico do processo sem depender do comando de diagnóstico no Console. O F12 foi usado para diagnosticar o problema; não deve ser necessário para o uso normal.

O botão abre uma página própria de impressão com o número do processo em destaque, a unidade e a movimentação mais recente, o histórico de datas/unidades/movimentações e instruções para consulta pelo portal. Os nomes internos de usuários não são incluídos na tabela impressa.

## Problema encontrado e causa

O histórico do SEI é renderizado em um frame aninhado. O diagnóstico do Console localizou o botão no frame `top.frames[1].frames[0]`. A implementação anterior observava somente o documento principal. Se o conteúdo do frame do histórico aparecesse depois da primeira verificação, a extensão não detectava a tabela/título e não inseria o botão. Abrir o DevTools coincidia com a atualização que fazia o botão aparecer, dando a impressão de que o F12 era necessário.

## Correção aplicada

Em `cs_modules/protocolo_cliente/acompanhamento.js`, a lógica agora observa cada documento acessível, inclusive os documentos dos frames, e reage ao carregamento de frames. Quando o SEI termina de carregar ou atualizar o histórico dentro de um frame, a extensão executa novamente a detecção e insere o botão. Os observadores são encerrados ao sair da página.

O módulo continua restrito à tela `procedimento_trabalhar` e procura a tabela de histórico do SEI antes de montar a página de impressão.

## Verificações

- `node --check cs_modules/protocolo_cliente/acompanhamento.js` — passou.
- `node scripts/validate-extension.js` — passou: “SEI Protocolistas validado com sucesso.”
- Teste manual no SEI real, após recarregar a extensão local — usuário confirmou que o botão ficou bom após a correção.
- O diagnóstico anterior confirmou que o título e a tabela estavam no frame aninhado e que o botão era inserido nesse frame.

A validação automatizada confirma sintaxe e estrutura da extensão. A confirmação manual registrada é sobre a exibição normal do botão. Este registro não afirma que todos os cenários de impressão, todos os tipos de histórico ou encaminhamentos para múltiplas unidades foram testados nessa sessão.

## Checkpoint

A pasta `Checkpoints/acompanhamento-impressao-validado-20261014/` preserva os arquivos diretamente ligados a esta correção:

- `acompanhamento.js` — implementação local validada;
- `manifest.json` — vínculo do módulo ao carregamento da extensão.

O código principal do cartão de protocolo também tem alterações locais anteriores e seus próprios registros/checkpoints. Não restaurar arquivos antigos sobre o estado atual sem comparar os diffs.

## Estado de publicação e próximos passos

A validação é **local**. Não houve fetch, pull, commit, push, merge nem publicação na Chrome Web Store. A versão permanece 6.0.7. O fluxo combinado continua: concluir a validação local, revisar e migrar as alterações ao GitHub, validar a versão no GitHub e só depois preparar/publicar um novo ZIP na loja.

## Contexto relacionado

O usuário informou que Fast Mail e Fast Proc estão funcionando bem nos fluxos testados, incluindo preparar resposta por e-mail e imprimir o comprovante do cliente. Não foi possível confirmar envio para múltiplas unidades por falta de um segundo setor de teste. A correção do cartão final e a nova impressão do andamento são funcionalidades diferentes e devem permanecer separadas.