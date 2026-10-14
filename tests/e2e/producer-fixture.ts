// Dublê de Auth/HTTP restrito aos testes; RPCs executam migrações reais no PGlite.
// Nenhuma rota simulada ou chave de teste é incluída na aplicação.
import { test as base, expect } from '@playwright/test';
import { testDatabase } from '../helpers/database';
import type { PGlite } from '@electric-sql/pglite';
type Fixture={backend:{db:PGlite;projectId:string;traffic:{path:string;request_bytes:number;response_bytes:number}[]}};
export const test=base.extend<Fixture>({
  backend:async({context},use)=>{
    const {db,project,producer}=await testDatabase(['001_projects.sql','002_contact_followup.sql','003_producer_schedule.sql','004_manual_finance.sql','005_producer_queries.sql','006_finance_completion.sql','007_finance_month_details.sql','008_submission_privacy.sql','009_whatsapp_validation.sql','010_optional_beat_type.sql']);
    const p=await project(true);
    const traffic:{path:string;request_bytes:number;response_bytes:number}[]=[];
    await context.route(/^https:\/\/[^/]+\.supabase\.co\//,route=>route.abort('blockedbyclient'));
    const user={id:producer,aud:'authenticated',role:'authenticated',email:'producer@example.test',app_metadata:{provider:'email',providers:['email']},user_metadata:{},created_at:new Date().toISOString()};
    const jwt=(obj:unknown)=>Buffer.from(JSON.stringify(obj)).toString('base64url');
    const token=`${jwt({alg:'HS256',typ:'JWT'})}.${jwt({sub:producer,role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600})}.test-signature`;
    await context.route('https://wa.me/**',route=>route.fulfill({status:200,body:'WhatsApp interceptado pelo teste; nenhuma mensagem enviada.'}));
    await context.route('https://mixbynam-test.invalid/**',async route=>{
      try {
        const request=route.request();const url=new URL(request.url());let data:unknown;
        if(url.pathname.startsWith('/auth/v1/')) {
          data=url.pathname.includes('/token')?{access_token:token,refresh_token:'test-refresh',token_type:'bearer',expires_in:3600,user}:user;
        }else if(url.pathname.startsWith('/rest/v1/rpc/')){
          const rpc=url.pathname.split('/').at(-1)!;const args=request.postDataJSON()??{};
          const mapping:Record<string,{sql:string;keys:string[]}>= {
            submit_project:{sql:'select public.submit_project($1,$2,$3,$4) as r',keys:['p_id','p_token','p_answers','p_marketing']},
            resume_project:{sql:'select public.resume_project($1,$2) as r',keys:['p_id','p_token']},
            revoke_project_marketing:{sql:'select public.revoke_project_marketing($1,$2) as r',keys:['p_id','p_token']},
            finance_month_summary:{sql:'select public.finance_month_summary($1,$2) as r',keys:['p_month','p_offset']},
            producer_find_financial_projects:{sql:'select public.producer_find_financial_projects($1,$2) as r',keys:['p_search','p_offset']},
            complete_financial_project:{sql:'select public.complete_financial_project($1,$2) as r',keys:['p_project_id','p_expected_revision']},
            
            producer_contacts:{sql:'select public.producer_contacts($1,$2,$3,$4) as r',keys:['p_filter','p_offset','p_limit','p_inactivity_hours']},
            producer_contact_detail:{sql:'select public.producer_contact_detail($1) as r',keys:['p_id']},
            producer_history:{sql:'select public.producer_history($1,$2,$3) as r',keys:['p_project_id','p_before','p_before_id']},
            producer_update_tracking:{sql:'select public.producer_update_tracking($1,$2,$3,$4,$5,$6) as r',keys:['p_project_id','p_operation_id','p_status','p_next_action','p_return_at','p_expected_revision']},
            producer_agenda:{sql:'select public.producer_agenda($1,$2) as r',keys:['p_start','p_end']},
            producer_find_projects:{sql:'select public.producer_find_projects($1,$2) as r',keys:['p_search','p_offset']},
            finance_snapshot:{sql:'select public.finance_snapshot($1) as r',keys:['p_month']},
            finance_project_detail:{sql:'select public.finance_project_detail($1,$2) as r',keys:['p_project_id','p_offset']},
            save_project_contract:{sql:'select public.save_project_contract($1,$2,$3,$4,$5,$6,$7) as r',keys:['p_project_id','p_operation_id','p_amount_cents','p_contracted_on','p_due_on','p_expected_revision','p_reason']},
            record_finance_entry:{sql:'select public.record_finance_entry($1,$2,$3,$4,$5,$6,$7,$8) as r',keys:['p_project_id','p_id','p_kind','p_amount_cents','p_occurred_at','p_method','p_reason','p_refund_of']},
            is_producer:{sql:'select public.is_producer() as r',keys:[]},
            list_producer_projects:{sql:'select public.list_producer_projects($1,$2,$3,$4) as r',keys:['p_filter','p_offset','p_limit','p_inactivity_hours']},
            save_contact_tracking:{sql:'select public.save_contact_tracking($1,$2,$3,$4,$5,$6) as r',keys:['p_project_id','p_operation_id','p_status','p_next_action','p_return_at','p_expected_revision']},
            record_contact_history:{sql:'select public.record_contact_history($1,$2,$3,$4) as r',keys:['p_project_id','p_id','p_kind','p_body']},
            save_producer_session:{sql:'select public.save_producer_session($1,$2,$3,$4,$5,$6,$7,$8) as r',keys:['p_id','p_project_id','p_session_type','p_starts_at','p_ends_at','p_notes','p_status','p_expected_updated_at']},
          };
          const m=mapping[rpc];if(!m)throw new Error('RPC não contemplada no teste: '+rpc);
          data=(await db.query<{r:unknown}>(m.sql,m.keys.map(k=>args[k]??null))).rows[0].r;
        }else {
          const table=url.pathname.split('/').at(-1)!;
          const allowed=['projects','contact_tracking','contact_history','producer_sessions','project_contracts','contract_history','finance_entries'];
          if(!allowed.includes(table))throw new Error('Tabela desconhecida no teste.');
          const related=url.searchParams.get('select')?.includes('projects(');
          const result=await db.query<{r:Record<string,unknown>}>(related
            ? 'select to_jsonb(s)||jsonb_build_object(\'projects\',to_jsonb(p)) as r from public.producer_sessions s join public.projects p on p.id=s.project_id order by s.starts_at,s.id'
            : `select to_jsonb(t) as r from public.${table} t`);
          let rows=result.rows.map(r=>r.r);
          const projectFilter=url.searchParams.get('project_id');if(projectFilter?.startsWith('eq.'))rows=rows.filter(r=>r.project_id===projectFilter.slice(3));
          const publicFilter=url.searchParams.get('public_id');if(publicFilter?.startsWith('eq.'))rows=rows.filter(r=>r.public_id===publicFilter.slice(3));
          if(table==='contact_history')rows.sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))||String(b.id).localeCompare(String(a.id)));
          if(table==='producer_sessions') {
            const start=url.searchParams.get('starts_at')?.slice(3),end=url.searchParams.get('ends_at')?.slice(3);
            if(start)rows=rows.filter(r=>Date.parse(String(r.starts_at))<Date.parse(start));if(end)rows=rows.filter(r=>Date.parse(String(r.ends_at))>Date.parse(end));
          }
          data=rows;
        }
        const body=JSON.stringify(data);
        if(url.pathname.startsWith('/rest/'))traffic.push({path:url.pathname,request_bytes:Buffer.byteLength(request.postData()||''),response_bytes:Buffer.byteLength(body)});
        await route.fulfill({status:200,contentType:'application/json',body});
      }catch(e){const error=e as {code?:string;message?:string};await route.fulfill({status:error.code==='42501'?403:400,contentType:'application/json',body:JSON.stringify({code:error.code||'TEST_ERROR',message:error.message,details:null,hint:null})});}
    });
    try{await use({db,projectId:p.id,traffic});}finally{await db.close();}
  },
});
export { expect };
