# Verificação da entrega — 14/10/2026

## Executado

- `npm run typecheck`: sem erros de TypeScript.
- `npm test`: 18 verificações passaram. A migração foi executada integralmente em PostgreSQL isolado via PGlite, incluindo funções, privilégios e RLS.
- `npm run test:e2e`: 3 testes passaram no Edge headless. Validação, configuração ausente sem confirmação falsa, nova tentativa mantendo respostas, painel sem dados privados e ausência de overflow em 320, 390 e 1440 px.
- `npm run build`: build de produção do Next.js passou.
- Instalação/auditoria npm: nenhuma vulnerabilidade reportada no momento da verificação. Versões resolvidas estão no `package-lock.json`.

## Cobertura do banco

1. Contato e autorização persistem na primeira etapa com estado incompleto.
2. Repetir o salvamento usa o mesmo identificador e mantém um registro.
3. Acesso público direto para leitura/escrita é negado.
4. Segredo incorreto não recupera nem sobrescreve respostas.
5. Identificador público não funciona como credencial de retomada.
6. Pular etapas ou omitir autorização é rejeitado.
7. Avançar atualiza o mesmo registro; revisar etapa anterior preserva respostas posteriores e progresso.
8. Concluir confirma estado e data no banco; retries não alteram a conclusão.
9. Outro projeto com o mesmo telefone gera outro registro.
10. Usuário autenticado não autorizado não recebe contatos nem respostas.
11. Somente UUID do produtor configurado recebe todos os pedidos; não recebe permissão de exclusão direta.

Também foram verificadas validações de referências/tipo de beat, orçamento com orientação, remoção de campos ocultos, composição do link de WhatsApp e neutralização de fórmulas no CSV.

## Pendente de configuração externa

Não foram executados salvamentos no Supabase remoto nem deploy no Netlify. Faltam URL/chave do projeto real, aplicação da migração, usuário do produtor configurado, número do WhatsApp e conta/site de hospedagem.

O teste `npm run test:integration` está disponível para projeto Supabase **separado**. Ele verifica a API real e oito chamadas concorrentes, sem chave de serviço. Não foi executado por ausência dessas configurações. O teste local de repetição não substitui essa verificação externa de concorrência e integração.

Os testes de interface desta entrega verificam deliberadamente a ausência de configuração. A confirmação, a listagem autenticada e a exportação devem ser verificadas no navegador conectado ao Supabase antes da divulgação, conforme o roteiro no README. Nenhum sucesso externo foi simulado.
