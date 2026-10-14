import type { Project } from './project';
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
