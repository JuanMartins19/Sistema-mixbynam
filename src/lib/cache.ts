export class MemoryCache {
  private user:string|null=null;
  private generation=0;
  private entries=new Map<string,{expires:number;promise:Promise<unknown>}>();
  constructor(private ttl=60000,private clock=()=>Date.now()){}
  scope(){return this.generation;}
  bind(user:string|null){if(user!==this.user){this.user=user;this.clear();}}
  clear(){this.generation++;this.entries.clear();}
  invalidate(prefix:string){for(const key of this.entries.keys())if(key.startsWith(prefix))this.entries.delete(key);}
  peek<T>(key:string):Promise<T>|undefined {const e=this.entries.get(key);return e&&e.expires>this.clock()?e.promise as Promise<T>:undefined;}
  put<T>(key:string,value:T){if(!this.user)return;this.entries.set(key,{expires:this.clock()+this.ttl,promise:Promise.resolve(value)});}
  async query<T>(key:string,fetcher:()=>Promise<T>):Promise<T>{
    if(!this.user)throw new Error('Sessão encerrada. Entre novamente.');
    const hit=this.peek<T>(key);if(hit)return hit;
    const generation=this.generation;const entry={expires:Infinity,promise:null as unknown as Promise<T>};
    entry.promise=Promise.resolve().then(fetcher).then(result=>{
      if(generation!==this.generation || this.entries.get(key)!==entry)throw new Error('Consulta invalidada. Atualize novamente.');
      entry.expires=this.clock()+this.ttl;return result;
    }).catch(e=>{if(this.entries.get(key)===entry)this.entries.delete(key);throw e;});
    this.entries.set(key,entry);return entry.promise;
  }
}
export const producerCache=new MemoryCache();
