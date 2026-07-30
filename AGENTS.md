# Orientações de desenvolvimento

## Missão

Construir o SEI Protocolistas como extensão gratuita, local e de código aberto para reduzir cliques,
retrabalho e erros na rotina de protocolistas.

## Forma de trabalho

- Diagnosticar primeiro. Alterar depois. Nunca o contrário.
- Avisar Thiago antes de cada bloco importante de trabalho.
- Explicar objetivo, arquivos alterados, funcionamento e testes em linguagem acessível.
- Trabalhar na branch `desenvolvimento`; integrar em `main` apenas após verificação.
- Commits, pull requests e merges verificados podem ser realizados sem aprovações repetitivas.
- Preservar créditos, histórico e obrigações da licença GPL-3.0 do SEI++.
- Não enviar dados de cidadãos, documentos ou credenciais para serviços externos.

## Qualidade

- Registrar a linha de base antes de corrigir problemas herdados.
- Preferir desativar e testar antes de excluir módulos legados.
- Validar `manifest.json`, executar o lint e testar o carregamento da extensão antes de integrar mudanças.
