-- Apply after 008. Country length metadata: libphonenumber-js 1.13.15.
-- Validate format/length only; does not prove ownership or a WhatsApp account.
begin;
create table private.phone_lengths(country_code text primary key,possible_lengths integer[] not null);
alter table private.phone_lengths enable row level security;
revoke all on private.phone_lengths from public,anon,authenticated;
insert into private.phone_lengths(country_code,possible_lengths) values
('1',array[10]),
('7',array[10,14]),
('20',array[8,9,10]),
('27',array[5,6,7,8,9,10]),
('30',array[10,11,12]),
('31',array[5,6,7,8,9,10,11]),
('32',array[8,9]),
('33',array[9]),
('34',array[9]),
('36',array[8,9]),
('39',array[6,7,8,9,10,11,12]),
('40',array[6,9]),
('41',array[9,12]),
('43',array[4,5,6,7,8,9,10,11,12,13]),
('44',array[7,9,10]),
('45',array[8]),
('46',array[6,7,8,9,10,12]),
('47',array[5,8]),
('48',array[6,7,8,9,10]),
('49',array[4,5,6,7,8,9,10,11,12,13,14,15]),
('51',array[8,9]),
('52',array[10]),
('53',array[6,7,8,10]),
('54',array[10,11]),
('55',array[8,9,10,11]),
('56',array[9,10,11]),
('57',array[8,10,11]),
('58',array[10]),
('60',array[8,9,10]),
('61',array[5,6,7,8,9,10,12]),
('62',array[7,8,9,10,11,12,13,14,15,16,17]),
('63',array[6,8,9,10,11,12,13]),
('64',array[5,6,7,8,9,10]),
('65',array[8,10,11]),
('66',array[8,9,10,13]),
('81',array[8,9,10,11,12,13,14,15,16,17]),
('82',array[5,6,8,9,10,11,12,13,14]),
('84',array[7,8,9,10]),
('86',array[7,8,9,10,11,12]),
('90',array[7,10,12,13]),
('91',array[8,9,10,11,12,13]),
('92',array[8,9,10,11,12]),
('93',array[9]),
('94',array[9]),
('95',array[6,7,8,9,10]),
('98',array[4,5,6,7,10]),
('211',array[9]),
('212',array[9]),
('213',array[8,9]),
('216',array[8]),
('218',array[9]),
('220',array[7,9]),
('221',array[9]),
('222',array[8]),
('223',array[8]),
('224',array[8,9]),
('225',array[10]),
('226',array[8]),
('227',array[8]),
('228',array[8]),
('229',array[8,10]),
('230',array[7,8,10]),
('231',array[7,8,9]),
('232',array[8]),
('233',array[8,9]),
('234',array[10,11,12,13,14]),
('235',array[8]),
('236',array[8]),
('237',array[8,9]),
('238',array[7]),
('239',array[7]),
('240',array[9]),
('241',array[7,8]),
('242',array[9]),
('243',array[7,8,9,10]),
('244',array[9]),
('245',array[7,9]),
('246',array[7]),
('247',array[5,6]),
('248',array[7]),
('249',array[9]),
('250',array[8,9]),
('251',array[9]),
('252',array[6,7,8,9]),
('253',array[8]),
('254',array[7,8,9,10]),
('255',array[9]),
('256',array[9]),
('257',array[8]),
('258',array[8,9]),
('260',array[9]),
('261',array[9]),
('262',array[9]),
('263',array[7,9,10]),
('264',array[8,9]),
('265',array[7,9]),
('266',array[8]),
('267',array[7,8,10]),
('268',array[8,9]),
('269',array[7]),
('290',array[4,5]),
('291',array[7]),
('297',array[7]),
('298',array[6]),
('299',array[6]),
('350',array[8]),
('351',array[9]),
('352',array[4,5,6,7,8,9,10,11]),
('353',array[7,8,9,10]),
('354',array[7,9]),
('355',array[6,7,8,9]),
('356',array[8]),
('357',array[8]),
('358',array[5,6,7,8,9,10,11,12]),
('359',array[6,7,8,9,12]),
('370',array[8]),
('371',array[8]),
('372',array[7,8,10]),
('373',array[8]),
('374',array[8]),
('375',array[6,7,8,9,10,11]),
('376',array[6,8,9]),
('377',array[8,9]),
('378',array[8,10]),
('380',array[9,10]),
('381',array[6,7,8,9,10,11,12]),
('382',array[8,9]),
('383',array[8,9,10,11,12]),
('385',array[7,8,9]),
('386',array[5,6,7,8]),
('387',array[8,9]),
('389',array[8]),
('420',array[9,10,11,12]),
('421',array[6,7,9]),
('423',array[7,9]),
('500',array[5]),
('501',array[7,11]),
('502',array[8,11]),
('503',array[7,8,11]),
('504',array[8,11]),
('505',array[8]),
('506',array[8,10]),
('507',array[7,8,10,11]),
('508',array[6,9]),
('509',array[8]),
('590',array[9]),
('591',array[8,9]),
('592',array[7]),
('593',array[8,9,10,11]),
('594',array[9]),
('595',array[6,7,8,9,10,11]),
('596',array[9]),
('597',array[6,7]),
('598',array[4,5,6,7,8,9,10,11,12,13]),
('599',array[7,8]),
('670',array[7,8]),
('672',array[6]),
('673',array[7]),
('674',array[7]),
('675',array[7,8]),
('676',array[5,7]),
('677',array[5,7]),
('678',array[5,7]),
('679',array[7,11]),
('680',array[7]),
('681',array[6,9]),
('682',array[5]),
('683',array[4,7]),
('685',array[5,6,7,10]),
('686',array[5,8]),
('687',array[6]),
('688',array[5,6,7]),
('689',array[6,8,9]),
('690',array[4,5,6,7]),
('691',array[7]),
('692',array[7]),
('800',array[8]),
('808',array[8]),
('850',array[8,10]),
('852',array[5,6,7,8,9,11]),
('853',array[7,8]),
('855',array[8,9,10]),
('856',array[8,9,10]),
('870',array[9,12]),
('878',array[12]),
('880',array[6,7,8,9,10]),
('881',array[9,10]),
('882',array[7,8,9,10,11,12]),
('883',array[8,9,10,11,12]),
('886',array[7,8,9,10,11]),
('888',array[11]),
('960',array[7,10]),
('961',array[7,8]),
('962',array[8,9]),
('963',array[8,9]),
('964',array[8,9,10]),
('965',array[7,8]),
('966',array[9,10]),
('967',array[7,8,9]),
('968',array[7,8,9]),
('970',array[8,9,10]),
('971',array[5,6,7,8,9,10,11,12]),
('972',array[7,8,9,10,11,12]),
('973',array[8]),
('974',array[7,8,9,11]),
('975',array[7,8]),
('976',array[8,9,10]),
('977',array[8,10,11]),
('979',array[9]),
('992',array[9]),
('993',array[8]),
('994',array[9]),
('995',array[9]),
('996',array[9,10]),
('998',array[9]);
create function private.valid_whatsapp(p_phone text) returns boolean
language plpgsql stable set search_path='' as $$
declare digits text;
begin
  if p_phone is null then return false; end if;
  if p_phone !~ '^\+[1-9][0-9]{1,14}$' then
    return p_phone ~ '^(11|12|13|14|15|16|17|18|19|21|22|24|27|28|31|32|33|34|35|37|38|41|42|43|44|45|46|47|48|49|51|53|54|55|61|62|63|64|65|66|67|68|69|71|73|74|75|77|79|81|82|83|84|85|86|87|88|89|91|92|93|94|95|96|97|98|99)([2-9][0-9]{7}|9[0-9]{8})$';
  end if;
  digits:=substring(p_phone from 2);
  if digits like '55%' then return substring(digits from 3) ~ '^(11|12|13|14|15|16|17|18|19|21|22|24|27|28|31|32|33|34|35|37|38|41|42|43|44|45|46|47|48|49|51|53|54|55|61|62|63|64|65|66|67|68|69|71|73|74|75|77|79|81|82|83|84|85|86|87|88|89|91|92|93|94|95|96|97|98|99)([2-9][0-9]{7}|9[0-9]{8})$'; end if;
  return exists(select 1 from private.phone_lengths where left(digits,length(country_code))=country_code
    and length(digits)-length(country_code)=any(possible_lengths));
end; $$;
revoke all on function private.valid_whatsapp(text) from public,anon,authenticated;
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
      or ((a->'services') ? 'beat' and a->>'beat_type' not in ('ready','exclusive','custom'))
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
