import { fromLocalInput, shiftDate, toLocalInput } from './datetime';
export const sessionStatuses={reserved:'Reservada',confirmed:'Confirmada',held:'Realizada',cancelled:'Cancelada'} as const;
export type ProducerSession={
  id:string; project_id:string; session_type:string; starts_at:string; ends_at:string;
  notes:string; status:keyof typeof sessionStatuses; created_at:string; updated_at:string;
};
export type SessionWithProject=ProducerSession & {artist_name:string;public_id:string};
export function agendaDays(day:string,view:'day'|'week'|'month') {
  if(view==='day')return [day];
  if(view==='month'){const [y,m]=day.split('-').map(Number);const size=new Date(Date.UTC(y,m,0)).getUTCDate();return Array.from({length:size},(_,i)=>`${day.slice(0,7)}-${String(i+1).padStart(2,'0')}`);}
  const weekday=new Date(day+'T12:00:00Z').getUTCDay();
  const monday=shiftDate(day,-((weekday+6)%7));
  return Array.from({length:7},(_,i)=>shiftDate(monday,i));
}
export function monthCells(day:string){const days=agendaDays(day,'month');const pad=(new Date(days[0]+'T12:00Z').getUTCDay()+6)%7;const cells:(string|null)[]=[...Array(pad).fill(null),...days];while(cells.length%7)cells.push(null);return cells;}
export function shiftMonth(day:string,delta:number){const [y,m,d]=day.split('-').map(Number),date=new Date(Date.UTC(y,m-1+delta,1));const last=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();return `${date.toISOString().slice(0,7)}-${String(Math.min(d,last)).padStart(2,'0')}`;}
export function agendaRange(days:string[]) {
  return {start:fromLocalInput(days[0]+'T00:00'),end:fromLocalInput(shiftDate(days.at(-1)!,1)+'T00:00')};
}
export function overlapsDay(s:ProducerSession,day:string) {
  const range=agendaRange([day]);return Date.parse(s.starts_at)<Date.parse(range.end)&&Date.parse(s.ends_at)>Date.parse(range.start);
}
export function localSessionTimes(s:ProducerSession) {return {start:toLocalInput(s.starts_at),end:toLocalInput(s.ends_at)};}
