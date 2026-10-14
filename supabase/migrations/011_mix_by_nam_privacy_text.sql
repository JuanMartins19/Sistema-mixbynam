-- Aplicar após 010. Atualiza a marca no texto de novos envios, com nova versão.
-- Não altera escolhas ou textos registrados anteriormente.
begin;
create or replace function public.submit_project(p_id uuid,p_token text,p_answers jsonb,p_marketing boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.projects; patch jsonb; inserted uuid; i integer;
begin
  if p_id is null or p_token is null or p_token !~ '^[a-f0-9]{64}$' or p_marketing is null then
    raise exception 'Pedido inválido' using errcode='22023'; end if;
  for i in 1..4 loop perform private.validate_stage(p_answers,i); end loop;
  select jsonb_object_agg(key,value) into patch from jsonb_each(p_answers)
    where key=any(array['artist_name','whatsapp','email','genre','arrangement','arrangement_other',
      'services','beat_type','references','no_references','notes','budget','needs_guidance','deadline']);
  insert into public.projects(id,answers,progress,status,completed_at,privacy_notice_version,privacy_notice_at,
    marketing_allowed,marketing_choice_at,marketing_consent_at,marketing_consent_version,marketing_consent_text)
    values(p_id,patch,4,'completed',now(),'2026-10-14-privacy-v3',now(),p_marketing,now(),
      case when p_marketing then now() end,'2026-10-14-marketing-v2',
      'Quero receber novidades, ofertas e lançamentos da Mix By Nam por WhatsApp ou e-mail. Sei que posso cancelar essa autorização a qualquer momento.')
    on conflict(id) do nothing returning id into inserted;
  if inserted is not null then
    insert into private.project_keys(project_id,token_hash)
      values(p_id,pg_catalog.sha256(pg_catalog.convert_to(p_token,'UTF8')));
  end if;
  select * into r from public.projects where id=p_id for update;
  if not exists(select 1 from private.project_keys where project_id=p_id
    and token_hash=pg_catalog.sha256(pg_catalog.convert_to(p_token,'UTF8'))) then
    raise exception 'Pedido indisponível' using errcode='42501'; end if;
  if r.status<>'completed' then raise exception 'Inicie uma nova solicitação' using errcode='22023'; end if;
  return to_jsonb(r);
end; $$;
revoke all on function public.submit_project(uuid,text,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.submit_project(uuid,text,jsonb,boolean) to anon,authenticated;

commit;
