# Banco GameAtlas

Estrutura inicial para Supabase/PostgreSQL. A autenticação usa `auth.users`, gerenciado pelo Supabase Auth; senhas e e-mails não são copiados para tabelas públicas.

## Tabelas

| Tabela | Finalidade |
| --- | --- |
| `perfis` | Nome, username único sem diferenciar maiúsculas, avatar e bio. Perfil criado automaticamente no cadastro Auth. |
| `jogos` | Referência local a jogos RAWG usados no aplicativo. `rawg_id` único, nome, slug e capa. |
| `reviews` | Uma nota inteira de 1 a 5 por usuário/jogo; `texto` opcional. Pode editar ou remover sua avaliação. |
| `listas` | Listas criadas pelo usuário. `publica=false` por padrão; dono pode mudar a visibilidade. |
| `lista_jogos` | Jogos em cada lista, sem duplicatas. Visibilidade segue a lista. |
| `jogos_salvos` | Jogos que o usuário escolheu salvar, sem duplicatas e visíveis somente a ele. |

Avaliar um jogo ou adicioná-lo a uma lista **não** o inclui em Jogos Salvos. Remover de Jogos Salvos não remove avaliações nem jogos das listas. O usuário pode criar uma lista chamada “Favoritos”, como qualquer outra lista.

## Aplicar e verificar

1. Em um projeto novo, executar `migrations/20261009000100_gameatlas.sql` no SQL Editor como `postgres`. A migração é transacional e deve ser executada uma única vez; conflitos interrompem a criação em vez de substituir dados.
2. Executar `tests/001_gameatlas.sql` como `postgres`. O teste cria dois usuários sintéticos sem credenciais e dados associados dentro de uma transação, simula usuários autenticados e visitante, verifica permissões e termina com `ROLLBACK`. Não mantém contas nem jogos de teste. Sequências de IDs podem avançar, como é normal no PostgreSQL.
3. Confirmar no Table Editor as seis tabelas com RLS ativo.

Aplicada no projeto Supabase GameAtlas em 09/10/2026. Os testes transacionais passaram. `verify.sql` permite conferir as seis tabelas, RLS, regras de acesso e contagens, sem alterar dados.

Todas as tabelas têm RLS. Visitantes podem ler perfis públicos, catálogo, avaliações e listas públicas. Usuários autenticados editam apenas seus próprios dados. Nenhum usuário pode alterar o catálogo RAWG diretamente. A chave `service_role`, se usada, é exclusiva do backend e nunca deve ir para variáveis `VITE_` ou para o GitHub.

## Integração com o site

Os formulários e botões React estão conectados ao Supabase Auth e às seis tabelas. Login, cadastro e saída usam o cliente oficial Supabase. O perfil, as listas, avaliações e Jogos Salvos usam a sessão do usuário, mantendo as regras RLS em cada operação. Avaliações e listas públicas possuem paginação; listas privadas e jogos salvos permanecem restritos ao dono.

Ao salvar, avaliar ou adicionar um jogo a uma lista:

1. O React envia o `rawg_id` ao endpoint `POST /api/biblioteca/jogos/:id` com a sessão em `Authorization: Bearer`.
2. O backend valida o token no Supabase Auth, reaproveita o jogo local ou consulta a RAWG e faz upsert em `jogos` usando `rawg_id`, retornando o `id` local. Nome e capa são obtidos da RAWG. A chave administrativa é usada somente para esse catálogo.
3. O React usa esse `id` como `jogo_id` na ação escolhida. As escritas de dados pessoais usam o cliente autenticado, sem acesso administrativo.

### Configuração local

- Raiz `.env.local`: `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Backend `backend/.env.local`: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` e `RAWG_API_KEY`.
- Copiar os respectivos `.env.example` apenas se os arquivos locais não existirem. Usar chaves do mesmo projeto Supabase. Não executar novamente a migração em um banco já configurado.

### Confirmação do cadastro

No painel Authentication > URL Configuration, a proprietária deve configurar `Site URL` como `http://localhost:5173` e adicionar `http://localhost:5173/perfil` em `Redirect URLs`. Para acessar por `127.0.0.1`, adicionar também `http://127.0.0.1:5173/perfil`. Na publicação, cadastrar o domínio real do front-end. O aplicativo envia a URL de retorno da origem em que está aberto.

Em 09/10/2026, o painel ainda apontava para `http://localhost:3000`, sem Redirect URLs. O perfil de Desenvolvedor desta sessão não permitia editar esses campos; o usuário ficou de pedir o ajuste à proprietária. A confirmação permanece ativa. O link confirma o e-mail no Supabase antes do retorno; até corrigir a URL, se o retorno não abrir o site, o usuário pode voltar a `http://localhost:5173/login` e entrar após a confirmação. A entrega do e-mail depende da configuração do Supabase; não foi disparado e-mail de teste.

### Teste de integração real

Com `npm run dev` ligado, executar `node --use-system-ca backend/scripts/test-supabase.mjs`. Esse teste usa as chaves locais e consulta um jogo real na RAWG. Cria duas contas sintéticas confirmadas, testa login, perfil, listas, notas sem comentário, Jogos Salvos, duplicatas e isolamento entre usuários, e remove as contas e seus dados ao terminar. Um jogo recém-inserido no teste é removido se não tiver uso real simultâneo. Não usar contas pessoais no teste. Os testes passaram no projeto GameAtlas.

Depois de `npm run build`, `node --use-system-ca backend/scripts/verify-connection.mjs` verifica as contagens, a configuração de cadastro/confirmacão e a ausência das chaves privadas no pacote React, sem gravar dados. Executar os comandos na raiz do projeto.

Nos inserts do cliente, `usuario_id` pode ser omitido: o padrão é `auth.uid()`. Atualizações aceitam apenas colunas editáveis, sem trocar dono, jogo ou timestamps. `username` começa vazio para não impedir o cadastro por colisão e pode ser preenchido depois no perfil.

Para mudar a escala da nota futuramente, será necessária uma migração da restrição `reviews_nota_1_a_5`, conversão das notas existentes e atualização dos formulários. A nota do usuário é independente da nota retornada pela RAWG.

Referências: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) e [perfis ligados ao Auth](https://supabase.com/docs/guides/auth/managing-user-data).
