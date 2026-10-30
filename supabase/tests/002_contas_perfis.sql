-- Somente dados sintéticos dentro de transação. Sempre termina em ROLLBACK.
begin;
select set_config('ga.a',gen_random_uuid()::text,true), set_config('ga.b',gen_random_uuid()::text,true);
insert into auth.users(id,raw_user_meta_data)
select current_setting('ga.'||x)::uuid, jsonb_build_object('username','teste_'||left(replace(current_setting('ga.'||x),'-',''),20),'nome','Nome de teste')
from unnest(array['a','b']) x;
do $$
declare nome_usuario text;
begin
  select username into nome_usuario from public.perfis where id=current_setting('ga.a')::uuid;
  if public.username_disponivel(upper(nome_usuario)) then raise exception 'Username repetido foi considerado livre'; end if;
  if public.username_disponivel(null) or public.username_disponivel('ab') then raise exception 'Username inválido aceito'; end if;
  if (select raw_user_meta_data->>'display_name' from auth.users where id=current_setting('ga.a')::uuid) <> nome_usuario
    then raise exception 'Metadados do Auth vazios'; end if;
  begin
    insert into auth.users(id,raw_user_meta_data) values (gen_random_uuid(),jsonb_build_object('username',upper(nome_usuario)));
    raise exception 'Username duplicado foi cadastrado';
  exception when unique_violation then null; end;
  begin
    insert into auth.users(id,raw_user_meta_data) values(gen_random_uuid(),'{"nome":"Sem usuário"}');
    raise exception 'Cadastro sem username aceito';
  exception when check_violation then null; end;
  update auth.users set raw_user_meta_data=raw_user_meta_data||'{"username":"outro_usuario","display_name":"falso"}'::jsonb
    where id=current_setting('ga.a')::uuid;
  if (select raw_user_meta_data->>'username' from auth.users where id=current_setting('ga.a')::uuid) <> nome_usuario
    then raise exception 'Metadados passaram a divergir do username'; end if;
end;
$$;
insert into public.jogos(rawg_id,nome) values(9000000000000101,'Jogo sintético de configurações'),(9000000000000102,'Outro jogo sintético');
insert into public.reviews(usuario_id,jogo_id,nota,criado_em)
select current_setting('ga.a')::uuid,id,4,case when rawg_id=9000000000000101 then now()-interval '5 days' else now() end
from public.jogos where rawg_id in(9000000000000101,9000000000000102);
select set_config('ga.review',(select r.id::text from public.reviews r join public.jogos g on g.id=r.jogo_id where g.rawg_id=9000000000000101),true);
insert into public.listas(usuario_id,nome,publica,criado_em) values
 (current_setting('ga.a')::uuid,'Privada',false,now()-interval '2 days'),
 (current_setting('ga.a')::uuid,'Pública',true,now());
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('ga.a'),true);
update public.perfis set jogos_favoritos=array['Minecraft','Portal 2'],
  redes_sociais='[{"rede":"github","url":"https://github.com/gameatlas"}]',
  ordem_reviews='populares',ordem_listas='antigas' where id=auth.uid();
insert into public.review_curtidas(review_id) values(current_setting('ga.review')::uuid);
do $$
begin
  begin
    update public.perfis set jogos_favoritos=array['Minecraft','minecraft'] where id=auth.uid();
    raise exception 'Favorito repetido aceito';
  exception when check_violation then null; end;
  begin
    update public.perfis set jogos_favoritos=array[null::text] where id=auth.uid();
    raise exception 'Favorito nulo aceito';
  exception when check_violation then null; end;
  begin
    update public.perfis set redes_sociais='[{"rede":"github","url":"https://github.com.evil.example/test"}]' where id=auth.uid();
    raise exception 'Domínio falso aceito';
  exception when check_violation then null; end;
  begin
    update public.perfis set redes_sociais='[{"rede":"site","url":"javascript:alert(1)"}]' where id=auth.uid();
    raise exception 'Link inseguro aceito';
  exception when check_violation then null; end;
  begin
    update public.perfis set username=null where id=auth.uid();
    raise exception 'Username obrigatório removido';
  exception when not_null_violation then null; end;
  begin
    update public.perfis set desativado_em=now() where id=auth.uid();
    raise exception 'Desativação sem passar pelo servidor aceita';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.review_curtidas(review_id) values(current_setting('ga.review')::uuid);
    raise exception 'Duas curtidas do mesmo usuário aceitas';
  exception when unique_violation then null; end;
  if (public.reviews_do_perfil(auth.uid())->>'count')::integer <> 2 then raise exception 'Reviews do perfil não carregaram'; end if;
  if (public.listas_do_perfil(auth.uid())->>'count')::integer <> 2 then raise exception 'Dono perdeu acesso à lista privada'; end if;
end;
$$;
select set_config('request.jwt.claim.sub',current_setting('ga.b'),true);
insert into public.review_curtidas(review_id) values(current_setting('ga.review')::uuid);
do $$
begin
  if public.total_curtidas_review(current_setting('ga.review')::uuid) <> 2 then raise exception 'Contagem incorreta'; end if;
  if (public.reviews_do_perfil(current_setting('ga.a')::uuid,'populares')->'items'->0->>'id') <> current_setting('ga.review')
    then raise exception 'Popularidade não usa curtidas'; end if;
  if (public.reviews_do_perfil(current_setting('ga.a')::uuid,'recentes')->'items'->0->>'id') = current_setting('ga.review')
    then raise exception 'Ordem recente incorreta'; end if;
  if (public.listas_do_perfil(current_setting('ga.a')::uuid)->>'count')::integer <> 1 then raise exception 'Lista privada vazou'; end if;
  update public.perfis set bio='invasão' where id=current_setting('ga.a')::uuid;
  if found then raise exception 'Outro usuário editou o perfil'; end if;
  begin
    perform public.email_por_username('outro'); raise exception 'E-mail exposto ao cliente';
  exception when insufficient_privilege then null; end;
  begin
    perform public.gameatlas_desativar_conta(current_setting('ga.a')::uuid); raise exception 'Outro usuário desativou conta';
  exception when insufficient_privilege then null; end;
end;
$$;
select set_config('request.jwt.claim.sub',current_setting('ga.a'),true);
update public.perfis set mostrar_reviews=false,mostrar_listas=false where id=auth.uid();
set local role anon;
do $$
begin
  if (public.reviews_do_perfil(current_setting('ga.a')::uuid)->>'count')::integer <> 0
    or (public.listas_do_perfil(current_setting('ga.a')::uuid)->>'count')::integer <> 0
    then raise exception 'Preferências de mostrar no perfil ignoradas'; end if;
  if not exists(select 1 from public.reviews where id=current_setting('ga.review')::uuid)
    then raise exception 'Ocultar aba removeu review pública do jogo'; end if;
end;
$$;
reset role;
select public.gameatlas_desativar_conta(current_setting('ga.a')::uuid);
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('ga.a'),true);
do $$
begin
  if public.gameatlas_conta_ativa() then raise exception 'Conta desativada continua ativa'; end if;
  update public.perfis set bio='Ainda posso editar' where id=auth.uid();
  if found then raise exception 'Token antigo editou o perfil desativado'; end if;
  begin
    insert into public.listas(nome) values('Não deve criar'); raise exception 'Conta inativa criou lista';
  exception when insufficient_privilege then null; end;
end;
$$;
set local role anon;
do $$
begin
  if exists(select 1 from public.perfis where id=current_setting('ga.a')::uuid)
    or exists(select 1 from public.reviews where usuario_id=current_setting('ga.a')::uuid)
    or exists(select 1 from public.listas where usuario_id=current_setting('ga.a')::uuid)
    then raise exception 'Conteúdo da conta inativa continua público'; end if;
end;
$$;
rollback;
