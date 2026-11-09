# API GameAtlas — IGDB

React → Express → IGDB / Supabase. A fonte ativa dos jogos é exclusivamente a IGDB.

## Executar

Node.js >=22.19. Na raiz: `npm ci`, `npm --prefix backend ci` e `npm run dev`.
Copiar `backend/.env.example` para `backend/.env.local` somente se não existir e preencher `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`. Segredos ficam apenas no servidor. Nunca reutilizar exemplos publicados como configuração de produção.

## Rotas

- GET `/api/health`
- GET `/api/jogos`, `/api/jogos/busca?q=craft`, `/api/jogos/:id`
- GET `/api/jogos/categorias?include=emAlta,melhoresAv,lancamentos,classicos,indie,multiplayer`
- GET `/api/generos`, `/api/plataformas`
- POST `/api/biblioteca/jogos/:id`: ID **IGDB**, com Bearer de usuário. Retorna a chave local do jogo.
- As rotas de conta, curtidas e perfil continuam conforme `docs/backend-contas.md`.

## Consultas e compatibilidade

`page` começa em 1; `page_size` até 48. `genres`, `platforms` e `developers` aceitam IDs ou slugs separados por vírgula, sem misturar os dois. Famílias: `parent_platforms=pc|playstation|xbox|nintendo|sega|mobile|mac-linux|web`. Famílias de consoles usam `platforms.platform_family.slug`.

`tags=multiplayer` usa game_modes; demais tags usam keywords. `metacritic=min,max` é um alias histórico para **aggregated_rating da IGDB**, não uma nota obtida do site Metacritic. `dates=início,fim` inclui o dia final inteiro.

`sort=relevance|popular|rating|recent|name|ordering`. Relevância faz correspondência parcial literal no nome, em ordem alfabética, sem a busca aproximada por descrição. Popularidade usa volume de avaliações (`total_rating_count`), não PopScore. `ordering` admite um critério entre name/released/added/rating/metacritic/created/updated, com `-` para decrescente. Ordenação múltipla e parâmetros desconhecidos são recusados com 400.

`hide_extras=true` mantém Main Game, Remake e Remaster e exclui parent_game/version_parent. `batch` vai de 1 a 20: cada lote libera 240 resultados de busca. O servidor consulta `/games/count` com os mesmos filtros. `total_count` é o total IGDB; `count` é a janela atualmente liberada, `count_scope=window|total`, `has_more` permite o botão existente ampliar a janela. A paginação usa offset; alterações no catálogo da IGDB entre consultas podem mudar os resultados.

JSON mantém `id,title,image,banner,description,rating,public_stars,critic_score,platforms,genres,genre_slugs,released,screenshots,trailer`. Notas 0–100 são convertidas em 0–10 e 0–5, ausências ficam null. Trailers usam youtubeId. A tradução mantém cache e fallback para sinopse original quando o tradutor falha. As categorias usam consultas próprias: volume de avaliações recente, nota da crítica, últimos 90 dias, até 2015, Indie e Multiplayer.

OAuth usa POST com corpo, cache do token e renovação com margem; 401 renova uma vez, 403 não é contornado. Fila única limita a menos de 4 requisições/s por instância; usar uma única instância ou coordenar a cota entre processos ao escalar. Cache por consulta por 5 minutos e coalescência reduzem chamadas. Timeout de 15s por tentativa; 429/5xx/rede têm até três tentativas, com espera limitada. Em erros, o JSON contém somente `erro` e `code`, sem credenciais.

## Verificar

- `npm --prefix backend test`: mocks IGDB e testes de conta/RLS simulados.
- `npm run test:auth`
- `npm run build`
- `node backend/scripts/verify-build.mjs`: bloqueia valores privados presentes no build.
- `node --use-system-ca backend/scripts/test-igdb-live.mjs`: teste real limitado da IGDB.
- `node --use-system-ca backend/scripts/test-supabase.mjs`: servidor HTTP efêmero, IGDB real e contas sintéticas; limpa os dados.
- `node --use-system-ca backend/scripts/test-contas.mjs`: preferências, avatar, curtidas e desativação.
- `node --use-system-ca backend/scripts/verify-connection.mjs`: leitura de contagens e verificação do build.

Aplicar antes, em ordem, `20261109000100_igdb.sql` e `20261109000200_relacoes_igdb.sql`. A primeira recusa catálogo não vazio para impedir colisão entre provedores; a segunda exige origem explícita nas inserções e resolve a relação de autor nas reviews. RLS e chaves locais das relações são preservadas. Consulte `docs/auditoria-igdb.md`.

Referências: https://api-docs.igdb.com/ e https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#client-credentials-grant-flow
