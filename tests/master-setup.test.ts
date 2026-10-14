import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { testDatabase } from './helpers/database';

test('configuração master exige conta confirmada e autoriza somente um UUID',async()=>{
  const {db,other,role}=await testDatabase();
  try {
    await role('admin');
    await db.exec('alter table auth.users add column email text; alter table auth.users add column email_confirmed_at timestamptz');
    const template=await readFile(resolve('supabase/setup/configure_master.sql'),'utf8');
    const sql=template.replace("'EMAIL-DO-PRODUTOR'","'master@example.test'");
    await assert.rejects(db.exec(sql),/exatamente um usuário/);await db.exec('rollback');
    await db.query('update auth.users set email=$1 where id=$2',['master@example.test',other]);
    await assert.rejects(db.exec(sql),/Confirme o e-mail/);await db.exec('rollback');
    await db.query('update auth.users set email_confirmed_at=now() where id=$1',[other]);
    await db.exec(sql);
    const rows=(await db.query<{user_id:string}>('select user_id from private.producer')).rows;
    assert.equal(rows.length,1);assert.equal(rows[0].user_id,other);
    await role('other');assert.equal((await db.query<{allowed:boolean}>('select public.is_producer() as allowed')).rows[0].allowed,true);
    await role('producer');assert.equal((await db.query<{allowed:boolean}>('select public.is_producer() as allowed')).rows[0].allowed,false);
  }finally{await db.close();}
});
