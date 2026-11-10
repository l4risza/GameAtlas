-- Favoritos de perfil com vínculos reais. Os nomes antigos não são convertidos por adivinhação.
begin;
create table public.perfil_jogos_favoritos (
  usuario_id uuid not null references public.perfis(id) on delete cascade,
  jogo_id bigint not null references public.jogos(id),
  posicao smallint not null check(posicao between 1 and 5),
  primary key(usuario_id,jogo_id), unique(usuario_id,posicao)
);
alter table public.perfil_jogos_favoritos enable row level security;
revoke all on public.perfil_jogos_favoritos from public,anon,authenticated;
grant select on public.perfil_jogos_favoritos to anon,authenticated;
grant all on public.perfil_jogos_favoritos to service_role;
create policy favoritos_perfil_leitura on public.perfil_jogos_favoritos for select to anon,authenticated
using(exists(select 1 from public.perfis p where p.id=usuario_id and p.desativado_em is null));

-- Uma operação atômica e limitada ao usuário autenticado. O bloqueio serializa
-- gravações concorrentes para não permitir ultrapassar cinco favoritos.
create function public.salvar_favoritos_igdb(jogos bigint[],legados text[] default '{}')
returns void language plpgsql security definer set search_path='' as $$
declare dono uuid := auth.uid(); antigos text[];
begin
  if dono is null then raise exception 'Autenticação obrigatória' using errcode='42501'; end if;
  select jogos_favoritos into antigos from public.perfis where id=dono and desativado_em is null for update;
  if not found then raise exception 'Conta indisponível' using errcode='42501'; end if;
  if jogos is null or legados is null or cardinality(jogos)+cardinality(legados)>5
    or exists(select 1 from unnest(jogos) j where j is null or j<=0)
    or cardinality(jogos)<>(select count(distinct j) from unnest(jogos) j)
    or not public.gameatlas_favoritos_validos(legados)
    then raise exception 'Selecione até cinco jogos, sem duplicar' using errcode='22023'; end if;
  -- Permite manter/remover os textos legados, mas não cadastrar novos textos.
  if not legados <@ antigos then raise exception 'Selecione um jogo real na busca' using errcode='22023'; end if;
  if exists(select 1 from unnest(jogos) j left join public.jogos g on g.id=j and g.provider='igdb' where g.id is null)
    then raise exception 'Jogo não encontrado no catálogo IGDB' using errcode='23503'; end if;
  delete from public.perfil_jogos_favoritos where usuario_id=dono;
  insert into public.perfil_jogos_favoritos(usuario_id,jogo_id,posicao)
    select dono,j,ord::smallint from unnest(jogos) with ordinality as itens(j,ord);
  update public.perfis set jogos_favoritos=legados where id=dono;
end $$;
revoke all on function public.salvar_favoritos_igdb(bigint[],text[]) from public,anon;
grant execute on function public.salvar_favoritos_igdb(bigint[],text[]) to authenticated;
notify pgrst,'reload schema';
commit;
