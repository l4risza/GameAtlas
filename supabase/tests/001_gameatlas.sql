-- Executar no SQL Editor como postgres depois da migração.
-- Dados sintéticos, sem e-mail/senha, existem apenas dentro desta transação.
begin;

select set_config('gameatlas.test_owner', gen_random_uuid()::text, true),
       set_config('gameatlas.test_other', gen_random_uuid()::text, true),
       set_config('gameatlas.test_private', gen_random_uuid()::text, true),
       set_config('gameatlas.test_public', gen_random_uuid()::text, true);

insert into auth.users (id, raw_user_meta_data) values
  (current_setting('gameatlas.test_owner')::uuid, '{"nome":"Teste GameAtlas A"}'),
  (current_setting('gameatlas.test_other')::uuid, '{"nome":"Teste GameAtlas B"}');

do $$
declare g bigint;
begin
  if (select count(*) from public.perfis where id in (
    current_setting('gameatlas.test_owner')::uuid, current_setting('gameatlas.test_other')::uuid
  )) <> 2 then raise exception 'O cadastro não criou os dois perfis'; end if;
  insert into public.jogos (rawg_id, nome) values (9000000000000001, 'Jogo sintético A') returning id into g;
  perform set_config('gameatlas.test_game_a', g::text, true);
  insert into public.jogos (rawg_id, nome) values (9000000000000002, 'Jogo sintético B') returning id into g;
  perform set_config('gameatlas.test_game_b', g::text, true);
  begin
    insert into public.jogos (rawg_id, nome) values (9000000000000001, 'Duplicado');
    raise exception 'rawg_id duplicado foi aceito';
  exception when unique_violation then null;
  end;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('gameatlas.test_owner'), true),
       set_config('request.jwt.claims', json_build_object('sub', current_setting('gameatlas.test_owner'), 'role', 'authenticated')::text, true);

do $$
declare l uuid; n integer;
begin
  if auth.uid() <> current_setting('gameatlas.test_owner')::uuid then
    raise exception 'Contexto do usuário A inválido';
  end if;
  insert into public.listas (nome) values ('Lista privada de teste') returning id into l;
  perform set_config('gameatlas.test_private', l::text, true);
  if (select publica from public.listas where id = l) then
    raise exception 'Lista não ficou privada por padrão';
  end if;
  insert into public.listas (nome, publica) values ('Lista pública de teste', true) returning id into l;
  perform set_config('gameatlas.test_public', l::text, true);
  insert into public.lista_jogos (lista_id, jogo_id) values
    (current_setting('gameatlas.test_private')::uuid, current_setting('gameatlas.test_game_a')::bigint),
    (current_setting('gameatlas.test_public')::uuid, current_setting('gameatlas.test_game_a')::bigint);

  -- Uma nota sem comentário é válida e não salva o jogo automaticamente.
  insert into public.reviews (jogo_id, nota) values (current_setting('gameatlas.test_game_a')::bigint, 5);
  if exists (select 1 from public.jogos_salvos where jogo_id = current_setting('gameatlas.test_game_a')::bigint) then
    raise exception 'Avaliar/adicionar à lista salvou o jogo automaticamente';
  end if;
  if not exists (select 1 from public.reviews where usuario_id = auth.uid()
    and jogo_id = current_setting('gameatlas.test_game_a')::bigint and texto is null) then
    raise exception 'Nota sem comentário falhou';
  end if;
  update public.reviews set nota = 4, texto = '   '
    where usuario_id = auth.uid() and jogo_id = current_setting('gameatlas.test_game_a')::bigint;
  if exists (select 1 from public.reviews where usuario_id = auth.uid() and texto is not null) then
    raise exception 'Comentário vazio não foi normalizado';
  end if;
  begin
    update public.reviews set nota = 0 where usuario_id = auth.uid();
    raise exception 'Nota 0 foi aceita';
  exception when check_violation then null;
  end;
  begin
    update public.reviews set nota = 6 where usuario_id = auth.uid();
    raise exception 'Nota 6 foi aceita';
  exception when check_violation then null;
  end;
  begin
    insert into public.reviews (jogo_id, nota) values (current_setting('gameatlas.test_game_a')::bigint, 3);
    raise exception 'Avaliação duplicada foi aceita';
  exception when unique_violation then null;
  end;
  begin
    insert into public.lista_jogos (lista_id, jogo_id) values
      (current_setting('gameatlas.test_private')::uuid, current_setting('gameatlas.test_game_a')::bigint);
    raise exception 'Jogo duplicado na lista foi aceito';
  exception when unique_violation then null;
  end;

  -- Salvar e remover são ações explícitas; não modificam listas ou notas.
  insert into public.jogos_salvos (jogo_id) values (current_setting('gameatlas.test_game_a')::bigint);
  begin
    insert into public.jogos_salvos (jogo_id) values (current_setting('gameatlas.test_game_a')::bigint);
    raise exception 'Jogo salvo duplicado foi aceito';
  exception when unique_violation then null;
  end;
  delete from public.jogos_salvos where jogo_id = current_setting('gameatlas.test_game_a')::bigint;
  get diagnostics n = row_count;
  if n <> 1 or not exists (select 1 from public.reviews where usuario_id = auth.uid())
    or (select count(*) from public.lista_jogos where jogo_id = current_setting('gameatlas.test_game_a')::bigint) <> 2 then
    raise exception 'Remover de Jogos Salvos alterou outras ações';
  end if;
  insert into public.jogos_salvos (jogo_id) values (current_setting('gameatlas.test_game_a')::bigint);
  update public.perfis set bio = 'Bio de teste' where id = auth.uid();
  update public.listas set publica = true where id = current_setting('gameatlas.test_private')::uuid;
  update public.listas set publica = false where id = current_setting('gameatlas.test_private')::uuid;
end;
$$;

-- Um segundo usuário pode ver apenas a lista pública do primeiro.
select set_config('request.jwt.claim.sub', current_setting('gameatlas.test_other'), true),
       set_config('request.jwt.claims', json_build_object('sub', current_setting('gameatlas.test_other'), 'role', 'authenticated')::text, true);
do $$
declare n integer;
begin
  if exists (select 1 from public.listas where id = current_setting('gameatlas.test_private')::uuid)
    or exists (select 1 from public.lista_jogos where lista_id = current_setting('gameatlas.test_private')::uuid) then
    raise exception 'Outro usuário leu a lista privada ou seus jogos';
  end if;
  if not exists (select 1 from public.listas where id = current_setting('gameatlas.test_public')::uuid)
    or not exists (select 1 from public.lista_jogos where lista_id = current_setting('gameatlas.test_public')::uuid) then
    raise exception 'Lista pública não ficou visível';
  end if;
  if exists (select 1 from public.jogos_salvos where usuario_id = current_setting('gameatlas.test_owner')::uuid) then
    raise exception 'Outro usuário leu os Jogos Salvos';
  end if;
  update public.listas set nome = 'Intruso' where id = current_setting('gameatlas.test_public')::uuid;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Outro usuário alterou uma lista'; end if;
  update public.reviews set nota = 1 where usuario_id = current_setting('gameatlas.test_owner')::uuid;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Outro usuário alterou uma avaliação'; end if;
  update public.perfis set bio = 'Intruso' where id = current_setting('gameatlas.test_owner')::uuid;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Outro usuário alterou um perfil'; end if;
  delete from public.lista_jogos where lista_id = current_setting('gameatlas.test_public')::uuid;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Outro usuário removeu jogos da lista pública'; end if;
  begin
    insert into public.lista_jogos (lista_id, jogo_id) values
      (current_setting('gameatlas.test_public')::uuid, current_setting('gameatlas.test_game_b')::bigint);
    raise exception 'Outro usuário adicionou jogos na lista pública';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.lista_jogos (lista_id, jogo_id) values
      (current_setting('gameatlas.test_private')::uuid, current_setting('gameatlas.test_game_b')::bigint);
    raise exception 'Outro usuário adicionou jogos na lista privada';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.jogos_salvos (usuario_id, jogo_id) values
      (current_setting('gameatlas.test_owner')::uuid, current_setting('gameatlas.test_game_b')::bigint);
    raise exception 'Outro usuário salvou em nome do dono';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.reviews (usuario_id, jogo_id, nota) values
      (current_setting('gameatlas.test_owner')::uuid, current_setting('gameatlas.test_game_b')::bigint, 3);
    raise exception 'Outro usuário avaliou em nome do dono';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.jogos (rawg_id, nome) values (9000000000000003, 'Cadastro indevido');
    raise exception 'Cliente alterou o catálogo RAWG';
  exception when insufficient_privilege then null;
  end;
  insert into public.jogos_salvos (jogo_id) values (current_setting('gameatlas.test_game_b')::bigint);
  if (select count(*) from public.jogos_salvos where jogo_id in (
    current_setting('gameatlas.test_game_a')::bigint, current_setting('gameatlas.test_game_b')::bigint
  )) <> 1 then raise exception 'Jogos Salvos não ficaram separados por usuário'; end if;
end;
$$;

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
begin
  if exists (select 1 from public.listas where id = current_setting('gameatlas.test_private')::uuid)
    or exists (select 1 from public.lista_jogos where lista_id = current_setting('gameatlas.test_private')::uuid) then
    raise exception 'Visitante leu lista privada';
  end if;
  if not exists (select 1 from public.lista_jogos where lista_id = current_setting('gameatlas.test_public')::uuid)
    or not exists (select 1 from public.reviews where jogo_id = current_setting('gameatlas.test_game_a')::bigint) then
    raise exception 'Leitura pública falhou';
  end if;
  begin
    perform 1 from public.jogos_salvos;
    raise exception 'Visitante leu Jogos Salvos';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.listas (nome) values ('Lista anônima');
    raise exception 'Visitante criou lista sem login';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
rollback;
select 'OK: cadastro, notas, listas, Jogos Salvos, duplicatas e privacidade verificados; dados de teste revertidos.' as resultado;
