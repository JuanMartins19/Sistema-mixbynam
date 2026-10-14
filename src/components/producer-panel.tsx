'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { services, type Project } from '@/lib/project';
import { projectsCsv } from '@/lib/export';
import ProjectSummary from './project-summary';
const pageSize = 20;
function date(value: string) { return new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(value)); }
export default function ProducerPanel() {
  const [authorized,setAuthorized] = useState(false);
  const [checking,setChecking] = useState(true);
  const [email,setEmail] = useState(''); const [password,setPassword] = useState('');
  const [error,setError] = useState(''); const [busy,setBusy] = useState(false);
  const [filter,setFilter] = useState('all'); const [page,setPage] = useState(0);
  const [rows,setRows] = useState<Project[]>([]); const [hasMore,setHasMore] = useState(false);
  const [selected,setSelected] = useState<Project|null>(null); const [loaded,setLoaded] = useState(false);
  const revision = useRef(0);
  const loadSequence = useRef(0);
  const detailTitle = useRef<HTMLHeadingElement>(null);
  const checkAccess = useCallback(async () => {
    const v = ++revision.current;
    setChecking(true); setAuthorized(false); setRows([]); setSelected(null); setLoaded(false); setBusy(false);
    try {
      const db = getSupabase(); const {data:{session},error:authError} = await db.auth.getSession();
      if(authError) throw new Error('Não foi possível consultar a sessão.');
      if(session) {
        const {data,error:dbError} = await db.rpc('is_producer');
        if(dbError || data !== true) throw new Error('Acesso não autorizado. Esta conta não é o produtor configurado.');
        if(v===revision.current) {setAuthorized(true);setError('');}
      }
    } catch(e) {if(v===revision.current) setError(e instanceof Error?e.message:'Falha na autorização.');}
    finally {if(v===revision.current) setChecking(false);}
  },[]);
  useEffect(() => {
    void checkAccess();
    try {
      const {data:{subscription}} = getSupabase().auth.onAuthStateChange(() => {
        // Executar fora do callback de Auth evita deadlock de chamadas Supabase.
        setTimeout(()=>void checkAccess(),0);
      });
      return ()=>{revision.current++;subscription.unsubscribe();};
    } catch { return; }
  },[checkAccess]);
  const load = useCallback(async () => {
    const v=revision.current, seq=++loadSequence.current; setBusy(true);setError('');setLoaded(false);setRows([]);
    try {
      let query = getSupabase().from('projects').select('*').order('created_at',{ascending:false}).order('id',{ascending:false}).range(page*pageSize,(page+1)*pageSize);
      if(filter!=='all') query=query.eq('status',filter);
      const {data,error:dbError} = await query;
      if(dbError) throw new Error('Não foi possível carregar os pedidos. Tente novamente.');
      if(v===revision.current && seq===loadSequence.current) {setRows((data ?? []).slice(0,pageSize) as Project[]);setHasMore((data?.length ?? 0)>pageSize);setLoaded(true);}
    } catch(e) {if(v===revision.current && seq===loadSequence.current) setError(e instanceof Error?e.message:'Falha ao consultar.');}
    finally {if(v===revision.current && seq===loadSequence.current) setBusy(false);}
  },[filter,page]);
  useEffect(()=>{if(authorized) void load();},[authorized,load]);
  useEffect(()=>{if(selected) detailTitle.current?.focus();},[selected]);
  async function login(e: React.FormEvent) {
    e.preventDefault();setBusy(true);setError('');
    try {
      const {error:authError} = await getSupabase().auth.signInWithPassword({email:email.trim(),password});
      if(authError) throw new Error('Não foi possível entrar. Confira e-mail e senha.');
      setPassword('');await checkAccess();
    } catch(e) {setError(e instanceof Error?e.message:'Falha ao entrar.');} finally {setBusy(false);}
  }
  async function logout() {
    revision.current++;setAuthorized(false);setRows([]);setSelected(null);setLoaded(false);setError('');setBusy(false);
    try {const {error:e}=await getSupabase().auth.signOut();if(e) throw e;} catch {setError('Não foi possível encerrar a sessão. Tente sair novamente.');}
  }
  async function exportAll(format: 'json'|'csv') {
    const v=revision.current; setBusy(true);setError('');
    try {
      const {data:allowed,error:denied} = await getSupabase().rpc('is_producer');
      if(denied || allowed!==true) throw new Error('Acesso não autorizado para exportar.');
      const all: Project[]=[];const cutoff=new Date().toISOString();let offset=0;
      while(true) {
        const {data,error:e}=await getSupabase().from('projects').select('*').lte('created_at',cutoff).order('created_at',{ascending:true}).order('id',{ascending:true}).range(offset,offset+499);
        if(e) throw new Error('A exportação falhou. Nenhum arquivo incompleto foi baixado.');
        if(v!==revision.current) return;
        all.push(...data as Project[]);if(data.length<500) break;offset+=500;
      }
      const body=format==='csv'?projectsCsv(all):JSON.stringify({version:1,exported_at:cutoff,projects:all},null,2);
      const blob=new Blob([body],{type:format==='csv'?'text/csv;charset=utf-8':'application/json'});
      const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`mixbynam-backup-${cutoff.slice(0,10)}.${format}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    } catch(e) {setError(e instanceof Error?e.message:'Falha na exportação.');} finally {setBusy(false);}
  }
  if(checking) return <main className="panel"><p role="status">Verificando acesso…</p></main>;
  if(!authorized) return <main className="login-wrap"><section className="form-card login-card"><div className="eyebrow">ACESSO PRIVADO</div><h1>Seu estúdio,<br/><em>em um só lugar.</em></h1><p className="form-subtitle">Entre com a conta previamente criada para o produtor.</p><form onSubmit={login}><fieldset disabled={busy}><label>E-mail<input type="email" required autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Senha<input type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label></fieldset>{error&&<p className="error" role="alert">{error}</p>}<button className="primary" disabled={busy}>{busy?'Verificando…':'Entrar no painel ↗'}</button></form><button className="text-button" onClick={()=>void logout()}>Encerrar sessão existente</button><p className="small-note">Sem cadastro público. Para recuperar o acesso, fale com o responsável pela configuração do Supabase.</p></section></main>;
  return <main className="panel"><div className="panel-header"><div><div className="eyebrow">ÁREA DO PRODUTOR</div><h1>Projetos em vista<span>.</span></h1><p>Contatos, ideias e os próximos sons para produzir.</p></div><button className="secondary" onClick={()=>void logout()}>Sair ↗</button></div>
    <div className="panel-toolbar"><div className="filters" role="group" aria-label="Filtrar pedidos">{[['all','Todos'],['completed','Concluídos'],['incomplete','Incompletos']].map(([value,label])=><button key={value} className={filter===value?'active':''} disabled={busy} aria-pressed={filter===value} onClick={()=>{setFilter(value);setPage(0);setSelected(null);}}>{label}</button>)}</div><div className="export-buttons"><button className="secondary" disabled={busy} onClick={()=>void load()}>Atualizar</button><button className="secondary" disabled={busy} onClick={()=>void exportAll('json')}>Backup JSON ↓</button><button className="secondary" disabled={busy} onClick={()=>void exportAll('csv')}>CSV ↓</button></div></div>
    {error&&<p className="error" role="alert">{error}</p>}
    {busy&&<p role="status">Consultando o banco…</p>}
    <div className="table-wrap"><table><thead><tr><th>Artista / pedido</th><th>Recebido em</th><th>Serviços</th><th>Progresso</th><th><span className="sr-only">Detalhes</span></th></tr></thead><tbody>{rows.map(p=><tr key={p.id}><td><strong>{p.answers.artist_name}</strong><small className="table-id">{p.public_id}</small></td><td>{date(p.created_at)}</td><td>{p.answers.services?.map(s=>services[s as keyof typeof services]).join(', ')||'Ainda não informado'}</td><td><span className={`badge ${p.status}`}>{p.status==='completed'?'Concluído':`Incompleto · ${p.progress}/4`}</span></td><td><button className="text-button" onClick={()=>setSelected(p)}>Ver pedido ↗</button></td></tr>)}</tbody></table>{loaded&&rows.length===0&&<p className="empty">Nenhum pedido neste filtro.</p>}</div>
    <div className="pagination"><button className="secondary" disabled={page===0||busy} onClick={()=>setPage(p=>p-1)}>← Anterior</button><span>Página {page+1}</span><button className="secondary" disabled={!hasMore||busy} onClick={()=>setPage(p=>p+1)}>Próxima →</button></div>
    <p className="small-note">As exportações incluem todos os pedidos, independentemente do filtro. Contêm dados pessoais: guarde fora do repositório, em local protegido. Horários de Brasília.</p>
    {selected&&<section className="detail-card" aria-labelledby="detail-title"><div className="detail-top"><h2 id="detail-title" ref={detailTitle} tabIndex={-1}>{selected.answers.artist_name}</h2><button className="secondary" onClick={()=>setSelected(null)}>Fechar detalhes</button></div><p className="public-id">Pedido {selected.public_id}</p><p>{selected.status==='completed'?'Concluído':'Incompleto'} · {selected.progress}/4 etapas · Criado em {date(selected.created_at)}</p><ProjectSummary project={selected}/><div className="consent-record"><strong>Autorização para contato</strong><p>{selected.consent_text}</p><small>Registrada em {date(selected.consent_at)} · versão {selected.consent_version}</small></div>{selected.completed_at&&<p className="small-note">Concluído em {date(selected.completed_at)}</p>}<p className="small-note">Atualizado em {date(selected.updated_at)}. Abrir o WhatsApp não comprova envio de mensagem.</p></section>}
  </main>;
}
