import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID, randomBytes } from 'node:crypto';
import { initialAnswers } from '../../src/lib/project';
export async function testDatabase(migrations=['001_projects.sql','002_contact_followup.sql']) {
  const db=new PGlite();const producer=randomUUID(),other=randomUUID();
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon,authenticated;
    grant execute on function auth.uid() to anon,authenticated;`);
  for(const migration of migrations)await db.exec(await readFile(resolve('supabase/migrations',migration),'utf8'));
  await db.query('insert into auth.users(id) values($1),($2)',[producer,other]);
  await db.query('insert into private.producer(user_id) values($1)',[producer]);
  async function role(who:'producer'|'other'|'anon'|'admin') {
    await db.exec('reset role');
    if(who==='admin')return;
    await db.exec('set role '+(who==='anon'?'anon':'authenticated'));
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[who==='producer'?producer:who==='other'?other:'']);
  }
  async function project(complete=false) {
    await role('anon');const id=randomUUID(),token=randomBytes(32).toString('hex');
    const answers={...initialAnswers,artist_name:'Teste',whatsapp:'11999999999',consent:true,genre:'Rap',arrangement:'solo',services:['mixing'],no_references:true,needs_guidance:true,deadline:'Sem prazo definido'};
    if(migrations.includes('008_submission_privacy.sql')){
      if(!complete)throw new Error('O novo fluxo não cria pedidos incompletos. Use fixture administrativa para dados legados.');
      await db.query('select public.submit_project($1,$2,$3::jsonb,false)',[id,token,JSON.stringify(answers)]);
      await role('producer');return {id,token,answers};
    }
    for(let s=1;s<=(complete?4:1);s++)await db.query('select public.save_project($1,$2,$3,$4::jsonb)',[id,token,s,JSON.stringify(answers)]);
    await role('producer');return {id,token,answers};
  }
  return {db,role,project,producer,other};
}
