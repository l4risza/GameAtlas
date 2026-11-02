# Contas e perfis — entrega de back-end e banco

Base da equipe: commit `14d26cc`. Os arquivos em `src/`, as páginas e os estilos não foram editados nesta entrega.

## Banco aplicado em 30/10/2026

Foram aplicadas, na ordem, as migrações:

1. `20261014000100_configuracoes.sql`: campos do perfil, favoritos, redes, preferências e bucket `avatares`.
2. `20261016000100_username_unico.sql`: username no cadastro, disponibilidade e resolução de e-mail exclusiva do servidor.
3. `20261030000100_contas_perfis.sql`: username obrigatório, metadados do Auth, validações, curtidas, consultas ordenadas e desativação.

Não executar novamente migrações já aplicadas. Em outro projeto, executar todas em ordem, começando pela migração inicial de 09/10. As migrações são transacionais.

### Cadastro e identidade

- Cadastro exige `user_metadata.username`: de 3 a 30 letras ASCII, números ou `_`.
- `perfis_username_unico`, em `lower(username)`, rejeita duplicatas inclusive em cadastros simultâneos. Consultar disponibilidade ajuda o formulário; o índice é a garantia final.
- E-mail continua único e gerenciado pelo Supabase Auth.
- O login existente aceita e-mail diretamente no Auth e username por `POST /api/auth/entrar`.
- `username`, `display_name`, `name` e `full_name` dos metadados Auth acompanham o username do perfil. O nome opcional de exibição continua em `perfis.nome` para compatibilidade com as telas da equipe.
- Alterar somente os metadados do Auth não muda o username: o perfil continua sendo a fonte desse dado.
- Contas antigas sem username receberam `jogador_...`, com sufixo único, preservando nome e conteúdo. Podem escolher outro username pelas configurações existentes.
- O provedor Phone permanece desabilitado. O campo telefone mostrado pelo painel é nativo do Supabase; não se deve remover a coluna interna `auth.users.phone`. O aplicativo não exige telefone.

### Foto e preferências

O código existente da equipe pode continuar gravando diretamente em `perfis` com a sessão do usuário e RLS:

- `avatar_url`, `nome`, `username`, `bio`;
- `jogos_favoritos`: até cinco nomes, sem vazios ou duplicatas, até 60 caracteres cada;
- `redes_sociais`: até seis itens `{ rede, url }`, uma entrada por rede, HTTPS e domínio correspondente;
- `mostrar_reviews`, `mostrar_listas`, `ordem_reviews`, `ordem_listas`.

Os favoritos são os destaques textuais do perfil já previstos na interface. São independentes de Jogos Salvos e das listas.

O bucket público `avatares` aceita JPEG, PNG e WebP de até 2 MB por arquivo. Cada pessoa só envia, lista ou remove arquivos de sua pasta `<auth.uid()>/...`. A conversão de imagem já feita pela interface continua funcionando. A URL pública permite mostrar a foto a visitantes.

## Chamadas disponíveis para o front-end

As rotas usam o prefixo `/api`. Operações autenticadas exigem `Authorization: Bearer <access_token>`; nunca usar chave privada no navegador.

| Operação | Chamada |
| --- | --- |
| Disponibilidade do username | `GET /api/usuarios/disponibilidade?username=Jogador` → `{ disponivel: boolean }` |
| Login por username, já usado pela equipe | `POST /api/auth/entrar` com `{ identificador, senha }` → tokens da sessão |
| Reviews no perfil | `GET /api/perfis/:uuid/reviews?ordem=populares&page=1&page_size=12` |
| Listas no perfil | `GET /api/perfis/:uuid/listas?ordem=recentes&page=1&page_size=12` |
| Curtir uma review | `POST /api/reviews/:uuid/curtida` |
| Remover a própria curtida | `DELETE /api/reviews/:uuid/curtida` |
| Desativar a própria conta | `POST /api/conta/desativar` com `{ senha: "senha atual" }` |

As consultas do perfil retornam `{ items, count }`. Os itens de review mantêm os campos do banco, `jogos`, `perfis` e acrescentam `curtidas`; são compatíveis com a transformação `reviewView` existente. As listas mantêm seus campos e `perfis`.

Também é possível chamar pelo cliente Supabase:

```js
supabase.rpc('username_disponivel', { candidato: username })
supabase.rpc('reviews_do_perfil', { alvo: userId, ordenacao: 'populares', pagina: 1, tamanho: 12 })
supabase.rpc('listas_do_perfil', { alvo: userId, ordenacao: 'antigas', pagina: 1, tamanho: 12 })
```

### Ordenação, curtidas e privacidade

- Reviews: `recentes` ou `populares`; `antigas` foi mantido para compatibilidade com o código atual. Popularidade usa a quantidade de curtidas, uma por usuário, com desempate pela data de criação e pelo ID.
- Listas: `recentes` ou `antigas`, por data de criação e ID.
- Sem `ordem`/`ordenacao`, a consulta usa a preferência do perfil. Páginas começam em 1 e têm no máximo 48 itens.
- Repetir `POST` de curtida não duplica a contagem; remover uma curtida só afeta a do usuário autenticado. O visitante recebe a contagem, sem a lista de quem curtiu.
- As consultas respeitam as opções de mostrar no perfil. Ocultar a aba de reviews não torna privadas as avaliações públicas dos jogos.
- Listas privadas e seus jogos continuam visíveis somente ao dono, inclusive nas consultas ordenadas.

### Desativação

Exige sessão válida e conferência da senha atual, com limite de tentativas. O servidor identifica o usuário pelo token, sem aceitar ID de outra conta no corpo.

A operação marca `desativado_em`, encerra as sessões e bloqueia novos logins no Auth. Perfil, reviews e listas deixam de aparecer publicamente; gravações com JWT antigo também são recusadas pelo banco. Os dados são preservados. A reativação é administrativa e não existe rota pública que a permita. URLs de fotos já públicas podem continuar acessíveis ou em cache.

Se o Auth estiver indisponível depois da marcação no banco, a API informa falha, mas as regras do banco já permanecem bloqueadas. O responsável deve concluir o bloqueio no Auth antes de reativar a conta.

## Pendências para o grupo conectar na interface

- O cadastro, login, foto, favoritos, redes e preferências já têm telas; o banco agora tem a estrutura que faltava.
- O botão **Desativar conta** está desabilitado no código da equipe. Precisa solicitar a senha atual, chamar o endpoint e encerrar a sessão local após sucesso.
- Os controles atuais de ordenação de reviews alternam apenas `recentes`/`antigas`. Precisam oferecer `populares` e usar a nova consulta/RPC para considerar curtidas.
- Os cards ainda não têm a ação de curtir/remover curtida e a contagem correspondente.
- Nenhuma dessas interfaces foi alterada nesta entrega. Não é necessário criar uma nova página só para essas ações; o grupo pode ligá-las às páginas existentes.

## Troca de e-mail e recuperação de senha

Os serviços da equipe já usam `auth.updateUser({ email })`, `auth.resetPasswordForEmail` e `auth.updateUser({ password })`. A troca do e-mail de uma conta permanente e o link de recuperação precisam de envio de e-mail, mesmo que o cadastro esteja com confirmação desligada. Não substituir esses fluxos por confirmação administrativa de usuários.

Os endereços de retorno abaixo já foram liberados no projeto em 30/10/2026, e o Site URL foi corrigido para `http://localhost:5173`. O responsável ainda precisa configurar SMTP:

- `http://localhost:5173/perfil`
- `http://localhost:5173/configuracoes`
- `http://localhost:5173/configuracoes?aba=conta`
- `http://localhost:5173/redefinir-senha`

Usar também os endereços publicados quando houver hospedagem. A recuperação e a troca de e-mail não foram consideradas aprovadas quanto à entrega de mensagens sem SMTP configurado. Não foi enviado e-mail para usuários reais.

## Verificação

```powershell
npm --prefix backend test
npm run test:auth
node --use-system-ca backend/scripts/test-contas.mjs
```

Passaram 81 testes da API, 22 testes de autenticação, os testes SQL transacionais e a integração com o Supabase real. A integração cria contas sintéticas pelo cadastro público, verifica username/login, foto e isolamento, preferências, curtidas, ordenação, listas privadas e desativação, e remove contas, arquivos e jogos de teste no final. Não depende da RAWG nem envia e-mails.

Referências: [metadados Auth](https://supabase.com/docs/guides/auth/managing-user-data), [troca de dados da conta](https://supabase.com/docs/reference/javascript/auth-updateuser), [SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
