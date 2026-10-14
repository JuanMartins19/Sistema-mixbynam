import { createClient, type SupabaseClient } from '@supabase/supabase-js';
let client: SupabaseClient | undefined;
export function getSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || url.includes('SEU-PROJETO') || key.includes('SUA-CHAVE')) {
    throw new Error('O Supabase ainda não foi configurado. O pedido não foi salvo. Entre em contato com o produtor ou tente novamente mais tarde.');
  }
  client ??= createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
  return client;
}
export async function saveProject(id: string, token: string, step: number, answers: Answers) {
  const { data, error } = await getSupabase().rpc('save_project', {
    p_id: id, p_token: token, p_step: step, p_answers: cleanAnswers(answers),
  });
  if (error || !data) throw new Error('Não foi possível confirmar o salvamento no banco. Suas respostas continuam nesta tela. Verifique sua conexão e tente novamente.');
  return data as Project;
}
import { cleanAnswers, type Answers, type Project } from './project';
