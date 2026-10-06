# GameAtlas

Projeto de TCC com front-end React/Vite e API Node.js/Express conectada à [RAWG](https://rawg.io/apidocs).

## Executar no VS Code

Abra a pasta `GameAtlas-RAWG` e execute no terminal:

```powershell
npm install
npm --prefix backend install
npm run dev
```

O site abre em http://localhost:5173 e a API executa em http://localhost:3001. Nesta cópia local, a configuração privada está em `backend/.env.local`. Em uma nova instalação, copie `backend/.env.example` para `backend/.env.local` e preencha `RAWG_API_KEY` antes de iniciar. Não sobrescreva uma configuração existente.

A chave RAWG fica exclusivamente no servidor. Nunca coloque a chave em variáveis `VITE_` ou envie arquivos `.env` para o GitHub.

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

Perfil ainda usa dados simulados. Login, cadastro, listas, reviews, Supabase e autenticação permanecem nas etapas seguintes do projeto.

## Estrutura

- `backend/`: servidor Express, serviço RAWG, validações, configuração e testes.
- `src/services/api.js`: chamadas do navegador para a API GameAtlas.
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
