import ProjectForm from '@/components/project-form';
import SpotifyPlaylist from '@/components/spotify-playlist';
export default function Home() {
  return <main className="home-grid"><section className="intro">
    <div className="eyebrow"><span className="signal-dot"/> VAMOS CRIAR ALGO SEU</div>
    <h1>Seu próximo som<br/><em>começa aqui.</em></h1>
    <p className="intro-copy">Conte sua ideia e o que você precisa para sua produção musical.</p>
    <SpotifyPlaylist />
    <div className="intro-meta"><span>Sem criar conta</span><span aria-hidden="true">•</span><span>Pedido simples</span><span aria-hidden="true">•</span><span>Direto com o produtor</span></div>
  </section><ProjectForm/></main>;
}
