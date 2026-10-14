import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanAnswers, initialAnswers, validateStep, whatsappLink } from '../src/lib/project';
import { csvCell, projectsCsv } from '../src/lib/export';
import {testDatabase} from './helpers/database';
import {randomUUID,randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';

test('banco aceita beat sem tipo e não atribui um tipo automaticamente',async()=>{
  const {db,project,role}=await testDatabase(['001_projects.sql','002_contact_followup.sql','003_producer_schedule.sql','004_manual_finance.sql','005_producer_queries.sql','006_finance_completion.sql','007_finance_month_details.sql','008_submission_privacy.sql','009_whatsapp_validation.sql','010_optional_beat_type.sql']);
  try{
    const p=await project(true);await role('admin');
    await db.exec(await readFile('supabase/migrations/011_mix_by_nam_privacy_text.sql','utf8'));await role('anon');
    const id=randomUUID(),token=randomBytes(32).toString('hex');
    const result=(await db.query<{r:{status:string;marketing_consent_text:string;marketing_consent_version:string;privacy_notice_version:string;answers:{beat_type:string;services:string[]}}}>('select public.submit_project($1,$2,$3,false) as r',[id,token,{...p.answers,services:['beat'],beat_type:''}])).rows[0].r;
    assert.equal(result.status,'completed');assert.equal(result.answers.beat_type,'');assert.deepEqual(result.answers.services,['beat']);
    assert.ok(result.marketing_consent_text.includes('Mix By Nam'));assert.equal(result.marketing_consent_version,'2026-10-14-marketing-v2');assert.equal(result.privacy_notice_version,'2026-10-14-privacy-v3');
    await role('producer');const legacy=(await db.query<{text:string}>('select marketing_consent_text as text from public.projects where id=$1',[p.id])).rows[0].text;assert.ok(legacy.includes('Beatz By Nam'));
  }finally{await db.close();}
});
test('contato exige WhatsApp válido; publicidade é opcional',()=>{
  assert.ok(validateStep(initialAnswers,1));
  assert.equal(validateStep({...initialAnswers,artist_name:'Artista',whatsapp:'(11) 99999-9999',consent:true},1),null);
  assert.equal(validateStep({...initialAnswers,artist_name:'Artista',whatsapp:'11999999999',consent:false,marketing:false},1),null);
  assert.ok(validateStep({...initialAnswers,artist_name:'Artista',whatsapp:'abc11999999999',consent:true},1));
});
test('beat não exige tipo; referências exigem link ou ausência explícita',()=>{
  const a={...initialAnswers,services:['beat'],no_references:true};
  assert.equal(validateStep(a,3),null);
  assert.equal(validateStep({...a,beat_type:'exclusive'},3),null);
  assert.ok(validateStep({...a,beat_type:'custom',no_references:false,references:'javascript:alert(1)'},3));
  assert.equal(validateStep({...a,beat_type:'custom',no_references:false,references:'https://example.com/track'},3),null);
});
test('orientação aceita orçamento ausente e exige prazo',()=>{
  assert.equal(validateStep({...initialAnswers,needs_guidance:true,deadline:'Sem prazo definido'},4),null);
  assert.ok(validateStep({...initialAnswers,needs_guidance:true},4));
});
test('campos ocultos são removidos da persistência',()=>{
  const a=cleanAnswers({...initialAnswers,whatsapp:'(11) 99999-9999',beat_type:'custom',budget:'500',needs_guidance:true,references:'https://example.com',no_references:true,arrangement_other:'Outro'});
  assert.equal(a.whatsapp,'+5511999999999');assert.equal(a.budget,'');assert.equal(a.references,'');assert.equal(a.beat_type,'');assert.equal(a.arrangement_other,'');
});
test('WhatsApp apenas abre mensagem com identificador, sem envio',()=>{
  assert.equal(whatsappLink('SEU-NUMERO','pedido','Artista'),null);
  const link=whatsappLink('5511999999999','public-id','Nome & som');
  assert.ok(link?.startsWith('https://wa.me/5511999999999?text='));
  assert.ok(decodeURIComponent(link!).includes('public-id'));
  assert.ok(decodeURIComponent(link!).includes('Nome & som'));
});
test('CSV neutraliza fórmulas e escapa aspas e quebras de linha',()=>{
  for(const value of ['=SUM(1)','+123','@formula','-1','  =formula','\t=cmd']) assert.ok(csvCell(value).startsWith('"\''));
  assert.equal(csvCell('um "som"\nnovo'),'"um ""som""\nnovo"');
  assert.ok(projectsCsv([]).startsWith('\uFEFF'));
});
