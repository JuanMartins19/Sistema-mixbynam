export type SpotifyController={
  play:()=>void; pause:()=>void; resume:()=>void; destroy:()=>void;
  addListener:(event:'ready'|'playback_update',listener:(event:{data:{isPaused:boolean;isBuffering:boolean;position:number;duration:number}})=>void)=>void;
};
type SpotifyApi={createController:(element:HTMLElement,options:{url:string;width:string;height:number},callback:(controller:SpotifyController)=>void)=>void};
declare global {interface Window{onSpotifyIframeApiReady?:(api:SpotifyApi)=>void}}
let apiPromise:Promise<SpotifyApi>|undefined;
export function loadSpotifyEmbed(){
  if(apiPromise)return apiPromise;
  apiPromise=new Promise<SpotifyApi>((resolve,reject)=>{
    const script=document.createElement('script');
    const timer=window.setTimeout(()=>{script.remove();reject(new Error('Spotify indisponível.'));},15000);
    window.onSpotifyIframeApiReady=api=>{clearTimeout(timer);resolve(api);};
    script.src='https://open.spotify.com/embed/iframe-api/v1';script.async=true;
    script.onerror=()=>{clearTimeout(timer);script.remove();reject(new Error('Spotify indisponível.'));};
    document.body.appendChild(script);
  }).catch(error=>{apiPromise=undefined;throw error;});
  return apiPromise;
}
