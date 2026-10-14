import { fromLocalInput, shiftDate, toLocalInput } from './datetime';
import type { Project } from './project';
export const sessionStatuses={reserved:'Reservada',confirmed:'Confirmada',held:'Realizada',cancelled:'Cancelada'} as const;
export type ProducerSession={
  id:string; project_id:string; session_type:string; starts_at:string; ends_at:string;
  notes:string; status:keyof typeof sessionStatuses; created_at:string; updated_at:string;
};
export type SessionWithProject=ProducerSession & { projects:Pick<Project,'id'|'public_id'|'answers'>|null };
export function agendaDays(day:string,view:'day'|'week') {
  if(view==='day')return [day];
  const weekday=new Date(day+'T12:00:00Z').getUTCDay();
  const monday=shiftDate(day,-((weekday+6)%7));
  return Array.from({length:7},(_,i)=>shiftDate(monday,i));
}
export function agendaRange(days:string[]) {
  return {start:fromLocalInput(days[0]+'T00:00'),end:fromLocalInput(shiftDate(days.at(-1)!,1)+'T00:00')};
}
export function overlapsDay(s:ProducerSession,day:string) {
  const range=agendaRange([day]);return Date.parse(s.starts_at)<Date.parse(range.end)&&Date.parse(s.ends_at)>Date.parse(range.start);
}
export function localSessionTimes(s:ProducerSession) {return {start:toLocalInput(s.starts_at),end:toLocalInput(s.ends_at)};}
