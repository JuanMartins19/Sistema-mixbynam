'use client';
import { useEffect, useRef, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { artistWhatsappLink, commercialStatuses, type CommercialStatus, type ContactHistory, type ContactTracking } from '@/lib/followup';
import { formatDate, fromLocalInput, toLocalInput } from '@/lib/datetime';
import type { Project } from '@/lib/project';

export default function ContactFollowup({project,onChange}:{project:Project;onChange:()=>void}) {
  const [tracking,setTracking]=useState<ContactTracking|null>(null);
  const [history,setHistory]=useState<ContactHistory[]>([]);
  const [status,setStatus]=useState<CommercialStatus>('new');
  const [action,setAction]=useState('');const [returnAt,setReturnAt]=useState('');
  const [kind,setKind]=useState<'note'|'contact'>('note');const [body,setBody]=useState('');
  const [busy,setBusy]=useState(false);const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');const [message,setMessage]=useState('');
  const [loadFailed,setLoadFailed]=useState(false);
  const [more,setMore]=useState(false);
  const flight=useRef(false), sequence=useRef(0);
  // UUID é mantido por conteúdo até a confirmação, inclusive em retry de resposta perdida.
  const operation=useRef<{fingerprint:string;id:string}|null>(null);
  const noteOperation=useRef<{fingerprint:string;id:string}|null>(null);
  async function load() {
    const seq=++sequence.current;setLoading(true);setError('');
    try {
      const db=getSupabase();
      const [t,h]=await Promise.all([db.from('contact_tracking').select('*').eq('project_id',project.id).maybeSingle(),db.from('contact_history').select('*').eq('project_id',project.id).order('created_at',{ascending:false}).order('id',{ascending:false}).range(0,49)]);
      if(t.error || h.error) throw new Error('Não foi possível carregar o acompanhamento. Verifique se a migração 002 foi aplicada e tente novamente.');
      if(seq!==sequence.current) return;
      const row=t.data as ContactTracking|null;setTracking(row);setStatus(row?.commercial_status??'new');setAction(row?.next_action??'');setReturnAt(row?.return_at?toLocalInput(row.return_at):'');setHistory(h.data as ContactHistory[]);setMore((h.data?.length??0)===50);setLoadFailed(false);
    }catch(e){if(seq===sequence.current){setError(e instanceof Error?e.message:'Falha ao consultar.');setLoadFailed(true);}}
    finally{if(seq===sequence.current)setLoading(false);}
  }
  useEffect(()=>{void load();return()=>{sequence.current++;};},[project.id]); // componente recebe key=project.id
  async function loadMore() {
    setBusy(true);const seq=sequence.current;
    try {
      const last=history.at(-1);if(!last)return;
      const {data,error:e}=await getSupabase().from('contact_history').select('*').eq('project_id',project.id).or(`created_at.lt.${last.created_at},and(created_at.eq.${last.created_at},id.lt.${last.id})`).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(50);
      if(e)throw new Error('Falha ao carregar mais registros.');if(seq!==sequence.current)return;
      setHistory(h=>[...h,...data as ContactHistory[]]);setMore(data.length===50);
    }catch(e){setError(e instanceof Error?e.message:'Falha no histórico.');}finally{setBusy(false);}
  }
  function idFor(ref:typeof operation,payload:unknown) {const fingerprint=JSON.stringify(payload);if(ref.current?.fingerprint!==fingerprint) ref.current={fingerprint,id:crypto.randomUUID()};return ref.current!.id;}
  async function save(e:React.FormEvent) {
    e.preventDefault();if(flight.current || loading)return;setError('');setMessage('');
    try {
      if(Boolean(action.trim())!==Boolean(returnAt))throw new Error('Preencha próxima ação e data de retorno juntas, ou deixe ambas vazias.');
      const payload={p_project_id:project.id,p_status:status,p_next_action:action.trim()||null,p_return_at:returnAt?fromLocalInput(returnAt):null,p_expected_revision:tracking?.revision??0};
      flight.current=true;setBusy(true);
      const {data,error:e}=await getSupabase().rpc('save_contact_tracking',{...payload,p_operation_id:idFor(operation,payload)});
      if(e || !data)throw new Error(e?.code==='40001'?'Outra janela alterou o acompanhamento. Use Recarregar acompanhamento antes de salvar.':'Falha ao confirmar o acompanhamento. Tente salvar novamente.');
      operation.current=null;setTracking(data as ContactTracking);setMessage('Acompanhamento confirmado no banco.');onChange();await load();
    }catch(e){setError(e instanceof Error?e.message:'Falha ao salvar.');}finally{setBusy(false);flight.current=false;}
  }
  async function record(e:React.FormEvent) {
    e.preventDefault();if(flight.current || loading)return;setError('');setMessage('');
    if(!body.trim()){setError('Escreva uma nota ou descreva o contato realizado.');return;}
    if(kind==='contact' && !window.confirm('Você confirma que este contato foi realizado? Abrir o WhatsApp, sozinho, não confirma envio.'))return;
    flight.current=true;setBusy(true);
    try {
      const payload={p_project_id:project.id,p_kind:kind,p_body:body.trim()};
      const {data,error:e}=await getSupabase().rpc('record_contact_history',{...payload,p_id:idFor(noteOperation,payload)});
      if(e || !data)throw new Error('Não foi possível confirmar o registro. Tente novamente.');
      noteOperation.current=null;setBody('');setMessage('Registro confirmado no banco.');onChange();await load();
    }catch(e){setError(e instanceof Error?e.message:'Falha ao registrar.');}finally{setBusy(false);flight.current=false;}
  }
  const blocked=tracking?.commercial_status==='do_not_contact';
  const link=artistWhatsappLink(project.answers.whatsapp,project.public_id,project.answers.artist_name,process.env.NEXT_PUBLIC_PRODUCER_NAME||'o produtor');
  return <section className="followup" aria-labelledby="followup-title"><h3 id="followup-title">Acompanhamento do contato</h3><p className="small-note">Situação comercial e atendimento são separados do progresso do formulário. Horários de Brasília.</p>
    {loading&&<p role="status">Carregando acompanhamento…</p>}{error&&<p className="error" role="alert">{error}</p>}{message&&<p className="success-note" role="status">{message}</p>}
    <button className="text-button" disabled={busy||loading} onClick={()=>void load()}>Recarregar acompanhamento</button>
    <form onSubmit={save}><fieldset disabled={busy||loading||loadFailed}>
      <label>Situação comercial<select value={status} onChange={e=>setStatus(e.target.value as CommercialStatus)}>{Object.entries(commercialStatuses).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
      <div className="form-columns"><label>Próxima ação<input maxLength={500} value={action} onChange={e=>setAction(e.target.value)} placeholder="Ex.: conversar sobre as referências"/></label><label>Data e hora de retorno<input type="datetime-local" value={returnAt} onChange={e=>setReturnAt(e.target.value)}/></label></div>
      <button className="primary" disabled={busy||loading}>Salvar acompanhamento</button>
    </fieldset></form>
    <div className="manual-contact">{blocked?<p>Não contatar: este pedido fica fora da fila de recuperação.</p>:link?<a className="secondary" href={link} target="_blank" rel="noopener noreferrer">Abrir WhatsApp do artista ↗</a>:<p>WhatsApp inválido. Confira o telefone informado.</p>}<p className="small-note">Abrir o WhatsApp não registra mensagem enviada nem contato realizado. Confirme manualmente abaixo após atender.</p></div>
    <form onSubmit={record}><fieldset disabled={busy||loading||loadFailed}>
      <label>Tipo de registro<select value={kind} onChange={e=>setKind(e.target.value as 'note'|'contact')}><option value="note">Nota interna</option><option value="contact" disabled={blocked}>Contato realizado — confirmação manual</option></select></label>
      <label>Registro de atendimento<textarea maxLength={3000} value={body} onChange={e=>setBody(e.target.value)} placeholder="Descreva a conversa ou registre uma nota"/></label>
      <button className="secondary" disabled={busy||loading||(blocked&&kind==='contact')}>{kind==='contact'?'Confirmar contato realizado':'Registrar nota'}</button>
    </fieldset></form>
    <h3>Histórico de atendimento</h3><ol className="history-list">{history.map(h=><li key={h.id}><div><strong>{h.kind==='contact'?'Contato realizado':h.kind==='note'?'Nota interna':'Acompanhamento atualizado'}</strong><time dateTime={h.created_at}>{formatDate(h.created_at)}</time></div><p>{h.body}</p>{h.kind==='tracking'&&<p className="small-note">{h.metadata.commercial_status&&commercialStatuses[h.metadata.commercial_status]} · {h.metadata.next_action||'Sem próxima ação'}{h.metadata.return_at&&` · ${formatDate(h.metadata.return_at)}`}</p>}</li>)}</ol>{!loading&&history.length===0&&<p className="small-note">Nenhum atendimento registrado.</p>}{more&&<button className="secondary" disabled={busy} onClick={()=>void loadMore()}>Carregar mais registros</button>}
  </section>;
}
