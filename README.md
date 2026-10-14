# Mixbynam — MVP de produções musicais

Next.js + TypeScript + Supabase, preparado para Netlify Free e endereço gratuito `nome-do-site.netlify.app`. Artistas não criam conta. Formulário público, acompanhamento privado de contatos e agenda manual do produtor. Nenhum serviço pago, API de WhatsApp, envio automático, gateway ou upload de áudio.

## Entrega

- Formulário público em quatro etapas, responsivo e em português.
- Etapa 1 salva contato e autorização explícita (texto, versão e horário do banco), incluindo atendimento de pedidos incompletos.
- Cada avanço atualiza o mesmo registro. Pedidos são identificados por UUID aleatório, nunca pelo telefone. Cliques e retries usam a mesma chave; projetos diferentes com o mesmo telefone ficam separados.
- Respostas permanecem na tela ao voltar ou após falha. A confirmação só aparece quando a RPC retorna `completed`, depois da transação. Ao concluir, resumo e link `wa.me` com identificador público. O artista ainda precisa enviar a mensagem; nenhum clique é registrado como envio.
- `/produtor`: login por senha, acesso de um único produtor previamente cadastrado, listagem paginada e respostas completas. Filtros Todos, Retomar contato, Sem atendimento, Concluídos e Incompletos.
- Acompanhamento separado: situação comercial, próxima ação/data de retorno, notas internas e histórico de contatos confirmados manualmente.
- Agenda diária/semanal, criação, edição e cancelamento manual de sessões relacionadas a um pedido. Horários de Brasília e conflito impedido pelo banco.
- JSON **v2** inclui todos os pedidos, acompanhamento, histórico e sessões. CSV preserva a exportação de respostas dos pedidos e neutraliza fórmulas. Não inclui segredos de retomada. Exportação de registros não substitui backup completo de banco/Auth.

## 1. Ambiente local

**Neste computador Windows**, o Node portátil e as dependências já foram preparados. Para iniciar, dê dois cliques em `iniciar.cmd` ou execute `.\iniciar.cmd` no terminal do projeto. Mantenha a janela aberta e acesse `http://127.0.0.1:3000`. “Conexão recusada” significa que o navegador não conseguiu alcançar um servidor nessa porta; verifique se o terminal mostra `Ready` e se o endereço está correto. O banco não precisa estar configurado para visualizar a primeira etapa.

O arquivo `.env.local` deste computador está ignorado pelo Git e pode já estar preenchido: preserve seus valores. Para nova instalação, copie `.env.example` apenas quando ainda não houver `.env.local`. Após alterar a configuração, reinicie o servidor (Ctrl+C e `iniciar.cmd` novamente). Não inicie dois servidores na mesma porta.

Instale Node.js 22 ou superior. Na raiz:

```sh
npm ci
cp .env.example .env.local
```

No PowerShell, use `Copy-Item .env.example .env.local`.

Preencha somente estas variáveis para a aplicação:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=SUA-CHAVE-PUBLICA
NEXT_PUBLIC_PRODUCER_WHATSAPP=SEU-NUMERO-INTERNACIONAL
NEXT_PUBLIC_PRODUCER_NAME=NOME-DO-PRODUTOR
```

Copie URL e chave **anon/publishable** das configurações de API do projeto. O número do WhatsApp deve ter apenas dígitos, código do país, DDD e número. Nunca colocar `service_role`, chaves secretas ou senhas em `NEXT_PUBLIC_*`. Essas variáveis são públicas e entram no bundle; a segurança dos registros está nas políticas e RPCs do banco.

```sh
npm run dev
```

Abra `http://localhost:3000`. Sem configuração, o site apresenta erro de salvamento; não há dados simulados nem confirmação fictícia. Sem número válido do produtor, o pedido continua salvo e a confirmação explica a ausência do botão do WhatsApp.

## 2. Supabase Free e migração

1. Crie uma organização/projeto no plano **Free**, sem contratar plano pago.
2. No SQL Editor, execute as migrações integralmente, uma vez cada, nesta ordem:
   - [001_projects.sql](supabase/migrations/001_projects.sql): formulário e acesso do produtor.
   - [002_contact_followup.sql](supabase/migrations/002_contact_followup.sql): acompanhamento, histórico e fila.
   - [003_producer_schedule.sql](supabase/migrations/003_producer_schedule.sql): agenda e exclusão de sobreposições.
   **Se 001 já foi aplicada, execute somente 002 e depois 003.** Não sobrescreva nem reaplique 001. As migrações são transacionais e preservam os pedidos existentes. Faça backup administrativo antes de atualizar um banco com dados. A nova interface privada depende de 002/003; em caso de ausência, mostra erro explícito.
3. Em Authentication → Providers, habilite e-mail/senha e **desabilite “Allow new users to sign up”**. Não habilite login anônimo. O site não oferece cadastro.
4. Em Authentication → Users, use **Add user → Create new user** para criar o produtor com senha forte e e-mail confirmado (**Auto Confirm User**). Isso dispensa convite e envio de e-mail. Não adicione envio SMTP ao MVP.
5. Copie o UUID desse usuário e execute no SQL Editor, substituindo o placeholder:

```sql
insert into private.producer(singleton, user_id)
values (true, 'UUID-DO-USUARIO-PRODUTOR'::uuid)
on conflict (singleton) do update set user_id = excluded.user_id;
```

Só esse UUID pode consultar pedidos. Uma outra conta, mesmo autenticada, recebe zero registros. Para trocar produtor, repita o comando com o novo UUID. Não conceda permissões pelo e-mail, telefone ou metadata editável do usuário.

Esse único produtor é o **usuário master da aplicação**, com acesso aos contatos, acompanhamento, agenda e exportações. Isso não concede papel administrativo do Supabase nem ignora as políticas do banco. Para configurar pelo e-mail da conta previamente criada, use [configure_master.sql](supabase/setup/configure_master.sql) no SQL Editor como postgres, substituindo apenas `EMAIL-DO-PRODUTOR`. O script exige uma conta única com e-mail confirmado e configura seu UUID em `private.producer`; substitui qualquer produtor anteriormente configurado e retorna a conta autorizada para conferência. Não armazene senha em SQL, código ou `.env.local`. Mantenha cadastro público desabilitado em Authentication.

Para recuperar acesso, o responsável pelo Supabase deve atualizar a senha no Dashboard. Este MVP não envia recuperação automática por e-mail. Configure o Site URL em Authentication → URL Configuration para o endereço definitivo do Netlify; o login por senha não usa redirecionamento.

### Acompanhamento e recuperação

Progresso do formulário, situação comercial e histórico são estruturas independentes. `projects.updated_at` continua sendo a última atualização confirmada do artista: registrar uma nota, alterar situação comercial ou criar sessão não modifica esse relógio.

A fila **Retomar contato** inclui, pela hora do banco, qualquer pedido com uma destas condições: incompleto sem atualização há **pelo menos 24 horas**; próxima ação vencida; concluído sem registro manual de contato. A regra é `INACTIVITY_HOURS` em `src/lib/followup.ts`, passada à RPC; alterar essa constante muda o limite e o texto. No limite exato de 24h o pedido entra. A interface usa “Incompleto há mais de 24 horas”; nunca afirma abandono. Atualizações recentes do artista retiram a condição de inatividade; outras condições ainda podem manter o pedido na fila.

Situações comerciais: Novo, Em contato, Proposta enviada, Fechado, Perdido e Não contatar. **Não contatar fica fora das filas Retomar contato e Sem atendimento**, mesmo com retorno vencido. Continua disponível em Todos. O link do WhatsApp é bloqueado enquanto essa situação estiver salva.

O filtro **Sem atendimento** mostra pedidos sem contato confirmado, inclusive incompletos recentes, exceto Não contatar. Nota interna, mudança comercial e clique no WhatsApp não contam como contato realizado. O botão só abre mensagem preenchida para o artista; envio e registro de atendimento são manuais. Telefones brasileiros de 10/11 dígitos recebem prefixo 55 no link; números internacionais válidos são preservados.

Para registrar contato, selecione “Contato realizado”, descreva a conversa e confirme a pergunta. O histórico guarda horário do registro no banco e o usuário responsável. Notas e mudanças de situação/retorno também aparecem no histórico, que é imutável pela API. Próxima ação e data/hora de retorno devem ser preenchidas juntas ou ambas removidas; registrar atendimento não apaga a próxima ação automaticamente. A data é interpretada em Brasília, mesmo se o navegador estiver em outro fuso.

UUID de operação protege registros contra duplicação por clique/retry. Revisão do acompanhamento impede sobrescrever uma alteração de outra janela: recarregue antes de salvar novamente. Não há fallback para localStorage ou dados simulados.

### Agenda do produtor

Na aba Agenda, escolha Diária ou Semanal (segunda a domingo), navegue pela data e clique em Nova sessão. Busque o pedido pelo nome artístico ou identificador público e selecione-o. Informe tipo, início, fim, observações e situação: Reservada, Confirmada, Realizada ou Cancelada. As visões semanais se organizam verticalmente no celular; sessões que atravessam meia-noite aparecem nos dias correspondentes.

Instantes são armazenados como `timestamptz`. A entrada/saída usa `America/Sao_Paulo`, independentemente do fuso do dispositivo. Fim deve ser posterior ao início; datas infinitas são rejeitadas. Todas as situações, exceto Cancelada, ocupam horário. Cancelar mantém o registro e libera o intervalo; reativar passa pela mesma verificação de conflitos.

`producer_sessions_no_overlap` é uma constraint PostgreSQL `EXCLUDE USING gist` sobre `tstzrange(starts_at, ends_at, '[)')`. O intervalo inclui início e exclui fim: **10h–11h e 11h–12h são permitidos**. Há uma agenda global para o único produtor. A constraint decide conflitos atomicamente, inclusive entre transações simultâneas; a verificação visual não é a barreira de segurança. Não exige extensão adicional. Conflito `23P01` é apresentado na interface sem apagar respostas. Versão `updated_at` impede sobrescrita de uma edição simultânea (`40001`); a mesma PK evita duplicação de criação por retry.

O formulário público continua sem agendar ou confirmar sessões, e não tem acesso a essas tabelas/RPCs.

## 3. Modelo de acesso

`public.projects` armazena respostas, progresso, situação e autorização. RLS está habilitado. `anon` não tem privilégios diretos na tabela; `authenticated` tem apenas SELECT, restrito pela política `producer_read`. Não há INSERT, UPDATE ou DELETE diretos para os clientes.

`private.producer` guarda o único UUID autorizado e `private.project_keys` guarda SHA-256 da chave de retomada. O schema privado e suas tabelas não têm acesso de `anon`/`authenticated` nem devem ser expostos na API. `public_id` serve para identificação na conversa e não dá acesso às respostas.

`contact_tracking`, `contact_history` e `producer_sessions` têm RLS habilitado, SELECT somente para o produtor configurado e nenhum privilégio de escrita direta para clientes. Usuários autenticados não autorizados recebem zero linhas; visitantes não podem ler as tabelas. Escritas passam exclusivamente por `save_contact_tracking`, `record_contact_history` e `save_producer_session`, com checagem do produtor, validação e `search_path` vazio. `list_producer_projects` também exige o produtor. As RPCs públicas do artista não recebem nem retornam dados comerciais, histórico ou agenda. Nenhuma chave administrativa foi adicionada ao navegador.

As únicas operações do artista são `save_project` e `resume_project`. Elas são `SECURITY DEFINER` com `search_path` vazio, validam entradas no PostgreSQL e exigem UUID + segredo criptográfico de 256 bits. Só os campos da etapa atual são aceitos; não é possível concluir pulando etapas, substituir uma chave existente nem editar pedido concluído. A chave primária e o bloqueio transacional impedem duplicação em chamadas concorrentes e progresso regressivo.

A chave de retomada fica no **sessionStorage**, só para identificar o pedido na mesma aba; respostas e contatos persistem **no Supabase**. O site recupera as etapas confirmadas do banco após recarregar. Respostas ainda não salvas se perdem ao recarregar. Fechar a aba encerra a recuperação pelo artista; os dados salvos continuam no painel para o produtor fazer contato autorizado. Bloquear armazenamento no navegador permite continuar na aba, com aviso de que não será possível retomá-la. Não existe busca pública por telefone ou identificador.

Quem tiver a chave secreta da aba poderá recuperar aquele pedido, sem conta. Não compartilhe essa chave. Ela não aparece no link de WhatsApp, exportação ou interface. O shell de login é público, mas contatos e respostas são protegidos pelo banco, inclusive em chamadas diretas à API.

## 4. Publicar no Netlify Free

1. Envie código e `package-lock.json` para um repositório privado ou público, sem `.env`, `.tools`, backups ou exportações.
2. No Netlify, escolha **Free**, importe o repositório em Add new project. Não use teste de plano pago nem habilite recarga automática.
3. O `netlify.toml` define `npm run build`, saída `.next` e Node 22. O Netlify detecta Next.js e configura seu adaptador OpenNext; não configurar exportação estática manual nem Netlify Forms.
4. Cadastre as quatro variáveis públicas em Project configuration → Environment variables, também disponíveis para **Builds**. Não cadastre `service_role`.
5. Faça o deploy e escolha um nome disponível: `nome-do-site.netlify.app`. O HTTPS e subdomínio são gratuitos; domínio próprio é opcional e não necessário.
6. Mudanças em variáveis `NEXT_PUBLIC_*` exigem novo build/deploy. Aplique a migração e cadastre o produtor **antes** de divulgar o formulário.

O projeto está preparado para publicação, mas a publicação e a integração remota desta versão permanecem pendentes. A existência de um `.env.local` configurado não autoriza executar testes em produção. Nesta atualização, nenhuma migração ou escrita foi realizada no Supabase remoto. Não configure `MIXBYNAM_E2E` no Netlify: é exclusivo dos testes locais, que usam `.next-e2e`; produção continua em `.next`.

## 5. Limites gratuitos e continuidade

Referências oficiais consultadas em **14/10/2026**; verificar novamente antes de publicar, pois planos podem mudar:

- [Netlify Free](https://www.netlify.com/pricing/): 300 créditos/mês. [Documentação de créditos](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/): deploys de produção, tráfego e computação compartilham o limite. Ao esgotar, o site pode ser pausado até o próximo ciclo. Contas antigas podem ter limites legados diferentes. Use Free e confira o consumo no painel; sem garantia de disponibilidade contínua ao exceder cotas.
- [Supabase Free](https://supabase.com/pricing): banco de 500 MB por projeto; monitore espaço e tráfego no Dashboard. [Pausa por inatividade](https://supabase.com/docs/guides/platform/free-project-pausing): projetos com baixa atividade por sete dias podem ser pausados. Restaure pelo Dashboard; enquanto indisponível, o formulário informa falha e não confirma sucesso.
- [Next.js no Netlify](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/): suporte com adaptador OpenNext. O MVP usa páginas estáticas e consultas diretas ao Supabase, reduzindo funções e computação no Netlify. Não armazena áudio nem faz upload; apenas links e texto.

Operar dentro das cotas gratuitas dispensa mensalidade de infraestrutura, mas não representa capacidade ilimitada ou SLA. Não use tráfego artificial para contornar pausa. A RPC pública de captação pode receber spam; mantenha monitoramento do banco/uso e, se necessário, acrescente proteção gratuita contra abuso em etapa posterior. IDs aleatórios e RLS protegem contatos, mas não limitam volume de novos pedidos.

## 6. Backup e dados pessoais

No painel, use **Backup JSON** antes de mudanças e periodicamente. O formato **v2** contém `format`, `version`, `exported_at`, `time_zone`, `backup_scope: application_records_only` e coleções `projects`, `contact_tracking`, `contact_history`, `producer_sessions`. Inclui IDs, respostas, datas, progresso, autorização, notas comerciais e sessões; CSV mantém apenas as respostas dos pedidos. A exportação pagina todas as coleções e só baixa o arquivo após todas as consultas terem sucesso; falha em uma tabela impede baixar um JSON incompleto. Não disponibiliza endpoint público. Não é snapshot transacional: evite exportar durante muitas alterações e não trate o arquivo como backup completo do banco/Auth.

Guarde em diretório protegido fora do projeto, com controle de acesso e, preferencialmente, cópia criptografada. `.gitignore` exclui `.env*` (exceto exemplo), `exports/`, `backups/`, CSV, dumps, logs e resultados de testes. Arquivos JSON de clientes devem ficar em `exports/` ou `backups/`, nunca ao lado dos arquivos de código. Confira os arquivos antes de um commit. Nunca incluir credenciais/exportações no repositório.

O JSON não contém chaves secretas de retomada ou usuários do Auth. Para recuperação completa, faça também backup administrativo das tabelas e Auth pelas ferramentas do Supabase/PostgreSQL, sem colocar dumps no repositório. A importação automática pelo painel não faz parte desta etapa; a restauração deve ser administrativa e validada em projeto separado. Defina retenção dos contatos e atenda pedidos de exclusão pelo responsável do banco. Exemplo de exclusão administrativa, sempre conferindo o ID:

```sql
delete from public.projects where public_id = 'ID-PUBLICO-CONFERIDO'::uuid;
```

A chave privada, acompanhamento, histórico e sessões associadas são removidos por cascade. Confira o pedido e suas sessões antes da exclusão administrativa. O painel não oferece exclusão; cancelar sessão mantém seu registro.

## 7. Verificação

```sh
npm run typecheck
npm test
npm run build
```

`npm test` preserva os testes anteriores e executa as migrações reais em PostgreSQL isolado (PGlite). Cobre formulário, acompanhamento, RLS, limite exato de 24h, histórico/retries, próxima ação, atividade separada do artista/produtor, Não contatar, agenda, sobreposição, cancelamento, consecutividade, versão de edição, fuso e backup v2. PGlite serializa chamadas: o teste `Promise.all` verifica a constraint em chamadas assíncronas, mas **não comprova concorrência entre duas conexões PostgreSQL reais**. Essa verificação está no teste externo. O banco isolado existe somente nos testes; a aplicação não tem fallback local.

Teste de interface sem Supabase configurado:

```sh
# Windows usa Edge instalado. Linux/macOS: instalar Chromium para Playwright.
npx playwright install chromium
npm run test:e2e
npm run test:e2e:producer
```

No Windows com Edge, pule o download de Chromium. Pode definir `PLAYWRIGHT_CHANNEL=chrome` ou `msedge` para usar outro navegador instalado. Execute as duas suítes em sequência, não ao mesmo tempo: ambas usam porta 3100 e diretório `.next-e2e` ignorado. Isso evita interromper uma prévia em `.next`/porta 3000.

`test:e2e` preserva os três testes do formulário, com variáveis Supabase vazias: layout em 320/390/1440 px, validação, erro de configuração e retry sem confirmação falsa. `test:e2e:producer` usa um dublê de Auth/HTTP limitado aos testes, com domínio `.invalid`; as RPCs executam as **migrações reais no PostgreSQL isolado**. Testa atendimento manual, link WhatsApp sem registro automático, Não contatar/fila, download JSON v2, agenda móvel, conflito preservando respostas, sessões consecutivas, edição e cancelamento. Não valida Supabase Auth remoto, transporte PostgREST real ou Netlify. Fixtures não são rotas da aplicação nem persistência de produção. Resultados e backups fictícios dos testes ficam em diretórios ignorados pelo Git.

### Teste de integração externa

Use **outro projeto Supabase Free de teste**, aplique **001 → 002 → 003**, crie produtor e outro usuário (Auto Confirm) e configure o primeiro na tabela privada. Copie `.env.example` para `.env.test.local`, preencha URL/chave e credenciais **dessas contas de teste** e defina `TEST_CONFIRM_ISOLATED_PROJECT=yes`. O teste recusa o mesmo hostname configurado em `.env.local`, verifica autorização das duas contas antes de criar registros e não imprime senhas/chaves.

```sh
npm run test:integration
```

O teste chama a API real, dispara oito salvamentos concorrentes da primeira etapa e confere um registro. Também testa acompanhamento/histórico, acesso direto às tabelas/RPCs e duas conexões autenticadas criando sessões conflitantes em paralelo: uma precisa salvar, outra receber `23P01`. Depois cancela, reutiliza o horário e salva uma sessão consecutiva. Não usa chave de serviço nem faz exclusão automática. Os UUIDs dos projetos de teste são exibidos para exclusão administrativa no SQL Editor; o cascade remove seus dados de acompanhamento e sessões. As contas da aplicação não recebem permissão de DELETE.

Sem projeto/credenciais **de teste** configurados, esta integração permanece pendente. Consulte [VERIFICACAO.md](VERIFICACAO.md) para resultados efetivamente executados.

### Roteiro manual de aceite em projeto de teste

1. Aplicar as três migrações, criar/autorizar produtor e entrar em `/produtor`. Conta não autorizada deve ser bloqueada; repetir também chamadas diretas às tabelas/RPCs com chave pública e token dessa conta.
2. Salvar a etapa 1 de um pedido e conferir contato/autorização no painel. Incompleto recém-criado deve ficar fora de Retomar contato, desde que não tenha retorno vencido. Retomar/revisar formulário e repetir salvamento devem preservar um registro.
3. Para verificar 24h sem esperar, **somente no projeto de teste**, ajustar `projects.updated_at` de um UUID conferido para `now() - interval '24 hours'`. Atualizar fila; deve exibir o texto de inatividade. Registrar nota/mudar comercial e conferir que `projects.updated_at` não mudou. Avançar o formulário como artista deve atualizar esse relógio.
4. Definir próxima ação vencida; deve entrar na fila. Marcar Não contatar; deve sair, com WhatsApp e contato manual bloqueados. Reverter para Novo e conferir o retorno à fila.
5. Concluir outro pedido sem atendimento; deve entrar na fila. Abrir WhatsApp e registrar nota não devem contar como contato. Confirmar manualmente contato e consultar histórico/data; sem outra pendência, deve sair da fila. Conferir fuso e próxima ação preservada.
6. Agenda: criar sessão 10h–11h. Outra 10h30–11h30 deve falhar; 11h–12h deve salvar. Editar tipo/status/observações e conferir persistência após recarregar. Cancelar 10h–11h, reservar novamente e conferir horário liberado. Reativar a cancelada deve falhar se o horário foi ocupado.
7. Em duas janelas/conexões, tentar criar sessões conflitantes ao mesmo tempo: uma salva e a outra recebe conflito. Repetir clique/retry na mesma criação não deve duplicar. Edição com versão antiga precisa pedir recarregamento.
8. Conferir agenda diária e semana de segunda a domingo em celular, incluindo sessão atravessando meia-noite. O dispositivo em outro fuso deve continuar exibindo horários de Brasília.
9. Baixar JSON v2 e conferir as quatro coleções, IDs relacionados e histórico; CSV deve manter respostas dos pedidos. Retirar acesso a uma coleção no ambiente de teste deve impedir exportação incompleta. Guardar fora do repositório.

## Próximas etapas

1. Implementado: formulário, acompanhamento/recuperação de contatos, histórico, acesso privado, backup v2 e agenda manual.
2. Próxima implementação: financeiro com conferência e registro manual de pagamentos, sem gateway.
3. Próxima implementação: guardar links de entregas externas, sem upload de áudio.

As próximas etapas devem reutilizar IDs, contatos e políticas privadas existentes. Agendamento é exclusivo do produtor; nenhum pagamento, envio automático ou entrega de áudio é realizado pelo formulário público.
