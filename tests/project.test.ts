import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanAnswers, initialAnswers, validateStep, whatsappLink } from '../src/lib/project';
import { csvCell, projectsCsv } from '../src/lib/export';
test('contato exige autorização e WhatsApp válido',()=>{
  assert.ok(validateStep(initialAnswers,1));
  assert.equal(validateStep({...initialAnswers,artist_name:'Artista',whatsapp:'(11) 99999-9999',consent:true},1),null);
  assert.ok(validateStep({...initialAnswers,artist_name:'Artista',whatsapp:'11999999999',consent:false},1));
  assert.ok(validateStep({...initialAnswers,artist_name:'Artista',whatsapp:'abc11999999999',consent:true},1));
});
test('serviços exigem tipo de beat e referência ou ausência explícita',()=>{
  const a={...initialAnswers,services:['beat'],no_references:true};
  assert.ok(validateStep(a,3));
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
  assert.equal(a.whatsapp,'11999999999');assert.equal(a.budget,'');assert.equal(a.references,'');assert.equal(a.beat_type,'');assert.equal(a.arrangement_other,'');
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
