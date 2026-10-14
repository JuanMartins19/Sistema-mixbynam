# Verificação — clareza, consultas, agenda mensal e financeiro

Data da execução: 14/10/2026. Resultados desta versão; não são herdados de outra execução.

## Atualização: marca Mix By Nam

Textos atuais do formulário, publicidade e política usam Mix By Nam. Nova migração 011 após 010 atualiza somente o texto dos novos envios: marketing-v2 e privacy-v3. Escolhas e textos antigos permanecem preservados. TypeScript e sete testes de project.test.ts passaram, incluindo o texto novo no banco isolado e a preservação da marca original no registro anterior. Sem novo build, Playwright, aplicação remota ou deploy nesta alteração.

## Atualização: beat sem pergunta de tipo

Pergunta removida do formulário. Novos envios não exigem nem presumem tipo de beat; enviam beat_type vazio. Migração nova 010 após 009 permite esse vazio sem apagar tipos históricos. Seleção do serviço beat permanece.

Sete testes de project.test.ts passaram, incluindo submissão real no PostgreSQL isolado com beat e tipo vazio. Dois cenários Playwright de envio passaram em desktop/celular, com beat selecionado e confirmação de ausência da pergunta, sucesso e recebimento no painel. TypeScript passou. Não foi executado novo build, suíte completa ou integração remota nesta alteração. Nenhuma migração foi aplicada externamente.

## Atualização: limites do WhatsApp

Campo com Brasil/Outro país, máscara e limite de dígitos. Brasil exige DDD existente e 8 dígitos, ou 9 iniciados por 9; a aceitação de oito dígitos preserva o pedido de compatibilidade, sem acrescentar dígito automaticamente. Internacional exige código de país e comprimento possível por esse código; +1 exige código de área. Limites locais e tabela privada da migração 009 derivam de libphonenumber-js 1.13.15, sem consulta externa por digitação. Normalização guarda +código+número; links não acrescentam +55 a internacionais de dez/onze dígitos. Não comprova conta WhatsApp ou posse da linha.

- A suíte completa passou com **68 testes**, zero falhas. Após o ajuste final do limite por código e da regra +1, os **três testes de telefone** foram reexecutados e passaram: Brasil 8/9, DDD inválido, excesso, letras, EUA/Portugal/Reino Unido/Islândia, links e validação real PostgreSQL em chamadas diretas.
- TypeScript passou. `test:e2e`: **5 testes passaram**, incluindo digitação/paste limitada, validação nacional/internacional, formulário e layouts 320/390/1440.
- `test:e2e:producer -- --grep privacidade`: **3 testes passaram** com 001→009: ausência de gravação antes de enviar e sucesso no envio com/sem publicidade no banco isolado. Os outros cinco cenários privados não foram reexecutados nesta atualização; o resultado anterior está abaixo.
- `npm run build` passou, incluindo TypeScript e geração das páginas. Integração externa continua pendente; nenhum dado real, migração remota ou deploy foi alterado.

Ativação: aplicar somente 009 depois de 008, atualizar a interface e conferir os dois formatos brasileiros e um telefone internacional no projeto de teste. Nenhum registro existente é reescrito.

## Revisão atual: privacidade e envio sem coleta parcial

Esta revisão substitui o fluxo de salvamento parcial documentado nas entregas anteriores abaixo. Antes de Enviar pedido, respostas ficam apenas em memória; não há gravação no banco nem armazenamento das respostas no navegador. Após sucesso, apenas a credencial de confirmação fica em sessionStorage.

- `npm test`: **65 testes passaram**, zero falhas. As verificações antigas de 001/002 continuam validando versões históricas; `privacy.test.ts` aplica 001→008 e verifica o comportamento novo: coleta parcial bloqueada, legado fora de SELECT/listas/histórico comercial, entrada inválida sem registros parciais, publicidade marcada/desmarcada, auditoria, idempotência, mesmo telefone em projetos distintos, revogação por artista/produtor e RLS.
- `npm run typecheck`: passou, sem erros. `npm run build`: passou, incluindo a página estática `/privacidade`.
- `npm run test:e2e`: **4 testes passaram**, Edge headless, validação/retry sem configuração e sem sucesso fictício, layouts 320/390/1440 e playlist.
- `npm run test:e2e:producer`: **8 testes passaram numa execução conjunta**, banco PGlite/HTTP/Auth isolados: abandono sem requisições ou armazenamento, envio com/sem publicidade, link real da política, revogação e recebimento no painel; atendimento, exportações, cache/token, agenda e financeiro preservados. A primeira execução encontrou um seletor ambíguo entre os dois links da política; foi restrito ao formulário e a suíte completa passou novamente.
- Não houve mensagens/campanhas automáticas, novas dependências, gravação externa, aplicação de migração remota ou deploy. Falhas de configuração e conflitos deliberados nos testes não indicam envio real ou sucesso remoto. O teste externo foi adaptado para submit_project e revogação, mas permanece **não executado**, sem projeto de teste configurado.

Arquivos principais: `project-form.tsx`, `project.ts`, `supabase.ts`, `contact-followup.tsx`, `producer-contacts.tsx`, `export.ts`, `layout.tsx`, `evolution.css`; novos `src/app/privacidade/page.tsx`, `008_submission_privacy.sql` e `tests/privacy.test.ts`. Fixtures, verificações de formulário e integração foram ajustadas. A migração inicial não foi alterada.

Textos: consentimento obrigatório de atendimento removido; aviso informativo solicitado para Beatz By Nam perto do envio; publicidade opcional com o texto integral solicitado. Identidade visual/campos/validações e quatro etapas mantidos. Dados de publicidade são colunas separadas das respostas, com escolha, texto/versão, hora do banco e revogação; legado não é interpretado como autorização de marketing.

Informações fornecidas pelo proprietário: Renan Cubinhetz Guido Silva, mixbynam@gmail.com, prazo de cinco anos. Pendências: revisão jurídica das bases legais e retenção por finalidade; rotina administrativa de exclusão e tratamento de backups; revisão e eliminação ou justificativa de conservação dos incompletos antigos. A migração os bloqueia para atendimento/comercialização, mas **não os apaga** nem exclui backups já baixados. Não há garantia de conformidade jurídica integral.

Aceite externo: aplicar somente 008 depois de 007 num banco de teste, com backup administrativo; avançar três etapas e conferir ausência de requisições/registros; fechar a aba e conferir ausência no painel; enviar com e sem marketing, verificar registro único e auditoria; revogar pela confirmação e pelo produtor; conferir bloqueio de visitante/outra conta; testar agenda/financeiro/exportação; conferir política e layouts. Só então aplicar no ambiente definitivo e publicar a interface correspondente. Instâncias antigas que continuem chamando save_project ficam bloqueadas.

## Atualização: lançamentos abaixo do total mensal

Migração 007 após 006. A lista mensal usa valores reais, artista e ID curto; pagamentos positivos e estornos negativos, com paginação de 20 itens. Inclui pedidos financeiramente concluídos. Total e página vêm numa RPC privada, com mês em Brasília; não calcula total apenas da página.

TypeScript e 57 testes locais passaram novamente. O teste de banco verifica identificação/valor, mês vazio, offset e acesso bloqueado de visitante/outra conta, inclusive após conclusão. Playwright financeiro móvel passou, verificando `+ R$ 33,33 — Pedido Teste` e `− R$ 0,33 — Pedido Teste` com total R$ 33,00. Sem novo build ou validação remota nesta atualização. Aplicar 007 no Supabase de teste, conferir mês/lançamentos e depois publicar; não reaplicar 001–006.

## Atualização: conclusão financeira

- Migração nova `006_finance_completion.sql`, após 005; não reaplicar anteriores.
- `npm test`: 57 testes passaram, zero falhas. O novo teste verifica acesso privado, revisão, conclusão idempotente, remoção apenas da busca financeira, bloqueio de ajustes/pagamentos/estornos e preservação de faturamento e respostas do artista.
- TypeScript passou. Playwright financeiro móvel passou: confirma conclusão, consulta novamente e verifica que o pedido não aparece na busca financeira. Banco PGlite isolado e Auth/HTTP de teste; nenhuma escrita em produção.
- O bloqueio e a conclusão usam a mesma ordem de locks das RPCs financeiras. Concorrência em duas conexões PostgreSQL remotas ainda precisa de validação num projeto separado.
- Não executei novo build nesta atualização. Os resultados de build abaixo pertencem à entrega anterior.
- Aceite manual: aplicar 006 em teste, salvar contrato, concluir com confirmação, buscar o mesmo artista/ID no financeiro e conferir ausência; verificar contatos/agenda e backup, que preservam o projeto. Uma janela antiga deve receber erro ao tentar alterar o financeiro concluído. Conclusão com saldo pendente não significa quitação.

## Executado neste ambiente

- `npm test`: **56 verificações passaram, zero falhas**, incluindo as 40 anteriores. PostgreSQL isolado PGlite executou as migrações 001→005.
- `npm run test:e2e`: **3 testes passaram**, Edge headless, servidor de desenvolvimento isolado: formulário/validação/retry sem confirmação falsa; acesso público sem dados; layouts 320/390/1440 px.
- `npm run test:e2e:producer`: os **cinco cenários privados foram aprovados** em desenvolvimento. Quatro passaram na execução conjunta; o cenário desktop foi corrigido para solicitar explicitamente sua fixture e reexecutado com sucesso. Cobertura: atendimento manual, fila, backup v3, agenda/conflito/cancelamento, mensal, financeiro móvel em 320 px, erro sem zeros, carregamento/vazio, controles úteis, renovação de token e rascunhos preservados.
- Build de produção com configuração de teste passou para medição. O build normal final passou, restabelecendo configuração local em .next. TypeScript passou novamente após esse build, sem erros, incluindo o script de planos.
- Medição antes/depois passou em **produção local** com Next start e backend PGlite + dublê de Auth/HTTP. Não é medição de Supabase remoto.
- `scripts/inspect-test-plans.ts` executado em fixture PGlite com 2.000 lançamentos de 1 centavo: os filtros mensal e de estorno escolheram Index Scan. [Planos](docs/query-plans.txt).
- Nenhum serviço/dependência paga foi adicionado. Não houve auditoria npm nesta atualização; não é afirmada ausência de vulnerabilidades com base em outra execução.

O Windows requer execução fora da sandbox para processos de testes/build. Falhas intermediárias foram corrigidas: anotação de UUID no teste, seletores antigos dos textos/cancelamento, substituições com acentos no pipe do PowerShell e fixture desktop que não era solicitada. Mensagens de erro `TEST_FAILURE`, configuração ausente e `23P01` nos logs pertencem a cenários deliberados de falha/conflito; não foram expostas credenciais.

## Medições antes/depois

Build otimizado local, navegador Edge, um pedido concluído e uma sessão no dia. Sessão nova por execução, IDs com mesmo tamanho. Os quatro trechos usam as mesmas ações. Contabiliza REST do Supabase no teste; exclui Auth, assets, cabeçalhos, compressão e protocolo. Não mede latência/SLA, conversão de visitantes nem carga representativa.

| Trecho | Chamadas antes → depois | Bytes de resposta JSON antes → depois |
| --- | --- | --- |
| Login e lista inicial | 3 → 2 | 932 → 284 |
| Abrir atendimento | 2 → 1 | 4 → 958 |
| Salvar acompanhamento | 4 → 1 | 1.841 → 624 |
| Voltar à agenda já consultada | 1 → 0 | 1.224 → 0 |
| Soma dos quatro trechos | 10 → 4 | 4.001 → 1.866 |

Login fazia duas chamadas is_producer; depois fez uma. Abrir atendimento antes baixava apenas acompanhamento/histórico (as respostas completas já vinham na lista); depois baixa respostas sob demanda e histórico agrupado, por isso esse trecho cresce em bytes. Salvar depois recebe tracking/evento na própria escrita, sem três releituras. A volta à agenda dentro do TTL usa memória. A primeira visita à agenda e a navegação intermediária de volta aos contatos não fazem parte da soma; a medição de retorno não equivale ao custo total de toda a navegação.

Corpos de requisição dos quatro trechos: 339 → 316 bytes. Um único cenário/execução por versão; pequenas diferenças de timestamps podem alterar bytes. [Dados da medição](docs/performance.json) contêm apenas contagens, caminhos de endpoints e descrição da fixture, sem respostas de clientes ou credenciais. Não há afirmação de melhora de conversão ou desempenho remoto.

## Dados, saldos e segurança verificados

- Contrato não é inferido do orçamento, conclusão ou Fechado. Sem contrato, recebimento é rejeitado.
- Valores inteiros: contrato 100,01, recebimento 33,33 e estorno 0,33 resultam em líquido 33,00/saldo 67,01. Parser rejeita terceira casa decimal e valores fora do limite.
- Retry de contrato/lançamento preserva um registro. Histórico mantém motivo e versão; revisão antiga é rejeitada.
- Estorno respeita recebimento original e líquido. Recebimento não ultrapassa contrato; redução abaixo do líquido é bloqueada.
- Dois Promise.all locais para recebimento/estorno deixam apenas uma operação quando ambas excederiam o limite. PGlite serializa: **não comprova duas conexões reais concorrentes**.
- Virada mensal em Brasília: 02:59:59Z e 03:00:00Z pertencem a meses diferentes no caso sem DST testado. Estorno em mês posterior produz valor negativo naquele mês e não modifica a entrada histórica.
- Saldo vencido considera data anterior ao hoje local. Saldos são globais; indicadores mensais usam suas datas explícitas. Recebido não é apresentado como lucro; despesas/taxas ausentes são informadas.
- RLS/privilégios/RPCs negam financeiro e detalhes a visitante e outra conta. Escrita direta/DELETE de lançamentos é negada; operações públicas do artista preservadas.
- Fechado, Perdido e Não contatar são excluídos da recuperação, também na RPC legada. Histórico permanece.
- Calendário mensal cobre 28/29/30/31 dias, virada dezembro/janeiro e sessão entre dias. Bloqueio de sobreposição, consecutividade, cancelamento e versão de edição anteriores foram preservados e testados.
- Cache deduplica chamadas simultâneas, expira na borda de 60s, invalida, limpa por usuário/logout e rejeita resposta em voo de escopo anterior. Abas inativas não consultam; sem polling contínuo.
- Browser: uma is_producer no login; renovação simulada não apaga edição. Volta a período já consultado usa cache; mês não faz uma consulta por dia. Desktop e celular preservam rascunhos ao alternar abas.
- Carregamento/ausência/falha são distintos. Falha provocada de snapshot remove indicadores, sem substituir por zeros. Backup JSON v3 baixado contém contrato e os dois lançamentos, além dos domínios anteriores.

## Limites e pendências externas

Fixtures privadas têm autenticação/HTTP simulados e PostgreSQL real compilado para WASM. Não comprovam assinatura/renovação pelo Supabase Auth, transporte PostgREST, desempenho remoto ou hospedagem Netlify. Chamadas aos domínios reais Supabase são bloqueadas nesses testes. A aplicação continua persistindo somente no Supabase; nenhum backend fictício foi incluído no site.

Nenhuma migração/escrita foi feita no Supabase remoto nesta entrega. `.env.local` e o acesso master existentes foram preservados. Não há `.env.test.local` dedicado, portanto `test:integration` **não foi executado**. Foi ampliado para duas conexões autenticadas concorrentes criando pagamentos/estornos, além de agenda e formulário. Usa exclusivamente projeto separado, recusa hostname de `.env.local` e exige confirmação de isolamento.

Para aplicar num banco já com 001–003, executar **somente 004 → 005**, após backup e teste separado. Não reaplicar migrações existentes. Validar RLS direto, concorrência financeira real, períodos/fuso e JSON v3 no Supabase de teste. Publicação e aceite do endereço Netlify Free permanecem pendentes.

Veja [README — Roteiro manual de aceite](README.md#roteiro-manual-de-aceite-em-projeto-de-teste) e definições dos indicadores. Exportação da aplicação não substitui backup de banco/Auth. Arquivos musicais permanecem externos; links de entrega continuam para próxima implementação.

## Atualização: playlist Spotify

TypeScript e os três testes públicos Playwright passaram novamente, incluindo layouts 320/390/1440 px. O disco e as ondas foram preservados, com player oficial expansível e link direto. O teste de formulário não valida reprodução no serviço externo; conferir manualmente **Ouvir playlist** e a reprodução no Spotify. Sem migração ou novo build nesta alteração.

## Atualização: play no disco e ondas

Centro verde com PLAY/PAUSAR e indicação de playlist. Ondas seguem playback_update da iFrame API, não o clique; sem animação enquanto pausado ou carregando. TypeScript passou e os quatro testes públicos passaram, incluindo controle/pausa, falha externa e layout 320 px. O teste de reprodução usa dublê da API apenas no navegador de teste: não comprova áudio real nem desbloqueio de reprodução pelo navegador. Conferir manualmente a playlist no Spotify; se necessário, tocar no controle oficial abaixo. Sem novo build ou migração.
