'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { marketingText, initialAnswers, selectableServices, validateStep, whatsappLink, type Answers, type Project } from '@/lib/project';
import { getSupabase, submitProject } from '@/lib/supabase';
import {formatWhatsappInput} from '@/lib/phone';
import ProjectSummary from './project-summary';

type Identity = { id: string; token: string };
const sessionKey = 'mixbynam-submitted-project-v2';
function newIdentity(): Identity {
  return { id: crypto.randomUUID(), token: Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2,'0')).join('') };
}
const steps = ['Contato', 'Seu som', 'Serviços', 'Planejamento'];
export default function ProjectForm() {
  const [answers,setAnswers] = useState<Answers>({...initialAnswers});
  const [step,setStep] = useState(1);
  const [international,setInternational]=useState(false);
  const [busy,setBusy] = useState(false);
  const [restoring,setRestoring] = useState(true);
  const [restoreFailed,setRestoreFailed] = useState(false);
  const [error,setError] = useState('');
  const [complete,setComplete] = useState<Project|null>(null);
  const [storageWarning,setStorageWarning] = useState(false);
  const identity = useRef<Identity|null>(null);
  const inFlight = useRef(false);
  const title = useRef<HTMLHeadingElement>(null);
  function update<K extends keyof Answers>(key: K, value: Answers[K]) { setAnswers(a => ({...a,[key]:value})); setError(''); }
  function remember(value: Identity) {
    identity.current = value;
    try { sessionStorage.setItem(sessionKey,JSON.stringify(value)); } catch { setStorageWarning(true); }
  }
  async function restore(value: Identity) {
    setRestoring(true); setError('');
    try {
      const {data,error:dbError} = await getSupabase().rpc('resume_project',{p_id:value.id,p_token:value.token});
      if (dbError || !data) {console.error('Falha ao retomar pedido',{code:dbError?.code});throw new Error('Não foi possível retomar suas respostas. Tente novamente ou inicie outro pedido.');}
      const p = data as Project;
      if(p.status!=='completed')throw new Error('Esta solicitação não foi enviada. Inicie um novo pedido.');
      setAnswers({...initialAnswers,...p.answers}); setRestoreFailed(false);setComplete(p);
    } catch (e) { setError(e instanceof Error ? e.message : 'Falha ao recuperar pedido.'); setRestoreFailed(true); }
    finally { setRestoring(false); }
  }
  useEffect(() => {
    let existing: Identity|null = null;
    try { sessionStorage.removeItem('mixbynam-project-capability-v1');const raw = sessionStorage.getItem(sessionKey); if(raw) { const parsed = JSON.parse(raw); if (typeof parsed.id === 'string' && /^[a-f0-9]{64}$/.test(parsed.token)) existing = parsed; } } catch { setStorageWarning(true); }
    if(existing) { identity.current=existing; void restore(existing); } else { identity.current ??= newIdentity(); setRestoring(false); }
    // A chave local só identifica o pedido; as respostas recuperadas vêm do banco.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  useEffect(() => { if (!restoring) title.current?.focus(); },[step,complete,restoring]);
  async function advance(e: React.FormEvent) {
    e.preventDefault(); if(inFlight.current || restoring || restoreFailed) return;
    const validation = validateStep(answers,step); if(validation) {setError(validation); return;}
    if(step<4){setStep(s=>s+1);setError('');return;}
    for(let s=1;s<=4;s++){const error=validateStep(answers,s);if(error){setStep(s);setError(error);return;}}
    inFlight.current=true; setBusy(true); setError('');
    try {
      identity.current ??= newIdentity();
      const p = await submitProject(identity.current.id,identity.current.token,answers);
      if(p.status !== 'completed')throw new Error('Não foi possível enviar o pedido. Tente novamente.');
      remember(identity.current);setComplete(p);
    } catch(e) {setError(e instanceof Error ? e.message : 'Não foi possível salvar. Tente novamente.');}
    finally {setBusy(false); inFlight.current=false;}
  }
  function startNew() {
    identity.current=newIdentity();
    try {sessionStorage.removeItem(sessionKey);} catch {setStorageWarning(true);}
    setAnswers({...initialAnswers});setInternational(false); setStep(1); setComplete(null); setError(''); setRestoreFailed(false);
  }
  async function revokeMarketing(){
    if(!complete||!identity.current||inFlight.current)return;
    inFlight.current=true;setBusy(true);setError('');
    try{const {data,error}=await getSupabase().rpc('revoke_project_marketing',{p_id:identity.current.id,p_token:identity.current.token});if(error||data!==true)throw new Error('Não foi possível cancelar a autorização. Tente novamente ou solicite pelo canal da Política de Privacidade.');setComplete({...complete,marketing_allowed:false});}
    catch(e){setError(e instanceof Error?e.message:'Não foi possível cancelar a autorização.');}
    finally{inFlight.current=false;setBusy(false);}
  }
  if(restoring) return <section className="form-card" aria-busy="true"><p role="status">Consultando seu pedido…</p></section>;
  if(restoreFailed) return <section className="form-card"><div className="eyebrow">RECUPERAR PROJETO</div><h2 ref={title} tabIndex={-1}>Vamos retomar?</h2><p role="alert" className="error">{error}</p><button className="primary" onClick={()=>identity.current && void restore(identity.current)}>Tentar recuperar novamente</button><button className="text-button" onClick={startNew}>Iniciar outro projeto</button></section>;
  if(complete) {
    const link=whatsappLink(process.env.NEXT_PUBLIC_PRODUCER_WHATSAPP,complete.public_id,complete.answers.artist_name);
    const producer=process.env.NEXT_PUBLIC_PRODUCER_NAME;
    return <section className="form-card completed"><span className="success-icon">✓</span><div className="eyebrow">PROJETO RECEBIDO</div><h2 ref={title} tabIndex={-1}>Pedido recebido!</h2><p>O produtor analisará seu pedido e entrará em contato para combinar os próximos passos.</p>{link ? <a className="primary" href={link} target="_blank" rel="noopener noreferrer">Conversar no WhatsApp {producer ? `com ${producer}` : 'com o produtor'} ↗</a> : <p className="error" role="status">Seu pedido foi recebido. O contato direto pelo WhatsApp está indisponível no momento.</p>}<p className="small-note">O botão abre uma mensagem preenchida. Você precisa enviá-la no WhatsApp.</p><details className="project-details"><summary>Ver resumo e identificador do pedido</summary><p className="public-id">Pedido {complete.public_id}</p><ProjectSummary project={complete}/></details><p className="small-note">Publicidade: {complete.marketing_allowed?'autorizada':'não autorizada'}.</p>{complete.marketing_allowed&&<button className="text-button" disabled={busy} onClick={()=>void revokeMarketing()}>Cancelar autorização de publicidade</button>}{error&&<p role="alert" className="error">{error}</p>}<Link className="text-button" href="/privacidade">Política de Privacidade</Link><button className="text-button" onClick={startNew}>Iniciar outro projeto</button></section>;
  }
  return <section className="form-card">
    <div className="form-top"><span className="eyebrow">CONTE SEU PROJETO</span><span className="step-count">0{step} <span>/ 04</span></span></div>
    <ol className="steps" aria-label="Etapas">{steps.map((label,i)=><li key={label} className={i+1 === step?'active':i+1<step?'past':''} aria-current={i+1===step?'step':undefined}><span>{i+1<step?'✓':`0${i+1}`}</span>{label}</li>)}</ol>
    <form onSubmit={advance} noValidate>
      <fieldset disabled={busy}>
      {step===1 && <><h2 ref={title} tabIndex={-1}>Como podemos<br/>te chamar?</h2><p className="form-subtitle">Vamos conhecer o artista por trás da ideia.</p>
        <label>Nome artístico <span>*</span><input autoComplete="nickname" maxLength={100} required value={answers.artist_name} onChange={e=>update('artist_name',e.target.value)} placeholder="Seu nome na música"/></label>
        <label>País do WhatsApp<select value={international?'international':'BR'} onChange={e=>{setInternational(e.target.value==='international');update('whatsapp','');}}><option value="BR">Brasil (+55)</option><option value="international">Outro país</option></select></label>
        <label>{international?'WhatsApp internacional':'WhatsApp com DDD'} <span>*</span><input type="tel" autoComplete="tel" inputMode="tel" maxLength={25} required value={answers.whatsapp} onChange={e=>{const isInternational=international||e.target.value.trimStart().startsWith('+');if(isInternational)setInternational(true);update('whatsapp',formatWhatsappInput(e.target.value,isInternational));}} placeholder={international?'+351 912 345 678':'(11) 99999-9999'}/><small>{international?'Inclua +, código do país e número.':'DDD + número de 8 dígitos ou 9 dígitos começando com 9.'}</small></label>
        <label>E-mail <span className="optional">opcional</span><input type="email" autoComplete="email" maxLength={254} value={answers.email} onChange={e=>update('email',e.target.value)} placeholder="voce@exemplo.com"/></label>
        
        <p className="small-note">Seus dados só serão enviados ao concluir a última etapa.</p>
      </>}
      {step===2 && <><h2 ref={title} tabIndex={-1}>Qual gênero<br/>você faz?</h2><p className="form-subtitle">Conte um pouco sobre sua música e sua atuação.</p>
        <label>Gênero musical <span>*</span><input maxLength={100} value={answers.genre} onChange={e=>update('genre',e.target.value)} placeholder="Ex.: trap, rap, funk, pop…"/></label>
        <div className="field-label" id="arrangement-label">Como você atua? <span>*</span></div><div className="choice-grid" role="group" aria-labelledby="arrangement-label">{[['solo','Sozinho'],['team','Em equipe'],['other','Outro']].map(([value,label])=><label className={`choice ${answers.arrangement===value?'selected':''}`} key={value}><input type="radio" name="arrangement" value={value} checked={answers.arrangement===value} onChange={()=>update('arrangement',value)}/><span>{label}</span></label>)}</div>
        {answers.arrangement==='other' && <label>Conte como você atua<input maxLength={200} value={answers.arrangement_other} onChange={e=>update('arrangement_other',e.target.value)}/></label>}
      </>}
      {step===3 && <><h2 ref={title} tabIndex={-1}>Quais serviços<br/>você precisa?</h2><p className="form-subtitle">Você pode escolher mais de um serviço.</p>
        <div className="service-grid">{Object.entries(selectableServices).map(([value,label])=><label className={`service ${answers.services.includes(value)?'selected':''}`} key={value}><input type="checkbox" checked={answers.services.includes(value)} onChange={e=>update('services',e.target.checked?[...answers.services,value]:answers.services.filter(s=>s!==value))}/><span>{label}</span></label>)}</div>
        <label className="check-label"><input type="checkbox" checked={answers.no_references} onChange={e=>update('no_references',e.target.checked)}/><span>Ainda não tenho referências</span></label>
        {!answers.no_references && <label>Links de referência <span>*</span><textarea maxLength={2000} value={answers.references} onChange={e=>update('references',e.target.value)} placeholder={'https://…\nUm link por linha'}/><small>YouTube, Spotify, SoundCloud ou outros links públicos.</small></label>}
        <label>Observações <span className="optional">opcional</span><textarea maxLength={3000} value={answers.notes} onChange={e=>update('notes',e.target.value)} placeholder="Sua ideia, o que já está pronto, o que quer explorar…"/></label>
      </>}
      {step===4 && <><h2 ref={title} tabIndex={-1}>Qual orçamento<br/>e prazo?</h2><p className="form-subtitle">É uma estimativa para começarmos a conversa.</p>
        <label className="check-label"><input type="checkbox" checked={answers.needs_guidance} onChange={e=>update('needs_guidance',e.target.checked)}/><span>Preciso de orientação sobre o orçamento</span></label>
        {!answers.needs_guidance && <label>Orçamento aproximado <span>*</span><input maxLength={100} value={answers.budget} onChange={e=>update('budget',e.target.value)} placeholder="Ex.: R$ 500 a R$ 1.000"/></label>}
        <label>Prazo desejado <span>*</span><input maxLength={200} value={answers.deadline} onChange={e=>update('deadline',e.target.value)} placeholder="Ex.: até dezembro ou sem prazo definido"/></label>
        <div className="privacy-note"><span>↗</span><p>Valores e disponibilidade serão combinados diretamente com o produtor. Concluir este formulário não agenda uma sessão e não gera cobrança.</p></div>
      </>}
      {step===4&&<label className="check-label consent"><input type="checkbox" checked={answers.marketing} onChange={e=>update('marketing',e.target.checked)}/><span>{marketingText}</span></label>}</fieldset>
      {error && <p className="error" role="alert">{error}</p>}
      {storageWarning && <p className="small-note">Seu navegador bloqueou a chave de recuperação da confirmação. Mantenha esta aba aberta. Suas respostas ainda não enviadas não ficam salvas no banco.</p>}
      {step===4&&<p className="privacy-disclosure">Seus dados serão utilizados pela Mix By Nam exclusivamente para analisar sua solicitação, responder às suas dúvidas e entrar em contato sobre o serviço solicitado.<br/><br/>Não utilizaremos seus dados para enviar publicidade de outros projetos sem sua autorização.<br/><br/>Saiba mais em nossa <Link href="/privacidade" target="_blank" rel="noopener noreferrer">Política de Privacidade</Link>.</p>}<div className="form-actions">{step>1 && <button type="button" className="secondary" disabled={busy} onClick={()=>{setStep(s=>s-1);setError('');}}>← Voltar</button>}<button type="submit" className="primary" disabled={busy}>{busy?'Salvando…':error?'Tentar novamente':step===4?'Enviar pedido':'Continuar'}{!busy && <span aria-hidden>↗</span>}</button></div>
      <p className="save-note" role="status">* Campos obrigatórios. As respostas ficam apenas nesta aba até você enviar o pedido.</p>
    </form>
  </section>;
}
