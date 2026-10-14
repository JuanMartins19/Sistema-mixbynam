import { services, type Project } from '@/lib/project';
export default function ProjectSummary({ project }: { project: Project }) {
  const a = project.answers;
  const rows = [
    ['Nome artístico', a.artist_name], ['WhatsApp', a.whatsapp], ['E-mail', a.email || 'Não informado'],
    ['Gênero musical', a.genre], ['Atuação', ({solo:'Sozinho',team:'Com equipe',other:a.arrangement_other} as Record<string,string>)[a.arrangement]],
    ['Serviços', a.services?.map(s => services[s as keyof typeof services]).join(', ')],
    ['Tipo de beat', ({ready:'Pronto',exclusive:'Exclusivo',custom:'Sob encomenda'} as Record<string,string>)[a.beat_type]],
    ['Referências', a.no_references ? 'Ainda não tenho' : a.references], ['Observações', a.notes],
    ['Orçamento', a.needs_guidance ? 'Preciso de orientação' : a.budget], ['Prazo desejado', a.deadline],
  ];
  return <dl className="summary">{rows.map(([label,value]) => value ? <div key={label}><dt>{label}</dt><dd>{value}</dd></div> : null)}</dl>;
}
