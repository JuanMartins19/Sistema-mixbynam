// Netlify precisa destas variáveis durante o build: NEXT_PUBLIC_* fica no JS.
// Não carregar .env.local nem imprimir valores/chaves nos logs da hospedagem.
const problems = [];
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || url.includes('SEU-PROJETO')) {
  problems.push('NEXT_PUBLIC_SUPABASE_URL ausente ou de exemplo');
} else {
  try {
    if (new URL(url).protocol !== 'https:') throw new Error();
  } catch {
    problems.push('NEXT_PUBLIC_SUPABASE_URL deve ser uma URL HTTPS válida');
  }
}

if (!key || key.includes('SUA-CHAVE')) {
  problems.push('NEXT_PUBLIC_SUPABASE_ANON_KEY ausente ou de exemplo');
} else if (key.startsWith('sb_secret_')) {
  problems.push('NEXT_PUBLIC_SUPABASE_ANON_KEY deve usar a chave pública, nunca secret/service_role');
} else if (!key.startsWith('sb_publishable_')) {
  try {
    const payload = JSON.parse(Buffer.from(key.split('.')[1] || '', 'base64url').toString('utf8'));
    if (payload.role !== 'anon') throw new Error();
  } catch {
    problems.push('NEXT_PUBLIC_SUPABASE_ANON_KEY deve ser a chave anon ou publishable do Supabase');
  }
}

if (problems.length) {
  console.error('Build interrompido: o formulário não conseguiria enviar pedidos.');
  for (const problem of problems) console.error('- ' + problem);
  console.error('No Netlify, configure Environment variables para Production com escopo Builds e publique novamente.');
  process.exitCode = 1;
} else {
  console.log('Configuração pública do Supabase verificada para o build.');
}
