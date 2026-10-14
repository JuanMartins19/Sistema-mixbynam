import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {testDatabase} from './helpers/database';
import {parseMoney,money} from '../src/lib/finance';
import {monthCells,agendaDays,overlapsDay,shiftMonth,type ProducerSession} from '../src/lib/schedule';
import {MemoryCache} from '../src/lib/cache';
const migrations=['001_projects.sql','002_contact_followup.sql','003_producer_schedule.sql','004_manual_finance.sql','005_producer_queries.sql','006_finance_completion.sql','007_finance_month_details.sql'];

test('conclusão financeira é privada, idempotente e bloqueia alterações sem apagar faturamento',async()=>{
  const {db,project,role}=await testDatabase(migrations);
  try{
    const p=await project(true),other=await project();
    await db.query("select public.save_project_contract($1,$2,10000,'2020-01-01',null,0,'Contrato de teste')",[p.id,randomUUID()]);
    const receipt=randomUUID();
    await db.query("select public.record_finance_entry($1,$2,'receipt',4000,'2020-01-02T15:00:00Z','Pix','',null)",[p.id,receipt]);
    const original=(await db.query('select * from public.projects where id=$1',[p.id])).rows[0];
    await assert.rejects(db.query('select public.complete_financial_project($1,0)',[p.id]),/outra janela/);
    for(const who of ['anon','other'] as const){
      await role(who);
      await assert.rejects(db.query('select public.complete_financial_project($1,1)',[p.id]),/permission denied|Acesso não autorizado/);
      await assert.rejects(db.query('select public.producer_find_financial_projects()'),/permission denied|Acesso não autorizado/);
      await assert.rejects(db.query("select public.finance_month_summary('2020-01-01')"),/permission denied|Acesso não autorizado/);
    }
    await role('producer');
    const first=(await db.query<{r:{finalized_at:string}}>('select public.complete_financial_project($1,1) as r',[p.id])).rows[0].r;
    const retry=(await db.query<{r:{finalized_at:string}}>('select public.complete_financial_project($1,1) as r',[p.id])).rows[0].r;
    assert.ok(first.finalized_at);assert.equal(first.finalized_at,retry.finalized_at);
    assert.equal((await db.query('select * from public.contract_history')).rows.length,2);
    const results=(await db.query<{r:{id:string}[]}>('select public.producer_find_financial_projects() as r')).rows[0].r;
    assert.deepEqual(results.map(r=>r.id),[other.id]);
    assert.equal((await db.query<{r:unknown[]}>('select public.producer_find_projects() as r')).rows[0].r.length,2);
    await assert.rejects(db.query("select public.save_project_contract($1,$2,11000,'2020-01-01',null,2,'Ajuste de teste')",[p.id,randomUUID()]),/financeiro concluído/);
    for(const kind of ['receipt','refund'])await assert.rejects(db.query("select public.record_finance_entry($1,$2,$3,100,'2020-01-03T15:00:00Z','Pix','Motivo do teste',$4)",[p.id,randomUUID(),kind,kind==='refund'?receipt:null]),/financeiro concluído/);
    // Retry de um lançamento confirmado continua seguro, sem nova escrita.
    await db.query("select public.record_finance_entry($1,$2,'receipt',4000,'2020-01-02T15:00:00Z','Pix','',null)",[p.id,receipt]);
    assert.equal((await db.query<{r:{received_cents:string}}>("select public.finance_snapshot('2020-01-01') as r")).rows[0].r.received_cents,'4000');
    const summary=(await db.query<{r:{received_cents:string;entries:{public_id:string;artist_name:string;amount_cents:string;kind:string}[]}}>("select public.finance_month_summary('2020-01-01') as r")).rows[0].r;
    assert.equal(summary.received_cents,'4000');assert.equal(summary.entries.length,1);
    assert.equal(summary.entries[0].artist_name,'Teste');assert.equal(summary.entries[0].amount_cents,'4000');assert.equal(summary.entries[0].kind,'receipt');
    assert.ok(summary.entries[0].public_id);
    assert.deepEqual((await db.query<{r:{entries:unknown[]}}>("select public.finance_month_summary('2020-02-01') as r")).rows[0].r.entries,[]);
    assert.deepEqual((await db.query<{r:{entries:unknown[]}}>("select public.finance_month_summary('2020-01-01',20) as r")).rows[0].r.entries,[]);
    assert.deepEqual((await db.query('select * from public.projects where id=$1',[p.id])).rows[0],original);
  }finally{await db.close();}
});
test('financeiro e consultas: valores reais, histórico, limites e acesso',async t=>{
  const {db,role,project}=await testDatabase(migrations);const p=await project(true);let receiptId:string;
  async function contract(value='10001',revision=0,op:string=randomUUID()){return (await db.query<{r:{revision:number}}>('select public.save_project_contract($1,$2,$3,$4,$5,$6,$7) as r',[p.id,op,value,'2020-01-31','2020-02-01',revision,'Contrato ou ajuste de teste'])).rows[0].r;}
  async function entry(value:string,kind='receipt',refund:string|null=null,id:string=randomUUID(),date='2020-02-01T02:59:59Z'){return (await db.query<{r:{id:string}}>('select public.record_finance_entry($1,$2,$3,$4,$5,$6,$7,$8) as r',[p.id,id,kind,value,date,'Pix',kind==='refund'?'Correção confirmada':'Recebimento conferido',refund])).rows[0].r;}
  const snapshot=async(month='2020-01-01')=>(await db.query<{r:Record<string,string|number>}>('select public.finance_snapshot($1) as r',[month])).rows[0].r;
  try{
    await t.test('sem contrato não há pagamento; pedido concluído não representa recebimento',async()=>{assert.equal((await snapshot()).received_cents,'0');await assert.rejects(entry('100'),/contrato/);});
    await t.test('contrato e retry têm histórico único e valor explícito',async()=>{const id=randomUUID();assert.equal((await contract('10001',0,id)).revision,1);assert.equal((await contract('10001',0,id)).revision,1);assert.equal((await db.query('select * from public.contract_history')).rows.length,1);assert.equal((await snapshot()).contracted_cents,'10001');});
    await t.test('centavos, recebimentos parciais e idempotência são exatos',async()=>{receiptId=randomUUID();await entry('3333','receipt',null,receiptId);await entry('3333','receipt',null,receiptId);assert.equal((await snapshot()).received_cents,'3333');assert.equal((await snapshot()).receivable_cents,'6668');});
    await t.test('estorno preserva entrada e usa data do lançamento no mês correto',async()=>{await entry('33','refund',receiptId,randomUUID(),'2020-02-01T03:00:00Z');assert.equal((await snapshot('2020-02-01')).received_cents,'-33');assert.equal((await snapshot()).receivable_cents,'6701');assert.equal((await snapshot()).overdue_cents,'6701');assert.equal((await db.query('select * from public.finance_entries')).rows.length,2);});
    await t.test('estorno excessivo, pagamento acima do contrato e redução abaixo do líquido falham',async()=>{await assert.rejects(entry('3301','refund',receiptId),/Estorno superior/);await assert.rejects(entry('6702'),/acima do valor/);await assert.rejects(contract('3299',1),/inferior ao recebido/);});
    await t.test('atualização contratual exige revisão e guarda motivo/histórico',async()=>{await contract('12000',1);await assert.rejects(contract('13000',1),/outra janela/);assert.equal((await db.query('select * from public.contract_history')).rows.length,2);});
    await t.test('chamadas financeiras simultâneas não ultrapassam saldo',async()=>{const outcomes=await Promise.allSettled([entry('8000'),entry('8000')]);assert.equal(outcomes.filter(o=>o.status==='fulfilled').length,1);assert.equal(outcomes.filter(o=>o.status==='rejected').length,1);assert.equal((await snapshot()).receivable_cents,'700');});
    await t.test('estornos simultâneos respeitam o recebimento original',async()=>{const results=await Promise.allSettled([entry('2000','refund',receiptId),entry('2000','refund',receiptId)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);});
    await t.test('recuperação exclui fechado, perdido e não contatar sem apagar histórico',async()=>{for(const [i,status] of ['won','lost','do_not_contact'].entries()){await db.query('select public.save_contact_tracking($1,$2,$3,$4,$5,$6)',[p.id,randomUUID(),status,'Retornar','2020-01-01T00:00:00Z',i]);const r=await db.query<{r:{rows:unknown[]}}>("select public.producer_contacts('recovery') as r");assert.equal(r.rows[0].r.rows.length,0);assert.equal((await db.query<{r:unknown[]}>("select public.list_producer_projects('recovery') as r")).rows[0].r.length,0);}assert.equal((await db.query('select * from public.contact_history')).rows.length,3);});
    await t.test('projeções pequenas e detalhe agrupado preservam respostas privadas',async()=>{const cards=(await db.query<{r:{rows:Record<string,unknown>[]}}>('select public.producer_contacts() as r')).rows[0].r.rows;assert.equal(cards[0].answers,undefined);assert.equal(cards[0].artist_name,'Teste');const detail=(await db.query<{r:{project:{answers:unknown};history:unknown[]}}> ('select public.producer_contact_detail($1) as r',[p.id])).rows[0].r;assert.ok(detail.project.answers);assert.equal(detail.history.length,3);});
    await t.test('vencimento hoje não é vencido; canceladas e realizadas não são agendadas',async()=>{
      const before=(await db.query<{at:string}>('select updated_at::text as at from public.projects where id=$1',[p.id])).rows[0].at;
      await db.query("select public.save_project_contract($1,$2,12000,'2020-01-31',(now() at time zone 'America/Sao_Paulo')::date,2,'Ajuste do vencimento')",[p.id,randomUUID()]);
      assert.equal((await snapshot()).overdue_cents,'0');
      for(const [i,status] of ['reserved','held','cancelled'].entries())await db.query('select public.save_producer_session($1,$2,$3,$4,$5,$6,$7,null)',[randomUUID(),p.id,'Gravação',`2020-01-10T${13+i}:00:00Z`,`2020-01-10T${14+i}:00:00Z`,'',status]);
      assert.equal((await snapshot()).scheduled_sessions,1);assert.equal((await snapshot()).held_sessions,1);
      assert.equal((await db.query<{at:string}>('select updated_at::text as at from public.projects where id=$1',[p.id])).rows[0].at,before);
    });
    await t.test('público e outra conta não acessam financeiro ou novas RPCs',async()=>{for(const who of ['anon','other'] as const){await role(who);for(const table of ['project_contracts','contract_history','finance_entries']){if(who==='anon')await assert.rejects(db.query('select * from public.'+table),/permission denied/);else assert.equal((await db.query('select * from public.'+table)).rows.length,0);await assert.rejects(db.query('delete from public.'+table),/permission denied/);}await assert.rejects(snapshot(),/permission denied|Acesso não autorizado/);await assert.rejects(entry('1'),/permission denied|Acesso não autorizado/);await assert.rejects(contract(),/permission denied|Acesso não autorizado/);await assert.rejects(db.query('select public.producer_contact_detail($1)',[p.id]),/permission denied|Acesso não autorizado/);}});
  }finally{await db.close();}
});
test('moeda usa centavos inteiros sem arredondamento',()=>{assert.equal(parseMoney('0,01'),'1');assert.equal(parseMoney('1.234,56'),'123456');assert.equal(parseMoney('12.30'),'1230');assert.equal(money('-33'),'-R$ 0,33');assert.throws(()=>parseMoney('1,005'));assert.throws(()=>parseMoney('0'));});
test('calendário mensal: fevereiro, virada de ano e intervalos entre dias',()=>{assert.equal(agendaDays('2024-02-01','month').length,29);assert.equal(agendaDays('2025-02-01','month').length,28);assert.equal(agendaDays('2025-04-01','month').length,30);assert.equal(agendaDays('2025-12-01','month').length,31);assert.equal(monthCells('2025-02-01').length%7,0);assert.equal(shiftMonth('2025-01-31',1),'2025-02-28');assert.equal(shiftMonth('2025-12-31',1),'2026-01-31');const s={starts_at:'2025-12-31T23:00:00-03:00',ends_at:'2026-01-01T01:00:00-03:00'} as ProducerSession;assert.equal(overlapsDay(s,'2025-12-31'),true);assert.equal(overlapsDay(s,'2026-01-01'),true);});
test('cache deduplica, expira em 60s, invalida e isola usuários inclusive em voo',async()=>{let now=0,count=0;const c=new MemoryCache(60000,()=>now);c.bind('a');const fetcher=async()=>++count;assert.deepEqual(await Promise.all([c.query('x',fetcher),c.query('x',fetcher)]),[1,1]);now=60000;assert.equal(await c.query('x',fetcher),2);c.invalidate('x');assert.equal(await c.query('x',fetcher),3);let resolve!:(v:number)=>void;const pending=c.query('slow',()=>new Promise<number>(r=>{resolve=r;}));await Promise.resolve();c.bind('b');resolve(99);await assert.rejects(pending,/invalidada/);assert.equal(c.peek('x'),undefined);assert.equal(await c.query('x',fetcher),4);c.bind(null);await assert.rejects(c.query('x',fetcher),/Sessão encerrada/);});
