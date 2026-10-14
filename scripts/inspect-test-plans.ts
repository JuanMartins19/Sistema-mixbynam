// Somente PostgreSQL isolado. Sem conexões externas ou credenciais.
import {testDatabase} from '../tests/helpers/database';
import {randomUUID} from 'node:crypto';
import {writeFile,mkdir} from 'node:fs/promises';
async function main(){
  const {db,project,role,producer}=await testDatabase(['001_projects.sql','002_contact_followup.sql','003_producer_schedule.sql','004_manual_finance.sql','005_producer_queries.sql']);
  try{
    const p=await project();await db.query('select public.save_project_contract($1,$2,10001,$3,null,0,$4)',[p.id,randomUUID(),'2020-01-01','Fixture para planos']);await role('admin');
    await db.query("insert into public.finance_entries(id,project_id,kind,amount_cents,occurred_at,method,reason,recorded_by) select gen_random_uuid(),$1,'receipt',1,timestamptz '2020-01-01'+n*interval '1 day','Pix','Fixture',$2 from generate_series(0,1999)n",[p.id,producer]);
    await db.exec('analyze public.finance_entries');
    const queries=["select sum(amount_cents) from public.finance_entries where occurred_at>=timestamptz '2020-02-01 03:00Z' and occurred_at<timestamptz '2020-03-01 03:00Z'","select sum(amount_cents) from public.finance_entries where refund_of='00000000-0000-0000-0000-000000000001'::uuid"];
    const parts=['Planos locais PGlite, fixture de 2.000 lançamentos de 1 centavo. Não são planos ou tempos do Supabase remoto.'];
    for(const q of queries){const r=await db.query<Record<string,string>>('explain '+q);parts.push(q,...r.rows.map(row=>String(row['QUERY PLAN'])));}
    await mkdir('docs',{recursive:true});await writeFile('docs/query-plans.txt',parts.join('\n')+'\n');
  }finally{await db.close();}
}
void main();
