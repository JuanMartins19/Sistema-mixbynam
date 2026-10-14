'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { formatDate, fromLocalInput, localDateToday, shiftDate } from '@/lib/datetime';
import { agendaDays, agendaRange, localSessionTimes, overlapsDay, sessionStatuses, type ProducerSession, type SessionWithProject } from '@/lib/schedule';
import type { Project } from '@/lib/project';
type RelatedProject=Pick<Project,'id'|'public_id'|'answers'>;
export default function ProducerAgenda() {
  const [day,setDay]=useState(localDateToday);
  const [view,setView]=useState<'day'|'week'>('day');
  const [sessions,setSessions]=useState<SessionWithProject[]>([]);
  const [loading,setLoading]=useState(false),[busy,setBusy]=useState(false);
  const [error,setError]=useState(''),[editorError,setEditorError]=useState(''),[message,setMessage]=useState('');
  const [showEditor,setShowEditor]=useState(false),[editing,setEditing]=useState<ProducerSession|null>(null);
  const [related,setRelated]=useState<RelatedProject|null>(null);
  const [type,setType]=useState('Gravação'),[start,setStart]=useState(''),[end,setEnd]=useState(''),[notes,setNotes]=useState('');
  const [status,setStatus]=useState<ProducerSession['status']>('reserved');
  const [search,setSearch]=useState(''),[options,setOptions]=useState<RelatedProject[]>([]),[searchPage,setSearchPage]=useState(0),[moreProjects,setMoreProjects]=useState(false),[searching,setSearching]=useState(false);
  const newId=useRef<string|null>(null),flight=useRef(false),sequence=useRef(0),searchSequence=useRef(0);
  const editorTitle=useRef<HTMLHeadingElement>(null);
  const days=useMemo(()=>agendaDays(day,view),[day,view]);
  const range=useMemo(()=>agendaRange(days),[days]);
  const load=useCallback(async()=>{
    const seq=++sequence.current;setLoading(true);setError('');setSessions([]);
    try {
      const all:SessionWithProject[]=[];let offset=0;
      while(true) {
        const {data,error:e}=await getSupabase().from('producer_sessions').select('*,projects(id,public_id,answers)').lt('starts_at',range.end).gt('ends_at',range.start).order('starts_at',{ascending:true}).order('id',{ascending:true}).range(offset,offset+499);
        if(e)throw new Error('Não foi possível carregar a agenda. Confira se a migração 003 foi aplicada e tente novamente.');
        if(seq!==sequence.current)return;
        all.push(...data as SessionWithProject[]);if(data.length<500)break;offset+=500;
      }
      setSessions(all);
    }catch(e){if(seq===sequence.current)setError(e instanceof Error?e.message:'Falha ao carregar agenda.');}
    finally{if(seq===sequence.current)setLoading(false);}
  },[range]);
  useEffect(()=>{void load();return()=>{sequence.current++;searchSequence.current++;};},[load]);
  useEffect(()=>{if(showEditor)editorTitle.current?.focus();},[showEditor,editing]);
  async function findProjects(offsetPage=0) {
    const seq=++searchSequence.current;setSearching(true);setEditorError('');
    try {
      let q=getSupabase().from('projects').select('id,public_id,answers').order('created_at',{ascending:false}).order('id',{ascending:false}).range(offsetPage*20,offsetPage*20+20);
      const value=search.trim();
      if(value)q=/^[a-f0-9-]{36}$/i.test(value)?q.eq('public_id',value):q.ilike('answers->>artist_name',`%${value.replace(/[\\%_]/g,'\\$&')}%`);
      const {data,error:e}=await q;if(e)throw new Error('Não foi possível buscar artistas. Tente novamente.');
      if(seq!==searchSequence.current)return;
      setOptions(data.slice(0,20) as RelatedProject[]);setMoreProjects(data.length>20);setSearchPage(offsetPage);
    }catch(e){if(seq===searchSequence.current)setEditorError(e instanceof Error?e.message:'Falha na busca.');}
    finally{if(seq===searchSequence.current)setSearching(false);}
  }
  function openEditor(s?:SessionWithProject) {
    setEditorError('');setMessage('');setEditing(s??null);setRelated(s?.projects??null);setType(s?.session_type??'Gravação');
    const times=s?localSessionTimes(s):{start:day+'T10:00',end:day+'T11:00'};
    setStart(times.start);setEnd(times.end);setNotes(s?.notes??'');setStatus(s?.status??'reserved');setShowEditor(true);setOptions([]);setSearch('');setSearchPage(0);newId.current=s?.id??crypto.randomUUID();
  }
  async function save(e:React.FormEvent) {
    e.preventDefault();if(flight.current)return;setEditorError('');setMessage('');
    try {
      if(!related)throw new Error('Selecione o pedido / artista relacionado.');
      const starts=fromLocalInput(start),ends=fromLocalInput(end);if(Date.parse(ends)<=Date.parse(starts))throw new Error('O fim precisa ser posterior ao início.');
      if(type.trim().length<2)throw new Error('Informe o tipo de sessão.');
      flight.current=true;setBusy(true);
      const {data,error:e}=await getSupabase().rpc('save_producer_session',{
        p_id:newId.current,p_project_id:related.id,p_session_type:type.trim(),p_starts_at:starts,p_ends_at:ends,p_notes:notes,p_status:status,p_expected_updated_at:editing?.updated_at??null,
      });
      if(e||!data)throw new Error(e?.code==='23P01'?'Conflito de horário: já existe uma sessão nesse intervalo. Suas respostas foram mantidas.':e?.code==='40001'?'Esta sessão mudou em outra janela. Recarregue a agenda e reabra a sessão.':'Não foi possível confirmar a sessão no banco. Tente novamente.');
      setShowEditor(false);setMessage('Sessão confirmada no banco.');await load();
    }catch(e){setEditorError(e instanceof Error?e.message:'Falha ao salvar sessão.');}finally{setBusy(false);flight.current=false;}
  }
  async function cancel(s:SessionWithProject) {
    if(flight.current || !window.confirm('Cancelar esta sessão e liberar o horário?'))return;
    flight.current=true;setBusy(true);setError('');setMessage('');
    try {
      const {data,error:e}=await getSupabase().rpc('save_producer_session',{p_id:s.id,p_project_id:s.project_id,p_session_type:s.session_type,p_starts_at:s.starts_at,p_ends_at:s.ends_at,p_notes:s.notes,p_status:'cancelled',p_expected_updated_at:s.updated_at});
      if(e||!data)throw new Error(e?.code==='40001'?'A sessão mudou em outra janela. Atualize a agenda antes de cancelar.':'Não foi possível confirmar o cancelamento. Tente novamente.');
      setMessage('Sessão cancelada no banco. Horário liberado.');await load();
    }catch(e){setError(e instanceof Error?e.message:'Falha no cancelamento.');}finally{setBusy(false);flight.current=false;}
  }
  return <section aria-labelledby="agenda-title"><h2 id="agenda-title">Agenda do produtor</h2><p className="agenda-hours">Datas e horários em America/Sao_Paulo. Sessões são cadastradas manualmente; o formulário público não agenda.</p>
    <div className="agenda-toolbar"><div className="filters" role="group" aria-label="Visualização da agenda"><button className={view==='day'?'active':''} aria-pressed={view==='day'} onClick={()=>setView('day')}>Diária</button><button className={view==='week'?'active':''} aria-pressed={view==='week'} onClick={()=>setView('week')}>Semanal</button></div><div><button className="secondary" disabled={busy} onClick={()=>setDay(d=>shiftDate(d,view==='day'?-1:-7))}>← Anterior</button><label className="sr-only" htmlFor="agenda-day">Data da agenda</label><input id="agenda-day" type="date" value={day} onChange={e=>{if(/^\d{4}-\d{2}-\d{2}$/.test(e.target.value))setDay(e.target.value);}}/><button className="secondary" disabled={busy} onClick={()=>setDay(d=>shiftDate(d,view==='day'?1:7))}>Próxima →</button></div><div><button className="secondary" disabled={busy||loading} onClick={()=>void load()}>Atualizar agenda</button><button className="secondary" disabled={busy} onClick={()=>openEditor()}>Nova sessão +</button></div></div>
    {error&&<p className="error" role="alert">{error}</p>}{message&&<p className="success-note" role="status">{message}</p>}{loading&&<p className="agenda-loading" role="status">Consultando agenda…</p>}
    {!error&&<div className={`agenda-days ${view==='day'?'daily':''}`}>{days.map(d=><section key={d} className="agenda-day" aria-label={`Sessões de ${d}`}><h3>{new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'2-digit',month:'2-digit',timeZone:'UTC'}).format(new Date(d+'T12:00:00Z'))}</h3>{sessions.filter(s=>overlapsDay(s,d)).map(s=><article className={`session-card ${s.status}`} key={s.id}><span className="session-time">{formatDate(s.starts_at)} → {formatDate(s.ends_at)}</span><strong>{s.projects?.answers.artist_name??'Pedido indisponível'}</strong><p>{s.session_type} · {sessionStatuses[s.status]}</p><p>{s.notes}</p><small className="table-id">{s.projects?.public_id}</small><button className="text-button" disabled={busy} onClick={()=>openEditor(s)}>Editar sessão</button>{s.status!=='cancelled'&&<button className="text-button" disabled={busy} onClick={()=>void cancel(s)}>Cancelar sessão</button>}</article>)}{!loading&&!sessions.some(s=>overlapsDay(s,d))&&<p className="agenda-empty">Sem sessões neste dia.</p>}</section>)}</div>}
    {showEditor&&<section className="session-editor"><h2 ref={editorTitle} tabIndex={-1}>{editing?'Editar sessão':'Nova sessão'}</h2><p className="small-note">Horários de Brasília. O banco verifica conflitos ao salvar.</p>
      {editorError&&<p className="error session-error" role="alert">{editorError}</p>}
      <div className="session-search"><label>Buscar pedido por artista ou identificador público<input value={search} disabled={busy} onChange={e=>{setSearch(e.target.value);setSearchPage(0);}} placeholder="Nome artístico ou identificador"/></label><button className="secondary" disabled={busy||searching} onClick={()=>void findProjects()}>{searching?'Buscando…':'Buscar artistas'}</button><div className="session-options">{options.map(p=><button key={p.id} disabled={busy} onClick={()=>setRelated(p)}>{p.answers.artist_name} · {p.public_id}</button>)}</div>{options.length>0&&<div className="pagination"><button className="secondary" disabled={searchPage===0||busy||searching} onClick={()=>void findProjects(searchPage-1)}>Anterior na busca</button><button className="secondary" disabled={!moreProjects||busy||searching} onClick={()=>void findProjects(searchPage+1)}>Mais artistas</button></div>}{related&&<p className="session-selected">Pedido selecionado: <strong>{related.answers.artist_name}</strong> · {related.public_id}</p>}</div>
      <form onSubmit={save}><fieldset disabled={busy}><label>Tipo de sessão<input required maxLength={100} value={type} onChange={e=>setType(e.target.value)} placeholder="Ex.: gravação, produção, mixagem"/></label><div className="form-columns"><label>Início — horário de Brasília<input type="datetime-local" required value={start} onChange={e=>setStart(e.target.value)}/></label><label>Fim — horário de Brasília<input type="datetime-local" required value={end} onChange={e=>setEnd(e.target.value)}/></label></div><label>Status da sessão<select value={status} onChange={e=>setStatus(e.target.value as ProducerSession['status'])}>{Object.entries(sessionStatuses).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label>Observações da sessão<textarea maxLength={3000} value={notes} onChange={e=>setNotes(e.target.value)}/></label><div className="form-actions"><button className="primary" disabled={busy}>{busy?'Salvando no banco…':'Salvar sessão'}</button><button type="button" className="secondary" disabled={busy} onClick={()=>setShowEditor(false)}>Fechar edição</button></div></fieldset></form>
    </section>}
  </section>;
}
