# API GameAtlas — Node.js e Express

API em Node.js e Express para consulta de jogos na RAWG e fornecimento de dados ao front-end.

## Configuração

Requer Node.js 22.19 ou mais recente. Na raiz do projeto:

```powershell
npm install
npm --prefix backend install
Copy-Item backend/.env.example backend/.env.local
```

O comando de cópia é necessário apenas quando `backend/.env.local` ainda não existe. Abra esse arquivo e preencha `RAWG_API_KEY` com sua chave obtida em https://rawg.io/apidocs. Os arquivos `.env.local` e `.env` são ignorados pelo Git. Nunca coloque a chave em variáveis `VITE_`: elas são públicas no navegador.

```powershell
npm run dev
```

Esse comando inicia a API em http://localhost:3001 e o React em http://localhost:5173. Para iniciar somente a API, use `npm run dev:api` ou `npm run start:api`.

A inicialização usa `--use-system-ca` para aceitar os certificados confiáveis do sistema operacional nas conexões HTTPS, conforme a [documentação do Node.js](https://nodejs.org/learn/http/enterprise-network-configuration). Isso corrigiu a cadeia de certificados da conexão RAWG neste Windows.

## Supabase e vínculo de jogos

Configurar também `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_SECRET_KEY` em `backend/.env.local`. A chave Secret permanece no backend. O endpoint `POST /api/biblioteca/jogos/:id` exige a sessão em `Authorization: Bearer`, verifica o usuário no Supabase Auth e retorna `{ id, rawg_id, nome, slug, capa_url }` do jogo local. Reutiliza o `rawg_id` único ou consulta os dados na RAWG antes de gravar. Metadados enviados pelo navegador são ignorados.

Esse endpoint só mantém o catálogo. As gravações de listas, notas e Jogos Salvos usam o Supabase no React com o JWT do usuário e suas regras RLS. Consulte [o banco](../supabase/README.md) para estrutura, permissões e testes de integração.

## Rotas GET

| Rota | Uso |
| --- | --- |
| `/api/health` | Verificar se o servidor está executando; não consulta RAWG. |
| `/api/jogos` | Catálogo com filtros e paginação. |
| `/api/jogos/busca?q=minecraft` | Busca por trecho do nome, com paginação. |
| `/api/jogos/categorias` | Grupos usados pela Home/Explorar. |
| `/api/jogos/3498` | Detalhes completos de um jogo por ID RAWG. |
| `/api/generos` | IDs, nomes e slugs dos gêneros. |
| `/api/plataformas` | IDs, nomes e slugs das plataformas. |

`/api/jogos` aceita `page` (1–10000), `page_size` (1–40), `search`, `ordering`, `genres`, `platforms`, `parent_platforms`, `developers`, `tags`, `dates` e `metacritic`. Gêneros podem usar IDs ou slugs; plataformas usam IDs numéricos. `parent_platforms` filtra famílias: PC=1, PlayStation=2, Xbox=3, Nintendo=7, iOS=4, Android=8. Múltiplos valores são separados por vírgula. Exemplo:

```text
/api/jogos?genres=indie&platforms=4&page_size=12&ordering=-rating
/api/jogos?dates=2026-01-01,2026-12-31&ordering=-released
/api/jogos/busca?q=God%20of%20War&page=2
/api/jogos/busca?q=mario&parent_platforms=7&genres=platformer&hide_extras=true&sort=relevance
```

`ordering` aceita `name`, `released`, `added`, `created`, `updated`, `rating` e `metacritic`, com `-` para ordem decrescente. `dates` usa `AAAA-MM-DD,AAAA-MM-DD`; `metacritic` usa `mínimo,máximo` entre 0 e 100.

Nas listas, `next` e `previous` são **números de página ou null**, não URLs da RAWG. Isso evita enviar a chave ao navegador. A resposta usa `{ count, next, previous, results }`. Os jogos são adaptados para os campos que o React utiliza (`title`, `image`, `genre`, `platform`, etc.). `rating` mantém a compatibilidade de 0 a 10; `rawg_rating` é a nota original de 0 a 5 e não é uma avaliação criada por usuários do GameAtlas.

Quando `q` ou `search` é informado, o servidor mantém apenas jogos cujo nome contém o trecho pesquisado em qualquer posição, ignorando diferenças de caixa, acentos e espaços repetidos. Assim, `mine` e `craft` encontram `Minecraft`. Descrições e nomes apenas semelhantes não geram correspondências.

A consulta textual da RAWG pode omitir jogos quando a busca contém apenas parte de uma palavra. Para complementar os candidatos, o servidor consulta até 1.000 jogos populares da RAWG e inicialmente até 120 resultados da consulta textual, respeitando os filtros recebidos. Depois filtra pelo nome, remove IDs duplicados, ordena e pagina o conjunto reunido. `count_scope` é `available`: `count` representa esse conjunto consultado, não o total de correspondências em toda a base RAWG. Esta estratégia cobre jogos do catálogo consultado; não é um índice completo de todos os jogos da RAWG.

`sort` aceita `relevance` (padrão), `popular`, `rating`, `name` ou `ordering` (usa o parâmetro `ordering`). Na relevância, títulos exatos vêm primeiro. Os demais combinam popularidade e quantidade de avaliações com um bônus para nomes que começam com o termo. Isso favorece o início do nome entre jogos de popularidade semelhante, mantendo jogos conhecidos visíveis para trechos internos como `craft`. Nota baixa ou ausência de avaliações não excluem um jogo.

`hide_extras=true` encaminha `exclude_additions=true` à RAWG e remove demos/playtests identificados pelo título ou tags, prólogos identificados no final do título e jogos com `parents_count > 0`. O filtro depende dos metadados da RAWG e dos marcadores do nome; não certifica que todos os resultados restantes sejam jogos completos ou oficiais. Demos sem esses marcadores podem continuar aparecendo. Desative o filtro para consultar todos os tipos de jogos. A interface começa com ele ativado.

`batch` aceita 1–20. Cada lote amplia a consulta em até três páginas RAWG (120 candidatos por fonte); as anteriores são reutilizadas do cache. Quando os extras estão visíveis, o conjunto reúne a consulta com expansões e a consulta de jogos completos, para preservar os títulos encontrados com o filtro ativado. Isso utiliza até 1.000 jogos do catálogo e 120 candidatos por fonte no primeiro lote. `has_more=true` indica que é possível ampliar a consulta, e o botão **Buscar mais jogos** aparece após a última página dos resultados disponíveis. Ao ampliar, a interface volta à primeira página, pois novos candidatos podem mudar a ordem. Ao chegar a 20 lotes, a consulta alcança até 2.400 candidatos textuais por fonte, ainda sem garantir cobertura integral da base.

O catálogo popular fica salvo em `backend/.cache/name-catalog.json`, ignorado pelo Git, por até 24 horas; versões com filtros recebem arquivos separados por identificador do filtro. O cache guarda apenas os campos usados na busca e nos cards. As buscas prontas ficam em memória por cinco minutos e as páginas compartilham o mesmo conjunto. Sem busca, `count_scope` é `total` e a paginação continua seguindo a RAWG.

Categorias aceitas em `include`: `emAlta,melhoresAv,lancamentos,classicos,indie,multiplayer`. Exemplo: `/api/jogos/categorias?include=emAlta,lancamentos`. Retorna `{ games, categories }`, com jogos por ID e IDs por categoria. Em alta usa popularidade (`-added`); melhores avaliados usa Metacritic; lançamentos cobre os últimos 90 dias; clássicos cobre jogos até 2015; Indie e Multiplayer usam filtros próprios da RAWG.

## Organização

- `app.js`: rotas Express e respostas de erro.
- `server.js`: inicialização do servidor.
- `config.js`: leitura da configuração privada.
- `validation.js`: validação dos parâmetros.
- `rawg-service.js`: consulta RAWG, cache e adaptação dos dados.
- `name-catalog.js`: catálogo complementar e cache para busca por trechos do nome.
- `search-policy.js`: relevância e identificação de demos e expansões.
- `translation-service.js`: tradução das descrições para português brasileiro e cache persistente.
- `test/api.test.js`: testes das rotas, filtros, falhas e proteção da chave.

As consultas têm timeout total de 15 segundos e cache em memória por 5 minutos, limitado a 100 entradas. Falhas temporárias de rede ou respostas 408/500/502/503/504 têm até duas novas tentativas, dentro desse mesmo timeout. Erros de chave, jogo inexistente e limite de consultas não são repetidos. Consultas idênticas simultâneas compartilham a mesma chamada. Reiniciar o servidor limpa o cache. Os erros são JSON (`erro`, `code`): 400 para parâmetros inválidos, 404 para jogo inexistente, 502 para falha externa/chave recusada, 503 para configuração ausente ou limite de consultas e 504 para timeout. O terminal registra apenas endpoint, tentativa, status e código do erro, sem expor a chave nem a URL privada.

## Front-end e publicação futura

### Descrições em português brasileiro

O servidor traduz automaticamente as descrições usando `@vitalets/google-translate-api`, com detecção automática do idioma e destino `pt-BR`. Quando a RAWG concatena versões em vários idiomas, o servidor utiliza uma única versão; se existe uma seção identificada como português, ela é mantida. Textos extensos são divididos em trechos para tradução. As traduções são armazenadas em `backend/.cache/translations/`, uma pasta ignorada pelo Git, e reutilizadas mesmo após reiniciar o servidor. Se o texto da RAWG mudar, a tradução é refeita.

A biblioteca usa o serviço web público do Google Translate, sem chave adicional. Esse serviço pode sofrer indisponibilidade ou limites; para publicação, o adaptador pode ser substituído pela API oficial Google Cloud Translation. Uma falha mantém os demais detalhes do jogo disponíveis e permite carregar a descrição novamente.

Referência da biblioteca: https://github.com/vitalets/google-translate-api

O navegador chama `/api`; o Vite encaminha para `http://127.0.0.1:3001`. Home/carrossel usam jogos reais, Explorar lê `busca` da navbar e oferece filtros de plataforma/gênero, ordenação, ocultação de demos/DLCs, paginação e ampliação dos resultados. A URL conserva filtros e páginas ao compartilhar ou navegar pelo histórico; mudanças nos filtros voltam à primeira página e ao primeiro lote. Os cards da busca mostram ano e plataformas. `/jogo/:id` consulta detalhes diretamente. As páginas que exibem os dados incluem crédito e link para RAWG, conforme https://rawg.io/apidocs.

Para hospedagem separada, configure `VITE_API_URL=https://seu-backend/api` antes de gerar o front-end e `CORS_ORIGINS=https://seu-frontend` no servidor. `PORT` configura a porta da API. Configure também as variáveis Supabase e as URLs de retorno de autenticação do domínio real. O comando de build gera somente o front-end; o Node/Express precisa continuar executando separadamente.

## Verificação

```powershell
npm test
npm run build
```

Os testes usam respostas simuladas da RAWG e não consomem a chave nem a cota da API. Para testar ao vivo, inicie o projeto e visite `/api/jogos` pela porta 3001 ou busque um jogo no site.
