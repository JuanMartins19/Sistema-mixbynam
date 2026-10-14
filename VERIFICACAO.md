# Verificação — acompanhamento e agenda — 14/10/2026

## Executado

- `npm test`: **39 verificações passaram, zero falhas**, em execução nova desta versão. Inclui os 18 testes anteriores e os testes de acompanhamento/agenda. Migrações 001, 002 e 003 executadas integralmente em PostgreSQL isolado via PGlite.
- `npm run test:e2e`: **3 testes passaram** no Edge headless instalado neste computador. Formulário/validação/retry sem configuração e layouts 320/390/1440 px preservados.
- `npm run test:e2e:producer`: **2 testes passaram** no Edge headless: acompanhamento manual, fila, Não contatar, backup v2, agenda móvel, conflito, edição, consecutividade e cancelamento. Uma execução adicional do teste de agenda confirmou que o arquivo JSON baixado inclui as sessões criadas e canceladas.
- `npm run build`: **passou**, Next.js 16.4.0, incluindo compilação TypeScript e páginas `/` e `/produtor`. Configuração Netlify mantém `.next` e Node 22.
- `npm run typecheck`: passou novamente **após o build final**, sem erros de TypeScript.
- Não foram adicionadas dependências ou serviços externos. A auditoria de dependências não foi executada nesta atualização; nenhum resultado de outra execução é usado como prova de segurança desta versão.

Os testes precisaram de execução fora da sandbox devido ao bloqueio `spawn EPERM` do Windows. As primeiras tentativas identificaram comparação de objetos Date no teste, incompatibilidade de módulos no helper do Playwright e overflow móvel causado por um elemento de acessibilidade da tabela. Foram corrigidos e as execuções descritas acima passaram. O diretório `.next-e2e` isola os testes do servidor local em `.next`.

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

Também foram preservadas validações de referências/tipo de beat, orçamento com orientação, remoção de campos ocultos, composição do link de WhatsApp e neutralização de fórmulas no CSV.

## Acompanhamento validado

- Incompleto recente fica fora da recuperação; **limite exato de 24h entra**, usando `now()` constante em transação de teste. Limite configurável de 25h também exercitado.
- Próxima ação vencida entra; concluído sem contato confirmado entra. Nota interna isolada não comprova atendimento.
- Situação comercial, histórico e próxima ação ficam separados das respostas. Alterações do produtor preservam `projects.updated_at`; atualização do artista modifica somente seus dados/relógio e não altera a situação comercial.
- Não contatar exclui das filas e bloqueia registro de novo contato. No navegador, o link do WhatsApp fica oculto para esse estado.
- Cliques/retries de acompanhamento e registros manuais mantêm um evento por UUID. Revisão antiga é rejeitada; próxima ação fica preservada após contato.
- Visitante e outra conta autenticada não leem/escrevem acompanhamento ou histórico. RPCs verificam autorização no banco.
- Abrir WhatsApp no navegador de teste não cria contato; confirmação manual cria evento com data/hora. Nenhuma mensagem real foi enviada.

## Agenda validada

- Início/fim `timestamptz`, fim posterior e rejeição de infinito.
- Sobreposição parcial, contida, igual e entre projetos diferentes é rejeitada pela constraint GiST. Horários anteriores e consecutivos são permitidos.
- Repetição da criação preserva PK/data; edição respeita conflito e versão de outra janela.
- Cancelamento mantém o registro e libera o horário; reativação conflitante é rejeitada.
- Chamadas `Promise.all` ao PostgreSQL isolado deixam uma sessão e uma falha. O catálogo confirma constraint de exclusão `producer_sessions_no_overlap`.
- PGlite **serializa as transações**. Esse resultado não demonstra duas conexões PostgreSQL realmente simultâneas: o teste remoto com dois clientes foi preparado e permanece pendente.
- Visitante/outra conta não leem nem alteram sessões por tabelas ou RPC. Produtor só altera pelas RPCs validadas; formulário público não agenda nem recebe dados privados de agenda/acompanhamento.
- Conversão usa America/Sao_Paulo, semana começa segunda-feira e sessão atravessando meia-noite aparece nos dias correspondentes.
- Navegador móvel: criação, erro de conflito com respostas preservadas, consecutividade, edição de status, cancelamento e visão semanal sem overflow.

## Exportação e limites dos testes de navegador

JSON v2 baixado no teste inclui pedidos, acompanhamento, histórico e sessões (inclusive canceladas), com `backup_scope: application_records_only`. CSV anterior foi preservado. Exportação não inclui chaves privadas de retomada e não substitui backup de banco/Auth.

Os testes privados usam **dublê de Auth/HTTP exclusivamente no teste**, domínio `.invalid` e migrações reais em PGlite. Não testam assinatura de JWT pelo Supabase, comportamento remoto do PostgREST ou publicação. O WhatsApp é interceptado. Nenhuma fixture faz parte da persistência/rotas da aplicação.

## Pendente de configuração externa

Nesta atualização não foram feitas chamadas de teste ou escritas no Supabase de produção nem deploy no Netlify. A configuração local existente foi preservada; a conexão/formulário de outra versão não valida as novas tabelas/RPCs.

`npm run test:integration` foi ampliado para Supabase **separado**, com as três migrações, produtor e outra conta previamente criados. Inclui API direta, oito chamadas concorrentes ao formulário, acompanhamento/histórico e **dois clientes autenticados criando sessões conflitantes**; depois testa cancelamento, horário liberado e consecutividade. Recusa hostname igual ao `.env.local` e exige `TEST_CONFIRM_ISOLATED_PROJECT=yes`. Não foi executado: `.env.test.local` e projeto dedicado de teste não estão configurados. Não exige chave de serviço nem exclui dados automaticamente.

Antes de atualizar o ambiente remoto existente, aplicar **somente 002 → 003** se 001 já estiver aplicada; nunca reaplicar 001. Validar login real, RLS/GRANTs na API remota, migrações, concorrência entre conexões, exportações e publicação Netlify Free em ambiente de teste. Nenhum sucesso externo desta versão é afirmado.

O roteiro manual completo está em [README.md — Roteiro manual de aceite](README.md#roteiro-manual-de-aceite-em-projeto-de-teste). Inclui recuperação de contato, inatividade sem intervenção do produtor, atendimento manual, agenda/conflitos, contas não autorizadas e backup. Financeiro e links de entrega continuam para a próxima implementação.

## Configuração administrativa do produtor master

Adicionado `supabase/setup/configure_master.sql`, com placeholder de e-mail e sem senha. Uma verificação adicional executada com `tsx --test tests/master-setup.test.ts` passou: conta inexistente ou não confirmada é rejeitada; conta confirmada substitui o UUID anterior e mantém exatamente um produtor autorizado. Esse teste usou PostgreSQL isolado; a suíte de 39 testes acima não foi repetida nesta alteração administrativa.

Na tentativa de login remoto solicitada pelo usuário, Supabase Auth retornou `invalid_credentials` (HTTP 400). Isso não identifica, por si só, se a conta é inexistente ou a senha é diferente. Não foi criado usuário nem alterada autorização no banco remoto. Credenciais foram fornecidas ao processo apenas por stdin protegido, sem gravação em arquivo/repositório ou exposição no resultado. A criação da conta confirmada e execução do setup como postgres no Dashboard permanecem necessárias para ativar o master.
