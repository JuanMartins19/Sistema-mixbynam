import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {testDatabase} from './helpers/database';
import {initialAnswers} from '../src/lib/project';
const migrations=['001_projects.sql','002_contact_followup.sql','003_producer_schedule.sql','004_manual_finance.sql','005_producer_queries.sql','006_finance_completion.sql','007_finance_month_details.sql'];
const answers={...initialAnswers,artist_name:'Artista de teste',whatsapp:'11999999999',genre:'Rap',arrangement:'solo',services:['mixing'],no_references:true,needs_guidance:true,deadline:'Sem prazo definido'};
test('privacidade: envio atômico, publicidade opcional, revogação e bloqueio de legado',async t=>{
  const {db,project,role}=await testDatabase(migrations);
  try{
    const legacy=await project();await db.query("select public.record_contact_history($1,$2,'note','Nota legada')",[legacy.id,randomUUID()]);await role('admin');
    await db.exec(await readFile('supabase/migrations/008_submission_privacy.sql','utf8'));
    const ids:{id:string;token:string}[]=[];
    await t.test('coleta parcial antiga bloqueada, inclusive API direta',async()=>{
      await role('anon');await assert.rejects(db.query('select public.save_project($1,$2,1,$3)',[randomUUID(),randomBytes(32).toString('hex'),answers]),/permission denied/);
      await assert.rejects(db.query('select public.resume_project($1,$2)',[legacy.id,legacy.token]),/indisponível/);
      await role('producer');assert.equal((await db.query('select * from public.projects')).rows.length,0);
      const contacts=(await db.query<{r:{rows:unknown[]}}>('select public.producer_contacts() as r')).rows[0].r;assert.equal(contacts.rows.length,0);
      await assert.rejects(db.query('select public.producer_contact_detail($1)',[legacy.id]),/inexistente/);
      assert.equal((await db.query('select * from public.contact_history')).rows.length,0);
      assert.deepEqual((await db.query<{r:unknown[]}>('select public.producer_history($1) as r',[legacy.id])).rows[0].r,[]);
      await assert.rejects(db.query("select public.record_contact_history($1,$2,'contact','Contato indevido')",[legacy.id,randomUUID()]),/atendimento bloqueado/);
    });
    for(const marketing of [false,true])await t.test(`envio completo com publicidade ${marketing}`,async()=>{
      await role('anon');const id=randomUUID(),token=randomBytes(32).toString('hex');ids.push({id,token});
      const send=()=>db.query<{r:Record<string,unknown>}>('select public.submit_project($1,$2,$3,$4) as r',[id,token,answers,marketing]);
      const results=await Promise.all([send(),send(),send()]);const p=results[0].rows[0].r;
      assert.equal(p.status,'completed');assert.equal(p.progress,4);assert.equal(p.marketing_allowed,marketing);
      assert.ok(p.marketing_choice_at);assert.equal(!!p.marketing_consent_at,marketing);assert.ok(p.marketing_consent_text);assert.ok(p.marketing_consent_version);
      assert.equal(p.consent_at,null);assert.equal(p.consent_text,null);assert.equal((p.answers as Record<string,unknown>).consent,undefined);assert.equal((p.answers as Record<string,unknown>).marketing,undefined);
      await assert.rejects(db.query('select public.submit_project($1,$2,$3,$4)',[id,'a'.repeat(64),answers,marketing]),/indisponível/);
      await role('producer');assert.equal((await db.query('select * from public.projects where id=$1',[id])).rows.length,1);
      assert.equal((await db.query<{r:{project:{id:string}}}>('select public.producer_contact_detail($1) as r',[id])).rows[0].r.project.id,id);
    });
    await t.test('entrada inválida não deixa contato ou autorização parcial',async()=>{
      await role('anon');const id=randomUUID();await assert.rejects(db.query('select public.submit_project($1,$2,$3,true)',[id,randomBytes(32).toString('hex'),{...answers,deadline:''}]),/inválidos/);
      await role('admin');assert.equal((await db.query('select * from public.projects where id=$1',[id])).rows.length,0);assert.equal((await db.query('select * from private.project_keys where project_id=$1',[id])).rows.length,0);
    });
    await t.test('público e outra conta não leem respostas nem revogam sem segredo',async()=>{
      for(const who of ['anon','other'] as const){await role(who);if(who==='anon')await assert.rejects(db.query('select * from public.projects'),/permission denied/);else assert.equal((await db.query('select * from public.projects')).rows.length,0);await assert.rejects(db.query('select public.revoke_project_marketing($1,null)',[ids[1].id]),/indisponível/);}
    });
    await t.test('artista revoga sem conta; retry não reautoriza marketing',async()=>{
      const p=ids[1];await role('anon');await db.query('select public.revoke_project_marketing($1,$2)',[p.id,p.token]);
      const resumed=(await db.query<{r:{marketing_allowed:boolean;marketing_revoked_at:string;marketing_consent_at:string}}>('select public.resume_project($1,$2) as r',[p.id,p.token])).rows[0].r;
      assert.equal(resumed.marketing_allowed,false);assert.ok(resumed.marketing_revoked_at);assert.ok(resumed.marketing_consent_at);
      const retry=(await db.query<{r:{marketing_allowed:boolean}}>('select public.submit_project($1,$2,$3,true) as r',[p.id,p.token,answers])).rows[0].r;
      assert.equal(retry.marketing_allowed,false);
    });
    await t.test('produtor registra cancelamento solicitado por canal externo; projetos não se mesclam por telefone',async()=>{
      const id=randomUUID(),token=randomBytes(32).toString('hex');await role('anon');await db.query('select public.submit_project($1,$2,$3,true)',[id,token,answers]);
      await role('producer');await db.query('select public.revoke_project_marketing($1,null)',[id]);
      assert.equal((await db.query<{allowed:boolean}>('select marketing_allowed as allowed from public.projects where id=$1',[id])).rows[0].allowed,false);
      assert.equal((await db.query('select * from public.projects')).rows.length,3);
      await role('admin');assert.equal((await db.query('select * from public.projects')).rows.length,4); // Legado preservado para revisão, nunca comercializado.
    });
  }finally{await db.close();}
});
