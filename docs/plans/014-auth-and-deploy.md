# 014 — Autenticação e deploy em VPS

Status: **implementado em 2026-11-17**, aprovado com as propostas das perguntas (ver "Decisões")
Branch: `feat/auth-and-deploy`

## Objetivo

Fechar as duas últimas pendências do `CLAUDE.md`: o app passa a exigir login com e-mail e senha e ganha tudo o que é preciso para rodar num VPS com Docker, com HTTPS. A autenticação vem primeiro, porque o deploy depende dela.

## Parte A — Autenticação

### Modelo de contas (pergunta 1)

O Prumo continua sendo de **um único usuário**, como diz o `CLAUDE.md`. A proposta é **uma conta só**, sem `userId` nas entidades:

- Objetivos, trilhas, rotinas e PDI continuam sem dono; quem está logado vê tudo.
- O login só protege o acesso. Adicionar `userId` a todas as tabelas e a todas as consultas (a previsão antiga da pendência) só faz sentido se o app passar a ter várias pessoas, o que está fora do escopo do projeto.

### Sem dependência nova

- **Senha:** hash com `scrypt`, que já vem no Node (`node:crypto`), com sal aleatório por senha e comparação em tempo constante (`timingSafeEqual`). O guia do Next usa `bcrypt` como exemplo, mas ele seria uma dependência nova sem ganho real aqui.
- **Sessão no banco** (o modelo "database sessions" do guia do Next), em vez de cookie criptografado com `jose` ou `iron-session`: o cookie leva só um token aleatório de 32 bytes, e o banco guarda o hash SHA-256 desse token. Sair do app apaga a sessão de verdade, e não há chave de criptografia de sessão para gerenciar.

### Mudanças no modelo de dados

```prisma
model User {
  id                String    @id @default(uuid(7)) @db.Uuid
  email             String    @unique @db.VarChar(254)   // sempre em minúsculas
  passwordHash      String    @map("password_hash")
  failedLoginCount  Int       @default(0) @map("failed_login_count")
  lockedUntil       DateTime? @map("locked_until")
  sessions          Session[]
  createdAt / updatedAt
  @@map("users")
}

model Session {
  id         String   @id @default(uuid(7)) @db.Uuid
  tokenHash  String   @unique @map("token_hash")
  userId     String   @map("user_id") @db.Uuid   // onDelete: Cascade
  expiresAt  DateTime @map("expires_at")
  createdAt  DateTime @default(now()) @map("created_at")
  @@index([userId])
  @@map("sessions")
}
```

Migration `add_auth`. Nenhuma tabela existente muda.

### Regras (no service `src/modules/auth/service.ts`, testadas)

- **Login:** e-mail (sem diferenciar maiúsculas) e senha. Erro sempre genérico, "E-mail ou senha incorretos.", para não revelar se o e-mail existe.
- **Tentativas repetidas:** depois de **5 senhas erradas seguidas**, a conta fica bloqueada por **15 minutos** ("Muitas tentativas. Tente de novo em alguns minutos."). Um login certo zera o contador.
- **Sessão:** vale **30 dias** e é renovada (estende o prazo) quando usada com menos de 15 dias restantes. Sessão vencida é recusada e apagada.
- **Sair:** apaga a sessão atual.
- **Trocar senha:** pede a senha atual; a nova precisa ter pelo menos **12 caracteres**. Trocar a senha encerra todas as outras sessões.
- **Criar a conta:** só pela linha de comando (`npm run auth:create-user`), que pergunta e-mail e senha no terminal (a senha sem aparecer na tela). Recusa se já existir uma conta. Não há tela de cadastro, então ninguém de fora consegue criar conta. O mesmo comando com `--reset-password` troca a senha de quem esqueceu.

### Onde a proteção acontece

- **`src/proxy.ts`** (o antigo middleware, renomeado no Next 16): checagem otimista. Sem o cookie de sessão, qualquer página (menos `/login`, os arquivos estáticos e o ícone) redireciona para `/login?next=<página>`. Não consulta o banco, só olha se o cookie existe.
- **Camada de acesso (`src/modules/auth/session.ts`):** `getSession()` lê o cookie e valida no banco; `requireSession()` redireciona para o login se não houver sessão válida. É chamada:
  - **em toda Server Action** que muda dados (todas as `actions.ts` de todos os módulos), porque uma action pode ser chamada sem passar pela tela; e
  - **nas páginas**, por um componente no layout, dentro de `<Suspense>` (exigência do Cache Components para leitura de cookie), que redireciona quem chega com cookie inválido ou vencido.
- **Cookie:** `httpOnly`, `sameSite: "lax"`, `secure` em produção, `path: "/"`, validade igual à da sessão.

### Telas

- **`/login`:** e-mail, senha e "Entrar"; depois do login, volta para a página do `next` (só caminhos internos, para não virar redirecionamento aberto) ou para o painel. Fora do layout com navegação (usa um grupo de rotas), com a marca do Prumo.
- **Cabeçalho:** botão "Sair" (formulário com Server Action, não link) ao lado do tema.
- **`/settings/account`:** trocar senha (senha atual, nova, confirmação).
- Mesmo padrão dos outros formulários: Zod no cliente e no servidor, `useActionState`, botão desabilitado durante o envio, erros por campo.

### Testes

- **Unidade:** hash e verificação de senha (certa, errada, hash adulterado); token e hash do token; validação do `next` (aceita `/goals/1`, recusa `https://outro.site`, `//outro.site` e `/\outro`).
- **Integração (`src/modules/auth/service.int.test.ts`):** login certo cria sessão; senha errada não cria; e-mail com maiúsculas funciona; 5 erros bloqueiam, o 6º recusa mesmo com a senha certa, e o bloqueio expira depois de 15 minutos (com relógio injetado); login certo zera o contador; sessão vencida é recusada e apagada; renovação perto do vencimento; sair apaga a sessão; trocar senha exige a atual, recusa senha curta e encerra as outras sessões; criar conta recusa a segunda.
- **E2E:**
  - Os testes atuais passam a rodar logados: o `resetDatabase` dos e2e recria uma conta de teste e uma sessão com token fixo, e o Playwright já começa com esse cookie (`storageState`), então nenhum teste existente precisa mudar de lógica.
  - Novo `e2e/auth.spec.ts`: sem sessão, qualquer página leva ao login e, depois de entrar, volta para ela; senha errada mostra o erro genérico; "Sair" leva ao login e a página anterior não abre mais; trocar senha funciona e a nova senha entra; a tela de login passa no axe.

## Parte B — Deploy em VPS com Docker

### O que entra no repositório

- **`next.config.ts`:** `output: "standalone"`, que gera um servidor Node enxuto, sem `node_modules` inteiro, próprio para imagem Docker.
- **`Dockerfile`** (multi-stage, `node:26-slim`): instala dependências, gera o cliente Prisma, roda `next build` e copia só o resultado `standalone`, os arquivos estáticos e o necessário para as migrations. Roda como usuário sem privilégios.
- **`deploy/entrypoint.sh`:** ao subir o contêiner, aplica as migrations pendentes (`prisma migrate deploy`) e o seed das categorias padrão (idempotente), depois inicia o servidor.
- **`docker-compose.prod.yml`** (projeto `prumo-prod`): três serviços na mesma rede interna:
  - `db`: Postgres 18 com volume próprio, **sem porta exposta** para fora;
  - `app`: a imagem do Prumo, sem porta exposta;
  - `caddy`: proxy reverso nas portas 80 e 443, com **HTTPS automático** (Let's Encrypt) para o domínio configurado, cabeçalhos de segurança e compressão. É o "proxy reverso na frente do Next" que o guia de self-hosting recomenda.
- **`deploy/Caddyfile`**, **`.env.production.example`** (domínio, credenciais do banco, e-mail para o Let's Encrypt) e **`deploy/backup.sh`** (dump do banco com `pg_dump`, guardando os últimos 14, pensado para rodar no `cron` do servidor).
- **`docs/deploy.md`:** passo a passo em pt-BR: requisitos do VPS, apontar o DNS, instalar Docker, clonar o repositório, preencher o `.env.production`, subir, criar a conta, agendar o backup, atualizar para uma versão nova e restaurar um backup.

### O que fica com você

- Contratar o VPS e o domínio, apontar o DNS e rodar os comandos do `docs/deploy.md` no servidor. Eu não tenho acesso ao servidor, e o `CLAUDE.md` exige pedido explícito para push.
- O repositório remoto: o servidor precisa clonar o projeto de algum lugar (GitHub privado, por exemplo). Criar o repositório e fazer o primeiro push é um passo seu, ou meu se você pedir.

### Conferência local

- `docker compose -f docker-compose.prod.yml up --build` na sua máquina, com o domínio `localhost` (o Caddy serve HTTPS local com certificado próprio): o app sobe, as migrations rodam, `npm run auth:create-user` dentro do contêiner cria a conta, o login funciona e o painel abre. Depois, `docker compose ... down` sem apagar nada do ambiente de desenvolvimento (projeto e volume com outro nome).
- O backup gera um arquivo restaurável (restauro num banco temporário e confiro a contagem de linhas).

## Fora de escopo

- Várias contas, cadastro pela tela, papéis ou `userId` nas entidades (pergunta 1).
- Recuperação de senha por e-mail (o reset é pela linha de comando, no servidor).
- Login com Google/GitHub, autenticação em dois fatores, passkeys.
- Deploy automático pelo CI, várias instâncias, CDN e monitoramento.
- Contratar e configurar o VPS em si.

## Arquivos afetados

```
prisma/schema.prisma, prisma/migrations/<timestamp>_add_auth/
src/modules/auth/{password,tokens,service,session,schemas,actions}.ts (+ testes)
src/proxy.ts
src/app/(auth)/login/page.tsx, src/app/settings/account/page.tsx (+ loading)
src/app/layout.tsx (ou grupo de rotas)  (botão Sair, verificação de sessão)
src/components/auth/{login-form,password-form,logout-button,session-guard}.tsx
src/modules/*/actions.ts                (requireSession no início de cada action)
scripts/create-user.ts                  (npm run auth:create-user)
e2e/helpers.ts, e2e/global-setup.ts, playwright.config.ts, e2e/auth.spec.ts
src/test/test-database.ts               (conta e sessão de teste dos e2e)
next.config.ts, Dockerfile, .dockerignore, docker-compose.prod.yml
deploy/{entrypoint.sh,Caddyfile,backup.sh}, .env.production.example
docs/deploy.md, CLAUDE.md, .github/workflows/ci.yml (se a conta de teste precisar de variável)
```

## Critério de pronto

- `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e` passando; `npm audit` em 0.
- Migration `add_auth` incluída.
- Ambiente de produção conferido localmente (subida, login, backup e restauração).
- Pendências removidas do `CLAUDE.md`; regras de autenticação e o processo de deploy registrados; este plano atualizado.

## Mudanças durante a implementação

### Autenticação

- **Grupos de rotas:** as telas foram para `src/app/(app)/` e o login para `src/app/(auth)/login/` (as URLs não mudam). O layout raiz ficou só com HTML, tema e um `<Suspense>`; o cabeçalho, o botão Sair e a verificação de sessão estão no layout de `(app)`. O `not-found.tsx` raiz ganhou o próprio `<main>`, já que ficou fora do layout com cabeçalho.
- **Verificação da sessão nas páginas:** um componente `SessionGate`, dentro de `<Suspense>` no layout de `(app)`, valida a sessão no banco e só então renderiza a página. Assim um cookie forjado nunca vê dados (o proxy só confere se o cookie existe). A primeira versão aguardava a sessão no topo do layout, e o Next 16 avisou que isso segura toda navegação ("uncached data during prerendering or a navigation"); o guia de autenticação com Cache Components recomenda exatamente o componente dentro de `<Suspense>`.
- **Relógio depois do banco:** `validateSession` e `login` recebem o "agora" opcional e só leem `new Date()` depois da consulta, porque o Next recusa ler o relógio antes de qualquer dado da requisição.
- **`useSchemaForm` devolve também o `state`** da última resposta da action, para o formulário de senha mostrar "Senha alterada" (`saved`).
- **Link "Minha conta"** (ícone) no cabeçalho, ao lado do tema e do Sair.
- **`PASSWORD_MIN_LENGTH`** ficou em `src/modules/auth/schemas.ts` (o formulário do navegador importa dali); o service reexporta.
- **E2E logados:** o `seedTestDatabase` cria a conta de teste e uma sessão com token fixo, e o `playwright.config.ts` começa todo teste com esse cookie. O `global-setup` também roda o seed, para os testes que não chamam `resetDatabase`.
- **Login com a conta sumindo no meio:** a primeira bateria de e2e registrou um erro do Prisma (P2025) no login: o `resetDatabase` do teste seguinte esvaziou o banco enquanto um login ainda terminava. Em produção a conta única não é apagada, mas o login passou a usar `updateMany` e a responder com o erro genérico se a conta não existir mais, em vez de estourar um erro 500.
- **Testes de unidade das funções puras** (senha, token, `next`) foram escritos junto com a implementação, sem rodá-los falhando antes.

### Deploy

- **Migrations num serviço `migrate`**, em vez de um `entrypoint.sh` no app: o Dockerfile tem dois alvos, `runner` (o servidor `standalone`, sem ferramentas de desenvolvimento) e `tools` (dependências completas e código), e o Compose roda o `tools` antes do app (`service_completed_successfully`). O mesmo serviço roda o `npm run auth:create-user` no servidor. Assim a imagem do app continua enxuta, e o Prisma CLI e o `tsx` ficam só na imagem de ferramentas.
- **Script `prepare` tolerante:** passou a ser `node scripts/enable-git-hooks.mjs`, que ignora a falta de Git; dentro do build da imagem não há Git e o `npm ci` quebrava.
- **Conferência local feita:** com `DOMAIN=localhost`, a pilha subiu (banco, migrations, app, Caddy com HTTPS local); `/` redirecionou para o login; os cabeçalhos de segurança apareceram; a conta foi criada pelo `migrate`; login, criação de objetivo e saída funcionaram, com o cookie `Secure`, `HttpOnly` e `SameSite=Lax`. O `deploy/backup.sh` gerou o dump, que foi restaurado num banco temporário com os mesmos dados. Depois, a pilha local foi parada (`down`, sem apagar volumes) e os arquivos temporários removidos.

## Decisões

1. Uma conta só, sem `userId` nas entidades.
2. Senha com pelo menos 12 caracteres, bloqueio de 15 minutos após 5 erros e sessão de 30 dias renovada com o uso.
3. Conta criada e senha trocada só pela linha de comando.
