'use client';
import { useCallback,useEffect,useRef,useState } from 'react';
import { useProducerHeaderAction } from './producer-header-action';
import { getSupabase } from '@/lib/supabase';
import { producerCache } from '@/lib/cache';
import { rpc } from '@/lib/producer-data';
import ProducerContacts from './producer-contacts';
import ProducerAgenda from './producer-agenda';
import ProducerFinance from './producer-finance';
export default function ProducerPanel(){
  const setHeaderAction=useProducerHeaderAction();
  const [authorized,setAuthorized]=useState(false),[checking,setChecking]=useState(true),[hasSession,setHasSession]=useState(false);
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [tab,setTab]=useState<'contacts'|'agenda'|'finance'>('contacts');const [visited,setVisited]=useState(new Set(['contacts']));
  const identity=useRef<string|null>(null),generation=useRef(0),allowed=useRef(false);
  useEffect(()=>{
    let alive=true;
    try{
      const {data:{subscription}}=getSupabase().auth.onAuthStateChange((event,session)=>{
        setHasSession(!!session);
        const user=session?.user.id??null;
        if(user===identity.current && allowed.current && event!=='SIGNED_OUT')return;
        if(event==='TOKEN_REFRESHED' && user===identity.current)return;
        const g=++generation.current;
        if(user!==identity.current){producerCache.bind(user);identity.current=user;setVisited(new Set(['contacts']));setTab('contacts');}
        allowed.current=false;setAuthorized(false);
        if(!user){producerCache.bind(null);setChecking(false);return;}
        setChecking(true);
        setTimeout(()=>void producerCache.query('authorization',()=>rpc<boolean>('is_producer')).then(ok=>{
          if(!alive||g!==generation.current)return;
          if(!ok)throw new Error('Esta conta não tem acesso ao painel.');allowed.current=true;setAuthorized(true);setError('');
        }).catch(e=>{if(alive&&g===generation.current)setError(e instanceof Error?e.message:'Não foi possível verificar seu acesso.');}).finally(()=>{if(alive&&g===generation.current)setChecking(false);}),0);
      });
      return()=>{alive=false;generation.current++;subscription.unsubscribe();};
    }catch{setChecking(false);setError('O acesso ainda não está disponível. Tente novamente mais tarde.');}
  },[]);
  async function login(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{const {error:e}=await getSupabase().auth.signInWithPassword({email:email.trim(),password});if(e)throw new Error('Confira o e-mail e a senha e tente novamente.');setPassword('');}catch(e){setError(e instanceof Error?e.message:'Não foi possível entrar.');}finally{setBusy(false);}}
  const logout=useCallback(async()=>{generation.current++;identity.current=null;allowed.current=false;producerCache.bind(null);setAuthorized(false);setHasSession(false);setVisited(new Set(['contacts']));try{const {error}=await getSupabase().auth.signOut();if(error)throw error;}catch{setHasSession(true);setError('Não foi possível sair. Tente novamente.');}},[]);
  useEffect(()=>{setHeaderAction(authorized?{logout}:null);return()=>setHeaderAction(null);},[authorized,logout,setHeaderAction]);
  if(checking)return <main className="panel"><p role="status">Verificando acesso…</p></main>;
  if(!authorized)return <main className="login-wrap"><section className="form-card login-card"><div className="eyebrow">ACESSO PRIVADO</div><h1>Seu estúdio,<br/><em>em um só lugar.</em></h1><p className="form-subtitle">Entre com a conta do produtor.</p><form onSubmit={login}><fieldset disabled={busy}><label>E-mail<input type="email" required autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Senha<input type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label></fieldset>{error&&<p className="error" role="alert">{error}</p>}<button className="primary" disabled={busy}>{busy?'Entrando…':'Entrar no painel'}</button></form>{hasSession&&<button className="text-button" onClick={()=>void logout()}>Sair desta conta</button>}</section></main>;
  return <main className="panel"><div className="panel-header"><div><div className="eyebrow">ÁREA DO PRODUTOR</div><h1>Projetos em vista<span>.</span></h1></div></div><nav className="panel-nav" aria-label="Área do produtor">{([['contacts','Contatos'],['agenda','Agenda'],['finance','Financeiro']] as const).map(([key,label])=><button key={key} className={tab===key?'active':''} aria-pressed={tab===key} onClick={()=>{setTab(key);setVisited(v=>new Set([...v,key]));}}>{label}</button>)}</nav>
    <div hidden={tab!=='contacts'}><ProducerContacts active={tab==='contacts'}/></div>
    {visited.has('agenda')&&<div hidden={tab!=='agenda'}><ProducerAgenda active={tab==='agenda'}/></div>}
    {visited.has('finance')&&<div hidden={tab!=='finance'}><ProducerFinance active={tab==='finance'}/></div>}
  </main>;
}
