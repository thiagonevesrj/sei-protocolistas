# Correção local do cartão — 14/10/2026

Pasta funcional: `C:\Projetos\Sei-Protocolistas\sei-protocolistas`.
O cartão está em `cs_modules/protocolo_cliente/index.js`.

## Causa e mudança

O observador de alterações da página chamava `insertCard()` ao reconhecer “Processo aberto ... unidade”. A localização atual do processo era interpretada como envio bem-sucedido. Destinos e modalidade também podiam vir do contexto global de outro atendimento.

Agora o clique/submit na tela `procedimento_enviar` registra apenas intenção de envio, por id SEI, na sessão da aba. O cartão exige uma resposta posterior: mensagem explícita de encaminhamento ou mudança nas unidades abertas, retornada pelo SEI, incluindo todos os destinos selecionados e pelo menos um destino novo. Informação inalterada não confirma. O registro expira em dez minutos; troca de processo invalida o cartão. A modalidade por e-mail só vem de um atendimento iniciado e vinculado a esse processo na mesma aba. Os dados de impressão ficam vinculados ao cartão confirmado.

O observador acompanha alterações enquanto a página permanece aberta. Não há nova requisição ao SEI e a extensão não envia processos automaticamente.

## Recarregar e testar no SEI

A primeira revisão passou em 23 checagens simuladas, mas falhou no teste manual do SEI real. A revisão atual acrescenta recuperação da localização quando a tela é trocada, leitura do identificador na página principal e vínculo do contexto somente quando ele pertence ao fluxo atual. Na cópia de revisão, 27 checagens simuladas e o teste de navegador do Fast Mail passaram. Após aplicar os arquivos à pasta funcional, passaram a verificação de sintaxe e o teste do protocolo do cliente; não foi possível repetir a suíte de navegador porque o Playwright não está instalado nas pastas disponíveis. A confirmação operacional no SEI-RJ permanece pendente. A suíte geral tinha uma falha preexistente em `test-fast-proc-flow.js`, também presente na versão original. O manifesto e a versão da extensão não foram alterados.

1. No perfil de trabalho do Chrome, abra `chrome://extensions` e ative “Modo do desenvolvedor”.
2. Identifique a cópia local SEI Protocolistas, id `olaehbkokmjcklnpagcekphlhndadgje`, carregada de `C:\Projetos\Sei-Protocolistas\sei-protocolistas`, e clique em Recarregar (seta circular).
3. Se a cópia da loja SEI Protocolistas também estiver habilitada nesse perfil, desative-a durante o teste para não executar dois códigos. Não precisa removê-la.
4. Atualize a aba do SEI (Ctrl+R) e comece um novo atendimento na mesma aba.
5. Antes de enviar, inclusive na tela de seleção de unidades, o cartão não deve aparecer.
6. Cancelar ou falhar no envio não deve exibir sucesso.
7. Faça um encaminhamento que você já precisa realizar. Depois do retorno do SEI, confira a unidade de destino e o histórico/andamento nativo. Só então o cartão deve aparecer, uma vez, com o destino correto.
8. Em envio para várias unidades, confira todas no retorno do SEI e no cartão.
9. Abra outro processo: ele não deve herdar o cartão anterior. Confira também o comprovante e o botão de retorno ao e-mail num atendimento novo iniciado pela extensão.

Se a mensagem real do SEI tiver formato diferente ou não houver confirmação inequívoca, o cartão ficará oculto. Os testes usam páginas simuladas em Chrome; a validação operacional no SEI-RJ continua necessária. Reenvio para unidades nas quais o processo já estava aberto não é confirmado apenas pela localização inalterada.

## Reversão

O checkpoint na pasta `Checkpoints/cartao-confirmacao-...` contém os arquivos anteriores à aplicação. Copie `cs_modules/protocolo_cliente/index.js` e `scripts/test-protocolo-cliente.js` dele para os respectivos locais, recarregue a extensão e atualize o SEI.

Sem publicação na loja, push, merge ou alteração de versão.
