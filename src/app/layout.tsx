import type { Metadata } from 'next';
import Link from 'next/link';
import ProducerHeaderAction, { ProducerHeaderProvider } from '@/components/producer-header-action';
import './globals.css';
import './producer.css';
import './evolution.css';
export const metadata: Metadata = { title: 'Mixbynam · Seu próximo som começa aqui', description: 'Conte sua ideia e solicite uma produção musical, beat ou finalização.' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="pt-BR"><body><ProducerHeaderProvider>
    <header className="site-header"><Link href="/" className="brand" aria-label="Mixbynam, início"><span className="brand-mark">m<span>↗</span></span>mixbynam<span className="brand-dot">®</span></Link><span className="header-tag">PRODUÇÃO MUSICAL INDEPENDENTE</span><ProducerHeaderAction /></header>
    {children}
    <footer><span>mixbynam · Da ideia ao último detalhe.</span><span>Feito para dar voz ao seu som.</span></footer>
  </ProducerHeaderProvider></body></html>;
}
