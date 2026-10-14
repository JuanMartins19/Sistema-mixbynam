'use client';

import { useEffect, useRef, useState } from 'react';
import {loadSpotifyEmbed,type SpotifyController} from '@/lib/spotify-embed';

const playlistUrl = 'https://open.spotify.com/playlist/7Fq8hsA9pdJiRdrCTB67Yg';

export default function SpotifyPlaylist() {
  const [open,setOpen]=useState(false),[loading,setLoading]=useState(false),[playing,setPlaying]=useState(false),[notice,setNotice]=useState('');
  const host=useRef<HTMLDivElement>(null),controller=useRef<SpotifyController|null>(null),alive=useRef(false),inFlight=useRef(false),playingRef=useRef(false),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;controller.current?.destroy();controller.current=null;if(timer.current)clearTimeout(timer.current);};},[]);
  function requestPlay(){
    controller.current?.resume();
    if(timer.current)clearTimeout(timer.current);
    timer.current=setTimeout(()=>{if(alive.current&&!playingRef.current)setNotice('Se a música não iniciar, toque no play do Spotify abaixo.');},6000);
  }
  async function toggle(startPlayback=true){
    setNotice('');
    if(controller.current){if(!startPlayback)return;if(playingRef.current)controller.current.pause();else{setOpen(true);requestPlay();}return;}
    if(inFlight.current)return;
    inFlight.current=true;setLoading(true);setOpen(true);
    try{
      const api=await loadSpotifyEmbed();if(!alive.current||!host.current)return;
      const target=document.createElement('div');host.current.replaceChildren(target);
      api.createController(target,{url:playlistUrl+'?theme=0',width:'100%',height:352},embed=>{
        if(!alive.current){embed.destroy();return;}
        controller.current=embed;
        embed.addListener('playback_update',event=>{
          if(!alive.current)return;
          const data=event.data;
          const isPlaying=!data.isPaused&&!data.isBuffering&&!(data.duration>0&&data.position>=data.duration);
          playingRef.current=isPlaying;setPlaying(isPlaying);
          if(isPlaying){setNotice('');if(timer.current)clearTimeout(timer.current);}
        });
        embed.addListener('ready',()=>{if(!alive.current)return;inFlight.current=false;setLoading(false);if(startPlayback)requestPlay();});
        timer.current=setTimeout(()=>{if(alive.current&&inFlight.current){inFlight.current=false;setLoading(false);setNotice('Use o player abaixo ou abra a playlist no Spotify.');}},15000);
      });
    }catch{if(alive.current){inFlight.current=false;setLoading(false);setNotice('Não foi possível carregar o player. Abra a playlist no Spotify.');}}
  }
  return <section className={`spotify-showcase${playing?' is-playing':''}`} aria-label="Playlist Mixbynam">
    <div className="sound-art">
      <div className="record"><button type="button" className="record-center record-play" disabled={loading} aria-label={loading?'Carregando playlist':playing?'Pausar playlist':'Reproduzir playlist'} aria-pressed={playing} onClick={()=>void toggle()}><span aria-hidden>{loading?'…':playing?'Ⅱ':'▶'}</span><small>{playing?'PAUSAR':'PLAY'}</small></button></div>
      <div className="wave" aria-hidden="true">{Array.from({length:36},(_,i)=><i key={i} style={{height:`${16+((i*17+13)%65)}px`,animationDelay:`-${i*0.13}s`,animationDuration:`${0.55+(i%5)*0.14}s`}}/>)}</div>
      <div className="sound-caption"><span>PLAYLIST NO SPOTIFY</span><button type="button" aria-expanded={open} aria-controls="spotify-player" onClick={()=>{setOpen(!open);if(!open&&!controller.current&&!inFlight.current)void toggle(false);}}>{open?'OCULTAR PLAYER':'VER PLAYLIST'} <span aria-hidden>↗</span></button></div>
    </div>
    <p className="playlist-status" role="status">{loading?'Carregando playlist…':notice||(playing?'Tocando agora':'Toque no centro verde para ouvir.')}</p>
    <div className="spotify-player" id="spotify-player" hidden={!open}>
      <div ref={host}/>
      <a href={playlistUrl} target="_blank" rel="noopener noreferrer">Abrir playlist no Spotify ↗</a>
    </div>
  </section>;
}
