-- Aplicar após 006. Resumo mensal e lançamentos privados na mesma consulta.
begin;
create function public.finance_month_summary(p_month date,p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare start_at timestamptz; end_at timestamptz; entries jsonb;
begin
  perform private.require_producer();
  if p_month is null or not isfinite(p_month) or extract(day from p_month)<>1
    or p_offset is null or p_offset<0 then
    raise exception 'Período inválido' using errcode='22023';
  end if;
  start_at:=p_month::timestamp at time zone 'America/Sao_Paulo';
  end_at:=(p_month+interval '1 month')::timestamp at time zone 'America/Sao_Paulo';
  select coalesce(jsonb_agg(to_jsonb(x) order by x.occurred_at desc,x.id desc),'[]') into entries from(
    select e.id,e.kind,e.amount_cents::text as amount_cents,e.occurred_at,
      p.public_id,p.answers->>'artist_name' as artist_name
    from public.finance_entries e join public.projects p on p.id=e.project_id
    where e.occurred_at>=start_at and e.occurred_at<end_at
    order by e.occurred_at desc,e.id desc offset p_offset limit 21
  )x;
  -- Sem excluir contratos concluídos: os valores continuam compondo o mês.
  return public.finance_snapshot(p_month)||jsonb_build_object('entries',entries);
end; $$;
revoke all on function public.finance_month_summary(date,integer) from public,anon,authenticated;
grant execute on function public.finance_month_summary(date,integer) to authenticated;
commit;
