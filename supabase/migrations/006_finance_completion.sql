-- Aplicar após 005. Conclusão financeira independente do formulário e atendimento.
begin;
alter table public.project_contracts
  add column finalized_at timestamptz,
  add column finalized_by uuid references auth.users(id),
  add constraint contract_finalization_pair check ((finalized_at is null) = (finalized_by is null));

create function private.guard_closed_finance() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  -- Mesma ordem de locks das RPCs: projeto, contrato. Serializa com conclusão.
  perform 1 from public.projects where id=new.project_id for update;
  if tg_table_name='project_contracts' then
    if tg_op='UPDATE' and old.finalized_at is not null then
      raise exception 'Pedido financeiro concluído' using errcode='55000';
    end if;
  elsif exists(select 1 from public.project_contracts where project_id=new.project_id and finalized_at is not null) then
    raise exception 'Pedido financeiro concluído' using errcode='55000';
  end if;
  return new;
end; $$;
revoke all on function private.guard_closed_finance() from public,anon,authenticated;
create trigger guard_closed_contract before update on public.project_contracts
  for each row execute function private.guard_closed_finance();
create trigger guard_closed_entry before insert or update on public.finance_entries
  for each row execute function private.guard_closed_finance();

create function public.complete_financial_project(p_project_id uuid,p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.project_contracts;
begin
  perform private.require_producer();
  perform 1 from public.projects where id=p_project_id for update;
  select * into c from public.project_contracts where project_id=p_project_id for update;
  if not found then raise exception 'Salve o contrato antes de concluir' using errcode='22023'; end if;
  if c.finalized_at is not null then return to_jsonb(c)||jsonb_build_object('amount_cents',c.amount_cents::text); end if;
  if p_expected_revision is null or c.revision<>p_expected_revision then
    raise exception 'Contrato alterado em outra janela' using errcode='40001';
  end if;
  update public.project_contracts set finalized_at=clock_timestamp(),finalized_by=auth.uid(),
    revision=revision+1,updated_at=clock_timestamp() where project_id=p_project_id returning * into c;
  insert into public.contract_history(id,project_id,payload,reason,recorded_by)
    values(gen_random_uuid(),p_project_id,jsonb_build_object('amount_cents',c.amount_cents::text,
      'contracted_on',c.contracted_on,'balance_due_on',c.balance_due_on,'finalized_at',c.finalized_at),
      'Pedido concluído no financeiro pelo produtor',auth.uid());
  return to_jsonb(c)||jsonb_build_object('amount_cents',c.amount_cents::text);
end; $$;
revoke all on function public.complete_financial_project(uuid,bigint) from public,anon,authenticated;
grant execute on function public.complete_financial_project(uuid,bigint) to authenticated;

create function public.producer_find_financial_projects(p_search text default '',p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  perform private.require_producer();
  if p_search is null or length(p_search)>100 or p_offset is null or p_offset<0 then
    raise exception 'Busca inválida' using errcode='22023'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id desc),'[]') from(
    select p.id,p.public_id,p.answers->>'artist_name' as artist_name,p.created_at from public.projects p
    where not exists(select 1 from public.project_contracts c where c.project_id=p.id and c.finalized_at is not null)
      and (p_search='' or p.answers->>'artist_name' ilike '%'||p_search||'%' or p.public_id::text=p_search)
    order by p.created_at desc,p.id desc offset p_offset limit 21
  )x);
end; $$;
revoke all on function public.producer_find_financial_projects(text,integer) from public,anon,authenticated;
grant execute on function public.producer_find_financial_projects(text,integer) to authenticated;
commit;
