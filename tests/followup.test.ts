import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { testDatabase } from './helpers/database';
import { artistWhatsappLink, INACTIVITY_HOURS, type ProducerProject } from '../src/lib/followup';
test('acompanhamento: limite, histórico, independência do artista e acesso privado',async t=>{
  const {db,role,project}=await testDatabase();const p=await project();
  async function queue(filter='recovery',hours=24) {return (await db.query<{r:ProducerProject[]}>('select public.list_producer_projects($1,0,100,$2) as r',[filter,hours])).rows[0].r;}
  async function track(status='in_contact',action:string|null=null,at:string|null=null,revision=0,operation=randomUUID()) {
    return (await db.query<{r:{revision:number}}>('select public.save_contact_tracking($1,$2,$3,$4,$5,$6) as r',[p.id,operation,status,action,at,revision])).rows[0].r;
  }
  try {
    await t.test('incompleto recente não é recuperação; limite exato de 24h entra',async()=>{
      assert.equal((await queue()).length,0);
      await role('admin');await db.query("update public.projects set updated_at=now()-interval '24 hours'+interval '1 minute' where id=$1",[p.id]);await role('producer');assert.equal((await queue()).length,0);
      // Uma transação mantém now() constante, permitindo testar exatamente a borda.
      await role('admin');await db.exec('begin');await db.query("update public.projects set updated_at=now()-interval '24 hours' where id=$1",[p.id]);await db.exec('set local role authenticated');
      // claims já contêm produtor; schema privado continua inacessível sob authenticated.
      assert.equal((await queue()).length,1);await db.exec('commit');await role('producer');
      assert.equal((await queue('recovery',25)).length,0);
    });
    await t.test('produtor altera acompanhamento sem atualizar atividade do artista',async()=>{
      const before=(await db.query<{updated_at:string}>('select updated_at from public.projects where id=$1',[p.id])).rows[0].updated_at;
      const operation=randomUUID();const a=await track('proposal_sent','Enviar referências','2020-01-01T12:00:00Z',0,operation);const b=await track('proposal_sent','Enviar referências','2020-01-01T12:00:00Z',0,operation);
      assert.equal(a.revision,1);assert.equal(b.revision,1);
      assert.equal(String((await db.query<{updated_at:string}>('select updated_at from public.projects where id=$1',[p.id])).rows[0].updated_at),String(before));
      const q=await queue();assert.ok(q[0].recovery_reasons.includes('inactive'));assert.ok(q[0].recovery_reasons.includes('overdue'));
      assert.equal((await db.query('select * from public.contact_history where project_id=$1',[p.id])).rows.length,1);
      await assert.rejects(track('won',null,null,0),/outra janela/);
    });
    await t.test('notas e contatos manuais têm histórico idempotente e próxima ação é preservada',async()=>{
      const event=randomUUID();for(let i=0;i<2;i++)await db.query("select public.record_contact_history($1,$2,'note','Nota de teste')",[p.id,event]);
      const rows=(await db.query<{kind:string;created_at:string}>('select * from public.contact_history where project_id=$1',[p.id])).rows;assert.equal(rows.length,2);assert.ok(rows.every(r=>r.created_at));
      assert.equal((await queue('pending')).length,1);
      await db.query("select public.record_contact_history($1,$2,'contact','Conversa realizada manualmente')",[p.id,randomUUID()]);
      assert.equal((await queue('pending')).length,0);assert.equal((await queue()).length,1); // ação vencida continua pendente
    });
    await t.test('não contatar exclui da fila mesmo com inatividade e retorno vencido',async()=>{
      await track('do_not_contact','Retorno antigo','2020-01-01T12:00:00Z',1);assert.equal((await queue()).length,0);
      await assert.rejects(db.query("select public.record_contact_history($1,$2,'contact','Contato')",[p.id,randomUUID()]),/não contatar/);
      assert.equal((await queue('all')).length,1);
    });
    await t.test('concluído sem contato entra; nota isolada não comprova atendimento',async()=>{
      const done=await project(true);assert.ok((await queue()).some(r=>r.id===done.id));
      await db.query("select public.record_contact_history($1,$2,'note','Nota interna')",[done.id,randomUUID()]);assert.ok((await queue()).some(r=>r.id===done.id));
      await db.query("select public.record_contact_history($1,$2,'contact','Atendimento confirmado')",[done.id,randomUUID()]);assert.equal((await queue()).length,0);
    });
    await t.test('atualização do artista reinicia só sua própria inatividade e não muda comercial',async()=>{
      await role('anon');await db.query('select public.save_project($1,$2,1,$3::jsonb)',[p.id,p.token,JSON.stringify({...p.answers,commercial_status:'won',next_action:'Invadir dados comerciais'})]);
      await role('producer');const all=await queue('all');const row=all.find(r=>r.id===p.id)!;assert.equal(row.tracking?.commercial_status,'do_not_contact');assert.ok(!row.recovery_reasons.includes('inactive'));
    });
    await t.test('visitante e outra conta não leem nem alteram acompanhamento/histórico',async()=>{
      for(const who of ['anon','other'] as const){await role(who);
        for(const table of ['contact_tracking','contact_history']){if(who==='anon')await assert.rejects(db.query('select * from public.'+table),/permission denied/);else assert.equal((await db.query('select * from public.'+table)).rows.length,0);await assert.rejects(db.query('delete from public.'+table),/permission denied/);}
        await assert.rejects(queue(),/permission denied|Acesso não autorizado/);
        await assert.rejects(track(),/permission denied|Acesso não autorizado/);
        await assert.rejects(db.query("select public.record_contact_history($1,$2,'note','Intruso')",[p.id,randomUUID()]),/permission denied|Acesso não autorizado/);
      }
    });
  }finally{await db.close();}
});
test('WhatsApp do artista prepara mensagem sem criar registro de atendimento',()=>{
  assert.equal(INACTIVITY_HOURS,24);const link=artistWhatsappLink('11999999999','id-publico','Artista','Nam');assert.ok(link?.startsWith('https://wa.me/5511999999999?'));assert.ok(decodeURIComponent(link!).includes('id-publico'));
});
