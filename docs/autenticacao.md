# Login e cadastro do GameAtlas

## Configuração compartilhada

O clone usa a URL e a chave **publishable** do projeto em `src/config/supabase-public.json`. Isso permite abrir login e cadastro sem depender do `.env.local` que existia somente na máquina em que a integração foi criada. A chave publishable é destinada ao navegador e pode estar no código; as permissões continuam sendo controladas pelo Supabase Auth e pelas políticas RLS. [Referência oficial](https://supabase.com/docs/guides/getting-started/api-keys).

Para usar outro projeto, preencher **juntas** `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` em `.env.local` e reiniciar o Vite. A variável antiga `VITE_SUPABASE_ANON_KEY` também é aceita. Uma configuração parcial ou uma chave administrativa é recusada, com mensagem de orientação. Nunca colocar `SUPABASE_SECRET_KEY`, `service_role` ou a chave RAWG na configuração do navegador.

O login e o cadastro acessam o Supabase diretamente e podem ser verificados com `npm run dev:web`. Não é necessário iniciar a API RAWG para autenticar.

## Fluxo de cadastro

1. Preencher nome, e-mail, senha de pelo menos oito caracteres e confirmação da senha.
2. Quando a confirmação de e-mail estiver ativa no Supabase, confirmar a mensagem recebida antes de entrar. A tela permite reenviar a confirmação e informa falhas de envio.
3. O link retorna para `/perfil` na origem em que o site está aberto. Links expirados ou inválidos são apresentados como erro, sem simular login.

No Supabase, o projeto precisa estar **ativo**, com cadastro por e-mail habilitado. Em Authentication > URL Configuration, usar `http://localhost:5173` como Site URL para desenvolvimento e cadastrar `http://localhost:5173/perfil` em Redirect URLs. Se o grupo usa `127.0.0.1`, cadastrar também `http://127.0.0.1:5173/perfil`. Na hospedagem, usar os endereços reais.

Se o painel mostrar **Project is paused**, o login e o cadastro não conseguem acessar o serviço. O responsável com permissão para gerenciar o projeto deve usar **Resume project** e aguardar a retomada antes de repetir o teste real. Se esse botão estiver bloqueado para o perfil Developer, solicitar a retomada à proprietária. [Retomada de projetos pausados](https://supabase.com/docs/guides/platform/free-project-pausing).

O serviço de e-mail padrão do Supabase limita os destinatários aos membros autorizados do projeto e tem limites de envio. Para cadastrar pessoas fora desse grupo com confirmação ativa, o responsável deve configurar um provedor de e-mail próprio. Um bloqueio no envio não é tratado como cadastro concluído pelo site. [Documentação de envio de e-mails](https://supabase.com/docs/guides/auth/auth-smtp).

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

Os testes de regressão incluem o cliente oficial do Supabase com transporte simulado e cobrem cadastro pendente, reenvio, login, sessão, saída, erros e validação da configuração. Eles não enviam e-mails nem alteram dados de listas, avaliações ou jogos. A validação contra o serviço real exige o projeto online e acesso autorizado ao Supabase.

Com `SUPABASE_URL` e `SUPABASE_SECRET_KEY` do mesmo projeto disponíveis apenas no ambiente do servidor, executar `node --use-system-ca scripts/test-auth-live.mjs`. Esse teste usa uma conta temporária para verificar a criação, a confirmação por token, o login e a sessão reais, removendo a conta no final. Não envia mensagens de e-mail, não altera configurações do Supabase e não edita as outras funcionalidades. A entrega do e-mail precisa ser verificada separadamente com um destinatário autorizado.

### Situação verificada em 25/10/2026

O projeto estava pausado e voltou a responder após a retomada feita pela proprietária. Os 18 testes de autenticação, a compilação e o teste real de criação/confirmação por token, login, sessão e saída passaram. As contas temporárias foram removidas.

O painel ainda mostrava Site URL em `http://localhost:3000`, sem Redirect URLs, e SMTP próprio desativado. A proprietária precisa ajustar os endereços conforme as instruções acima e configurar o envio de e-mails para permitir confirmações de pessoas fora da organização. O perfil Developer desta sessão não permite editar essas configurações. O teste por token não equivale a um teste de entrega de e-mail.
