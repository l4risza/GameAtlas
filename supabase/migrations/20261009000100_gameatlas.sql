-- Estrutura inicial do GameAtlas. Executar uma vez em um projeto novo.
begin;

create table public.perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null default 'Jogador' check (char_length(btrim(nome)) between 1 and 100),
  username text check (username ~ '^[A-Za-z0-9_]{3,30}$'),
  avatar_url text,
  bio text check (char_length(bio) <= 1000),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index perfis_username_unico on public.perfis (lower(username));

create table public.jogos (
  id bigint generated always as identity primary key,
  rawg_id bigint not null unique check (rawg_id > 0),
  nome text not null check (char_length(btrim(nome)) between 1 and 300),
  slug text,
  capa_url text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references public.perfis(id) on delete cascade,
  jogo_id bigint not null references public.jogos(id) on delete restrict,
  nota smallint not null constraint reviews_nota_1_a_5 check (nota between 1 and 5),
  texto text check (char_length(texto) <= 10000),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint reviews_usuario_jogo_unico unique (usuario_id, jogo_id)
);
create index reviews_jogo_idx on public.reviews (jogo_id);

create table public.listas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references public.perfis(id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 1 and 100),
  descricao text check (char_length(descricao) <= 2000),
  publica boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index listas_usuario_idx on public.listas (usuario_id);

create table public.lista_jogos (
  lista_id uuid not null references public.listas(id) on delete cascade,
  jogo_id bigint not null references public.jogos(id) on delete restrict,
  posicao integer not null default 0 check (posicao >= 0),
  adicionado_em timestamptz not null default now(),
  primary key (lista_id, jogo_id)
);
create index lista_jogos_jogo_idx on public.lista_jogos (jogo_id);

create table public.jogos_salvos (
  usuario_id uuid not null default auth.uid() references public.perfis(id) on delete cascade,
  jogo_id bigint not null references public.jogos(id) on delete restrict,
  salvo_em timestamptz not null default now(),
  primary key (usuario_id, jogo_id)
);
create index jogos_salvos_jogo_idx on public.jogos_salvos (jogo_id);

comment on table public.jogos is 'Cache dos jogos RAWG utilizados. rawg_id identifica o jogo na API; id é a chave local.';
comment on table public.reviews is 'Uma avaliação por usuário/jogo. Nota obrigatória de 1 a 5; texto opcional.';
comment on column public.listas.publica is 'False: somente o dono pode ver a lista e seus jogos. True: leitura pública.';
comment on table public.jogos_salvos is 'Jogos que o usuário escolheu salvar. Independente de avaliações e listas; leitura privada.';

create function public.gameatlas_atualizar_timestamp()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

create function public.gameatlas_normalizar_review()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.texto := nullif(btrim(new.texto), '');
  new.atualizado_em := now();
  return new;
end;
$$;

create function public.gameatlas_criar_perfil()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.perfis (id, nome)
  values (
    new.id,
    coalesce(
      nullif(left(btrim(new.raw_user_meta_data ->> 'nome'), 100), ''),
      nullif(left(btrim(new.raw_user_meta_data ->> 'display_name'), 100), ''),
      nullif(left(btrim(new.raw_user_meta_data ->> 'full_name'), 100), ''),
      'Jogador'
    )
  );
  return new;
end;
$$;

create trigger perfis_atualizar_timestamp before update on public.perfis
for each row execute function public.gameatlas_atualizar_timestamp();
create trigger jogos_atualizar_timestamp before update on public.jogos
for each row execute function public.gameatlas_atualizar_timestamp();
create trigger listas_atualizar_timestamp before update on public.listas
for each row execute function public.gameatlas_atualizar_timestamp();
create trigger reviews_normalizar before insert or update on public.reviews
for each row execute function public.gameatlas_normalizar_review();
create trigger gameatlas_novo_usuario after insert on auth.users
for each row execute function public.gameatlas_criar_perfil();

-- Cobre usuários já cadastrados, sem copiar e-mail ou credenciais.
insert into public.perfis (id, nome)
select id, coalesce(
  nullif(left(btrim(raw_user_meta_data ->> 'nome'), 100), ''),
  nullif(left(btrim(raw_user_meta_data ->> 'display_name'), 100), ''),
  nullif(left(btrim(raw_user_meta_data ->> 'full_name'), 100), ''),
  'Jogador'
)
from auth.users;

alter table public.perfis enable row level security;
alter table public.jogos enable row level security;
alter table public.reviews enable row level security;
alter table public.listas enable row level security;
alter table public.lista_jogos enable row level security;
alter table public.jogos_salvos enable row level security;

-- Remove permissões padrão e concede apenas operações previstas no aplicativo.
revoke all on table public.perfis, public.jogos, public.reviews,
  public.listas, public.lista_jogos, public.jogos_salvos from public, anon, authenticated;
revoke all on sequence public.jogos_id_seq from public, anon, authenticated;
revoke all on function public.gameatlas_atualizar_timestamp(),
  public.gameatlas_normalizar_review(), public.gameatlas_criar_perfil() from public, anon, authenticated;

grant select on public.perfis, public.jogos, public.reviews,
  public.listas, public.lista_jogos to anon, authenticated;
grant update (nome, username, avatar_url, bio) on public.perfis to authenticated;
grant insert (usuario_id, jogo_id, nota, texto) on public.reviews to authenticated;
grant update (nota, texto) on public.reviews to authenticated;
grant delete on public.reviews to authenticated;
grant insert (usuario_id, nome, descricao, publica) on public.listas to authenticated;
grant update (nome, descricao, publica) on public.listas to authenticated;
grant delete on public.listas to authenticated;
grant insert (lista_id, jogo_id, posicao) on public.lista_jogos to authenticated;
grant update (posicao) on public.lista_jogos to authenticated;
grant delete on public.lista_jogos to authenticated;
grant select, delete on public.jogos_salvos to authenticated;
grant insert (usuario_id, jogo_id) on public.jogos_salvos to authenticated;

-- A chave service_role é exclusiva do servidor; nunca deve ir para o React.
grant all on table public.perfis, public.jogos, public.reviews,
  public.listas, public.lista_jogos, public.jogos_salvos to service_role;
grant usage, select on sequence public.jogos_id_seq to service_role;

create policy perfis_leitura_publica on public.perfis for select to anon, authenticated using (true);
create policy perfis_editar_proprio on public.perfis for update to authenticated
using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy jogos_leitura_publica on public.jogos for select to anon, authenticated using (true);

create policy reviews_leitura_publica on public.reviews for select to anon, authenticated using (true);
create policy reviews_criar_propria on public.reviews for insert to authenticated
with check ((select auth.uid()) = usuario_id);
create policy reviews_editar_propria on public.reviews for update to authenticated
using ((select auth.uid()) = usuario_id) with check ((select auth.uid()) = usuario_id);
create policy reviews_excluir_propria on public.reviews for delete to authenticated
using ((select auth.uid()) = usuario_id);

create policy listas_leitura on public.listas for select to anon, authenticated
using (publica or (select auth.uid()) = usuario_id);
create policy listas_criar_propria on public.listas for insert to authenticated
with check ((select auth.uid()) = usuario_id);
create policy listas_editar_propria on public.listas for update to authenticated
using ((select auth.uid()) = usuario_id) with check ((select auth.uid()) = usuario_id);
create policy listas_excluir_propria on public.listas for delete to authenticated
using ((select auth.uid()) = usuario_id);

create policy lista_jogos_leitura on public.lista_jogos for select to anon, authenticated
using (exists (
  select 1 from public.listas l where l.id = lista_id
  and (l.publica or l.usuario_id = (select auth.uid()))
));
create policy lista_jogos_adicionar_proprio on public.lista_jogos for insert to authenticated
with check (exists (
  select 1 from public.listas l where l.id = lista_id and l.usuario_id = (select auth.uid())
));
create policy lista_jogos_editar_proprio on public.lista_jogos for update to authenticated
using (exists (
  select 1 from public.listas l where l.id = lista_id and l.usuario_id = (select auth.uid())
)) with check (exists (
  select 1 from public.listas l where l.id = lista_id and l.usuario_id = (select auth.uid())
));
create policy lista_jogos_remover_proprio on public.lista_jogos for delete to authenticated
using (exists (
  select 1 from public.listas l where l.id = lista_id and l.usuario_id = (select auth.uid())
));

create policy jogos_salvos_ler_proprio on public.jogos_salvos for select to authenticated
using ((select auth.uid()) = usuario_id);
create policy jogos_salvos_salvar_proprio on public.jogos_salvos for insert to authenticated
with check ((select auth.uid()) = usuario_id);
create policy jogos_salvos_remover_proprio on public.jogos_salvos for delete to authenticated
using ((select auth.uid()) = usuario_id);

commit;
