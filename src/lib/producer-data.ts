import { getSupabase } from './supabase';
import { producerCache } from './cache';
import type { ContactHistory,ContactTracking,CommercialStatus } from './followup';
import type { Project } from './project';
import { agendaRange,overlapsDay,type SessionWithProject } from './schedule';
export type ContactCard={id:string;artist_name:string;services:string[]|null;form_status:Project['status'];progress:number;commercial_status:CommercialStatus;next_action:string|null;return_at:string|null;recovery_reasons:string[]};
export type ContactDetail={queried_at:string;project:Project;tracking:ContactTracking|null;history:ContactHistory[]};
export async function rpc<T>(name:string,args:Record<string,unknown>={}) {
  const {data,error}=await getSupabase().rpc(name,args);
  if(error||data===null){console.error('Falha na operação',{operation:name,code:error?.code});throw Object.assign(new Error('Não foi possível concluir. Tente novamente.'),{code:error?.code});}
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
