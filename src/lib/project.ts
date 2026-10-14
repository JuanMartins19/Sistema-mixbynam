import { z } from 'zod';

export const services = {
  beat: 'Beat / instrumental', recording: 'Gravação', editing: 'Edição vocal',
  mixing: 'Mixagem', mastering: 'Masterização', tuning: 'Afinação vocal / Auto-Tune',
  live: 'Suporte ao vivo / discotecagem',
} as const;
export const consentText = 'Autorizo o produtor a usar meu nome artístico, WhatsApp, e-mail e respostas para atendimento e contato sobre este projeto, inclusive se eu não concluir o formulário. Não autorizo publicidade de outros projetos.';
export const consentVersion = '2026-10-14-v1';
export const initialAnswers = {
  artist_name: '', whatsapp: '', email: '', consent: false,
  genre: '', arrangement: '', arrangement_other: '', services: [] as string[],
  beat_type: '', references: '', no_references: false, notes: '',
  budget: '', needs_guidance: false, deadline: '',
};
export type Answers = typeof initialAnswers;
export type Project = {
  id: string; public_id: string; answers: Answers; progress: number;
  status: 'incomplete' | 'completed'; created_at: string; updated_at: string;
  completed_at: string | null; consent_at: string; consent_version: string; consent_text: string;
};
const basic = z.object({
  artist_name: z.string().trim().min(2, 'Informe seu nome artístico.').max(100),
  whatsapp: z.string().regex(/^\+?[0-9 ()-]+$/, 'Use apenas números, espaços, +, parênteses ou hífen.').refine(v => { const n = v.replace(/\D/g, '').length; return n >= 10 && n <= 15; }, 'Informe WhatsApp com DDD (10 a 15 dígitos).'),
  email: z.union([z.literal(''), z.email('Confira seu e-mail.').max(254)]),
  consent: z.literal(true, { error: 'É necessário autorizar o contato sobre o projeto.' }),
});
const music = z.object({
  genre: z.string().trim().min(2, 'Informe o gênero musical.').max(100),
  arrangement: z.enum(['solo', 'team', 'other'], { error: 'Escolha como você atua.' }),
  arrangement_other: z.string().trim().max(200),
}).refine(a => a.arrangement !== 'other' || a.arrangement_other.length >= 2, { message: 'Descreva sua atuação.', path: ['arrangement_other'] });
const production = z.object({
  services: z.array(z.enum(Object.keys(services) as [keyof typeof services, ...(keyof typeof services)[]])).min(1, 'Escolha pelo menos um serviço.').max(7).refine(v => new Set(v).size === v.length),
  beat_type: z.string(), no_references: z.boolean(),
  references: z.string().trim().max(2000), notes: z.string().trim().max(3000),
}).superRefine((a, ctx) => {
  if (a.services.includes('beat') && !['ready', 'exclusive', 'custom'].includes(a.beat_type)) ctx.addIssue({code:'custom', message:'Escolha o tipo de beat.', path:['beat_type']});
  if (!a.no_references && !a.references.trim()) ctx.addIssue({code:'custom', message:'Adicione um link ou marque “Ainda não tenho”.', path:['references']});
  if (!a.no_references) for (const line of a.references.split('\n').filter(v => v.trim())) {
    try { const url = new URL(line.trim()); if (!['https:', 'http:'].includes(url.protocol)) throw new Error(); }
    catch { ctx.addIssue({code:'custom', message:'Use links completos http:// ou https://, um por linha.', path:['references']}); break; }
  }
});
const planning = z.object({
  budget: z.string().trim().max(100), needs_guidance: z.boolean(),
  deadline: z.string().trim().min(2, 'Informe o prazo desejado ou “Sem prazo definido”.').max(200),
}).refine(a => a.needs_guidance || a.budget.length >= 2, { message:'Informe o orçamento ou peça orientação.', path:['budget'] });
export function validateStep(answers: Answers, step: number): string | null {
  const result = [basic, music, production, planning][step - 1]?.safeParse(answers);
  return result?.success ? null : result?.error.issues[0]?.message ?? 'Etapa inválida.';
}
export function cleanAnswers(a: Answers): Answers {
  return { ...a, whatsapp: a.whatsapp.replace(/\D/g, ''),
    beat_type: a.services.includes('beat') ? a.beat_type : '',
    references: a.no_references ? '' : a.references.trim(),
    budget: a.needs_guidance ? '' : a.budget.trim(),
    arrangement_other: a.arrangement === 'other' ? a.arrangement_other.trim() : '',
  };
}
export function whatsappLink(phone: string | undefined, publicId: string, artist: string) {
  if (!phone || !/^[1-9]\d{9,14}$/.test(phone)) return null;
  return `https://wa.me/${phone}?text=${encodeURIComponent(`Olá! Sou ${artist}. Concluí meu pedido de produção musical ${publicId}. Vamos conversar sobre o projeto?`)}`;
}
