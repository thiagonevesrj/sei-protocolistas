# Orientações de desenvolvimento

## Missão

Construir o SEI Protocolistas como extensão gratuita, local e de código aberto para reduzir cliques,
retrabalho e erros na rotina de protocolistas.

## Identidade e autoria

- O nome do idealizador é **Thiago Neves**, sempre escrito com **H**.
- A assinatura visual oficial é **by Thiago Neves Design**.
- Nunca publicar `Tiago Neves`, sem o H, em telas, imagens, documentação ou metadados do projeto.

## Forma de trabalho

- Diagnosticar primeiro. Alterar depois. Nunca o contrário.
- Avisar Thiago antes de cada bloco importante de trabalho.
- Explicar objetivo, arquivos alterados, funcionamento e testes em linguagem acessível.
- Nesta continuidade, trabalhar na branch `agent/catalogo-fast-mail-amanha`, conforme orientação de Thiago. Não alterar `desenvolvimento` ou `main` nem fazer merge/publicação sem pedido específico.
- Commits e envio das correções verificadas à branch de trabalho estão autorizados, sem aprovações repetitivas.
- Preservar créditos, histórico e obrigações da licença GPL-3.0 do SEI++.
- Não enviar dados de cidadãos, documentos ou credenciais para serviços externos.

## Preferência permanente de autonomia — registrada em 16/09/2026

- Thiago pediu explicitamente: não ficar pedindo confirmação; deixar para ele apenas **Fetch origin** e **Pull** no fluxo de atualização do código.
- Para demandas já solicitadas, conduzir diagnóstico, implementação, testes, documentação, commit, envio à branch e conferência de CI até concluir. Não parar para perguntar se pode continuar, corrigir, criar commit ou enviar a correção.
- As mensagens de progresso são informativas, não pedidos de aprovação.
- Usar a conexão GitHub já disponível quando ela permitir concluir o trabalho sem exigir autenticação local ou comandos do usuário.
- Solicitar informação somente quando ela estiver realmente faltando para definir o resultado, como a lista e a ordem de atalhos. Não transformar decisões rotineiras de implementação em perguntas.
- Ao entregar, informar o resultado e o commit disponível para Fetch/Pull. Quando um comportamento depender do OWA real, registrar a validação pendente com honestidade, sem apresentar CI como confirmação operacional.
- Esta preferência não autoriza ampliar o escopo para ações destrutivas, publicação ou merge, nem elimina confirmações obrigatórias da plataforma.

## Verificações

- Registrar a linha de base antes de corrigir problemas herdados.
- Preferir desativar e testar antes de excluir módulos legados.
- Validar `manifest.json`, executar o lint e testar o carregamento da extensão antes de integrar mudanças.
