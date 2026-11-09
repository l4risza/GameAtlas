-- Retorno estrutural permitido somente se o catálogo continuar vazio.
begin;
lock table public.jogos in access exclusive mode;
do $$ begin if exists(select 1 from public.jogos) then raise exception 'Não reverter com jogos IGDB: preservar dados e preparar migração específica.'; end if; end $$;
alter table public.jogos drop constraint jogos_provider_external_unique, drop column external_id, drop column provider;
notify pgrst,'reload schema';
commit;
