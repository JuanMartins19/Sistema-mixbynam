'use client';
import {useState} from 'react';
import {producerCache} from '@/lib/cache';
import {rpc} from '@/lib/producer-data';
export type RelatedProject={id:string;public_id:string;artist_name:string};
export default function ProjectPicker({value,onChange,disabled=false}:{value:RelatedProject|null;onChange:(p:RelatedProject)=>void;disabled?:boolean}){
  const [search,setSearch]=useState(''),[page,setPage]=useState(0),[rows,setRows]=useState<RelatedProject[]|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function find(offset=0){setBusy(true);setError('');try{const r=await producerCache.query<RelatedProject[]>(`picker:${search}:${offset}`,()=>rpc('producer_find_projects',{p_search:search.trim(),p_offset:offset*20}));setRows(r);setPage(offset);}catch{setError('Não foi possível buscar. Tente novamente.');}finally{setBusy(false);}}
  return <div className="session-search"><label>Buscar pedido por artista ou identificador público<input maxLength={100} value={search} disabled={disabled} onChange={e=>setSearch(e.target.value)}/></label><button className="secondary" disabled={busy||disabled} onClick={()=>void find()}>Buscar artistas</button>{error&&<p className="error" role="alert">{error}</p>}{rows&&rows.length===0&&<p>Nenhum pedido encontrado.</p>}<div className="session-options">{rows?.slice(0,20).map(p=><button disabled={disabled} key={p.id} onClick={()=>{onChange(p);setRows(null);}}>{p.artist_name} · {p.public_id}</button>)}</div>{rows&&(page>0||rows.length>20)&&<div className="pagination"><button disabled={page===0||busy} onClick={()=>void find(page-1)}>Anterior</button><button disabled={rows.length<=20||busy} onClick={()=>void find(page+1)}>Mais artistas</button></div>}{value&&<p className="session-selected">Pedido selecionado: <strong>{value.artist_name}</strong></p>}</div>;
}
