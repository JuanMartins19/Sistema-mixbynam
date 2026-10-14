import ProjectForm from '@/components/project-form';
export default function Home() {
  return <main className="home-grid"><section className="intro">
    <div className="eyebrow"><span className="signal-dot"/> VAMOS CRIAR ALGO SEU</div>
    <h1>Seu próximo som<br/><em>começa aqui.</em></h1>
    <p className="intro-copy">Conte sua ideia e o que você precisa para sua produção musical.</p>
    <div className="sound-art" aria-hidden="true"><div className="record"><div className="record-center">m↗</div></div><div className="wave">{Array.from({length:36},(_,i)=><i key={i} style={{height: `${16 + ((i * 17 + 13) % 65)}px`}}/>)}</div><div className="sound-caption"><span>INDEPENDENTE NA ESSÊNCIA</span><span>01 — ∞</span></div></div>
    <div className="intro-meta"><span>↗ Sem cadastro</span><span>◷ 4 etapas</span><span>◎ Atendimento direto</span></div>
  </section><ProjectForm/></main>;
}
