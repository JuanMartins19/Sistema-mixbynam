'use client';
import { useEffect, useRef, useState } from 'react';
import { consentText, initialAnswers, services, validateStep, whatsappLink, type Answers, type Project } from '@/lib/project';
import { getSupabase, saveProject } from '@/lib/supabase';
import ProjectSummary from './project-summary';

type Identity = { id: string; token: string };
const sessionKey = 'mixbynam-project-capability-v1';
function newIdentity(): Identity {
  return { id: crypto.randomUUID(), token: Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2,'0')).join('') };
}
const steps = ['Contato', 'Seu som', 'Serviços', 'Planejamento'];
export default function ProjectForm() {
  const [answers,setAnswers] = useState<Answers>({...initialAnswers});
  const [step,setStep] = useState(1);
  const [busy,setBusy] = useState(false);
  const [restoring,setRestoring] = useState(true);
  const [restoreFailed,setRestoreFailed] = useState(false);
  const [error,setError] = useState('');
  const [saved,setSaved] = useState<Project|null>(null);
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
      if (dbError || !data) throw new Error('Não foi possível recuperar o pedido no banco. Tente novamente ou inicie outro projeto.');
      const p = data as Project;
      setAnswers({...initialAnswers,...p.answers}); setSaved(p); setRestoreFailed(false);
      if (p.status === 'completed') setComplete(p); else setStep(Math.min(p.progress+1,4));
    } catch (e) { setError(e instanceof Error ? e.message : 'Falha ao recuperar pedido.'); setRestoreFailed(true); }
    finally { setRestoring(false); }
  }
  useEffect(() => {
    let existing: Identity|null = null;
    try { const raw = sessionStorage.getItem(sessionKey); if(raw) { const parsed = JSON.parse(raw); if (typeof parsed.id === 'string' && /^[a-f0-9]{64}$/.test(parsed.token)) existing = parsed; } } catch { setStorageWarning(true); }
    if(existing) { identity.current=existing; void restore(existing); } else { identity.current ??= newIdentity(); setRestoring(false); }
    // A chave local só identifica o pedido; as respostas recuperadas vêm do banco.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  useEffect(() => { if (!restoring) title.current?.focus(); },[step,complete,restoring]);
  async function advance(e: React.FormEvent) {
    e.preventDefault(); if(inFlight.current || restoring || restoreFailed) return;
    const validation = validateStep(answers,step); if(validation) {setError(validation); return;}
    inFlight.current=true; setBusy(true); setError('');
    try {
      identity.current ??= newIdentity(); remember(identity.current);
      const p = await saveProject(identity.current.id,identity.current.token,step,answers);
      setSaved(p);
      if(p.status === 'completed') setComplete(p);
      else if(step === 4) throw new Error('O banco não confirmou a conclusão. Tente novamente.');
      else setStep(s => s+1);
    } catch(e) {setError(e instanceof Error ? e.message : 'Não foi possível salvar. Tente novamente.');}
    finally {setBusy(false); inFlight.current=false;}
  }
  function startNew() {
    if ((saved || restoreFailed) && !complete && !window.confirm('Iniciar outro projeto? O pedido anterior continuará salvo para o produtor.')) return;
    identity.current=newIdentity();
    try {sessionStorage.removeItem(sessionKey);} catch {setStorageWarning(true);}
    setAnswers({...initialAnswers}); setStep(1); setSaved(null); setComplete(null); setError(''); setRestoreFailed(false);
  }
  if(restoring) return <section className="form-card" aria-busy="true"><p role="status">Consultando seu pedido…</p></section>;
  if(restoreFailed) return <section className="form-card"><div className="eyebrow">RECUPERAR PROJETO</div><h2 ref={title} tabIndex={-1}>Vamos retomar?</h2><p role="alert" className="error">{error}</p><button className="primary" onClick={()=>identity.current && void restore(identity.current)}>Tentar recuperar novamente</button><button className="text-button" onClick={startNew}>Iniciar outro projeto</button></section>;
  if(complete) {
    const link=whatsappLink(process.env.NEXT_PUBLIC_PRODUCER_WHATSAPP,complete.public_id,complete.answers.artist_name);
    const producer=process.env.NEXT_PUBLIC_PRODUCER_NAME;
    return <section className="form-card completed"><span className="success-icon">✓</span><div className="eyebrow">PROJETO RECEBIDO</div><h2 ref={title} tabIndex={-1}>Seu som está um<br/>passo mais perto.</h2><p>Pedido concluído e confirmado no banco. Você já pode conversar com o produtor sobre os próximos passos.</p><p className="public-id">Pedido <strong>{complete.public_id}</strong></p><ProjectSummary project={complete}/>{link ? <a className="primary" href={link} target="_blank" rel="noopener noreferrer">Abrir WhatsApp {producer ? `de ${producer}` : 'do produtor'} ↗</a> : <p className="error" role="status">O WhatsApp do produtor ainda não foi configurado. Seu pedido está salvo.</p>}<p className="small-note">O botão abre uma mensagem preenchida. Você precisa enviá-la no WhatsApp.</p><button className="text-button" onClick={startNew}>Quero iniciar outro projeto</button></section>;
  }
  return <section className="form-card">
    <div className="form-top"><span className="eyebrow">CONTE SEU PROJETO</span><span className="step-count">0{step} <span>/ 04</span></span></div>
    <ol className="steps" aria-label="Etapas">{steps.map((label,i)=><li key={label} className={i+1 === step?'active':i+1<step?'past':''} aria-current={i+1===step?'step':undefined}><span>{i+1<step?'✓':`0${i+1}`}</span>{label}</li>)}</ol>
    <form onSubmit={advance} noValidate>
      <fieldset disabled={busy}>
      {step===1 && <><h2 ref={title} tabIndex={-1}>Primeiro, como<br/>podemos te chamar?</h2><p className="form-subtitle">Vamos conhecer o artista por trás da ideia.</p>
        <label>Nome artístico <span>*</span><input autoComplete="nickname" maxLength={100} required value={answers.artist_name} onChange={e=>update('artist_name',e.target.value)} placeholder="Seu nome na música"/></label>
        <label>WhatsApp com DDD <span>*</span><input type="tel" autoComplete="tel" inputMode="tel" maxLength={25} required value={answers.whatsapp} onChange={e=>update('whatsapp',e.target.value)} placeholder="(11) 99999-9999"/></label>
        <label>E-mail <span className="optional">opcional</span><input type="email" autoComplete="email" maxLength={254} value={answers.email} onChange={e=>update('email',e.target.value)} placeholder="voce@exemplo.com"/></label>
        <div className="privacy-note"><span aria-hidden>◎</span><p>Seus dados serão usados para atendimento do seu projeto. Ao continuar, seu contato e autorização serão salvos, mesmo que você não conclua as próximas etapas.</p></div>
        <label className="check-label consent"><input type="checkbox" checked={answers.consent} onChange={e=>update('consent',e.target.checked)} required/><span>{consentText} <b>*</b></span></label>
      </>}
      {step===2 && <><h2 ref={title} tabIndex={-1}>Qual é a sua<br/>frequência?</h2><p className="form-subtitle">Conte um pouco sobre sua música e sua atuação.</p>
        <label>Gênero musical <span>*</span><input maxLength={100} value={answers.genre} onChange={e=>update('genre',e.target.value)} placeholder="Ex.: trap, rap, funk, pop…"/></label>
        <div className="field-label" id="arrangement-label">Como você atua? <span>*</span></div><div className="choice-grid" role="group" aria-labelledby="arrangement-label">{[['solo','Sozinho'],['team','Com equipe'],['other','Outro']].map(([value,label])=><label className={`choice ${answers.arrangement===value?'selected':''}`} key={value}><input type="radio" name="arrangement" value={value} checked={answers.arrangement===value} onChange={()=>update('arrangement',value)}/><span>{label}</span></label>)}</div>
        {answers.arrangement==='other' && <label>Conte como você atua<input maxLength={200} value={answers.arrangement_other} onChange={e=>update('arrangement_other',e.target.value)}/></label>}
      </>}
      {step===3 && <><h2 ref={title} tabIndex={-1}>O que seu som<br/>precisa agora?</h2><p className="form-subtitle">Você pode escolher mais de um serviço.</p>
        <div className="service-grid">{Object.entries(services).map(([value,label])=><label className={`service ${answers.services.includes(value)?'selected':''}`} key={value}><input type="checkbox" checked={answers.services.includes(value)} onChange={e=>update('services',e.target.checked?[...answers.services,value]:answers.services.filter(s=>s!==value))}/><span>{label}</span></label>)}</div>
        {answers.services.includes('beat') && <label>Como você quer seu beat? <span>*</span><select value={answers.beat_type} onChange={e=>update('beat_type',e.target.value)}><option value="">Selecione uma opção</option><option value="ready">Pronto</option><option value="exclusive">Exclusivo</option><option value="custom">Sob encomenda</option></select></label>}
        <label className="check-label"><input type="checkbox" checked={answers.no_references} onChange={e=>update('no_references',e.target.checked)}/><span>Ainda não tenho referências</span></label>
        {!answers.no_references && <label>Links de referência <span>*</span><textarea maxLength={2000} value={answers.references} onChange={e=>update('references',e.target.value)} placeholder={'https://…\nUm link por linha'}/><small>YouTube, Spotify, SoundCloud ou outros links públicos.</small></label>}
        <label>Observações <span className="optional">opcional</span><textarea maxLength={3000} value={answers.notes} onChange={e=>update('notes',e.target.value)} placeholder="Sua ideia, o que já está pronto, o que quer explorar…"/></label>
      </>}
      {step===4 && <><h2 ref={title} tabIndex={-1}>Vamos encontrar<br/>o melhor caminho.</h2><p className="form-subtitle">É uma estimativa para começarmos a conversa.</p>
        <label className="check-label"><input type="checkbox" checked={answers.needs_guidance} onChange={e=>update('needs_guidance',e.target.checked)}/><span>Preciso de orientação sobre o orçamento</span></label>
        {!answers.needs_guidance && <label>Orçamento aproximado <span>*</span><input maxLength={100} value={answers.budget} onChange={e=>update('budget',e.target.value)} placeholder="Ex.: R$ 500 a R$ 1.000"/></label>}
        <label>Prazo desejado <span>*</span><input maxLength={200} value={answers.deadline} onChange={e=>update('deadline',e.target.value)} placeholder="Ex.: até dezembro ou sem prazo definido"/></label>
        <div className="privacy-note"><span>↗</span><p>Valores e disponibilidade serão combinados diretamente com o produtor. Concluir este formulário não agenda uma sessão e não gera cobrança.</p></div>
      </>}
      </fieldset>
      {error && <p className="error" role="alert">{error}</p>}
      {storageWarning && <p className="small-note">Seu navegador bloqueou a chave de recuperação. Mantenha esta aba aberta até concluir; o produtor terá acesso às etapas já salvas.</p>}
      <div className="form-actions">{step>1 && <button type="button" className="secondary" disabled={busy} onClick={()=>{setStep(s=>s-1);setError('');}}>← Voltar</button>}<button type="submit" className="primary" disabled={busy}>{busy?'Salvando no banco…':error?'Tentar salvar novamente':step===4?'Concluir pedido':'Salvar e continuar'}{!busy && <span aria-hidden>↗</span>}</button></div>
      <p className="save-note" role="status">{saved?`Etapa ${saved.progress} salva no banco. Você pode voltar e revisar.`:'* Campos obrigatórios. O contato será salvo ao continuar.'}</p>
    </form>
  </section>;
}
