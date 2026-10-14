// PostgreSQL real compilado para WASM, isolado; não substitui o Supabase em produção.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID, randomBytes } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { initialAnswers } from '../src/lib/project';
test('migração: persistência parcial, conclusão, idempotência e RLS',async t=>{
  const db = new PGlite();
  const producer=randomUUID(), outsider=randomUUID(), id=randomUUID();
  const token=randomBytes(32).toString('hex'), wrongToken=randomBytes(32).toString('hex');
  const answers={...initialAnswers,artist_name:'Artista teste',whatsapp:'11999999999',consent:true,genre:'Rap',arrangement:'solo',services:['beat','mixing'],beat_type:'custom',no_references:true,needs_guidance:true,deadline:'Sem prazo definido'};
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon,authenticated;
    grant execute on function auth.uid() to anon,authenticated;`);
  await db.exec(await readFile(new URL('../supabase/migrations/001_projects.sql',import.meta.url),'utf8'));
  await db.query('insert into auth.users(id) values ($1),($2)',[producer,outsider]);
  await db.query('insert into private.producer(user_id) values ($1)',[producer]);
  await db.exec('set role anon');
  async function save(projectId:string,secret:string,step:number,a=answers) {
    const result=await db.query<{p:{status:string;progress:number;public_id:string;answers:typeof answers}}>('select public.save_project($1,$2,$3,$4::jsonb) as p',[projectId,secret,step,JSON.stringify(a)]);
    return result.rows[0].p;
  }
  try {
    await t.test('etapa 1 persiste contato e autorização sem concluir',async()=>{
      const p=await save(id,token,1);assert.equal(p.status,'incomplete');assert.equal(p.progress,1);assert.equal(p.answers.whatsapp,answers.whatsapp);assert.equal(p.answers.consent,true);assert.equal(p.answers.genre,undefined);
    });
    await t.test('repetição da primeira etapa não duplica',async()=>{
      const a=await save(id,token,1);const b=await save(id,token,1);assert.equal(a.public_id,b.public_id);
      await db.exec('reset role');const result=await db.query<{count:number}>('select count(*)::int as count from public.projects');assert.equal(result.rows[0].count,1);await db.exec('set role anon');
    });
    await t.test('público não pode listar, inserir ou alterar diretamente',async()=>{
      await assert.rejects(db.query('select * from public.projects'),/permission denied/i);
      await assert.rejects(db.query('insert into public.projects(id) values ($1)',[randomUUID()]),/permission denied/i);
      await assert.rejects(db.query("update public.projects set status='completed'"),/permission denied/i);
      await assert.rejects(db.query('select * from private.project_keys'),/permission denied/i);
    });
    await t.test('chave errada não recupera nem sobrescreve',async()=>{
      await assert.rejects(save(id,wrongToken,1),/Pedido indisponível/);
      await assert.rejects(db.query('select public.resume_project($1,$2)',[id,wrongToken]),/Pedido indisponível/);
      const resumed=await db.query<{p:{answers:typeof answers}}>('select public.resume_project($1,$2) as p',[id,token]);assert.equal(resumed.rows[0].p.answers.artist_name,answers.artist_name);
    });
    await t.test('ID público não permite recuperar o pedido',async()=>{
      const p=await save(id,token,1);await assert.rejects(db.query('select public.resume_project($1,$2)',[p.public_id,token]),/Pedido indisponível/);
    });
    await t.test('pular etapas ou enviar consentimento inválido falha',async()=>{
      await assert.rejects(save(id,token,4),/Conclua as etapas anteriores/);
      await assert.rejects(save(randomUUID(),token,1,{...answers,consent:false}),/Contato ou autorização inválidos/);
    });
    await t.test('etapas avançam no mesmo registro e voltar preserva progresso',async()=>{
      assert.equal((await save(id,token,2)).progress,2);assert.equal((await save(id,token,3)).progress,3);
      const p=await save(id,token,1,{...answers,artist_name:'Nome revisado'});assert.equal(p.progress,3);assert.equal(p.answers.genre,'Rap');assert.deepEqual(p.answers.services,['beat','mixing']);
    });
    await t.test('conclusão confirmada é idempotente e imutável',async()=>{
      const a=await save(id,token,4),b=await save(id,token,4);assert.equal(a.status,'completed');assert.equal(b.public_id,a.public_id);assert.equal(b.progress,4);assert.equal(b.answers.artist_name,'Nome revisado');
      const c=await save(id,token,1);assert.equal(c.answers.artist_name,'Nome revisado');
    });
    await t.test('mesmo telefone com novo projeto gera outro pedido',async()=>{
      const b=await save(randomUUID(),wrongToken,1);assert.equal(b.status,'incomplete');
      await db.exec('reset role');const result=await db.query<{count:number}>('select count(*)::int as count from public.projects');assert.equal(result.rows[0].count,2);await db.exec('set role anon');
    });
    await t.test('usuário autenticado não autorizado não lê contatos',async()=>{
      await db.exec('reset role; set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[outsider]);
      assert.equal((await db.query('select * from public.projects')).rows.length,0);
      assert.equal((await db.query<{allowed:boolean}>('select public.is_producer() as allowed')).rows[0].allowed,false);
      await assert.rejects(db.query('select * from private.producer'),/permission denied/i);
    });
    await t.test('somente produtor configurado lê todos os pedidos',async()=>{
      await db.query("select set_config('request.jwt.claim.sub',$1,false)",[producer]);
      assert.equal((await db.query('select * from public.projects')).rows.length,2);
      assert.equal((await db.query<{allowed:boolean}>('select public.is_producer() as allowed')).rows[0].allowed,true);
      await assert.rejects(db.query('delete from public.projects'),/permission denied/i);
    });
  } finally {await db.close();}
});
