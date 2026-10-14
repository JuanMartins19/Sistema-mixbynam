import type { Project } from './project';
import type { ContactHistory, ContactTracking } from './followup';
import type { ProducerSession } from './schedule';
export function backupV2(exportedAt:string,projects:Project[],tracking:ContactTracking[],history:ContactHistory[],sessions:ProducerSession[]) {
  return {format:'mixbynam-export',version:2,exported_at:exportedAt,time_zone:'America/Sao_Paulo',
    backup_scope:'application_records_only',projects,contact_tracking:tracking,contact_history:history,producer_sessions:sessions};
}
export function backupV3(exportedAt:string,projects:Project[],tracking:unknown[],history:unknown[],sessions:unknown[],contracts:unknown[],contractHistory:unknown[],entries:unknown[]){
  return {...backupV2(exportedAt,projects,tracking as ContactTracking[],history as ContactHistory[],sessions as ProducerSession[]),version:3,project_contracts:contracts,contract_history:contractHistory,finance_entries:entries};
}
export function csvCell(value: unknown) {
  let text = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  // Neutraliza fórmulas também após espaços/control characters (Excel/LibreOffice).
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g,'""')}"`;
}
export function projectsCsv(projects: Project[]) {
  const columns = ['public_id','created_at','updated_at','status','progress','completed_at','consent_at','consent_version','consent_text','artist_name','whatsapp','email','genre','arrangement','arrangement_other','services','beat_type','references','no_references','notes','budget','needs_guidance','deadline'];
  return '\uFEFF' + [columns.map(csvCell).join(';'),...projects.map(p => {
    const row: Record<string,unknown> = {...p,...p.answers};
    return columns.map(c=>csvCell(row[c])).join(';');
  })].join('\r\n');
}
