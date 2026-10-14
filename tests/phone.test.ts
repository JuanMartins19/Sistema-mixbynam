import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID,randomBytes} from 'node:crypto';
import {normalizeWhatsapp,formatWhatsappInput} from '../src/lib/phone';
import {artistWhatsappLink} from '../src/lib/followup';
import {testDatabase} from './helpers/database';

test('telefone brasileiro: DDD, oito ou nove dígitos e limite de digitação',()=>{
  assert.equal(normalizeWhatsapp('(11) 99999-9999'),'+5511999999999');
  assert.equal(normalizeWhatsapp('(11) 9999-9999'),'+551199999999');
  assert.equal(normalizeWhatsapp('(21) 2345-6789'),'+552123456789');
  assert.equal(formatWhatsappInput('119999999999999999999'),'(11) 99999-9999');
  assert.equal(formatWhatsappInput('1199999999'),'(11) 9999-9999');
  for(const number of ['20999999999','00999999999','11899999999','119999999','119999999999','11999abc99999'])assert.throws(()=>normalizeWhatsapp(number));
});
test('internacional: código e comprimentos por país, sem confundir com DDD brasileiro',()=>{
  for(const [input,expected] of [
    ['+1 (202) 555-0123','+12025550123'],['+351 912 345 678','+351912345678'],
    ['+44 7911 123456','+447911123456'],['+354 611 1234','+3546111234'],
    ['+55 (11) 9999-9999','+551199999999'],
  ])assert.equal(normalizeWhatsapp(input),expected);
  for(const input of ['+999123456789','+35191234','+13101234','+120255501234','+351912345678999999'])assert.throws(()=>normalizeWhatsapp(input));
  assert.equal(formatWhatsappInput('+1234567890123456789',true).replace(/\D/g,'').length,11);
  assert.equal(formatWhatsappInput('+351912345678999999',true).replace(/\D/g,''),'351912345678');
  assert.equal(formatWhatsappInput('+999999999999999999',true).replace(/\D/g,'').length,15);
  assert.ok(artistWhatsappLink('+12025550123','id','Artista','Nam')?.startsWith('https://wa.me/12025550123?'));
  assert.ok(artistWhatsappLink('11999999999','id','Artista','Nam')?.startsWith('https://wa.me/5511999999999?'));
});
test('banco valida telefones nacionais/internacionais em chamadas diretas',async()=>{
  const {db,role,project}=await testDatabase(['001_projects.sql','002_contact_followup.sql','003_producer_schedule.sql','004_manual_finance.sql','005_producer_queries.sql','006_finance_completion.sql','007_finance_month_details.sql','008_submission_privacy.sql']);
  try{
    const p=await project(true);await role('admin');await db.exec(await readFile('supabase/migrations/009_whatsapp_validation.sql','utf8'));
    for(const phone of ['11999999999','1199999999','+5511999999999','+12025550123','+351912345678','+3546111234'])assert.equal((await db.query<{valid:boolean}>('select private.valid_whatsapp($1) as valid',[phone])).rows[0].valid,true);
    for(const phone of ['20999999999','11899999999','9'.repeat(25),'+999123456789','+35191234','+13101234','+120255501234'])assert.equal((await db.query<{valid:boolean}>('select private.valid_whatsapp($1) as valid',[phone])).rows[0].valid,false);
    await role('anon');
    const send=(phone:string)=>db.query('select public.submit_project($1,$2,$3,false)',[randomUUID(),randomBytes(32).toString('hex'),{...p.answers,whatsapp:phone}]);
    await assert.rejects(send('9'.repeat(25)),/Contato inválido/);await assert.rejects(send('+35191234'),/Contato inválido/);
    await send('+12025550123');await send('+551199999999');
    await assert.rejects(db.query('select * from private.phone_lengths'),/permission denied/);
  }finally{await db.close();}
});
