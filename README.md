# GameAtlas

Projeto de TCC com front-end React/Vite, API Node.js/Express conectada à [RAWG](https://rawg.io/apidocs) e autenticação/dados de usuários no Supabase.

## Executar no VS Code

Abra a pasta `GameAtlas-RAWG` e execute no terminal:

```powershell
npm install
npm --prefix backend install
npm run dev
```

O site abre em http://localhost:5173 e a API executa em http://localhost:3001. Nesta cópia local, a configuração privada está em `backend/.env.local`. Em uma nova instalação, copie `backend/.env.example` para `backend/.env.local` e preencha `RAWG_API_KEY` antes de iniciar. Não sobrescreva uma configuração existente.

A configuração do Supabase no React fica em `.env.local` na raiz (`VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`). No backend, preencha também `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_SECRET_KEY`. Os arquivos locais já estão configurados nesta cópia e são ignorados pelo Git. Veja [supabase/README.md](supabase/README.md) para preparar uma nova instalação.

As chaves RAWG e Supabase Secret ficam exclusivamente no servidor. Nunca coloque essas chaves em variáveis `VITE_` ou envie arquivos `.env` para o GitHub. A chave publishable é destinada ao navegador e depende das regras RLS.

## Implementado nesta etapa

- Listagem de jogos e filtros por gênero, plataforma, desenvolvedor, tags, datas e notas.
- Busca por trechos do nome pela navbar, com relevância, filtros de plataforma/gênero e paginação em Explorar.
- Opção de ocultar demos/DLCs, ano e plataformas nos cards e botão para ampliar os resultados consultados.
- Home e carrossel usando dados e imagens reais.
- Detalhes ligados à rota `/jogo/:id`, com consulta direta pelo ID RAWG.
- Descrições em português brasileiro, com cache no servidor.
- Rotas de gêneros e plataformas para futuras interfaces de filtro.
- Validação, cache, timeout e mensagens de erro.
- Crédito e link RAWG nas páginas que utilizam seus dados.

- Cadastro, login, sessão persistente e saída com Supabase Auth.
- Perfil real com edição de nome, username, bio e foto por URL.
- Criar, editar e excluir listas; escolher visibilidade pública/privada e gerenciar jogos.
- Notas inteiras de 1 a 5 com comentário opcional, edição e remoção da avaliação.
- Jogos Salvos privados, adicionados somente pela escolha do usuário.
- Avaliações da comunidade, listas públicas e páginas pessoais com paginação.

As rotas atuais usam React também ao abrir diretamente ou recarregar, preservando os HTML antigos como referência. O cadastro segue a confirmação de e-mail configurada pelo projeto Supabase. Falta a proprietária ajustar o Site URL para `http://localhost:5173` e adicionar `http://localhost:5173/perfil` aos Redirect URLs; o acesso atual de Desenvolvedor não permite alterar esses campos. Consulte os detalhes em [supabase/README.md](supabase/README.md).

## Estrutura

- `backend/`: servidor Express, serviço RAWG, validações, configuração e testes.
- `supabase/`: migração das seis tabelas, regras de acesso e testes transacionais do banco.
- `src/services/api.js`: chamadas do navegador para a API GameAtlas.
- `src/services/account.js` e `src/services/supabase.js`: operações de contas, listas, avaliações e jogos salvos.
- `src/context/`: sessão de autenticação compartilhada pela aplicação.
- `src/hooks/`: carregamento dos jogos, detalhes e perfil.
- `src/pages/`: páginas React.
- `src/components/`: navbar, carrossel, cards e componentes compartilhados.
- `public/`: imagens estáticas usadas pelo React.

Os arquivos HTML/JS antigos do repositório foram mantidos como referência da migração; a entrada da aplicação atual é React/Vite.

## Validar

```powershell
npm test
npm run build
```

Veja [backend/README.md](backend/README.md) para rotas, exemplos de filtros, configuração e detalhes da integração. Os testes automatizados não usam a chave real nem consomem consultas RAWG. O comando `npm run lint` também verifica arquivos antigos e páginas inacabadas do GitHub, que ainda têm pendências anteriores a esta integração.
