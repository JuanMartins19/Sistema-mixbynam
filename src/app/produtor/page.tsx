import ProducerPanel from '@/components/producer-panel';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Área do produtor · Mixbynam', robots: { index:false, follow:false } };
export default function ProducerPage() { return <ProducerPanel/>; }
