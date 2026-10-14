import { test, expect } from '@playwright/test';
test('celular: validação, falha real de configuração, retry e respostas preservadas',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Primeiro, como podemos te chamar?'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.getByRole('button',{name:'Salvar e continuar'}).click();
  await expect(page.locator('main').getByRole('alert')).toContainText('nome artístico');
  await page.getByRole('textbox',{name:'Nome artístico *',exact:true}).fill('Artista do teste');
  await page.getByLabel('WhatsApp com DDD').fill('(11) 99999-9999');
  await page.getByRole('checkbox').check();
  await page.getByRole('button',{name:'Salvar e continuar'}).click();
  await expect(page.locator('main').getByRole('alert')).toContainText('Supabase ainda não foi configurado');
  await expect(page.getByRole('textbox',{name:'Nome artístico *',exact:true})).toHaveValue('Artista do teste');
  await expect(page.getByRole('heading',{name:'Primeiro, como podemos te chamar?'})).toBeVisible();
  await expect(page.getByText('PROJETO RECEBIDO',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Tentar salvar novamente'}).click();
  await expect(page.locator('main').getByRole('alert')).toContainText('pedido não foi salvo');
  await expect(page.getByLabel('WhatsApp com DDD')).toHaveValue('(11) 99999-9999');
});
test('painel público exibe apenas login, sem contatos nem pedidos',async({page})=>{
  await page.goto('/produtor');
  await expect(page.getByRole('heading',{name:'Seu estúdio, em um só lugar.'})).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Backup JSON'})).toHaveCount(0);
  await expect(page.locator('main').getByRole('alert')).toContainText('Supabase ainda não foi configurado');
});
test('formulário também cabe em tela estreita e desktop',async({page})=>{
  for(const width of [320,1440]) {
    await page.setViewportSize({width,height:900});await page.goto('/');
    await expect(page.getByRole('textbox',{name:'Nome artístico *',exact:true})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await page.screenshot({path:`test-results/screenshots/home-${width}.png`,fullPage:true});
  }
});
