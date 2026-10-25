# Login e cadastro do GameAtlas

## Configuração compartilhada

O clone usa a URL e a chave **publishable** do projeto em `src/config/supabase-public.json`. Isso permite abrir login e cadastro sem depender do `.env.local` que existia somente na máquina em que a integração foi criada. A chave publishable é destinada ao navegador e pode estar no código; as permissões continuam sendo controladas pelo Supabase Auth e pelas políticas RLS. [Referência oficial](https://supabase.com/docs/guides/getting-started/api-keys).

Para usar outro projeto, preencher **juntas** `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` em `.env.local` e reiniciar o Vite. A variável antiga `VITE_SUPABASE_ANON_KEY` também é aceita. Uma configuração parcial ou uma chave administrativa é recusada, com mensagem de orientação. Nunca colocar `SUPABASE_SECRET_KEY`, `service_role` ou a chave RAWG na configuração do navegador.

O login e o cadastro acessam o Supabase diretamente e podem ser verificados com `npm run dev:web`. Não é necessário iniciar a API RAWG para autenticar.

## Cadastro sem SMTP e sem confirmação de e-mail

1. Preencher nome, e-mail, senha de pelo menos oito caracteres e confirmação da senha.
2. O Supabase cria a conta e devolve uma sessão. O site entra automaticamente e abre `/perfil`.
3. Nos próximos acessos, usar o mesmo e-mail e senha. Não há etapa nem botão de reenvio de confirmação.

**Etapa necessária no painel:** a proprietária deve abrir **Authentication > Sign In / Providers > User Signups**, manter **Allow new users to sign up** ligado, desligar **Confirm email** e clicar em **Save changes**. O projeto precisa estar ativo e o provedor Email habilitado. O perfil Developer desta sessão não permite salvar essa configuração.

Desligar a confirmação é uma configuração do Supabase; alterar somente o front-end não muda essa exigência. Enquanto ela continuar ativa, o cadastro pode falhar no envio ou retornar uma conta pendente sem sessão. O site informa essa pendência, sem tratar o cadastro como concluído. A entrada direta é o comportamento oficial do `signUp` quando **Confirm email** está desativado. [Referência do Supabase](https://supabase.com/docs/reference/javascript/auth-signup).

Contas criadas antes da mudança podem continuar com confirmação pendente. Se ocorrer `email_not_confirmed`, a proprietária deve regularizar essas contas no Supabase; o site não confirma contas por conta própria.

O cadastro e o login por senha nesse modo não usam links de retorno nem SMTP. Para futuros fluxos que enviem e-mails, como recuperação de senha, será necessário configurar o envio e os endereços de retorno. Em desenvolvimento, o site usa `http://localhost:5173`.

Se o painel mostrar **Project is paused**, o login e o cadastro não conseguem acessar o serviço. O responsável com permissão para gerenciar o projeto deve usar **Resume project** e aguardar a retomada antes de repetir o teste real. Se esse botão estiver bloqueado para o perfil Developer, solicitar a retomada à proprietária. [Retomada de projetos pausados](https://supabase.com/docs/guides/platform/free-project-pausing).

## Login e sessão

- Credenciais inválidas e e-mail ainda não confirmado têm mensagens específicas.
- O retorno ao jogo ou à página solicitada é preservado, sem redirecionar para sites externos ou criar ciclos entre login e cadastro.
- Uma sessão existente é restaurada. Eventos novos de login/saída prevalecem sobre uma leitura inicial atrasada.
- Falha ou demora na leitura inicial libera o formulário com uma mensagem, em vez de mantê-lo carregando indefinidamente.

## Verificação

Na raiz do clone:

```powershell
npm run test:auth
npm run build
```

Os testes de regressão incluem o cliente oficial do Supabase com transporte simulado e cobrem cadastro com entrada direta, bloqueio de sucesso quando não há sessão, login, sessão, saída, erros e validação da configuração. Eles não enviam e-mails nem alteram dados de listas, avaliações ou jogos.

Com `SUPABASE_URL` e `SUPABASE_SECRET_KEY` do mesmo projeto disponíveis apenas no ambiente do servidor, executar `node --use-system-ca scripts/test-auth-live.mjs`. Antes de criar qualquer conta, esse teste confere se **Confirm email** está desligado. Se estiver ligado, encerra com orientação, sem solicitar e-mail nem criar uma conta. Depois de liberado o fluxo, usa o cadastro público normal, verifica a sessão imediata, saída e novo login e remove a conta temporária. A chave privada serve somente para remover essa conta de teste; não é usada para cadastrar nem confirmar usuários.

### Situação verificada em 25/10/2026

O projeto estava pausado e voltou a responder após a retomada feita pela proprietária. O login real, a restauração de sessão e a saída já foram verificados com conta temporária, removida ao final.

O fluxo foi ajustado para cadastro com entrada direta, sem SMTP. Os 19 testes de autenticação e a compilação passaram. A confirmação de e-mail ainda estava ativa no serviço na última verificação; falta a proprietária desligar **Confirm email** para permitir validar esse cadastro no projeto real. Os testes simulados desse modo não substituem essa validação.
