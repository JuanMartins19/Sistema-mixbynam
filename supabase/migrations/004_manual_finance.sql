begin;
create table public.project_contracts (
  project_id uuid primary key references public.projects(id) on delete cascade,
  amount_cents bigint not null check(amount_cents between 1 and 1000000000000),
  contracted_on date not null check(isfinite(contracted_on)),
  balance_due_on date check(balance_due_on is null or isfinite(balance_due_on)),
  revision bigint not null default 1,
  created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp()
);
create table public.contract_history (
  id uuid primary key, project_id uuid not null references public.project_contracts(project_id) on delete cascade,
  payload jsonb not null, reason text not null check(length(btrim(reason)) between 3 and 1000),
  recorded_at timestamptz not null default clock_timestamp(), recorded_by uuid not null references auth.users(id)
);
create table public.finance_entries (
  id uuid primary key, project_id uuid not null references public.project_contracts(project_id) on delete cascade,
  kind text not null check(kind in ('receipt','refund')),
  amount_cents bigint not null check(amount_cents between 1 and 1000000000000),
  occurred_at timestamptz not null check(isfinite(occurred_at)),
  method text not null check(length(btrim(method)) between 2 and 100),
  reason text not null default '' check(length(reason)<=1000),
  refund_of uuid references public.finance_entries(id),
  recorded_at timestamptz not null default clock_timestamp(), recorded_by uuid not null references auth.users(id),
  check((kind='receipt' and refund_of is null) or (kind='refund' and refund_of is not null and length(btrim(reason))>=3))
);
-- Histórico por projeto, estornos por recebimento, indicadores por data e saldo vencido.
create index finance_entries_project_date_idx on public.finance_entries(project_id,occurred_at desc,id desc);
create index finance_entries_refund_idx on public.finance_entries(refund_of) where refund_of is not null;
create index finance_entries_period_idx on public.finance_entries(occurred_at);
create index project_contracts_date_idx on public.project_contracts(contracted_on);
create index project_contracts_due_idx on public.project_contracts(balance_due_on) where balance_due_on is not null;
create index contract_history_project_idx on public.contract_history(project_id,recorded_at desc,id desc);
alter table public.project_contracts enable row level security;
alter table public.contract_history enable row level security;
alter table public.finance_entries enable row level security;
revoke all on public.project_contracts,public.contract_history,public.finance_entries from public,anon,authenticated;
grant select on public.project_contracts,public.contract_history,public.finance_entries to authenticated;
create policy producer_contracts_read on public.project_contracts for select to authenticated using((select public.is_producer()));
create policy producer_contract_history_read on public.contract_history for select to authenticated using((select public.is_producer()));
create policy producer_entries_read on public.finance_entries for select to authenticated using((select public.is_producer()));

create function public.save_project_contract(p_project_id uuid,p_operation_id uuid,p_amount_cents bigint,p_contracted_on date,p_due_on date,p_expected_revision bigint,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.project_contracts; prior public.contract_history; payload jsonb; net bigint;
begin
  perform private.require_producer();
  if p_operation_id is null or p_amount_cents is null or p_amount_cents not between 1 and 1000000000000
    or p_contracted_on is null or not isfinite(p_contracted_on) or p_contracted_on > (now() at time zone 'America/Sao_Paulo')::date
    or (p_due_on is not null and not isfinite(p_due_on)) or p_expected_revision is null or p_expected_revision<0
    or p_reason is null or length(btrim(p_reason)) not between 3 and 1000 then
    raise exception 'Contrato inválido' using errcode='22023';
  end if;
  perform 1 from public.projects where id=p_project_id for update;
  if not found then raise exception 'Pedido inexistente' using errcode='22023'; end if;
  payload:=jsonb_build_object('amount_cents',p_amount_cents::text,'contracted_on',p_contracted_on,'balance_due_on',p_due_on,'expected_revision',p_expected_revision);
  select * into prior from public.contract_history where id=p_operation_id;
  if found then
    if prior.project_id<>p_project_id or prior.payload<>payload or prior.reason<>btrim(p_reason) then raise exception 'Operação já utilizada' using errcode='22023'; end if;
    select * into r from public.project_contracts where project_id=p_project_id;
    return to_jsonb(r)||jsonb_build_object('amount_cents',r.amount_cents::text);
  end if;
  select * into r from public.project_contracts where project_id=p_project_id for update;
  if (not found and p_expected_revision<>0) or (found and r.revision<>p_expected_revision) then raise exception 'Contrato alterado em outra janela' using errcode='40001'; end if;
  select coalesce(sum(case when kind='receipt' then amount_cents else -amount_cents end),0) into net from public.finance_entries where project_id=p_project_id;
  if p_amount_cents<net then raise exception 'Valor contratado inferior ao recebido líquido' using errcode='22023'; end if;
  insert into public.project_contracts(project_id,amount_cents,contracted_on,balance_due_on)
    values(p_project_id,p_amount_cents,p_contracted_on,p_due_on)
    on conflict(project_id) do update set amount_cents=excluded.amount_cents,contracted_on=excluded.contracted_on,balance_due_on=excluded.balance_due_on,
      revision=public.project_contracts.revision+1,updated_at=clock_timestamp() returning * into r;
  insert into public.contract_history(id,project_id,payload,reason,recorded_by) values(p_operation_id,p_project_id,payload,btrim(p_reason),auth.uid());
  return to_jsonb(r)||jsonb_build_object('amount_cents',r.amount_cents::text);
end; $$;
revoke all on function public.save_project_contract(uuid,uuid,bigint,date,date,bigint,text) from public,anon,authenticated;
grant execute on function public.save_project_contract(uuid,uuid,bigint,date,date,bigint,text) to authenticated;

create function public.record_finance_entry(p_project_id uuid,p_id uuid,p_kind text,p_amount_cents bigint,p_occurred_at timestamptz,p_method text,p_reason text,p_refund_of uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.project_contracts; r public.finance_entries; original public.finance_entries; net bigint; refunded bigint;
begin
  perform private.require_producer();
  if p_id is null or p_kind is null or p_kind not in ('receipt','refund') or p_amount_cents is null or p_amount_cents not between 1 and 1000000000000
    or p_occurred_at is null or not isfinite(p_occurred_at) or p_occurred_at>clock_timestamp()
    or p_method is null or length(btrim(p_method)) not between 2 and 100 or p_reason is null or length(p_reason)>1000
    or (p_kind='receipt' and p_refund_of is not null) or (p_kind='refund' and (p_refund_of is null or length(btrim(p_reason))<3)) then raise exception 'Lançamento inválido' using errcode='22023'; end if;
  -- Serializa também com edição do contrato (mesma ordem de locks).
  perform 1 from public.projects where id=p_project_id for update;
  select * into c from public.project_contracts where project_id=p_project_id for update;
  if not found then raise exception 'Registre um contrato antes do recebimento' using errcode='22023'; end if;
  select * into r from public.finance_entries where id=p_id;
  if found then
    if r.project_id<>p_project_id or r.kind<>p_kind or r.amount_cents<>p_amount_cents or r.occurred_at<>p_occurred_at
      or r.method<>btrim(p_method) or r.reason<>btrim(p_reason) or r.refund_of is distinct from p_refund_of then raise exception 'Operação já utilizada' using errcode='22023'; end if;
    return to_jsonb(r)||jsonb_build_object('amount_cents',r.amount_cents::text);
  end if;
  select coalesce(sum(case when kind='receipt' then amount_cents else -amount_cents end),0) into net from public.finance_entries where project_id=p_project_id;
  if p_kind='receipt' and net+p_amount_cents>c.amount_cents then raise exception 'Recebimento acima do valor contratado' using errcode='22023'; end if;
  if p_kind='refund' then
    select * into original from public.finance_entries where id=p_refund_of and project_id=p_project_id and kind='receipt';
    if not found then raise exception 'Recebimento original inválido' using errcode='22023'; end if;
    select coalesce(sum(amount_cents),0) into refunded from public.finance_entries where refund_of=p_refund_of;
    if p_amount_cents>original.amount_cents-refunded or p_amount_cents>net then raise exception 'Estorno superior ao recebido disponível' using errcode='22023'; end if;
  end if;
  insert into public.finance_entries(id,project_id,kind,amount_cents,occurred_at,method,reason,refund_of,recorded_by)
    values(p_id,p_project_id,p_kind,p_amount_cents,p_occurred_at,btrim(p_method),btrim(p_reason),p_refund_of,auth.uid()) returning * into r;
  return to_jsonb(r)||jsonb_build_object('amount_cents',r.amount_cents::text);
end; $$;
revoke all on function public.record_finance_entry(uuid,uuid,text,bigint,timestamptz,text,text,uuid) from public,anon,authenticated;
grant execute on function public.record_finance_entry(uuid,uuid,text,bigint,timestamptz,text,text,uuid) to authenticated;

create function public.finance_snapshot(p_month date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; start_at timestamptz; end_at timestamptz;
begin
  perform private.require_producer();
  if p_month is null or not isfinite(p_month) or extract(day from p_month)<>1 then raise exception 'Período inválido' using errcode='22023'; end if;
  start_at:=p_month::timestamp at time zone 'America/Sao_Paulo'; end_at:=(p_month+interval '1 month')::timestamp at time zone 'America/Sao_Paulo';
  with nets as(select project_id,sum(case when kind='receipt' then amount_cents else -amount_cents end) as net from public.finance_entries group by project_id),
  balances as(select c.*,c.amount_cents-coalesce(n.net,0) as balance from public.project_contracts c left join nets n using(project_id))
  select jsonb_build_object('queried_at',now(),'month',to_char(p_month,'YYYY-MM'),'period_start',start_at,'period_end',end_at,
    'received_cents',(select coalesce(sum(case when kind='receipt' then amount_cents else -amount_cents end),0)::text from public.finance_entries where occurred_at>=start_at and occurred_at<end_at),
    'entry_count',(select count(*) from public.finance_entries where occurred_at>=start_at and occurred_at<end_at),
    'contracted_cents',(select coalesce(sum(amount_cents),0)::text from public.project_contracts where contracted_on>=p_month and contracted_on<(p_month+interval '1 month')::date),
    'contract_count',(select count(*) from public.project_contracts),
    'receivable_cents',(select coalesce(sum(balance),0)::text from balances),
    'overdue_cents',(select coalesce(sum(balance),0)::text from balances where balance_due_on<(now() at time zone 'America/Sao_Paulo')::date and balance>0),
    'orders',(select count(*) from public.projects where created_at>=start_at and created_at<end_at),
    'pending_returns',(select count(*) from public.contact_tracking where return_at<=now() and commercial_status not in ('won','lost','do_not_contact')),
    'scheduled_sessions',(select count(*) from public.producer_sessions where starts_at>=start_at and starts_at<end_at and status in ('reserved','confirmed')),
    'held_sessions',(select count(*) from public.producer_sessions where starts_at>=start_at and starts_at<end_at and status='held')
  ) into result;
  return result;
end; $$;
revoke all on function public.finance_snapshot(date) from public,anon,authenticated;
grant execute on function public.finance_snapshot(date) to authenticated;

create function public.finance_project_detail(p_project_id uuid,p_offset integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  perform private.require_producer();
  if p_offset is null or p_offset<0 then raise exception 'Página inválida' using errcode='22023'; end if;
  return jsonb_build_object('queried_at',now(),
    'contract',(select to_jsonb(c)||jsonb_build_object('amount_cents',c.amount_cents::text) from public.project_contracts c where project_id=p_project_id),
    'net_cents',(select coalesce(sum(case when kind='receipt' then amount_cents else -amount_cents end),0)::text from public.finance_entries where project_id=p_project_id),
    'entries',(select coalesce(jsonb_agg(x.r order by x.occurred_at desc,x.id desc),'[]') from (select e.id,e.occurred_at,to_jsonb(e)||jsonb_build_object('amount_cents',e.amount_cents::text,'refund_remaining_cents',(e.amount_cents-coalesce((select sum(amount_cents) from public.finance_entries where refund_of=e.id),0))::text) as r from public.finance_entries e where project_id=p_project_id order by occurred_at desc,id desc offset p_offset limit 21) x),
    'contract_history',(select coalesce(jsonb_agg(to_jsonb(x) order by x.recorded_at desc,x.id desc),'[]') from(select * from public.contract_history where project_id=p_project_id order by recorded_at desc,id desc offset p_offset limit 21)x)
  );
end; $$;
revoke all on function public.finance_project_detail(uuid,integer) from public,anon,authenticated;
grant execute on function public.finance_project_detail(uuid,integer) to authenticated;
commit;
