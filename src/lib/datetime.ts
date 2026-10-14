export const PRODUCER_TIMEZONE = 'America/Sao_Paulo';
export function formatDate(value:string) {
  return new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:PRODUCER_TIMEZONE}).format(new Date(value));
}
// A conversão usa o fuso IANA, não o fuso do navegador nem offset fixo.
export function toLocalInput(value:string) {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:PRODUCER_TIMEZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value));
  const get=(name:string)=>parts.find(p=>p.type===name)?.value;
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}
export function fromLocalInput(value:string):string {
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Informe data e horário válidos.');
  const wall=Date.parse(value+'Z');
  if(!Number.isFinite(wall) || new Date(wall).toISOString().slice(0,16)!==value) throw new Error('Data inválida.');
  let guess=wall;
  for(let i=0;i<4;i++) {const shown=Date.parse(toLocalInput(new Date(guess).toISOString())+'Z');const delta=wall-shown;if(delta===0) return new Date(guess).toISOString();guess+=delta;}
  throw new Error('Horário inexistente neste fuso. Escolha outro horário.');
}
export function localDateToday() {return toLocalInput(new Date().toISOString()).slice(0,10);}
export function shiftDate(day:string,delta:number) {return new Date(Date.parse(day+'T12:00:00Z')+delta*86400000).toISOString().slice(0,10);}
