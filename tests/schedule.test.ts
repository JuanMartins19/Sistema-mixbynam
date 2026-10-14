import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { testDatabase } from './helpers/database';
import { fromLocalInput, toLocalInput } from '../src/lib/datetime';
import { agendaDays, agendaRange, overlapsDay, type ProducerSession } from '../src/lib/schedule';
import { backupV2 } from '../src/lib/export';
test('agenda: banco bloqueia sobreposição, libera cancelamento e restringe acesso',async t=>{
  const {db,project,role}=await testDatabase(['001_projects.sql','002_contact_followup.sql','003_producer_schedule.sql']);
  const p=await project();const id=randomUUID();let first:ProducerSession;
  async function save(s:string,e:string,sessionId=randomUUID(),status='reserved',expected:string|null=null,projectId=p.id) {
    return (await db.query<{r:ProducerSession}>('select public.save_producer_session($1,$2,$3,$4,$5,$6,$7,$8) as r',[sessionId,projectId,'Gravação',s,e,'Observações',status,expected])).rows[0].r;
  }
  try {
    await t.test('fim precisa ser posterior; datas infinitas rejeitadas',async()=>{
      await assert.rejects(save('2030-01-01T10:00Z','2030-01-01T10:00Z'),/Sessão inválida/);
      await assert.rejects(save('2030-01-01T11:00Z','2030-01-01T10:00Z'),/Sessão inválida/);
      await assert.rejects(save('2030-01-01T10:00Z','infinity'),/Sessão inválida/);
    });
    await t.test('sessão com fuso e retry usam o mesmo registro',async()=>{
      first=await save('2030-01-01T10:00:00-03:00','2030-01-01T11:00:00-03:00',id);
      const again=await save('2030-01-01T10:00:00-03:00','2030-01-01T11:00:00-03:00',id);
      assert.equal(again.id,first.id);assert.equal(again.updated_at,first.updated_at);
      assert.equal(Date.parse(first.starts_at),Date.parse('2030-01-01T13:00Z'));
    });
    await t.test('sobreposição parcial, contida, igual e em outro projeto são impedidas',async()=>{
      const p2=await project();
      for(const [s,e] of [['12:30','13:30'],['13:15','13:45'],['13:00','14:00'],['12:00','15:00']])await assert.rejects(save(`2030-01-01T${s}Z`,`2030-01-01T${e}Z`,randomUUID(),'confirmed',null,p2.id),/conflicting key|exclusion constraint/i);
    });
    await t.test('horários consecutivos e anteriores são permitidos',async()=>{
      await save('2030-01-01T14:00Z','2030-01-01T15:00Z');await save('2030-01-01T12:00Z','2030-01-01T13:00Z');
      assert.equal((await db.query('select * from public.producer_sessions')).rows.length,3);
    });
    await t.test('editar respeita conflito e versão de outra janela',async()=>{
      await assert.rejects(save('2030-01-01T14:00Z','2030-01-01T14:30Z',id,'confirmed',first.updated_at),/exclusion constraint/i);
      const changed=await save('2030-01-01T13:00Z','2030-01-01T14:00Z',id,'confirmed',first.updated_at);
      await assert.rejects(save('2030-01-01T13:00Z','2030-01-01T14:00Z',id,'held',first.updated_at),/outra janela/);first=changed;
    });
    await t.test('cancelar libera horário; reativação conflitante é rejeitada',async()=>{
      first=await save('2030-01-01T13:00Z','2030-01-01T14:00Z',id,'cancelled',first.updated_at);
      await save('2030-01-01T13:00Z','2030-01-01T14:00Z');
      await assert.rejects(save('2030-01-01T13:00Z','2030-01-01T14:00Z',id,'reserved',first.updated_at),/exclusion constraint/i);
    });
    await t.test('solicitações assíncronas conflitantes deixam apenas uma sessão',async()=>{
      // PGlite serializa transações; testa arbitragem da constraint em chamadas Promise.all.
      // Concorrência entre duas conexões reais é coberta pelo teste remoto separado.
      const outcomes=await Promise.allSettled([save('2030-01-02T13:00Z','2030-01-02T14:00Z'),save('2030-01-02T13:30Z','2030-01-02T14:30Z')]);
      assert.equal(outcomes.filter(o=>o.status==='fulfilled').length,1);assert.equal(outcomes.filter(o=>o.status==='rejected').length,1);
      const constraint=await db.query<{contype:string}>('select contype from pg_constraint where conname=$1',['producer_sessions_no_overlap']);assert.equal(constraint.rows[0].contype,'x');
    });
    await t.test('público/outra conta não leem nem alteram sessões; produtor não escreve direto',async()=>{
      await assert.rejects(db.query("update public.producer_sessions set status='cancelled'"),/permission denied/);
      for(const who of ['anon','other'] as const){await role(who);if(who==='anon')await assert.rejects(db.query('select * from public.producer_sessions'),/permission denied/);else assert.equal((await db.query('select * from public.producer_sessions')).rows.length,0);
        await assert.rejects(save('2030-01-03T13:00Z','2030-01-03T14:00Z'),/permission denied|Acesso não autorizado/);await assert.rejects(db.query('delete from public.producer_sessions'),/permission denied/);
      }
    });
    await t.test('RPC pública preservada não cria sessões nem inclui dados privados na retomada',async()=>{
      await role('anon');const resumed=await db.query<{r:Record<string,unknown>}>('select public.resume_project($1,$2) as r',[p.id,p.token]);assert.equal(resumed.rows[0].r.producer_sessions,undefined);assert.equal(resumed.rows[0].r.contact_tracking,undefined);
    });
  }finally{await db.close();}
});
test('conversão de Brasília independe do fuso do navegador e semana começa segunda',()=>{
  assert.equal(fromLocalInput('2030-01-01T10:00'),'2030-01-01T13:00:00.000Z');assert.equal(toLocalInput('2030-01-01T13:00:00Z'),'2030-01-01T10:00');
  assert.equal(agendaDays('2030-01-06','week')[0],'2029-12-31');assert.equal(agendaDays('2030-01-06','week').length,7);
  const day=agendaRange(['2030-01-01']);assert.equal(day.start,'2030-01-01T03:00:00.000Z');assert.equal(day.end,'2030-01-02T03:00:00.000Z');
  assert.throws(()=>fromLocalInput('2030-02-30T10:00'),/Data inválida/);
  assert.equal(overlapsDay({starts_at:'2030-01-02T02:00Z',ends_at:'2030-01-02T04:00Z'} as ProducerSession,'2030-01-01'),true);
});
test('backup v2 contém domínios separados e escopo explícito',()=>{
  const b=backupV2('2030-01-01T00:00Z',[],[],[],[]);assert.equal(b.version,2);assert.equal(b.backup_scope,'application_records_only');assert.deepEqual(b.contact_tracking,[]);assert.deepEqual(b.contact_history,[]);assert.deepEqual(b.producer_sessions,[]);
});
