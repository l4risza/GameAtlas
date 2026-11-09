-- Executar como postgres. Nenhum registro é mantido: termina em ROLLBACK.
begin;
do $$
declare row_game public.jogos;
begin
  begin
    insert into public.jogos(provider,rawg_id,nome) values('rawg',9000000000000201,'Origem indevida');
    raise exception 'Outro provedor foi aceito';
  exception when check_violation then null; end;
  begin
    insert into public.jogos(rawg_id,nome) values(9000000000000201,'Origem omitida');
    raise exception 'Origem implícita foi aceita';
  exception when not_null_violation then null; end;
  insert into public.jogos(provider,rawg_id,nome) values('igdb',9000000000000201,'Jogo sintético IGDB') returning * into row_game;
  if row_game.external_id <> row_game.rawg_id or row_game.provider <> 'igdb' then
    raise exception 'Identificador canônico divergiu do alias';
  end if;
  begin
    insert into public.jogos(provider,rawg_id,nome) values('igdb',row_game.external_id,'Duplicado');
    raise exception 'Identificador duplicado foi aceito';
  exception when unique_violation then null; end;
  if (select prosecdef from pg_proc where oid='public.perfis(public.reviews)'::regprocedure) then
    raise exception 'Relação de autor não pode contornar RLS';
  end if;
end $$;
rollback;
select 'IGDB: origem, IDs e relação de autor validados; testes revertidos' as resultado;
