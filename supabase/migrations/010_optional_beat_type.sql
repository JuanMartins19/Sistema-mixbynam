-- Aplicar após 009. Novos pedidos podem selecionar beat sem informar tipo.
-- Preserva tipos existentes nos pedidos antigos, sem escolher uma opção automaticamente.
begin;
create or replace function private.validate_stage(a jsonb, s integer) returns void
language plpgsql set search_path = '' as $$
declare k text; required_keys text[]; svc jsonb;
begin
  if a is null or jsonb_typeof(a) <> 'object' or octet_length(a::text) > 16000 then
    raise exception 'Respostas inválidas' using errcode = '22023';
  end if;
  required_keys := case s
    when 1 then array['artist_name','whatsapp','email']
    when 2 then array['genre','arrangement','arrangement_other']
    when 3 then array['beat_type','references','notes']
    when 4 then array['budget','deadline'] else array[]::text[] end;
  foreach k in array required_keys loop
    if jsonb_typeof(a->k) is distinct from 'string' then
      raise exception 'Campo inválido: %', k using errcode = '22023';
    end if;
  end loop;
  if s = 1 then
    if length(btrim(a->>'artist_name')) not between 2 and 100
      or not private.valid_whatsapp(a->>'whatsapp')
      or length(a->>'email') > 254
      or ((a->>'email') <> '' and (a->>'email') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
 then
      raise exception 'Contato inválido' using errcode = '22023';
    end if;
  elsif s = 2 then
    if length(btrim(a->>'genre')) not between 2 and 100
      or a->>'arrangement' not in ('solo','team','other')
      or length(a->>'arrangement_other') > 200
      or (a->>'arrangement' = 'other' and length(btrim(a->>'arrangement_other')) < 2) then
      raise exception 'Atuação inválida' using errcode = '22023';
    end if;
  elsif s = 3 then
    if jsonb_typeof(a->'services') is distinct from 'array' then
      raise exception 'Serviços inválidos' using errcode = '22023';
    end if;
    if jsonb_array_length(a->'services') not between 1 and 7
      or exists (select 1 from jsonb_array_elements(a->'services') v
        where jsonb_typeof(v) <> 'string' or v #>> '{}' not in ('beat','recording','editing','mixing','mastering','tuning','live'))
      or (select count(distinct v) from jsonb_array_elements(a->'services') v) <> jsonb_array_length(a->'services')
      or (a->>'beat_type' <> '' and a->>'beat_type' not in ('ready','exclusive','custom'))
      or jsonb_typeof(a->'no_references') is distinct from 'boolean'
      or length(a->>'references') > 2000 or length(a->>'notes') > 3000 then
      raise exception 'Produção inválida' using errcode = '22023';
    end if;
    if a->'no_references' = 'false'::jsonb then
      if length(btrim(a->>'references')) = 0 or exists (
        select 1 from regexp_split_to_table(a->>'references', E'\n') link
        where btrim(link) <> '' and btrim(link) !~ '^https?://[^[:space:]/]+[^[:space:]]*$'
      ) then raise exception 'Referências inválidas' using errcode = '22023'; end if;
    end if;
  elsif s = 4 then
    if jsonb_typeof(a->'needs_guidance') is distinct from 'boolean'
      or length(a->>'budget') > 100
      or (a->'needs_guidance' = 'false'::jsonb and length(btrim(a->>'budget')) < 2)
      or length(btrim(a->>'deadline')) not between 2 and 200 then
      raise exception 'Orçamento ou prazo inválidos' using errcode = '22023';
    end if;
  else raise exception 'Etapa inválida' using errcode = '22023';
  end if;
end;
$$;
revoke all on function private.validate_stage(jsonb,integer) from public, anon, authenticated;




commit;
