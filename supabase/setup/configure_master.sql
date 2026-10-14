-- Configuração administrativa, não é uma migração de estrutura.
-- Executar no SQL Editor como postgres, após criar o usuário em Authentication.
-- Substituir EMAIL-DO-PRODUTOR no editor. Não inserir senha neste script.
begin;
do $$
declare
  producer_email text := 'EMAIL-DO-PRODUTOR';
  producer_id uuid;
  confirmed_at timestamptz;
  matching_users integer;
begin
  if producer_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Informe o e-mail válido da conta criada.';
  end if;
  select count(*) into matching_users from auth.users
    where lower(email) = lower(btrim(producer_email));
  if matching_users <> 1 then
    raise exception 'É necessário exatamente um usuário com esse e-mail. Confira Authentication > Users.';
  end if;
  select id,email_confirmed_at into producer_id,confirmed_at from auth.users
    where lower(email) = lower(btrim(producer_email));
  if confirmed_at is null then
    raise exception 'Confirme o e-mail da conta no Dashboard antes de autorizar o acesso.';
  end if;
  insert into private.producer(singleton,user_id) values(true,producer_id)
    on conflict(singleton) do update set user_id = excluded.user_id;
end;
$$;
select u.email, p.user_id, u.email_confirmed_at is not null as email_confirmado,
  'Produtor master único' as acesso
from private.producer p join auth.users u on u.id = p.user_id;
commit;
