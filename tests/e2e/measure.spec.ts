import { test,expect } from './producer-fixture';
import { mkdir,writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { localDateToday,fromLocalInput } from '../../src/lib/datetime';
test('medições em produção local com backend isolado',async({page,backend})=>{
  const results:Record<string,unknown>={};
  const today=localDateToday();await backend.db.query('select public.save_producer_session($1,$2,$3,$4,$5,$6,$7,null)',[randomUUID(),backend.projectId,'Gravação',fromLocalInput(today+'T10:00'),fromLocalInput(today+'T11:00'),'Notas de sessão','reserved']);
  const capture=async(name:string,action:()=>Promise<void>)=>{
    const offset=backend.traffic.length;await action();await page.waitForTimeout(400);
    const calls=backend.traffic.slice(offset);results[name]={calls:calls.length,request_bytes:calls.reduce((a,c)=>a+c.request_bytes,0),response_bytes:calls.reduce((a,c)=>a+c.response_bytes,0),endpoints:calls.map(c=>c.path)};
  };
  await page.goto('/produtor');
  await capture('login',async()=>{await page.getByLabel('E-mail',{exact:true}).fill('producer@example.test');await page.getByLabel('Senha',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Entrar no painel'}).click();await expect(page.getByRole('heading',{name:'Projetos em vista.'})).toBeVisible();await expect(page.getByRole('button',{name:'Ver pedido'})).toBeVisible();});
  await capture('abrir_atendimento',async()=>{await page.getByRole('button',{name:'Ver pedido'}).click();await expect(page.getByLabel('Situação comercial')).toBeEnabled();});
  await capture('salvar_acompanhamento',async()=>{await page.getByLabel('Situação comercial').selectOption('in_contact');await page.getByRole('button',{name:'Salvar acompanhamento'}).click();await expect(page.getByLabel('Situação comercial')).toBeEnabled();});
  await page.getByRole('button',{name:'Agenda',exact:true}).click();await expect(page.locator('.session-card')).toHaveCount(1);await page.getByRole('button',{name:'Contatos',exact:true}).click();
  await capture('voltar_agenda',async()=>{await page.getByRole('button',{name:'Agenda',exact:true}).click();await expect(page.locator('.session-card')).toHaveCount(1);});
  await mkdir('.tools/measurements',{recursive:true});await writeFile(`.tools/measurements/${process.env.MIXBYNAM_MEASUREMENT_LABEL||'measurement'}.json`,JSON.stringify({environment:'production_local',backend:'PGlite + Auth/HTTP fixture',sample:'um pedido concluído; uma sessão no dia',metrics:'requisições REST; bytes de corpos JSON, sem cabeçalhos/compressão',results},null,2));
});
