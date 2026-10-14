import { getSupabase } from './supabase';
import { producerCache } from './cache';
import type { ContactHistory,ContactTracking,CommercialStatus } from './followup';
import type { Project } from './project';
import { agendaRange,overlapsDay,type SessionWithProject } from './schedule';
export type ContactCard={id:string;artist_name:string;services:string[]|null;form_status:Project['status'];progress:number;commercial_status:CommercialStatus;next_action:string|null;return_at:string|null;recovery_reasons:string[]};
export type ContactDetail={queried_at:string;project:Project;tracking:ContactTracking|null;history:ContactHistory[]};
const financeErrors:Record<string,string>={
  'Recebimento acima do valor contratado':'O pagamento ultrapassa o saldo deste contrato. Confira o valor ou ajuste o contrato antes de registrar.',
  'Estorno superior ao recebido disponível':'O estorno ultrapassa o valor disponível do recebimento original.',
  'Registre um contrato antes do recebimento':'Salve o contrato deste projeto antes de registrar o pagamento.',
  'Recebimento original inválido':'Selecione novamente o recebimento que deseja estornar.',
  'Lançamento inválido':'Confira o valor e a data do pagamento. A data não pode estar no futuro. Para estornos, informe também o motivo.',
  'Operação já utilizada':'Esta tentativa já foi utilizada com outros dados. Atualize o financeiro antes de tentar novamente.',
};
export async function rpc<T>(name:string,args:Record<string,unknown>={}) {
  const {data,error}=await getSupabase().rpc(name,args);
  if(error||data===null){
    const code=error?.code;
    // Falhas esperadas aparecem no formulário; logs não incluem respostas ou contatos.
    console.warn('Operação não concluída',{operation:name,code:code||'unknown'});
    const message=name==='record_finance_entry'&&code==='22023'&&error?financeErrors[error.message]:undefined;
    throw Object.assign(new Error(message||(code==='55000'?'Este pedido já foi concluído no financeiro e não permite alterações.':code==='42501'||code==='PGRST301'?'Sua sessão não permite esta operação. Saia e entre novamente.':code==='PGRST202'?'O banco precisa ser atualizado para esta função. Confira se as migrações financeiras foram aplicadas.':'Não foi possível concluir. Confira sua conexão e tente novamente.')),{code});
  }
  return data as T;
}
export const contactDetail=(id:string)=>producerCache.query<ContactDetail>('detail:'+id,()=>rpc('producer_contact_detail',{p_id:id}));
export async function loadAgenda(days:string[]){
  const scope=producerCache.scope();
  const months=[...new Set(days.map(d=>d.slice(0,7)))].sort();
  const missing=months.filter(m=>!producerCache.peek('agenda:month:'+m));
  if(missing.length){const first=missing[0]+'-01',last=missing.at(-1)!;const [y,m]=last.split('-').map(Number);const finalDay=new Date(Date.UTC(y,m,0)).toISOString().slice(0,10);const range=agendaRange([first,finalDay]);
    const data=await producerCache.query<{queried_at:string;rows:SessionWithProject[]}>('agenda:range:'+missing.join(','),()=>rpc('producer_agenda',{p_start:range.start,p_end:range.end}));
    if(scope!==producerCache.scope())throw new Error('Sessão alterada.');
    for(const month of missing){const [year,num]=month.split('-').map(Number);const lastDay=new Date(Date.UTC(year,num,0)).toISOString().slice(0,10);const boundary=agendaRange([month+'-01',lastDay]);producerCache.put('agenda:month:'+month,{queried_at:data.queried_at,rows:data.rows.filter(s=>Date.parse(s.starts_at)<Date.parse(boundary.end)&&Date.parse(s.ends_at)>Date.parse(boundary.start))});}
  }
  const snapshots=await Promise.all(months.map(m=>producerCache.peek<{queried_at:string;rows:SessionWithProject[]}>('agenda:month:'+m)!));
  return {queried_at:snapshots.map(s=>s.queried_at).sort()[0],rows:[...new Map(snapshots.flatMap(s=>s.rows).map(s=>[s.id,s])).values()].filter(s=>days.some(day=>overlapsDay(s,day))).sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at))};
}
