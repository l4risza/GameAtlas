-- Configurações do perfil: foto (Storage) e novos campos do perfil.
-- Executar uma vez, depois de 20261009000100_gameatlas.sql. Tudo roda em uma transação:
-- se algum comando falhar, nada é aplicado.
begin;

-- 1) Novas colunas do perfil -------------------------------------------------------------------
alter table public.perfis
  add column jogos_favoritos text[] not null default '{}',
  add column redes_sociais jsonb not null default '[]'::jsonb,
  add column mostrar_reviews boolean not null default true,
  add column mostrar_listas boolean not null default true,
  add column ordem_reviews text not null default 'recentes',
  add column ordem_listas text not null default 'recentes';

alter table public.perfis
  -- até 5 jogos; o limite de tamanho total (300 caracteres) evita textos gigantes
  add constraint perfis_jogos_favoritos_valido check (
    cardinality(jogos_favoritos) <= 5
    and char_length(array_to_string(jogos_favoritos, '')) <= 300
  ),
  -- até 6 redes; cada item precisa ter "rede" (letras minúsculas) e "url" começando com https://
  -- (isso impede salvar javascript:... mesmo chamando a API direto, sem passar pela tela)
  add constraint perfis_redes_sociais_valida check (
    case when jsonb_typeof(redes_sociais) = 'array' then
      jsonb_array_length(redes_sociais) <= 6
      and jsonb_array_length(redes_sociais) = jsonb_array_length(jsonb_path_query_array(redes_sociais,
        '$[*] ? (@.rede like_regex "^[a-z]{1,20}$" && @.url like_regex "^https://[^ ]{1,190}$")'))
    else false end
  ),
  add constraint perfis_ordem_reviews_valida check (ordem_reviews in ('recentes', 'antigas')),
  add constraint perfis_ordem_listas_valida check (ordem_listas in ('recentes', 'antigas'));

-- O usuário só pode editar as colunas liberadas, e só no próprio perfil (política perfis_editar_proprio).
grant update (jogos_favoritos, redes_sociais, mostrar_reviews, mostrar_listas, ordem_reviews, ordem_listas)
  on public.perfis to authenticated;

-- 2) Fotos de perfil (Storage) -----------------------------------------------------------------
-- Bucket público: a foto aparece para qualquer visitante pela URL pública. Limite de 2 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatares', 'avatares', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Cada usuário só enxerga, envia e apaga arquivos dentro da própria pasta: avatares/<id do usuário>/...
drop policy if exists avatares_listar_proprios on storage.objects;
drop policy if exists avatares_enviar_proprio on storage.objects;
drop policy if exists avatares_apagar_proprio on storage.objects;

create policy avatares_listar_proprios on storage.objects for select to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatares_enviar_proprio on storage.objects for insert to authenticated
  with check (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatares_apagar_proprio on storage.objects for delete to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);

commit;
