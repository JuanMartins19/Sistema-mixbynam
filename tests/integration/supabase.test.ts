import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { initialAnswers, type Project } from '../../src/lib/project';

test('integração em Supabase separado: API, concorrência e autorização',async t=>{
  const env=process.env;
  assert.equal(env.TEST_CONFIRM_ISOLATED_PROJECT,'yes','Use somente projeto de teste separado. Defina TEST_CONFIRM_ISOLATED_PROJECT=yes.');
  for(const key of ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','TEST_PRODUCER_EMAIL','TEST_PRODUCER_PASSWORD','TEST_OTHER_EMAIL','TEST_OTHER_PASSWORD']) assert.ok(env[key],`Falta ${key}`);
  const make=()=>createClient(env.NEXT_PUBLIC_SUPABASE_URL!,env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const anon=make(),producer=make(),other=make();
  for(const [client,email,password] of [[producer,env.TEST_PRODUCER_EMAIL!,env.TEST_PRODUCER_PASSWORD!],[other,env.TEST_OTHER_EMAIL!,env.TEST_OTHER_PASSWORD!]] as const) {
    const {error}=await client.auth.signInWithPassword({email,password});assert.equal(error,null,'Falha no login da conta de teste.');
  }
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
  } finally {
    console.info(`Registros de teste para remover pelo SQL Editor: ${id}, ${id2}`);
    await producer.auth.signOut();await other.auth.signOut();
  }
});
