-- Nome de usuário único no cadastro e login por nome de usuário.
-- Executar uma vez, depois das migrações anteriores. Tudo roda em uma transação:
-- se algum comando falhar, nada é aplicado.
--
-- A unicidade já existe desde a primeira migração: o índice perfis_username_unico (em lower(username))
-- impede "Ana" e "ana" ao mesmo tempo, e o formato (3 a 30 letras, números ou _) está em perfis.username.
begin;

-- 1) O trigger de novo usuário passa a gravar o username enviado no cadastro ---------------------------
-- Nome repetido ou fora do formato faz o cadastro falhar (o Supabase só mostra "Database error saving
-- new user", que a tela traduz). O nome de exibição começa igual ao username e pode ser trocado depois.
create or replace function public.gameatlas_criar_perfil()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  novo_username text := nullif(btrim(new.raw_user_meta_data ->> 'username'), '');
begin
  insert into public.perfis (id, nome, username)
  values (
    new.id,
    coalesce(
      nullif(left(btrim(new.raw_user_meta_data ->> 'nome'), 100), ''),
      nullif(left(btrim(new.raw_user_meta_data ->> 'display_name'), 100), ''),
      nullif(left(btrim(new.raw_user_meta_data ->> 'full_name'), 100), ''),
      novo_username,
      'Jogador'
    ),
    novo_username
  );
  return new;
end;
$$;

-- 2) "Esse nome de usuário está livre?" — usada pela tela de cadastro (visitante ainda sem conta) -----
-- O parâmetro se chama "candidato" (e não "nome") para não se confundir com a coluna perfis.nome.
create or replace function public.username_disponivel(candidato text)
returns boolean language sql stable security definer set search_path = '' as $$
  select candidato ~ '^[A-Za-z0-9_]{3,30}$'
     and not exists (select 1 from public.perfis p where lower(p.username) = lower(candidato));
$$;
revoke all on function public.username_disponivel(text) from public;
grant execute on function public.username_disponivel(text) to anon, authenticated;

-- 3) Descobre o e-mail de um nome de usuário — SÓ o backend (service_role) pode chamar ------------------
-- Se qualquer visitante pudesse chamar, daria para descobrir o e-mail de qualquer pessoa pelo @usuario.
create or replace function public.email_por_username(candidato text)
returns text language sql stable security definer set search_path = '' as $$
  select u.email::text
  from auth.users u
  join public.perfis p on p.id = u.id
  where lower(p.username) = lower(candidato)
  limit 1;
$$;
revoke all on function public.email_por_username(text) from public, anon, authenticated;
grant execute on function public.email_por_username(text) to service_role;

commit;
