# Verificação — clareza, consultas, agenda mensal e financeiro

Data da execução: 14/10/2026. Resultados desta versão; não são herdados de outra execução.

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
