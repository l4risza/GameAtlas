begin;
-- Campo calculado para selecionar e ordenar reviews pelo total público de curtidas.
-- A função existente omite contas desativadas e não revela quem curtiu.
create function public.curtidas(public.reviews) returns bigint
language sql stable security invoker set search_path='' as $$
  select public.total_curtidas_review($1.id);
$$;
revoke all on function public.curtidas(public.reviews) from public;
grant execute on function public.curtidas(public.reviews) to anon,authenticated,service_role;
create function public.resumo_avaliacoes_jogo(igdb_id bigint) returns jsonb
language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('count',count(*),'average',round(avg(r.nota),2))
  from public.reviews r join public.jogos j on j.id=r.jogo_id
  where j.provider='igdb' and j.external_id=igdb_id;
$$;
revoke all on function public.resumo_avaliacoes_jogo(bigint) from public;
grant execute on function public.resumo_avaliacoes_jogo(bigint) to anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
