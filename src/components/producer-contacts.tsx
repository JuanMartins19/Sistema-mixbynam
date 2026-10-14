'use client';
import { useEffect,useRef,useState } from 'react';
import { services,type Project } from '@/lib/project';
import { producerCache } from '@/lib/cache';
import { rpc,type ContactCard } from '@/lib/producer-data';
import { INACTIVITY_HOURS,commercialStatuses,recoveryLabels } from '@/lib/followup';
import { formatDate } from '@/lib/datetime';
import { getSupabase } from '@/lib/supabase';
import { backupV3,projectsCsv } from '@/lib/export';
import ContactFollowup from './contact-followup';
export default function ProducerContacts({active}:{active:boolean}){
  const [filter,setFilter]=useState('all'),[page,setPage]=useState(0),[selected,setSelected]=useState<string|null>(null);
  const [data,setData]=useState<{queried_at:string;rows:ContactCard[]}|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState(''),[exporting,setExporting]=useState(false);
  const sequence=useRef(0);
  async function load(force=false){const seq=++sequence.current;setLoading(true);setError('');const key=`contacts:${filter}:${page}`;if(force)producerCache.invalidate('contacts:');try{const r=await producerCache.query<typeof data>(key,()=>rpc('producer_contacts',{p_filter:filter,p_offset:page*20,p_limit:21,p_inactivity_hours:INACTIVITY_HOURS}));if(seq===sequence.current)setData(r);}catch{if(seq===sequence.current){setData(null);setError('Não foi possível carregar os contatos. Tente atualizar.');}}finally{if(seq===sequence.current)setLoading(false);}}
  useEffect(()=>{if(active)void load();return()=>{sequence.current++;};},[active,filter,page]);
  async function exportAll(format:'json'|'csv'){
    setExporting(true);setError('');const epoch=sequence.current;
    try{async function collect(table:string,key='id'){const rows:unknown[]=[];let offset=0;while(true){const {data,error}=await getSupabase().from(table).select('*').order(key).range(offset,offset+499);if(error)throw error;rows.push(...data);if(data.length<500)break;offset+=500;}return rows;}
      const projects=await collect('projects') as Project[];let body:string;
      if(format==='csv')body=projectsCsv(projects);else{const tables=['contact_tracking','contact_history','producer_sessions','project_contracts','contract_history','finance_entries'];const rows=await Promise.all(tables.map(t=>collect(t,t==='contact_tracking'||t==='project_contracts'?'project_id':'id')));body=JSON.stringify(backupV3(new Date().toISOString(),projects,...rows as [unknown[],unknown[],unknown[],unknown[],unknown[],unknown[]]),null,2);}
      if(epoch!==sequence.current)return;
      const url=URL.createObjectURL(new Blob([body],{type:format==='json'?'application/json':'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download=`mixbynam-${new Date().toISOString().slice(0,10)}.${format}`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch{setError('Não foi possível exportar. Nenhum arquivo incompleto foi baixado.');}finally{setExporting(false);}
  }
  const rows=data?.rows.slice(0,20)??[],more=(data?.rows.length??0)>20;
  function changed(id:string,tracking:{commercial_status:keyof typeof commercialStatuses;next_action:string|null;return_at:string|null},contact=false){producerCache.invalidate('contacts:');producerCache.invalidate('finance:');setData(old=>old?{...old,rows:old.rows.map(r=>r.id===id?{...r,...tracking,recovery_reasons:[...new Set([...r.recovery_reasons.filter(reason=>reason!=='overdue'&&(reason!=='unattended'||!contact)),...(tracking.return_at&&Date.parse(tracking.return_at)<=Date.now()?['overdue']:[])])]}:r).filter(r=>!['recovery','pending'].includes(filter)||(!['won','lost','do_not_contact'].includes(r.commercial_status)&&!(filter==='pending'&&r.id===id&&contact)&&(filter!=='recovery'||r.recovery_reasons.length>0)))}:old);}
  return <section><div className="panel-toolbar"><div className="filters" role="group" aria-label="Filtrar pedidos">{[['all','Todos'],['recovery','Retomar contato'],['pending','Sem atendimento'],['completed','Concluídos']].map(([value,label])=><button key={value} className={filter===value?'active':''} aria-pressed={filter===value} onClick={()=>{setFilter(value);setPage(0);}}>{label}</button>)}</div>{!selected&&<button className="secondary" disabled={loading} onClick={()=>void load(true)}>Atualizar contatos</button>}<details className="export-menu"><summary>Exportar</summary><button className="text-button" disabled={exporting} onClick={()=>void exportAll('json')}>Backup JSON</button><button className="text-button" disabled={exporting} onClick={()=>void exportAll('csv')}>CSV de pedidos</button><p>Exportação da aplicação. Não substitui backup de banco e Auth.</p></details></div>
    {filter==='recovery'&&<p className="small-note">Pedidos enviados sem atendimento e retornos vencidos. Fechados, perdidos e “não contatar” ficam fora desta fila.</p>}
    {error&&<p className="error" role="alert">{error}</p>}{loading&&<p role="status">Carregando contatos…</p>}
    {!loading&&data&&rows.length===0&&<p className="empty">Nenhum pedido neste filtro.</p>}
    <div className="contact-cards">{rows.map(p=><article className="contact-card" key={p.id}><h2>{p.artist_name}</h2><p>{p.services?.map(s=>services[s as keyof typeof services]).join(', ')||'Serviços ainda não informados'}</p><strong>{commercialStatuses[p.commercial_status]}</strong><p className="small-note">{p.return_at?`${p.next_action} · ${formatDate(p.return_at)}`:'Sem próximo retorno'}</p><span className="badge">{p.form_status==='completed'?'Formulário concluído':`Formulário incompleto · ${p.progress}/4`}</span>{filter==='recovery'&&p.recovery_reasons.map(r=><small className="queue-reason" key={r}>{recoveryLabels[r as keyof typeof recoveryLabels]}</small>)}<button className="secondary" onClick={()=>setSelected(p.id)}>Ver pedido</button></article>)}</div>
    {(page>0||more)&&<div className="pagination"><button className="secondary" disabled={page===0||loading} onClick={()=>setPage(p=>p-1)}>Anterior</button><span>Página {page+1}</span><button className="secondary" disabled={!more||loading} onClick={()=>setPage(p=>p+1)}>Próxima</button></div>}
    {data&&<p className="small-note">Consultado em {formatDate(data.queried_at)}. Dados podem ficar em memória por até 60 segundos.</p>}
    {selected&&<ContactFollowup key={selected} projectId={selected} onClose={()=>setSelected(null)} onChange={(t,contact)=>changed(selected,t,contact)}/>} 
  </section>;
}
