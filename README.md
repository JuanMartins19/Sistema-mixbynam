# Mixbynam — MVP de produções musicais

Next.js + TypeScript + Supabase, preparado para Netlify Free e endereço gratuito `nome-do-site.netlify.app`. Artistas não criam conta. Nenhum serviço pago, API de WhatsApp, envio automático, calendário ou processamento de pagamentos.

## Entrega

- Formulário público em quatro etapas, responsivo e em português.
- Etapa 1 salva contato e autorização explícita (texto, versão e horário do banco), incluindo atendimento de pedidos incompletos.
- Cada avanço atualiza o mesmo registro. Pedidos são identificados por UUID aleatório, nunca pelo telefone. Cliques e retries usam a mesma chave; projetos diferentes com o mesmo telefone ficam separados.
- Respostas permanecem na tela ao voltar ou após falha. A confirmação só aparece quando a RPC retorna `completed`, depois da transação. Ao concluir, resumo e link `wa.me` com identificador público. O artista ainda precisa enviar a mensagem; nenhum clique é registrado como envio.
- `/produtor`: login por senha, acesso de um único produtor previamente cadastrado, listagem paginada, filtro de incompletos/concluídos, respostas e autorização completa.
- Exportação de **todos** os registros em JSON (backup) e CSV (consulta), independentemente do filtro. CSV neutraliza fórmulas. Não inclui segredos de retomada.

## 1. Ambiente local

**Neste computador Windows**, o Node portátil e as dependências já foram preparados. Para iniciar, dê dois cliques em `iniciar.cmd` ou execute `.\iniciar.cmd` no terminal do projeto. Mantenha a janela aberta e acesse `http://127.0.0.1:3000`. “Conexão recusada” significa que o navegador não conseguiu alcançar um servidor nessa porta; verifique se o terminal mostra `Ready` e se o endereço está correto. O banco não precisa estar configurado para visualizar a primeira etapa.

O arquivo `.env.local` preparado neste computador contém apenas placeholders e está ignorado pelo Git. Preencha-o conforme os passos abaixo. Após alterar a configuração, reinicie o servidor (Ctrl+C e `iniciar.cmd` novamente). Não inicie dois servidores na mesma porta.

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
2. No SQL Editor, execute integralmente [001_projects.sql](supabase/migrations/001_projects.sql), uma vez. A migração é transacional. Para futuras mudanças, crie novas migrações; não reaplique esta.
3. Em Authentication → Providers, habilite e-mail/senha e **desabilite “Allow new users to sign up”**. Não habilite login anônimo. O site não oferece cadastro.
4. Em Authentication → Users, use **Add user → Create new user** para criar o produtor com senha forte e e-mail confirmado (**Auto Confirm User**). Isso dispensa convite e envio de e-mail. Não adicione envio SMTP ao MVP.
5. Copie o UUID desse usuário e execute no SQL Editor, substituindo o placeholder:

```sql
insert into private.producer(singleton, user_id)
values (true, 'UUID-DO-USUARIO-PRODUTOR'::uuid)
on conflict (singleton) do update set user_id = excluded.user_id;
```

Só esse UUID pode consultar pedidos. Uma outra conta, mesmo autenticada, recebe zero registros. Para trocar produtor, repita o comando com o novo UUID. Não conceda permissões pelo e-mail, telefone ou metadata editável do usuário.

Para recuperar acesso, o responsável pelo Supabase deve atualizar a senha no Dashboard. Este MVP não envia recuperação automática por e-mail. Configure o Site URL em Authentication → URL Configuration para o endereço definitivo do Netlify; o login por senha não usa redirecionamento.

## 3. Modelo de acesso

`public.projects` armazena respostas, progresso, situação e autorização. RLS está habilitado. `anon` não tem privilégios diretos na tabela; `authenticated` tem apenas SELECT, restrito pela política `producer_read`. Não há INSERT, UPDATE ou DELETE diretos para os clientes.

`private.producer` guarda o único UUID autorizado e `private.project_keys` guarda SHA-256 da chave de retomada. O schema privado e suas tabelas não têm acesso de `anon`/`authenticated` nem devem ser expostos na API. `public_id` serve para identificação na conversa e não dá acesso às respostas.

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

O projeto está preparado para publicação, mas não foi publicado nesta entrega: faltam projeto Supabase, configuração real e conta/site Netlify conectados. Nenhum pedido real foi gravado externamente.

## 5. Limites gratuitos e continuidade

Referências oficiais consultadas em **14/10/2026**; verificar novamente antes de publicar, pois planos podem mudar:

- [Netlify Free](https://www.netlify.com/pricing/): 300 créditos/mês. [Documentação de créditos](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/): deploys de produção, tráfego e computação compartilham o limite. Ao esgotar, o site pode ser pausado até o próximo ciclo. Contas antigas podem ter limites legados diferentes. Use Free e confira o consumo no painel; sem garantia de disponibilidade contínua ao exceder cotas.
- [Supabase Free](https://supabase.com/pricing): banco de 500 MB por projeto; monitore espaço e tráfego no Dashboard. [Pausa por inatividade](https://supabase.com/docs/guides/platform/free-project-pausing): projetos com baixa atividade por sete dias podem ser pausados. Restaure pelo Dashboard; enquanto indisponível, o formulário informa falha e não confirma sucesso.
- [Next.js no Netlify](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/): suporte com adaptador OpenNext. O MVP usa páginas estáticas e consultas diretas ao Supabase, reduzindo funções e computação no Netlify. Não armazena áudio nem faz upload; apenas links e texto.

Operar dentro das cotas gratuitas dispensa mensalidade de infraestrutura, mas não representa capacidade ilimitada ou SLA. Não use tráfego artificial para contornar pausa. A RPC pública de captação pode receber spam; mantenha monitoramento do banco/uso e, se necessário, acrescente proteção gratuita contra abuso em etapa posterior. IDs aleatórios e RLS protegem contatos, mas não limitam volume de novos pedidos.

## 6. Backup e dados pessoais

No painel, use **Backup JSON** antes de mudanças e periodicamente. Ele inclui IDs, respostas, datas, progresso e autorização; CSV facilita leitura, mas JSON é a cópia recomendada. A exportação pagina todos os registros e só baixa o arquivo ao terminar; não disponibiliza endpoint público. Não é snapshot transacional: evite exportar durante muitas alterações e não trate o arquivo como backup completo do banco/Auth.

Guarde em diretório protegido fora do projeto, com controle de acesso e, preferencialmente, cópia criptografada. `.gitignore` exclui `.env*` (exceto exemplo), `exports/`, `backups/`, CSV, dumps, logs e resultados de testes. Arquivos JSON de clientes devem ficar em `exports/` ou `backups/`, nunca ao lado dos arquivos de código. Confira os arquivos antes de um commit. Nunca incluir credenciais/exportações no repositório.

O JSON não contém chaves secretas de retomada ou usuários do Auth. Para recuperação completa, faça também backup administrativo das tabelas e Auth pelas ferramentas do Supabase/PostgreSQL, sem colocar dumps no repositório. A importação automática pelo painel não faz parte desta etapa; a restauração deve ser administrativa e validada em projeto separado. Defina retenção dos contatos e atenda pedidos de exclusão pelo responsável do banco. Exemplo de exclusão administrativa, sempre conferindo o ID:

```sql
delete from public.projects where public_id = 'ID-PUBLICO-CONFERIDO'::uuid;
```

A chave privada associada é removida por cascade. O painel não oferece exclusão para evitar remoções acidentais nesta etapa.

## 7. Verificação

```sh
npm run typecheck
npm test
npm run build
```

`npm test` executa validações do formulário/exportação e a **migração real em PostgreSQL isolado (PGlite)**. Esse banco existe somente nos testes; a aplicação não tem fallback local. Cobre salvamento parcial, autorização, progressão e revisão, conclusão idempotente, repetição sem duplicação, projetos separados com mesmo telefone, chave errada e bloqueio de acesso público/outro usuário.

Teste de interface sem Supabase configurado:

```sh
# Windows usa Edge instalado. Linux/macOS: instalar Chromium para Playwright.
npx playwright install chromium
npm run test:e2e
```

No Windows com Edge, pule o download de Chromium. Pode definir `PLAYWRIGHT_CHANNEL=chrome` ou `msedge` para usar outro navegador instalado. O servidor dos testes usa porta 3100 e variáveis Supabase vazias intencionalmente: verifica layout em 320/390/1440 px, validação, erro real de configuração, nova tentativa sem perda das respostas e ausência de confirmação falsa/dados privados. Resultados do navegador são ignorados no Git.

### Teste de integração externa

Use **outro projeto Supabase Free de teste**, aplique a migração, crie produtor e outro usuário (Auto Confirm) e configure o primeiro na tabela privada. Copie `.env.example` para `.env.test.local`, preencha URL/chave e credenciais **dessas contas de teste** e defina `TEST_CONFIRM_ISOLATED_PROJECT=yes`.

```sh
npm run test:integration
```

O teste chama a API real, dispara oito salvamentos concorrentes da primeira etapa, confere um único registro, testa retomada, conclusão/retries, mesmo telefone em dois projetos e acesso não autorizado. Não usa chave de serviço. Os UUIDs de teste são exibidos para exclusão administrativa pelo SQL Editor. As contas de aplicação não recebem permissão de DELETE.

Sem credenciais externas, esta integração permanece pendente; não interpretar os testes isolados como validação do seu Supabase/Netlify. Para aceite após configuração: avançar etapa 1 e verificar contato no painel; fechar a aba e verificar pedido incompleto; repetir clique/retry e conferir um registro; completar e verificar resumo/ID no WhatsApp; criar outro projeto com mesmo telefone; entrar com outra conta e confirmar bloqueio; exportar JSON e conferir respostas.

## Próximas etapas

1. Atual: formulário, contatos recuperáveis de pedidos incompletos, acesso privado e backup.
2. Agenda: disponibilidade e sessões, sem ativação nesta entrega.
3. Financeiro: produtor confere pagamentos e registra situação manualmente, sem gateway.
4. Entregas: guardar somente links dos arquivos entregues externamente; sem upload de áudio para manter o uso gratuito.

Essas etapas devem reutilizar IDs, contatos e políticas privadas existentes. Não há promessa de agendamento, pagamento ou envio automático na interface atual.
