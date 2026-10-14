import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { initialAnswers, type Project } from '../../src/lib/project';
import { readFile } from 'node:fs/promises';
import type { ProducerSession } from '../../src/lib/schedule';

test('integração em Supabase separado: API, concorrência e autorização',async t=>{
  const env=process.env;
  assert.equal(env.TEST_CONFIRM_ISOLATED_PROJECT,'yes','Use somente projeto de teste separado. Defina TEST_CONFIRM_ISOLATED_PROJECT=yes.');
  for(const key of ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','TEST_PRODUCER_EMAIL','TEST_PRODUCER_PASSWORD','TEST_OTHER_EMAIL','TEST_OTHER_PASSWORD']) assert.ok(env[key],`Falta ${key}`);
  const localEnv=await readFile(new URL('../../.env.local',import.meta.url),'utf8').catch(()=>'');
  const productionUrl=localEnv.match(/^NEXT_PUBLIC_SUPABASE_URL=["']?([^\s"']+)/m)?.[1];
  if(productionUrl)assert.notEqual(new URL(env.NEXT_PUBLIC_SUPABASE_URL!).hostname,new URL(productionUrl).hostname,'Projeto de teste precisa ser diferente do .env.local. Nenhuma escrita em produção.');
  const make=()=>createClient(env.NEXT_PUBLIC_SUPABASE_URL!,env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const anon=make(),producer=make(),other=make(),rival=make();
  for(const [client,email,password] of [[producer,env.TEST_PRODUCER_EMAIL!,env.TEST_PRODUCER_PASSWORD!],[rival,env.TEST_PRODUCER_EMAIL!,env.TEST_PRODUCER_PASSWORD!],[other,env.TEST_OTHER_EMAIL!,env.TEST_OTHER_PASSWORD!]] as const) {
    const {error}=await client.auth.signInWithPassword({email,password});assert.equal(error,null,'Falha no login da conta de teste.');
  }
  assert.equal((await producer.rpc('is_producer')).data,true,'Autorize a conta do produtor de teste antes de executar.');
  assert.equal((await other.rpc('is_producer')).data,false,'A segunda conta de teste precisa ser não autorizada.');
  const id=randomUUID(),id2=randomUUID(),token=randomBytes(32).toString('hex');
  const answers={...initialAnswers,artist_name:`TESTE-MVP-${id}`,whatsapp:'11999999999',consent:true,genre:'Rap',arrangement:'solo',services:['beat'],beat_type:'custom',no_references:true,needs_guidance:true,deadline:'Sem prazo definido'};
  async function save(step:number,projectId=id) {
    const {data,error}=await anon.rpc('save_project',{p_id:projectId,p_token:token,p_step:step,p_answers:answers});assert.equal(error,null);assert.ok(data);return data as Project;
  }
  try {
    await t.test('cliques e tentativas concorrentes geram só um registro',async()=>{
      const results=await Promise.all(Array.from({length:8},()=>save(1)));
      assert.equal(new Set(results.map(p=>p.public_id)).size,1);
      const {data,error}=await producer.from('projects').select('*').eq('id',id);assert.equal(error,null);assert.equal(data?.length,1);
      assert.equal(data![0].status,'incomplete');assert.equal(data![0].answers.whatsapp,answers.whatsapp);
    });
    await t.test('retomada exige chave correta',async()=>{
      const {data,error}=await anon.rpc('resume_project',{p_id:id,p_token:token});assert.equal(error,null);assert.equal(data.answers.artist_name,answers.artist_name);
      const bad=await anon.rpc('resume_project',{p_id:id,p_token:'0'.repeat(64)});assert.ok(bad.error);assert.equal(bad.data,null);
    });
    await t.test('conclusão real e repetição preservam um registro',async()=>{
      await save(2);await save(3);const p=await save(4);assert.equal(p.status,'completed');assert.ok(p.completed_at);
      const retries=await Promise.all([save(4),save(4)]);assert.ok(retries.every(r=>r.public_id===p.public_id && r.completed_at===p.completed_at));
    });
    await t.test('outro projeto com o mesmo telefone permanece separado',async()=>{
      const p=await save(1,id2);assert.equal(p.status,'incomplete');assert.equal(p.id,id2);
      const {data,error}=await producer.from('projects').select('id').in('id',[id,id2]);assert.equal(error,null);assert.equal(data?.length,2);
    });
    await t.test('acesso público e usuário não autorizado são bloqueados',async()=>{
      const publicList=await anon.from('projects').select('*');assert.ok(publicList.error || publicList.data?.length===0);
      const publicWrite=await anon.from('projects').update({answers:{}}).eq('id',id);assert.ok(publicWrite.error);
      const privateList=await other.from('projects').select('*');assert.equal(privateList.error,null);assert.deepEqual(privateList.data,[]);
      const permission=await other.rpc('is_producer');assert.equal(permission.data,false);
      const allowed=await producer.rpc('is_producer');assert.equal(allowed.data,true);
    });
    await t.test('acompanhamento e histórico não alteram atividade do artista',async()=>{
      const before=await producer.from('projects').select('updated_at').eq('id',id2).single();assert.equal(before.error,null);
      const payload={p_project_id:id2,p_operation_id:randomUUID(),p_status:'in_contact',p_next_action:'Retornar sobre orçamento',p_return_at:'2020-01-01T12:00:00Z',p_expected_revision:0};
      const a=await producer.rpc('save_contact_tracking',payload),b=await producer.rpc('save_contact_tracking',payload);assert.equal(a.error,null);assert.equal(b.error,null);assert.equal(a.data.revision,b.data.revision);
      const after=await producer.from('projects').select('updated_at').eq('id',id2).single();assert.equal(after.data?.updated_at,before.data?.updated_at);
      const queue=await producer.rpc('list_producer_projects',{p_filter:'recovery'});assert.equal(queue.error,null);assert.ok(queue.data.some((p:Project)=>p.id===id2));
      const block=await producer.rpc('save_contact_tracking',{...payload,p_operation_id:randomUUID(),p_expected_revision:1,p_status:'do_not_contact'});assert.equal(block.error,null);
      const q2=await producer.rpc('list_producer_projects',{p_filter:'recovery'});assert.ok(!q2.data.some((p:Project)=>p.id===id2));
      const event={p_project_id:id,p_id:randomUUID(),p_kind:'contact',p_body:'Atendimento de teste confirmado manualmente'};
      for(let i=0;i<2;i++)assert.equal((await producer.rpc('record_contact_history',event)).error,null);
      const history=await producer.from('contact_history').select('id').eq('id',event.p_id);assert.equal(history.data?.length,1);
    });
    await t.test('duas conexões simultâneas: só uma reserva; cancelar libera e consecutiva funciona',async()=>{
      const base=Date.UTC(2090,0,1)+(randomBytes(4).readUInt32BE(0)%20000)*86400000+13*3600000;
      const params={p_id:randomUUID(),p_project_id:id,p_session_type:'TESTE de concorrência',p_starts_at:new Date(base).toISOString(),p_ends_at:new Date(base+3600000).toISOString(),p_notes:'Registro isolado de teste',p_status:'reserved',p_expected_updated_at:null};
      const otherParams={...params,p_id:randomUUID(),p_starts_at:new Date(base+1800000).toISOString(),p_ends_at:new Date(base+5400000).toISOString()};
      const results=await Promise.all([producer.rpc('save_producer_session',params),rival.rpc('save_producer_session',otherParams)]);
      assert.equal(results.filter(r=>!r.error).length,1);assert.equal(results.filter(r=>r.error?.code==='23P01').length,1);
      const winner=results.find(r=>!r.error)!.data as ProducerSession;
      const cancel=await producer.rpc('save_producer_session',{p_id:winner.id,p_project_id:winner.project_id,p_session_type:winner.session_type,p_starts_at:winner.starts_at,p_ends_at:winner.ends_at,p_notes:winner.notes,p_status:'cancelled',p_expected_updated_at:winner.updated_at});assert.equal(cancel.error,null);
      const loser=results[0].error?params:otherParams;
      const reuse=await producer.rpc('save_producer_session',loser);assert.equal(reuse.error,null);
      const adjacent=await producer.rpc('save_producer_session',{...params,p_id:randomUUID(),p_starts_at:loser.p_ends_at,p_ends_at:new Date(Date.parse(loser.p_ends_at)+3600000).toISOString()});assert.equal(adjacent.error,null);
      const noEnd=await producer.rpc('save_producer_session',{...params,p_id:randomUUID(),p_ends_at:params.p_starts_at});assert.equal(noEnd.error?.code,'22023');
    });
    await t.test('API direta protege novos dados de visitantes e outra conta',async()=>{
      for(const table of ['contact_tracking','contact_history','producer_sessions']){
        const a=await anon.from(table).select('*');assert.ok(a.error || a.data?.length===0);
        const b=await other.from(table).select('*');assert.equal(b.error,null);assert.deepEqual(b.data,[]);
        const write=await other.from(table).delete().eq(table==='contact_tracking'?'project_id':'id',id);assert.ok(write.error);
      }
      const unauthorized=await other.rpc('record_contact_history',{p_project_id:id,p_id:randomUUID(),p_kind:'note',p_body:'Intruso'});assert.equal(unauthorized.error?.code,'42501');
      const queue=await anon.rpc('list_producer_projects',{});assert.ok(queue.error);
    });
  } finally {
    console.info(`Registros de teste para remover pelo SQL Editor: ${id}, ${id2}`);
    await producer.auth.signOut();await other.auth.signOut();await rival.auth.signOut();
  }
});
