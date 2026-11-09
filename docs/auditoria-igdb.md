# Auditoria e conclusão do back-end — 09/11/2026

## A. Diagnóstico inicial

Clone novo da branch `gameatlasIGDB`, commit `1ef010e`, em `GameAtlas-IGDB-2026-11-09`. Trabalho isolado na branch `codex/auditoria-igdb`. A `main` estava em `7248059`, com RAWG. Os últimos commits da equipe na IGDB eram `1ef010e`, `8c2a303`, `becb1dc`, `ceec92c` e `5f66c28`. O objetivo foi concluir a migração iniciada pela equipe, mantendo seus componentes, páginas, estilos, rotas e serviços React.

Já funcionavam a estrutura Express/IGDB, normalização básica, imagens, vídeos e consultas das categorias. Foram preservadas e corrigidas pontualmente. Problemas identificados:

| Prioridade | Problema e causa | Correção |
| --- | --- | --- |
| Crítica | Credenciais Twitch preenchidas em `.env.example` e preservadas no histórico Git | Exemplo sem valores; configuração privada ignorada; revogação ainda necessária |
| Crítica | Vínculo do catálogo ainda assumia IDs RAWG; IDs iguais não representam o mesmo jogo | Origem explícita IGDB, ID canônico e migração condicionada a catálogo vazio |
| Alta | OAuth colocava Secret na URL; faltavam timeout e tratamento de falhas | POST com corpo, expiração, renovação, fila e erros sanitizados |
| Alta | Total dependia de `x-count` ou tamanho da página | Endpoint oficial `/games/count` com os mesmos filtros |
| Alta | Busca aproximada e filtros herdados sem implementação equivalente | Correspondência parcial literal no nome e tradução dos parâmetros |
| Alta | Testes antigos criavam `createApp({rawg})` | Mocks e integrações atualizados para IGDB |
| Alta | PostgREST encontrou duas relações reviews → perfis, por autor e por curtidas | Relação computada explícita, com RLS, sem editar a consulta React |

A comparação das branches mostrou mudanças da equipe em Home, Explorar, Jogo, Reviews, Footer, GameAccount, PlatformSection, serviços e estilos. Esses arquivos foram apenas lidos; o diff deste trabalho não contém nenhum arquivo em `src/`.

## B. Modificações realizadas

- `backend/igdb-client.js`: cliente OAuth separado, token compartilhado com margem de validade, uma renovação em 401, timeout por tentativa de 15s, fila com intervalo mínimo de 260ms e até três tentativas para rede/429/5xx. Não contorna 403 nem registra credenciais.
- `backend/igdb-service.js`: cache de cinco minutos e compartilhamento de chamadas simultâneas; busca literal parcial por nome; contagem oficial; gêneros, plataformas, famílias, empresas desenvolvedoras, tags, datas e nota da crítica; categorias, mídia e normalização preservadas. Sinopse original como fallback de tradução.
- `backend/validation.js`: parâmetros desconhecidos, ordenações inválidas, datas inválidas, IDs/slugs misturados e caracteres de busca incompatíveis são recusados. `q` e `search` são aliases; valores conflitantes são recusados.
- `backend/supabase-service.js`: valida sessão e origem IGDB, reutiliza o jogo local ou consulta IGDB, confere o ID retornado e grava metadados obtidos pelo servidor. Nunca grava o ID fornecido como se pertencesse à RAWG.
- `backend/app.js`: remove log de exceção inesperada que poderia expor detalhes de chamadas externas. Rotas e JSON existentes preservados.
- `.env.example`: credenciais removidas. `.env.local` fica fora do Git. Nenhuma nova dependência ou framework foi introduzido.
- Removidos `rawg-service.js`, `name-catalog.js`, `search-policy.js` e testes exclusivos do provedor aposentado. Migrações históricas preservadas.
- Testes `api`, `supabase`, `translation` e `account` atualizados; scripts reais usam IGDB e declaram a origem do catálogo. `verify-connection.mjs` deixa de verificar o antigo `apiKey`; `verify-build.mjs` verifica recursivamente os arquivos do build.
- READMEs da raiz, backend e Supabase atualizados. A troca RAWG → IGDB permanece documentada para o TCC.

As rotas públicas continuam `/api/health`, `/api/jogos`, `/api/jogos/busca`, `/api/jogos/categorias`, `/api/jogos/:id`, `/api/generos`, `/api/plataformas`; a vinculação autenticada continua em `POST /api/biblioteca/jogos/:id`. Os campos esperados pelo React foram mantidos. As rotas de contas e autenticação não foram reescritas.

### Semântica dos filtros e limites

`mine` pode encontrar Minecraft; `craft` também. A comparação ocorre em `name`, sem buscar descrições. Em `relevance`, os resultados são ordenados por nome: a IGDB não fornece relevância para essa consulta literal. Popularidade usa quantidade total de avaliações, uma aproximação documentada, não PopScore.

`metacritic` é mantido como alias para `aggregated_rating` da IGDB; não representa consulta ao Metacritic. Famílias de consoles usam `platforms.platform_family.slug`. `tags=multiplayer` usa modos de jogo; demais tags usam keywords. `hide_extras` mantém Main Game, Remake e Remaster e exclui jogos com parent_game/version_parent. Datas incluem o último dia inteiro. A IGDB rejeitou múltiplos campos em `sort` no teste real: a validação agora aceita um critério por consulta.

Cada `batch` libera 240 resultados de busca, até 20 lotes. `total_count` é o total consultado na IGDB; `count` é a janela liberada e `has_more` controla a ampliação existente. A paginação usa offset; atualizações do catálogo entre páginas podem alterar sua composição. A fila limita uma instância; múltiplos processos exigiriam coordenação de cota. Tradução depende de serviço externo e pode cair no texto original. Dados ausentes de nota, tempo de jogo ou mídia não são inventados.

## C. Banco de dados e recuperação

Consulta inicial: **0 jogos, 0 reviews, 1 lista sem jogos, 0 vínculos em listas, 0 jogos salvos e 0 curtidas**. Não havia jogos RAWG para mapear. A lista existente e os perfis foram preservados; depois da limpeza dos testes a consulta retornou **5 perfis, 0 jogos, 0 reviews, 1 lista, 0 vínculos e 0 jogos salvos**.

Migrações aplicadas no projeto GameAtlas:

1. `20261109000100_igdb.sql`: transação e bloqueio do catálogo, interrompendo se encontrar qualquer jogo existente. Adiciona `provider` restrito a IGDB, `external_id` gerado de `rawg_id` e unicidade da identidade externa. Os IDs locais usados pelas chaves estrangeiras não mudam.
2. `20261109000200_relacoes_igdb.sql`: remove a origem padrão, exigindo que toda inserção declare IGDB; código antigo não pode cadastrar jogos implicitamente. Define `public.perfis(public.reviews)` para resolver o autor da review no PostgREST. A função usa `security invoker`, respeitando as permissões do usuário e RLS.

`rawg_id` permanece como **nome legado de compatibilidade**, contendo somente ID IGDB nesta versão. O React consulta essa coluna diretamente; renomeá-la agora exigiria alteração proibida no front. Não há chamadas ativas à API RAWG.

Não houve transformação ou exclusão de dados de usuários. A recuperação desta mudança é estrutural: SQL versionado, transações atômicas, testes com rollback e scripts manuais em `supabase/rollback/`. Não foi criado dump completo do projeto. O retorno que remove as colunas recusa catálogo preenchido; não se deve apagá-lo para forçar rollback. O rollback da relação computada pode restaurar a ambiguidade anterior e não restaura o provider implícito.

Em outro ambiente com jogos antigos, a migração **deve parar**. É necessário exportar backup, preparar correspondência revisada jogo a jogo e planejar a compatibilidade com o React. Coincidência numérica de IDs não é correspondência válida. Não executar o backend RAWG da main contra o esquema migrado.

## D. Testes executados e resultados

| Verificação | Resultado real |
| --- | --- |
| `npm --prefix backend test` | 45 testes aprovados, zero falhas |
| `npm run test:auth` | 22 testes aprovados, zero falhas |
| `npx eslint backend` | Aprovado para arquivos JS; não representa lint de todo o front |
| `npm run build` | Aprovado, 125 módulos; aviso de bundle maior que 500 kB |
| `node backend/scripts/verify-build.mjs` | Valores privados configurados ausentes dos arquivos do build |
| Inspeção dos arquivos versionados e novos, excluindo ignorados | Nenhum valor das credenciais privadas configuradas, JWT service_role ou chave sb_secret encontrado; `.env.local` confirmado como ignorado |
| `node --use-system-ca backend/scripts/test-igdb-live.mjs` | Listagem, count, detalhe, busca parcial, gênero, família PlayStation, plataforma PC, desenvolvedora, crítica, multiplayer, seis categorias e metadados aprovados |
| `node --use-system-ca backend/scripts/test-supabase.mjs` | Login, perfil, jogo IGDB, listas públicas/privadas, notas sem comentário, Jogos Salvos, consulta de reviews com autor e isolamento entre usuários aprovados |
| `node --use-system-ca backend/scripts/test-contas.mjs` | Cadastro público, username único/obrigatório, login por e-mail/username, metadados Auth, favoritos, redes sociais, avatar, curtidas, ordenação, paginação, privacidade e desativação aprovados |
| `node --use-system-ca backend/scripts/verify-connection.mjs` | Contagens preservadas, build sem chaves verificadas; cadastro ativo, confirmação de e-mail desligada |
| SQL `001_gameatlas.sql`, `002_contas_perfis.sql` | Aprovados no SQL Editor com rollback dos dados sintéticos |
| SQL `003_igdb.sql` | Origem incorreta/omitida recusada, alias consistente, duplicidade recusada e relação de autor sem SECURITY DEFINER |
| Diff de `src/` em relação à base IGDB | Nenhuma alteração |

O teste real consultou GTA V pelo **ID IGDB 1020**, sem reutilizar o ID RAWG. O catálogo tinha 316385 resultados na consulta inicial de jogos principais/remakes/remasters; contagens externas podem variar. As contas, arquivos e jogos sintéticos dos testes reais foram removidos no bloco de limpeza. Nenhum teste declarou aprovação antes da execução.

Falhas encontradas durante a verificação foram corrigidas: ordenação múltipla rejeitada pela IGDB e relação de autor ambígua no PostgREST. Os comandos reais foram repetidos com sucesso após as correções correspondentes.

## E. Pendências e mudanças fora do escopo

1. **Revogar o Twitch Client Secret exposto e gerar outro.** O usuário autorizou uso temporário da credencial existente para esta verificação; isso não elimina o vazamento. A pessoa autorizada deve substituir somente `backend/.env.local` e reiniciar o servidor. O histórico Git ainda contém o valor antigo. Limpar o histórico exige coordenação da equipe e autorização específica; não foi executado force-push. Rotação continua necessária mesmo após eventual limpeza.
2. `src/components/config/ConfigSobre.jsx` ainda atribui os dados à RAWG em dois textos. A menor mudança é trocar o crédito e link para IGDB e corrigir a frase de privacidade. Não aplicada, pois é interface.
3. `src/services/account.js`, função `loadReviews`, recebe `rawgId` mas não o aplica à consulta; também não implementa popularidade por curtidas nessa consulta direta. Isso pode misturar reviews de jogos na tela que usar essa função ou ignorar a opção de popularidade. O banco/API oferecem filtragem e ordenação, verificadas nos testes. A menor correção futura é aplicar o filtro de jogo e conectar a ordenação à consulta/RPC apropriada. Sem o identificador enviado, o banco não pode inferir qual jogo a página está exibindo. Não aplicada, pois serviços do front são somente leitura.
4. Nomes internos legados como `rawgId`, `rawg_id` e classe CSS de crédito permanecem apenas por compatibilidade. Migrações antigas e documentação histórica continuam registrando a RAWG. Removê-los integralmente exigiria trabalho coordenado no front, não autorizado nesta entrega.
5. A confirmação de e-mail continua desligada e não foi configurado SMTP. A recuperação de senha por e-mail exige entrega de e-mails funcionando; não foi prometida sem esse serviço. Essas configurações não foram alteradas nesta migração.

## F. Estado final

O backend usa exclusivamente IGDB, autentica na Twitch, preserva o JSON React e vincula jogos ao Supabase com origem explícita e proteção contra colisões. Os fluxos de conta, listas, reviews, curtidas e Jogos Salvos foram verificados no backend/banco com dados sintéticos. A interface da equipe permaneceu intacta.

Para executar o clone: instalar dependências na raiz e em backend, preencher a configuração privada local e executar `npm run dev`. Não iniciar duas instâncias na mesma porta. Antes de publicar em produção, rotacionar a credencial exposta; para corrigir os dois pontos da interface, solicitar autorização e coordenar com a equipe responsável.

Documentação oficial consultada: [IGDB](https://api-docs.igdb.com/), [OAuth Twitch](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#client-credentials-grant-flow) e [relações computadas PostgREST](https://postgrest.org/en/stable/references/api/resource_embedding.html#computed-relationships).
