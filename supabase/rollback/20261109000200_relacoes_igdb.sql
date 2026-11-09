-- Reverte somente a relação computada; pode restaurar a ambiguidade preexistente
-- no PostgREST. Não altera registros nem concede escrita. O provider permanece
-- obrigatório: restaurar origem implícita permitiria inserções de servidores antigos.
begin;
drop function public.perfis(public.reviews);
notify pgrst,'reload schema';
commit;
