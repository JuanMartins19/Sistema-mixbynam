import type { Project } from './project';
export const INACTIVITY_HOURS = 24;
export const commercialStatuses = {
  new:'Novo', in_contact:'Em contato', proposal_sent:'Proposta enviada',
  won:'Fechado', lost:'Perdido', do_not_contact:'Não contatar',
} as const;
export type CommercialStatus = keyof typeof commercialStatuses;
export type ContactTracking = {
  project_id:string; commercial_status:CommercialStatus; next_action:string|null;
  return_at:string|null; revision:number; updated_at:string;
};
export type ContactHistory = {
  id:string; project_id:string; kind:'tracking'|'note'|'contact'; body:string;
  metadata:Partial<ContactTracking>; created_at:string; recorded_by:string;
};
export type ProducerProject = Project & { tracking:ContactTracking|null; recovery_reasons:('inactive'|'overdue'|'unattended')[] };
export const recoveryLabels = {
  inactive:`Incompleto há mais de ${INACTIVITY_HOURS} horas`,
  overdue:'Próxima ação vencida', unattended:'Concluído sem atendimento registrado',
};
export function artistWhatsappLink(phone:string,publicId:string,artist:string,producer:string) {
  let digits=phone.replace(/\D/g,'');
  if(!phone.startsWith('+')&&(digits.length===10 || digits.length===11)) digits='55'+digits;
  if(!/^[1-9]\d{1,14}$/.test(digits)) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(`Olá, ${artist}! Aqui é ${producer}. Vamos conversar sobre seu projeto musical ${publicId}?`)}`;
}
