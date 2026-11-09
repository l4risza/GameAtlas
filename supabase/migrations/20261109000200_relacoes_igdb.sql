begin;
-- Obriga o servidor a declarar a origem. Código antigo não pode rotular dados implicitamente.
alter table public.jogos alter column provider drop default;
-- Escolhe o autor da review, em vez da relação muitos-para-muitos de curtidas.
-- Computed relationship do PostgREST: mantém perfis(nome,username) do React.
create or replace function public.perfis(public.reviews)
returns setof public.perfis rows 1 language sql stable security invoker set search_path='' as $$
  select p.* from public.perfis p where p.id=$1.usuario_id;
$$;
revoke all on function public.perfis(public.reviews) from public;
grant execute on function public.perfis(public.reviews) to anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
