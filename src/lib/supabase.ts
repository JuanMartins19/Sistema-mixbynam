import { createClient, type SupabaseClient } from '@supabase/supabase-js';
let client: SupabaseClient | undefined;
export function getSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || url.includes('SEU-PROJETO') || key.includes('SUA-CHAVE')) {
    console.error('Atendimento indisponível', {code:'missing_supabase_configuration'});
    throw new Error('O atendimento online está indisponível no momento. Suas respostas não foram enviadas. Tente novamente mais tarde.');
  }
  try { client ??= createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } }); }
  catch { console.error('Atendimento indisponível',{code:'invalid_supabase_configuration'});throw new Error('O atendimento online está indisponível no momento. Tente novamente mais tarde.'); }
  return client;
}
export async function submitProject(id: string, token: string, answers: Answers) {
  const {consent:legacyConsent,marketing,...responses}=cleanAnswers(answers);
  void legacyConsent;
  const { data, error } = await getSupabase().rpc('submit_project', {
    p_id: id, p_token: token, p_answers: responses, p_marketing:marketing,
  });
  if (error || !data) { console.error('Falha ao salvar pedido', {code:error?.code}); throw new Error('Não foi possível salvar suas respostas. Elas continuam nesta tela. Confira sua conexão e tente novamente.'); }
  return data as Project;
}
import { cleanAnswers, type Answers, type Project } from './project';
