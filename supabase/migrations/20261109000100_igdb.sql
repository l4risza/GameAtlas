-- Compatibilidade temporária: rawg_id é o nome usado pelo React para o ID IGDB.
-- Nunca reinterpretar linhas antigas como IGDB. Esta versão só migra catálogo vazio.
begin;
lock table public.jogos in access exclusive mode;
do $$ begin
  if exists(select 1 from public.jogos) then
    raise exception 'MIGRATION_REQUIRES_MAPPING: existem jogos legados. Fazer backup e mapear individualmente antes de migrar.';
  end if;
end $$;
alter table public.jogos
  add column provider text not null default 'igdb' check(provider='igdb'),
  add column external_id bigint generated always as (rawg_id) stored,
  add constraint jogos_provider_external_unique unique(provider,external_id);
comment on column public.jogos.rawg_id is 'Alias legado do contrato React: nesta versão contém exclusivamente ID IGDB. Não consultar a API RAWG.';
comment on column public.jogos.external_id is 'ID externo canônico, acompanhado de provider. Derivado do alias para não divergir.';
notify pgrst,'reload schema';
commit;
