import { z } from 'zod';
import {normalizeWhatsapp} from './phone';

export const services = {
  beat: 'Beat / instrumental', recording: 'Gravação', editing: 'Edição vocal',
  mixing: 'Mixagem', mastering: 'Masterização', tuning: 'Autotune e/ou Discotecagem (som ao vivo)',
  live: 'Suporte ao vivo / discotecagem',
} as const;
// Mantém o código antigo para exibir pedidos históricos, sem oferecê-lo no formulário.
export const selectableServices=Object.fromEntries(Object.entries(services).filter(([key])=>key!=='live')) as Omit<typeof services,'live'>;
export const consentText = 'Autorizo o produtor a usar meu nome artístico, WhatsApp, e-mail e respostas para atendimento e contato sobre este projeto, inclusive se eu não concluir o formulário. Não autorizo publicidade de outros projetos.';
export const consentVersion = '2026-10-14-v1';
export const marketingText = 'Quero receber novidades, ofertas e lançamentos da Mix By Nam por WhatsApp ou e-mail. Sei que posso cancelar essa autorização a qualquer momento.';
export const initialAnswers = {
  artist_name: '', whatsapp: '', email: '', consent: false, marketing: false,
  genre: '', arrangement: '', arrangement_other: '', services: [] as string[],
  beat_type: '', references: '', no_references: false, notes: '',
  budget: '', needs_guidance: false, deadline: '',
};
export type Answers = typeof initialAnswers;
export type Project = {
  id: string; public_id: string; answers: Answers; progress: number;
  status: 'incomplete' | 'completed'; created_at: string; updated_at: string;
  completed_at: string | null; consent_at: string|null; consent_version: string|null; consent_text: string|null;
  privacy_notice_version?:string;privacy_notice_at?:string;marketing_allowed?:boolean;
  marketing_choice_at?:string;marketing_consent_at?:string|null;marketing_consent_version?:string|null;
  marketing_consent_text?:string|null;marketing_revoked_at?:string|null;
};
const basic = z.object({
  artist_name: z.string().trim().min(2, 'Informe seu nome artístico.').max(100),
  whatsapp: z.string().superRefine((v,ctx)=>{try{normalizeWhatsapp(v);}catch(e){ctx.addIssue({code:'custom',message:e instanceof Error?e.message:'Confira o WhatsApp.'});}}),
  email: z.union([z.literal(''), z.email('Confira seu e-mail.').max(254)]),
});
const music = z.object({
  genre: z.string().trim().min(2, 'Informe o gênero musical.').max(100),
  arrangement: z.enum(['solo', 'team', 'other'], { error: 'Escolha como você atua.' }),
  arrangement_other: z.string().trim().max(200),
}).refine(a => a.arrangement !== 'other' || a.arrangement_other.length >= 2, { message: 'Descreva sua atuação.', path: ['arrangement_other'] });
const production = z.object({
  services: z.array(z.enum(Object.keys(selectableServices) as [keyof typeof selectableServices, ...(keyof typeof selectableServices)[]])).min(1, 'Escolha pelo menos um serviço.').max(6).refine(v => new Set(v).size === v.length),
  beat_type: z.string(), no_references: z.boolean(),
  references: z.string().trim().max(2000), notes: z.string().trim().max(3000),
}).superRefine((a, ctx) => {
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
  return { ...a, whatsapp: normalizeWhatsapp(a.whatsapp),
    beat_type: '', // Pergunta removida; não presumir um tipo para novos pedidos.
    references: a.no_references ? '' : a.references.trim(),
    budget: a.needs_guidance ? '' : a.budget.trim(),
    arrangement_other: a.arrangement === 'other' ? a.arrangement_other.trim() : '',
  };
}
export function whatsappLink(phone: string | undefined, publicId: string, artist: string) {
  if (!phone || !/^[1-9]\d{9,14}$/.test(phone)) return null;
  return `https://wa.me/${phone}?text=${encodeURIComponent(`Olá! Sou ${artist}. Concluí meu pedido de produção musical ${publicId}. Vamos conversar sobre o projeto?`)}`;
}
