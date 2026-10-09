-- Verificação somente de leitura após aplicar a migração.
with tabelas as (
  select 'perfis' as tabela, count(*) as registros from public.perfis
  union all select 'jogos', count(*) from public.jogos
  union all select 'reviews', count(*) from public.reviews
  union all select 'listas', count(*) from public.listas
  union all select 'lista_jogos', count(*) from public.lista_jogos
  union all select 'jogos_salvos', count(*) from public.jogos_salvos
)
select t.tabela, c.relrowsecurity as rls_ativo, t.registros,
  (select count(*) from pg_policy p where p.polrelid = c.oid) as regras_de_acesso,
  (select count(*) from auth.users) as usuarios_auth
from tabelas t
join pg_namespace n on n.nspname = 'public'
join pg_class c on c.relnamespace = n.oid and c.relname = t.tabela
order by t.tabela;
