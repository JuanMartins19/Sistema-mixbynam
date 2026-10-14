import { test, expect } from '@playwright/test';

test('WhatsApp limita dígitos, aceita Brasil com ou sem nono dígito e valida internacional',async({page})=>{
  await page.goto('/');await page.getByLabel('Nome artístico').fill('Artista');
  await page.getByLabel('WhatsApp com DDD').fill('9999999999999999999999999');
  await expect(page.getByLabel('WhatsApp com DDD')).toHaveValue('(99) 99999-9999');
  for(const number of ['1199999999','11999999999']){
    await page.getByLabel('WhatsApp com DDD').fill(number);await page.getByRole('button',{name:'Continuar',exact:true}).click();await expect(page.getByLabel('Gênero musical')).toBeVisible();await page.getByRole('button',{name:'← Voltar',exact:true}).click();
  }
  await page.getByLabel('WhatsApp com DDD').fill('20999999999');await page.getByRole('button',{name:'Continuar',exact:true}).click();await expect(page.locator('main').getByRole('alert')).toContainText('DDD válido');
  await page.getByLabel('País do WhatsApp').selectOption('international');
  await page.getByLabel('WhatsApp internacional').fill('+351912345678999999');await expect(page.getByLabel('WhatsApp internacional')).toHaveValue('+351 912 345 678');
  await page.getByLabel('WhatsApp internacional').fill('+999123456789');await page.getByRole('button',{name:'Continuar',exact:true}).click();await expect(page.locator('main').getByRole('alert')).toContainText('código do país');
  await page.getByLabel('WhatsApp internacional').fill('+12025550123');await page.getByRole('button',{name:'Continuar',exact:true}).click();await expect(page.getByLabel('Gênero musical')).toBeVisible();
});

test('disco controla play; ondas seguem confirmação de reprodução e pausa',async({page})=>{
  // Dublê apenas do controle externo: não prova reprodução real no Spotify.
  await page.route('https://open.spotify.com/embed/iframe-api/v1',route=>route.fulfill({contentType:'application/javascript',body:`
    window.onSpotifyIframeApiReady({createController(element,options,callback){
      const listeners={};const frame=document.createElement('iframe');frame.title='Playlist Spotify';frame.src='about:blank';element.replaceWith(frame);
      const controller={play(){},resume(){},pause(){listeners.playback_update?.({data:{isPaused:true,isBuffering:false,position:100,duration:10000}});},destroy(){frame.remove();},addListener(name,fn){listeners[name]=fn;}};
      window.spotifyTestEvent=data=>listeners.playback_update({data});
      callback(controller);setTimeout(()=>listeners.ready?.({data:{}}),10);
    }});
  `}));
  await page.setViewportSize({width:320,height:900});await page.goto('/');
  await expect(page.getByRole('button',{name:'Reproduzir playlist',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Reproduzir playlist',exact:true}).click();
  await expect(page.getByRole('button',{name:'Reproduzir playlist',exact:true})).toBeEnabled();
  await expect(page.locator('.spotify-showcase')).not.toHaveClass(/is-playing/);
  await page.evaluate(()=>{(window as unknown as {spotifyTestEvent:(data:unknown)=>void}).spotifyTestEvent({isPaused:false,isBuffering:false,position:100,duration:10000});});
  await expect(page.locator('.spotify-showcase')).toHaveClass(/is-playing/);
  await expect(page.locator('.wave i').first()).toHaveCSS('animation-play-state','running');
  await page.getByRole('button',{name:'Pausar playlist',exact:true}).click();
  await expect(page.locator('.spotify-showcase')).not.toHaveClass(/is-playing/);
  await expect(page.locator('.wave i').first()).toHaveCSS('animation-play-state','paused');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.route('https://open.spotify.com/embed/iframe-api/v1',route=>route.abort());await page.reload();
  await page.getByRole('button',{name:'Reproduzir playlist',exact:true}).click();
  await expect(page.getByText('Não foi possível carregar o player. Abra a playlist no Spotify.',{exact:true})).toBeVisible();
  await expect(page.locator('.spotify-showcase')).not.toHaveClass(/is-playing/);
  await expect(page.getByRole('link',{name:'Abrir playlist no Spotify'})).toBeVisible();
});
test('celular: validação, falha real de configuração, retry e respostas preservadas',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Como podemos te chamar?'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.getByRole('button',{name:'Continuar'}).click();
  await expect(page.locator('main').getByRole('alert')).toContainText('nome artístico');
  await page.getByRole('textbox',{name:'Nome artístico *',exact:true}).fill('Artista do teste');
  await page.getByLabel('WhatsApp com DDD').fill('(11) 99999-9999');
  await page.getByRole('button',{name:'Continuar'}).click();
  await page.getByLabel('Gênero musical').fill('Rap');await page.getByRole('radio',{name:'Sozinho',exact:true}).check();await page.getByRole('button',{name:'Continuar'}).click();await page.getByRole('checkbox',{name:'Mixagem',exact:true}).check();await page.getByRole('checkbox',{name:'Ainda não tenho referências',exact:true}).check();await page.getByRole('button',{name:'Continuar'}).click();await page.getByRole('checkbox',{name:'Preciso de orientação sobre o orçamento',exact:true}).check();await page.getByLabel('Prazo desejado').fill('Sem prazo definido');await page.getByRole('button',{name:'Enviar pedido',exact:true}).click();
  await expect(page.locator('main').getByRole('alert')).toContainText('atendimento online está indisponível');

  await expect(page.getByRole('heading',{name:'Qual orçamento e prazo?'})).toBeVisible();
  await expect(page.getByText('PROJETO RECEBIDO',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Tentar novamente'}).click();
  await expect(page.locator('main').getByRole('alert')).toContainText('respostas não foram enviadas');
  await page.getByRole('button',{name:'← Voltar',exact:true}).click();await page.getByRole('button',{name:'← Voltar',exact:true}).click();await page.getByRole('button',{name:'← Voltar',exact:true}).click();await expect(page.getByLabel('WhatsApp com DDD')).toHaveValue('(11) 99999-9999');
});
test('painel público exibe apenas login, sem contatos nem pedidos',async({page})=>{
  await page.goto('/produtor');
  await expect(page.getByRole('heading',{name:'Seu estúdio, em um só lugar.'})).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Backup JSON'})).toHaveCount(0);
  await expect(page.locator('main').getByRole('alert')).toContainText('acesso ainda não está disponível');
});
test('formulário também cabe em tela estreita e desktop',async({page})=>{
  for(const width of [320,1440]) {
    await page.setViewportSize({width,height:900});await page.goto('/');
    await expect(page.getByRole('textbox',{name:'Nome artístico *',exact:true})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await page.screenshot({path:`test-results/screenshots/home-${width}.png`,fullPage:true});
  }
});
