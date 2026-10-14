export type Contract={project_id:string;amount_cents:string;contracted_on:string;balance_due_on:string|null;revision:number;finalized_at:string|null;finalized_by:string|null};
export type FinanceEntry={id:string;project_id:string;kind:'receipt'|'refund';amount_cents:string;occurred_at:string;recorded_at:string;method:string;reason:string;refund_of:string|null;refund_remaining_cents:string};
export type FinanceDetail={queried_at:string;contract:Contract|null;net_cents:string;entries:FinanceEntry[];contract_history:{id:string;payload:Record<string,unknown>;reason:string;recorded_at:string}[]};
export type FinanceSnapshot={queried_at:string;month:string;received_cents:string;contracted_cents:string;receivable_cents:string;overdue_cents:string;entry_count:number;contract_count:number;orders:number;pending_returns:number;scheduled_sessions:number;held_sessions:number};
export type FinanceMonthEntry={id:string;kind:'receipt'|'refund';amount_cents:string;occurred_at:string;public_id:string;artist_name:string};
export type FinanceMonthSummary=FinanceSnapshot&{entries:FinanceMonthEntry[]};
export function parseMoney(value:string):string {
  const s=value.trim();let normalized=s;
  if(s.includes(',')){if(!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(s))throw new Error('Informe um valor como 1500,50.');normalized=s.replace(/\./g,'').replace(',','.');}
  if(!/^\d+(?:\.\d{1,2})?$/.test(normalized))throw new Error('Informe um valor como 1500,50.');
  const [whole,decimal='']=normalized.split('.');const cents=BigInt(whole)*100n+BigInt(decimal.padEnd(2,'0'));
  if(cents<=0n||cents>1000000000000n)throw new Error('Valor fora do limite permitido.');return cents.toString();
}
export function money(cents:string) {const n=BigInt(cents),abs=n<0n?-n:n;return `${n<0n?'-':''}R$ ${(abs/100n).toLocaleString('pt-BR')},${(abs%100n).toString().padStart(2,'0')}`;}
export function moneyInput(cents:string){const n=BigInt(cents);return `${n/100n},${(n%100n).toString().padStart(2,'0')}`;}
