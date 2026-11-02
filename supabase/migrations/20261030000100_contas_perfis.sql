-- Executar depois das migrações 20261009, 20261014 e 20261016.
-- Preserva perfis e conteúdo existentes. Não altera o esquema interno do Auth.
begin;

alter table public.perfis add column desativado_em timestamptz;

-- Contas antigas sem username recebem um identificador único, sem usar e-mail.
do $$
declare p record; candidato text; base text; tentativa integer;
begin
  for p in select id from public.perfis where username is null order by id loop
    base := 'jogador_' || left(replace(p.id::text, '-', ''), 16);
    candidato := base; tentativa := 0;
    while exists (select 1 from public.perfis where lower(username) = lower(candidato)) loop
      tentativa := tentativa + 1; candidato := base || '_' || tentativa::text;
    end loop;
    update public.perfis set username = candidato where id = p.id;
  end loop;
end;
$$;
alter table public.perfis alter column username set not null;

-- O perfil é a fonte do username e do nome; metadados Auth não concedem permissões.
create function public.gameatlas_metadados_auth()
returns trigger language plpgsql security definer set search_path = '' as $$
declare usuario text; exibicao text;
begin
  if tg_op = 'INSERT' then
    usuario := btrim(new.raw_user_meta_data ->> 'username');
    if usuario is null or usuario !~ '^[A-Za-z0-9_]{3,30}$' then
      raise exception 'Nome de usuário obrigatório: use 3 a 30 letras, números ou _.' using errcode = '23514';
    end if;
    exibicao := coalesce(nullif(btrim(new.raw_user_meta_data ->> 'nome'), ''), usuario);
  else
    select username, nome into usuario, exibicao from public.perfis where id = new.id;
    if not found then return new; end if;
  end if;
  new.raw_user_meta_data := coalesce(new.raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
    'username', usuario, 'display_name', usuario, 'name', usuario, 'full_name', usuario, 'nome', exibicao);
  return new;
end;
$$;
create trigger gameatlas_metadados_auth before insert or update of raw_user_meta_data on auth.users
for each row execute function public.gameatlas_metadados_auth();

create function public.gameatlas_sincronizar_perfil()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update auth.users set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
    'username', new.username, 'display_name', new.username, 'name', new.username,
    'full_name', new.username, 'nome', new.nome)
  where id = new.id;
  return new;
end;
$$;
create trigger gameatlas_sincronizar_perfil after update of username, nome on public.perfis
for each row when (old.username is distinct from new.username or old.nome is distinct from new.nome)
execute function public.gameatlas_sincronizar_perfil();
update auth.users u set raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
  'username', p.username, 'display_name', p.username, 'name', p.username, 'full_name', p.username, 'nome', p.nome)
from public.perfis p where p.id = u.id;

create function public.gameatlas_favoritos_validos(itens text[])
returns boolean language sql immutable set search_path = '' as $$
  select cardinality(itens) <= 5
    and not exists (select 1 from unnest(itens) x where x is null or char_length(btrim(x)) not between 1 and 60)
    and cardinality(itens) = (select count(distinct lower(btrim(x))) from unnest(itens) x);
$$;
create function public.gameatlas_redes_validas(itens jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare item jsonb; rede text; endereco text; host text; permitidos text[]; vistos text[] := '{}';
begin
  if jsonb_typeof(itens) <> 'array' or jsonb_array_length(itens) > 6 then return false; end if;
  for item in select value from jsonb_array_elements(itens) loop
    if jsonb_typeof(item) <> 'object' or jsonb_typeof(item->'rede') <> 'string'
      or jsonb_typeof(item->'url') <> 'string' then return false; end if;
    rede := item->>'rede'; endereco := item->>'url';
    if rede is null or endereco is null or rede = any(vistos)
      or char_length(endereco) > 190 or endereco ~ '[[:space:][:cntrl:]]'
      or endereco !~ '^https://[^/?#]+' then return false; end if;
    host := lower(substring(endereco from '^https://([^/?#]+)'));
    if host like '%@%' then return false; end if;
    host := regexp_replace(host, ':[0-9]+$', '');
    if host !~ '^[a-z0-9]([a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$' then return false; end if;
    permitidos := case rede
      when 'instagram' then array['instagram.com'] when 'github' then array['github.com']
      when 'linkedin' then array['linkedin.com'] when 'x' then array['x.com','twitter.com']
      when 'youtube' then array['youtube.com','youtu.be'] when 'twitch' then array['twitch.tv']
      when 'steam' then array['steamcommunity.com'] when 'discord' then array['discord.gg','discord.com']
      when 'site' then array[host] else '{}'::text[] end;
    if not exists (select 1 from unnest(permitidos) p where host = p or right(host, length(p)+1) = '.' || p)
      then return false; end if;
    vistos := array_append(vistos, rede);
  end loop;
  return true;
end;
$$;
alter table public.perfis drop constraint perfis_jogos_favoritos_valido,
  drop constraint perfis_redes_sociais_valida, drop constraint perfis_ordem_reviews_valida;
-- NOT VALID preserva valores legados; novas gravações sempre passam pela validação.
alter table public.perfis
  add constraint perfis_jogos_favoritos_valido check (public.gameatlas_favoritos_validos(jogos_favoritos)) not valid,
  add constraint perfis_redes_sociais_valida check (public.gameatlas_redes_validas(redes_sociais)) not valid,
  add constraint perfis_ordem_reviews_valida check (ordem_reviews in ('recentes','antigas','populares'));

create function public.gameatlas_conta_ativa()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfis where id = (select auth.uid()) and desativado_em is null);
$$;
create function public.gameatlas_desativar_conta(alvo uuid)
returns void language sql security definer set search_path = '' as $$
  update public.perfis set desativado_em = coalesce(desativado_em, now()) where id = alvo;
$$;
revoke all on function public.gameatlas_desativar_conta(uuid) from public, anon, authenticated;
grant execute on function public.gameatlas_desativar_conta(uuid) to service_role;

create table public.review_curtidas (
  review_id uuid not null references public.reviews(id) on delete cascade,
  usuario_id uuid not null default auth.uid() references public.perfis(id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (review_id, usuario_id)
);
create index review_curtidas_usuario_idx on public.review_curtidas(usuario_id);
alter table public.review_curtidas enable row level security;
revoke all on public.review_curtidas from public, anon, authenticated;
grant select, delete on public.review_curtidas to authenticated;
grant insert (review_id, usuario_id) on public.review_curtidas to authenticated;
grant all on public.review_curtidas to service_role;
create policy curtidas_ler_proprias on public.review_curtidas for select to authenticated
  using (usuario_id = (select auth.uid()) and public.gameatlas_conta_ativa());
create policy curtidas_criar_proprias on public.review_curtidas for insert to authenticated
  with check (usuario_id = (select auth.uid()) and public.gameatlas_conta_ativa()
    and exists (select 1 from public.reviews where id = review_id));
create policy curtidas_remover_proprias on public.review_curtidas for delete to authenticated
  using (usuario_id = (select auth.uid()) and public.gameatlas_conta_ativa());

-- O visitante só recebe a contagem, nunca a relação de quem curtiu.
create function public.total_curtidas_review(alvo uuid)
returns bigint language sql stable security definer set search_path = '' as $$
  select count(*) from public.review_curtidas c join public.perfis p on p.id = c.usuario_id
  where c.review_id = alvo and p.desativado_em is null
    and exists (select 1 from public.reviews r join public.perfis a on a.id = r.usuario_id
      where r.id = alvo and a.desativado_em is null);
$$;

-- Restrições adicionais valem também para JWTs emitidos antes da desativação.
create policy perfis_ativos on public.perfis as restrictive for select to anon, authenticated
  using (desativado_em is null);
do $$
declare tabela text;
begin
  foreach tabela in array array['perfis','reviews','listas','lista_jogos','jogos_salvos'] loop
    execute format('create policy conta_ativa on public.%I as restrictive for all to authenticated using (public.gameatlas_conta_ativa()) with check (public.gameatlas_conta_ativa())', tabela);
  end loop;
end;
$$;
create policy reviews_autor_ativo on public.reviews as restrictive for select to anon, authenticated
  using (exists (select 1 from public.perfis where id = usuario_id));
create policy listas_autor_ativo on public.listas as restrictive for select to anon, authenticated
  using (exists (select 1 from public.perfis where id = usuario_id));
create policy avatares_conta_ativa on storage.objects as restrictive for all to authenticated
  using (bucket_id <> 'avatares' or public.gameatlas_conta_ativa())
  with check (bucket_id <> 'avatares' or public.gameatlas_conta_ativa());

create function public.reviews_do_perfil(alvo uuid, ordenacao text default null, pagina integer default 1, tamanho integer default 12)
returns jsonb language plpgsql stable set search_path = '' as $$
declare ordem text; resposta jsonb;
begin
  if pagina < 1 or pagina > 10000 or tamanho < 1 or tamanho > 48 or pagina is null or tamanho is null
    then raise exception 'Paginação inválida' using errcode = '22023'; end if;
  select coalesce(ordenacao, ordem_reviews) into ordem from public.perfis where id = alvo and mostrar_reviews;
  if not found then return jsonb_build_object('items','[]'::jsonb,'count',0); end if;
  if ordem not in ('recentes','antigas','populares') then raise exception 'Ordenação inválida' using errcode = '22023'; end if;
  select jsonb_build_object('items', coalesce(jsonb_agg(item order by pos), '[]'::jsonb),
    'count', (select count(*) from public.reviews where usuario_id = alvo)) into resposta
  from (
    select to_jsonb(r) || jsonb_build_object('curtidas',public.total_curtidas_review(r.id),
      'jogos',jsonb_build_object('id',g.id,'rawg_id',g.rawg_id,'nome',g.nome,'capa_url',g.capa_url),
      'perfis',jsonb_build_object('nome',p.nome,'username',p.username)) as item,
      row_number() over (order by
        case when ordem = 'populares' then public.total_curtidas_review(r.id) end desc,
        case when ordem = 'antigas' then r.criado_em end asc,
        case when ordem <> 'antigas' then r.criado_em end desc, r.id desc) as pos
    from public.reviews r join public.jogos g on g.id = r.jogo_id join public.perfis p on p.id = r.usuario_id
    where r.usuario_id = alvo
    order by pos limit tamanho offset (pagina-1)*tamanho
  ) dados;
  return resposta;
end;
$$;
create function public.listas_do_perfil(alvo uuid, ordenacao text default null, pagina integer default 1, tamanho integer default 12)
returns jsonb language plpgsql stable set search_path = '' as $$
declare ordem text; resposta jsonb;
begin
  if pagina < 1 or pagina > 10000 or tamanho < 1 or tamanho > 48 or pagina is null or tamanho is null
    then raise exception 'Paginação inválida' using errcode = '22023'; end if;
  select coalesce(ordenacao, ordem_listas) into ordem from public.perfis where id = alvo and mostrar_listas;
  if not found then return jsonb_build_object('items','[]'::jsonb,'count',0); end if;
  if ordem not in ('recentes','antigas') then raise exception 'Ordenação inválida' using errcode = '22023'; end if;
  select jsonb_build_object('items',coalesce(jsonb_agg(item order by pos),'[]'::jsonb),
    'count',(select count(*) from public.listas where usuario_id = alvo)) into resposta
  from (
    select to_jsonb(l) || jsonb_build_object('perfis',jsonb_build_object('nome',p.nome,'username',p.username)) as item,
      row_number() over (order by case when ordem = 'antigas' then l.criado_em end asc,
        case when ordem = 'recentes' then l.criado_em end desc,l.id desc) as pos
    from public.listas l join public.perfis p on p.id = l.usuario_id where l.usuario_id = alvo
    order by pos limit tamanho offset (pagina-1)*tamanho
  ) dados;
  return resposta;
end;
$$;
create or replace function public.username_disponivel(candidato text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(btrim(candidato) ~ '^[A-Za-z0-9_]{3,30}$' and not exists
    (select 1 from public.perfis where lower(username) = lower(btrim(candidato))), false);
$$;
create or replace function public.email_por_username(candidato text)
returns text language sql stable security definer set search_path = '' as $$
  select u.email::text from auth.users u join public.perfis p on p.id = u.id
  where lower(p.username) = lower(btrim(candidato)) and p.desativado_em is null limit 1;
$$;

revoke all on function public.gameatlas_metadados_auth(), public.gameatlas_sincronizar_perfil(),
  public.gameatlas_conta_ativa(), public.gameatlas_favoritos_validos(text[]), public.gameatlas_redes_validas(jsonb),
  public.total_curtidas_review(uuid), public.reviews_do_perfil(uuid,text,integer,integer),
  public.listas_do_perfil(uuid,text,integer,integer) from public, anon, authenticated;
grant execute on function public.gameatlas_conta_ativa() to authenticated, service_role;
grant execute on function public.gameatlas_favoritos_validos(text[]), public.gameatlas_redes_validas(jsonb)
  to authenticated, service_role;
grant execute on function public.total_curtidas_review(uuid), public.reviews_do_perfil(uuid,text,integer,integer),
  public.listas_do_perfil(uuid,text,integer,integer) to anon, authenticated, service_role;
notify pgrst, 'reload schema';
commit;
