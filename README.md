# Mixbynam — formulário, contatos, agenda e financeiro

Next.js + TypeScript + Supabase Free, preparado para Netlify Free e subdomínio `nome-do-site.netlify.app`. O artista não cria conta. O produtor master é previamente cadastrado. Pagamentos são externos e conferidos manualmente; o site não envia mensagens, não processa pagamentos e não recebe áudio.

## Funcionalidades

- Formulário em quatro etapas, com introdução curta no celular, perguntas diretas e ações Continuar / Enviar pedido.
- Nome artístico e WhatsApp no início; e-mail opcional. Aviso informativo de atendimento e link à Política de Privacidade; publicidade opcional e desmarcada por padrão.
- Respostas apenas na memória durante as quatro etapas. Uma transação no Supabase ao clicar Enviar pedido; mesmo UUID nas tentativas, sem duplicação nem mescla por telefone. Confirmação somente após conclusão confirmada pelo banco.
- Confirmação orienta sobre análise e contato do produtor. WhatsApp abre mensagem preenchida; o artista precisa enviá-la. Resumo e identificador ficam em uma seção expansível.
- Painel privado: Contatos, Agenda e Financeiro. Cartões de contatos no celular e desktop, com artista, serviços, situação comercial e próximo retorno. Respostas, autorização e identificador ficam no atendimento.
- Histórico de atendimento paginado, notas internas e confirmação manual de contato. Abrir WhatsApp não registra contato nem envio.
- Agenda diária, semanal e mensal; seleção de dia no mês, edição e cancelamento no editor. Formulário público não agenda. Sessões canceladas são distintas e liberam horário.
- Financeiro com contrato explícito, data de contratação, vencimento opcional, recebimentos parciais e estornos vinculados ao recebimento original. Histórico imutável e motivo nos ajustes.
- JSON v3 exporta dados da aplicação; CSV mantém respostas dos pedidos. Sem metas, projeções ou indicadores inventados.

## Configuração local

### Revisão de privacidade

Esta revisão substitui o salvamento parcial pedido na primeira etapa do MVP: **não há mais captação de dados antes de Enviar pedido**. Não reaplique migrações antigas. Aplique 008 e atualize a interface juntos; clientes antigos que tentem save_project recebem erro de permissão. O envio usa submit_project, valida todas as etapas e grava respostas e escolha de publicidade numa transação. Retry não duplica nem restaura autorização revogada.

O aviso foi substituído pelo texto solicitado para Mix By Nam. Publicidade tem checkbox opcional; não é base nem requisito do atendimento. O banco registra escolha, data/hora e texto/versão de marketing; dados antigos recebem marketing_allowed=false, sem presumir consentimento. Revogação pública exige o segredo do próprio pedido; também pode ser registrada pelo único produtor autorizado após solicitação e verificação de identidade. Sem envio automático de campanhas.

A página /privacidade informa o responsável **Renan Cubinhetz Guido Silva**, o canal **mixbynam@gmail.com** e o prazo informado de **cinco anos a partir do envio**. Bases legais e adequação desse prazo por finalidade precisam de revisão jurídica. A exclusão é administrativa, sem rotina automática. Dados financeiros e hipóteses legais de conservação precisam ser avaliados separadamente. Referência: [LGPD](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm).

**Legado:** 008 não apaga registros antigos. Bloqueia consultas comerciais/atendimento de incompletos e revoga coleta parcial via API. O responsável precisa revisar e eliminar ou justificar a conservação dos registros anteriores, inclusive cópias exportadas. Faça backup administrativo antes da migração; a exportação do painel não inclui projetos incompletos e não substitui backup completo. Registros financeiros ou sessões antigas ligados a incompletos devem ser conferidos administrativamente antes de qualquer exclusão, preservando obrigações aplicáveis. Não usar dados legados incompletos para prospecção.

Node.js 22 ou superior:

```sh
npm ci
```

Copie `.env.example` para `.env.local` somente se ainda não houver configuração. No Windows: `Copy-Item .env.example .env.local`. Preserve um arquivo já preenchido.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=SUA-CHAVE-PUBLICA
NEXT_PUBLIC_PRODUCER_WHATSAPP=SEU-NUMERO-INTERNACIONAL
NEXT_PUBLIC_PRODUCER_NAME=NOME-DO-PRODUTOR
```

A chave pode ser publishable/anon; nunca secret/service_role. Número: país + DDD + número, somente dígitos. A senha do produtor não fica no código, SQL ou `.env.local`.

```sh
npm run dev
```

Neste Windows, `iniciar.cmd` usa o Node portátil preparado em `.tools`, quando disponível. Mantenha a janela aberta. Abra `http://127.0.0.1:3000`; painel em `/produtor`. Conexão recusada indica que o servidor não está acessível nessa porta. Sem Supabase configurado, a interface mostra indisponibilidade e não inventa salvamento. Detalhes técnicos ficam nos logs, sem credenciais/respostas.

## Migrações e produtor master

### Erro no GitHub: projects already exists

Se a estrutura foi criada pelo SQL Editor e depois ativada a aplicação automática das migrações, o histórico da ferramenta pode não corresponder ao banco. A tentativa de executar 001 novamente encontra a tabela existente. Neste repositório local não há workflow `.github/workflows` de aplicação do banco; a origem do check deve ser confirmada no GitHub/Supabase.

Execute [check_migration_history.sql](supabase/setup/check_migration_history.sql) no SQL Editor. O diagnóstico é somente leitura, sem dados de clientes. Se o histórico existir, execute a segunda consulta comentada separadamente. Confira quais arquivos foram realmente executados integralmente: presença de uma tabela isolada não basta. Faça backup administrativo antes de reparar o histórico.

Para usar a automação, alinhe o histórico do banco correto com os arquivos já aplicados, conforme [migration repair](https://supabase.com/docs/reference/cli/supabase-migration-repair). Com a CLI instalada e autenticada, na raiz do projeto:

```sh
supabase link --project-ref REFERENCIA-DO-PROJETO-CORRETO
supabase migration list --linked
# Somente se 001 foi aplicada integralmente e não está no histórico:
supabase migration repair 001 --status applied --linked
supabase migration list --linked
```

O reparo registra a versão como aplicada; não executa novamente seu SQL. Repita somente para versões comprovadamente aplicadas e ausentes do histórico. Não marcar todas por suposição, não resetar banco com dados e não renomear migrações existentes para contornar o erro. Depois confira as pendentes e reexecute o check. O reparo precisa ser no banco que apresentou o erro (produção e branches podem ter históricos distintos), sem senhas ou tokens no repositório. Alternativa operacional: manter migrações manuais e desativar a aplicação automática de migrações na integração, sem desativar o deploy do site no Netlify.

Execute como postgres no SQL Editor, uma vez e em ordem:

1. [001_projects.sql](supabase/migrations/001_projects.sql): formulário e autorização original.
2. [002_contact_followup.sql](supabase/migrations/002_contact_followup.sql): acompanhamento e histórico.
3. [003_producer_schedule.sql](supabase/migrations/003_producer_schedule.sql): agenda e conflito de horários.
4. [004_manual_finance.sql](supabase/migrations/004_manual_finance.sql): contratos, lançamentos e indicadores.
5. [005_producer_queries.sql](supabase/migrations/005_producer_queries.sql): projeções pequenas, detalhe agrupado, consultas da agenda e recuperação corrigida.
6. [006_finance_completion.sql](supabase/migrations/006_finance_completion.sql): conclusão financeira, busca de pedidos abertos e bloqueio de alterações após conclusão.
7. [007_finance_month_details.sql](supabase/migrations/007_finance_month_details.sql): total e lista privada dos lançamentos do mês.
8. [008_submission_privacy.sql](supabase/migrations/008_submission_privacy.sql): envio atômico, publicidade opcional, revogação e exclusão de incompletos das listas comerciais.
9. [009_whatsapp_validation.sql](supabase/migrations/009_whatsapp_validation.sql): DDD brasileiro, número com 8/9 dígitos e tamanhos internacionais por código do país.
10. [010_optional_beat_type.sql](supabase/migrations/010_optional_beat_type.sql): permite selecionar beat sem exigir tipo; mantém respostas históricas.
11. [011_mix_by_nam_privacy_text.sql](supabase/migrations/011_mix_by_nam_privacy_text.sql): marca Mix By Nam nos novos registros, com nova versão do texto de publicidade e aviso de privacidade.

**Se 001–010 já foram aplicadas, execute somente 011.** Se está em 009, aplique 010 → 011. Se está em 008, aplique 009 → 010 → 011. Não reaplique as anteriores. Faça backup antes de atualizar um ambiente com dados e publique a interface nova após aplicar suas migrações.

Em Authentication, mantenha e-mail/senha ativo, cadastro público e login anônimo desabilitados. Crie o produtor em Users → Add user → Create new user, com Auto Confirm User, sem convite por e-mail. Execute [configure_master.sql](supabase/setup/configure_master.sql), substituindo o placeholder pelo e-mail da conta criada. O script mantém um único UUID em `private.producer`; não concede papel administrativo do Supabase. Outra conta, mesmo autenticada, não recebe os dados.

Recuperação de senha é administrativa pelo Dashboard; não há envio automático de e-mail. Nenhuma senha de exemplo real deve entrar no repositório.

## Recuperação e atendimento

`projects.updated_at` representa a última atualização confirmada do artista. Alterações de atendimento, sessões ou financeiro não modificam esse relógio. Situação comercial e histórico são separados das respostas.

Retomar contato agora inclui **somente solicitações enviadas** sem atendimento e ações vencidas. A recuperação comercial de formulários incompletos foi desativada por esta revisão de privacidade. O parâmetro antigo de 24 horas permanece apenas para compatibilidade da assinatura de RPC; não inclui contatos incompletos.

**Fechado, Perdido e Não contatar ficam fora de Retomar contato e Sem atendimento.** Histórico é preservado. Compromissos de produção de clientes fechados devem ser acompanhados na agenda. Não contatar também bloqueia WhatsApp e novo registro de contato.

Situações: Novo, Em contato, Proposta enviada, Fechado, Perdido, Não contatar. Formulário concluído não significa venda fechada, sessão realizada ou pagamento recebido. Notas e cliques não comprovam contato. Próxima ação e data de retorno são preenchidas juntas; contato manual não apaga a ação automaticamente. Revisão protege alterações de outra janela. UUID de operação impede duplicação por retry.

Antes do envio, respostas ficam só em memória: voltar preserva respostas, mas fechar ou recarregar perde o rascunho. Nenhum nome/telefone/resposta é gravado em sessionStorage, localStorage ou no banco nesse período. Após confirmação do envio, sessionStorage guarda somente UUID e segredo para reabrir a confirmação e revogar publicidade na mesma aba. Sem essa chave, o titular solicita cancelamento pelo canal da política; o produtor registra a revogação no painel. Identificador público não é credencial e a chave secreta não aparece em WhatsApp ou exportações.

## Agenda e cache

Instantes são `timestamptz`, exibidos/interpretados em America/Sao_Paulo. Semana começa segunda. O calendário mensal respeita fevereiro, anos bissextos e virada de ano; sessão entre dias aparece em ambos. Ponto indica sessão ativa, C indica cancelada. Selecionar um dia abre a visão diária.

A constraint PostgreSQL `producer_sessions_no_overlap`, GiST sobre `[início,fim)`, bloqueia conflitos inclusive em transações simultâneas. Fim deve ser posterior ao início, datas infinitas são rejeitadas e 10h–11h / 11h–12h são permitidos. Cancelar mantém o registro, liberando o intervalo; reativação passa pela mesma validação. Versão protege edições concorrentes. O produtor agenda manualmente.

Cache **somente em memória**, máximo inicial de 60s após resposta, com deduplicação de chamadas em voo. Erros não são armazenados como resultados. Cache é limpo ao sair/trocar usuário e invalidado por alterações. Não há polling de dados nem promessa de tempo real; telas mostram horário da consulta e uma atualização manual por contexto. Renovação do token mantém estado e rascunhos.

Apenas a aba ativa consulta dados. Abas já visitadas preservam estado, mas não fazem leituras em segundo plano. Na agenda, cache é por mês completo: dia e semana reutilizam esses dados. Semana atravessando dois meses carrega os meses ausentes numa consulta de intervalo; sessões são deduplicadas pelo UUID. Não há consulta por dia do calendário. Alterar/cancelar sessão invalida agenda e indicadores de sessões.

Listas de contatos trazem campos pequenos. O atendimento agrupa respostas, acompanhamento e primeira página do histórico em uma chamada. Salvamento devolve acompanhamento/evento para atualizar a tela sem três releituras. Busca de artista é explícita pelo botão, nunca por tecla/cartão.

## Financeiro e significado dos indicadores

A interface mostra apenas **Faturado no mês**: recebimentos menos estornos no mês selecionado. O vencimento e o motivo do contrato foram retirados do formulário; o histórico recebe uma descrição padrão de registro ou atualização pelo produtor. As definições abaixo documentam também os campos mantidos na RPC.

Abaixo do total, cada lançamento aparece como **+ R$ 1.500,00 — Pedido Nam (ID curto)**; estornos usam sinal negativo e a indicação “estorno”. O mês segue a data do pagamento em Brasília, inclusive em pedidos concluídos no financeiro. A lista mostra 20 lançamentos por página, com “Mais lançamentos” quando necessário; o total sempre considera o mês inteiro. Só o produtor autorizado consulta a lista, junto com o total numa única RPC.

Depois de salvar o contrato, **Concluir pedido** pede confirmação e informa eventual saldo pendente. A conclusão financeira não marca pagamento, não altera respostas do artista ou situação comercial. Registra data/autor, acrescenta histórico e retira o projeto da busca desta aba; buscas de agenda e contatos continuam disponíveis. O banco bloqueia novos ajustes, recebimentos e estornos, inclusive com uma tela antiga aberta. Não há reabertura nesta versão. Concluir com saldo pendente não o apaga. O faturamento e o backup JSON preservam contratos, lançamentos e a conclusão.

O produtor informa o valor real combinado, **sem inferir pelo orçamento do formulário ou pela situação Fechado**. Data de contratação é obrigatória e não pode ser futura. Vencimento é opcional; sem data o saldo não entra em vencido. Valor por contrato/lançamento: 1 até 1.000.000.000.000 centavos. Centavos inteiros são armazenados em bigint; valores agregados retornam texto, formatado com BigInt no navegador, sem arredondamento binário.

Recebimentos positivos têm data/hora efetiva do pagamento, forma e observação opcional; datas futuras são rejeitadas. Estorno positivo referencia um recebimento, exige motivo e respeita seu restante disponível. Lançamentos não são editados ou apagados pela API. Para corrigir recebimento, registre estorno com motivo e um recebimento correto. Contratos podem ser ajustados com motivo e revisão; cada versão fica no histórico. Registro guarda também horário e autor da inclusão.

As RPCs serializam pelo projeto e contrato, conferindo saldo depois do lock. Recebimento não pode deixar líquido acima do contrato; estorno não pode exceder o recebimento original nem o líquido disponível. Redução de contrato abaixo do líquido é rejeitada. IDs de operação garantem idempotência. Não há gateway, API de pagamento ou envio automático.

O snapshot é calculado no banco em uma consulta consistente, com `queried_at`. Não são baixados todos os pagamentos para calcular cartões. Carregamento, ausência e erro são estados distintos; consulta que falha oculta indicadores e mostra erro, sem zeros substitutos.

| Indicador | Definição / período |
| --- | --- |
| Recebido no mês | Entradas menos estornos cuja **data efetiva informada** (`occurred_at`) cai no mês selecionado em Brasília. Pode ser negativo. Não representa lucro. |
| Contratado no mês | Soma dos contratos com `contracted_on` no mês selecionado, segundo os valores atuais; ajustes permanecem auditáveis. |
| Saldo a receber | Todos os contratos, na consulta: contratado menos recebimentos líquidos de estornos. |
| Saldo vencido | Saldo positivo de todos os contratos com vencimento **anterior ao dia atual de Brasília**; vencimento hoje ainda não é vencido. |
| Pedidos no mês | Pedidos criados no mês em Brasília, inclusive incompletos. Conta pedidos, não artistas únicos. |
| Retornos pendentes | Todas as ações vencidas até a consulta em situações comerciais abertas; exclui Fechado, Perdido e Não contatar. |
| Sessões agendadas | Reservadas/confirmadas com **início** no mês selecionado. Exclui realizadas e canceladas. |
| Sessões realizadas | Status realizada, com início no mês selecionado. |

Meses usam limites `[início, próximo mês)` no fuso America/Sao_Paulo. Saldos e retornos são globais, não filtrados pelo mês. Taxas e despesas não estão incluídas; nenhum número é apresentado como lucro.

Índices novos correspondem aos filtros reais: projeto/data para histórico, recebimento original para estornos, data efetiva para meses, contratação para meses e vencimento para saldo vencido. Os planos locais de fixture pequena podem usar varredura sequencial; não há afirmação de ganho de tempo SQL sem medir ambiente representativo.

## Acesso e exportação

RLS e privilégios protegem projetos, acompanhamento, histórico, sessões, contratos e lançamentos. Visitantes não leem essas tabelas; outra conta autenticada recebe zero linhas. Escrita direta é negada inclusive ao produtor; RPCs exigem o único UUID autorizado, validam entradas e usam search_path vazio. Schema privado não é exposto. As operações públicas do formulário não acessam dados comerciais/financeiros ou agenda. Nenhuma chave administrativa fica no navegador.

Em Contatos → Exportar, JSON **v3** inclui `projects`, `contact_tracking`, `contact_history`, `producer_sessions`, `project_contracts`, `contract_history`, `finance_entries`, com versão, horário, fuso e `backup_scope: application_records_only`. CSV preserva respostas dos pedidos e neutraliza fórmulas. Todas as coleções são paginadas; falha impede baixar arquivo incompleto.

Exportação não é snapshot transacional e **não substitui backup completo de banco/Auth**. Não contém usuários do Auth nem segredos de retomada. Evite exportar durante muitas alterações. Restauração é administrativa e deve ser validada em projeto separado. Exclusão administrativa de projeto remove dados associados por cascade; confira sessões e financeiro e faça backup antes de qualquer exclusão.

Guarde arquivos fora do repositório, em diretório protegido, preferencialmente com cópia criptografada. `.gitignore` exclui `.env*` (exceto exemplo), exports, backups, CSV, dumps, logs, builds e resultados de teste. JSON de clientes deve ficar somente em diretórios ignorados, nunca junto do código. Não versionar credenciais.

## Netlify Free e limites

No Netlify Free, importe repositório com `package-lock.json`. `netlify.toml` usa `npm run build`, `.next` e Node 22; adaptador Next.js/OpenNext é detectado. Cadastre somente as quatro variáveis públicas também no escopo Builds. Escolha subdomínio gratuito `nome-do-site.netlify.app`. Mudanças em NEXT_PUBLIC exigem rebuild. Não configurar MIXBYNAM_E2E na hospedagem; `.next-e2e` é exclusivo dos testes. Não habilitar Netlify Forms, recarga ou teste de plano pago.

Referências de limites consultadas na configuração inicial em 14/10/2026; verificar novamente antes da publicação:

- [Netlify Free](https://www.netlify.com/pricing/): 300 créditos/mês compartilhados entre deploy, tráfego e computação; pode pausar ao esgotar. Contas legadas podem ter outro limite. [Créditos](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/).
- [Supabase Free](https://supabase.com/pricing): banco de 500 MB. Projetos de baixa atividade podem pausar após sete dias. [Pausa](https://supabase.com/docs/guides/platform/free-project-pausing). Monitorar quotas pelo Dashboard, sem tráfego artificial.
- [Next.js no Netlify](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/). Páginas são estáticas; dados vêm do Supabase. Arquivos musicais continuam externos; não há upload.

Nenhuma mensalidade de infraestrutura é necessária dentro das quotas, sem promessa de capacidade ilimitada/SLA. Publicação e validação remota desta versão permanecem pendentes; configuração local não autoriza testes em produção.

## Testes e medição

```sh
npm run typecheck
npm test
npm run test:e2e
npm run test:e2e:producer
npm run build
```

Windows usa Edge instalado; em outro ambiente, `npx playwright install chromium` ou PLAYWRIGHT_CHANNEL adequado. Execute as suítes de navegador em sequência: porta 3100 e `.next-e2e`. Testes antigos foram preservados, com seletores ajustados aos novos textos/menus.

PGlite executa migrações reais, mas serializa transações. Promise.all local não prova duas conexões PostgreSQL reais. Auth/HTTP dos testes privados são dublês, domínio .invalid; chamadas a domínios reais Supabase são bloqueadas pela fixture. Isso não comprova Auth/PostgREST remoto.

A medição `test:measure` usa **build de produção local**, backend isolado e cenários idênticos. No PowerShell, configure temporariamente as variáveis públicas para domínio/chave de teste (.invalid / sb_publishable_TEST_ONLY), faça build e rode `npm run test:measure`. Use MIXBYNAM_MEASUREMENT_LABEL para nomear resultado em `.tools/measurements`. Não alterar `.env.local`; ao terminar remova essas variáveis do terminal ou abra outro terminal e refaça build com a configuração normal. Nunca executar teste sobre produção. Resultados medidos estão em VERIFICACAO.md; bytes são corpos JSON, não tráfego comprimido com cabeçalhos. Não foi medida conversão de visitantes ou latência real do Supabase.

### Integração remota separada

Crie outro Supabase Free, aplique 001→010, crie produtor e outra conta confirmados e autorize somente o produtor. Preencha `.env.test.local` com URL/chave e credenciais **de teste**, com TEST_CONFIRM_ISOLATED_PROJECT=yes. O teste recusa hostname do `.env.local` e verifica autorização antes de escrever.

```sh
npm run test:integration
```

A suíte cobre API, concorrência de salvamento/agenda e duas conexões criando recebimentos ou estornos concorrentes, com limites no banco. Não usa service_role nem exclui automaticamente. UUIDs dos projetos fictícios são apresentados para limpeza administrativa, somente no projeto de teste. Sem ambiente dedicado configurado, permanece pendente.

## Roteiro manual de aceite em projeto de teste

1. Aplicar migrações, criar master e outra conta. Conferir bloqueio no painel e chamadas diretas às tabelas/RPCs com visitante/outro usuário.
2. No celular 320/390 e desktop, preencher etapas, voltar, provocar falha e tentar novamente. Confirmar um único registro e confirmação somente após sucesso. Resumo/ID ficam acessíveis; WhatsApp não envia automaticamente.
3. Antes do envio, conferir zero gravações/requisições de dados ao avançar etapas ou mudar publicidade; recarregar e confirmar perda do rascunho. Enviar com publicidade marcada e desmarcada; conferir escolha, texto/versão/hora do banco. Cancelar pela confirmação e pelo painel. Registros incompletos legados devem ficar fora das listas e do atendimento comercial.
4. Abrir WhatsApp e registrar nota não comprovam contato. Confirmar manualmente e consultar histórico paginado. Formulário concluído é separado de fechamento/venda/produção.
5. Agenda mensal: fevereiro 28/29, meses de 30/31, dezembro/janeiro e sessão entre dias. Escolher dia, editar, cancelar; 10h–11h/11h–12h aceitos, 10h30–11h30 rejeitado. Validar concorrência e versão antiga em duas conexões.
6. Contrato 100,01 com data explícita, recebimento 33,33 e estorno 0,33: líquido 33,00, saldo 67,01. Não preencher preço a partir do orçamento. Provar que fechado/concluído não gera pagamento.
7. Testar recebimento excessivo, estorno excessivo, redução do contrato abaixo do recebido, retries e concorrência entre conexões. Conferir histórico e motivos, inclusive correções de data/forma por estorno e novo registro.
8. Mês em Brasília: testar 02:59:59Z e 03:00:00Z no primeiro dia de mês sem horário de verão. Conferir vencido com data anterior a hoje, sem considerar vencimento hoje. Ver significado de cada indicador.
9. Testar carregamento, vazio e falha; falha não mostra zero no lugar do resultado. Renovação de token e alternância de abas preservam rascunhos. Verificar TTL, atualização manual, invalidação e limpeza após logout/troca de usuário. Não anunciar tempo real.
10. Exportar JSON v3, conferir as sete coleções, relações e lançamentos. Guardar fora do Git. Após aceite remoto, publicar no Netlify Free e testar endereço público.

Links de entrega de áudio continuam para próxima implementação, sempre externos. Não há integração paga, gateway ou automação de mensagens.

## Playlist na página pública

O centro verde do disco é um botão **PLAY/PAUSAR**, com indicação de playlist no Spotify. O primeiro clique carrega a iFrame API oficial e solicita reprodução; cliques seguintes controlam pausa e retomada. As ondas são uma animação visual ligada aos eventos reais de reprodução, parada durante pausa, carregamento ou fim; respeitam redução de movimento. Não são um analisador de frequências do áudio. O player mantém controles oficiais e link direto. Alguns navegadores exigem um toque adicional no play do Spotify; o site informa isso e não simula música tocando. Sem SDK Premium, chave de API, reprodução ao abrir a página ou alteração no banco. Referência: https://developer.spotify.com/documentation/embeds/references/iframe-api

## Validação do WhatsApp

Brasil: DDD existente + número de 8 dígitos, ou 9 dígitos iniciados por 9. Máscara (11) 9999-9999 / (11) 99999-9999; digitação limitada a 11 dígitos. A opção Outro país exige código internacional e ajusta o limite conforme esse código, até 15 dígitos. O +1 exige também código de área. Novos envios guardam +código-país+número, sem pontuação, evitando confundir números internacionais com nacionais na abertura do WhatsApp. Não acrescentamos o nono dígito a números de 8 dígitos; é a compatibilidade solicitada, não confirmação de existência da linha ou conta WhatsApp. [Plano brasileiro — Anatel](https://www.gov.br/anatel/pt-br/regulado/numeracao/plano-de-numeracao-brasileiro).

Dependência gratuita libphonenumber-js/min, fixada no lockfile, justificada para interpretar e validar comprimentos internacionais localmente, sem API externa. A migração 009 contém a mesma referência de comprimentos em tabela privada e protege chamadas diretas. Metadados não provam posse/conta ativa. Atualizações futuras precisam manter biblioteca e regras do banco sincronizadas por nova migração; não sobrescrever migrações aplicadas. Dados anteriores não são reescritos; links continuam aceitando números nacionais legados.

## Opções atuais de serviços

O formulário oferece seis opções; a última é Autotune e/ou Discotecagem (som ao vivo). Suporte ao vivo não é uma opção separada. A pergunta Como você quer seu beat? foi removida. Selecionar beat não exige tipo nem atribui pronto/exclusivo/sob encomenda automaticamente. O campo histórico beat_type continua disponível em pedidos antigos e exportações, mas novos envios do site usam vazio. A migração 010 torna esse vazio válido no banco; aplicar antes de divulgar a interface atual.
