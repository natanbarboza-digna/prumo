# 000 — Scaffold

Status: **aprovado em 2026-11-16** (dependências extras, commit inicial na `main` e porta 5432 aprovados; escopo ampliado com convenções de front-end, `next-themes` e `@axe-core/playwright`)
Branch: `chore/scaffold`

## Objetivo

Deixar o projeto pronto para começar a etapa 1 (Objetivos): aplicação Next.js rodando, banco no Docker, Prisma conectado, ferramentas de qualidade configuradas e um teste de fumaça de cada tipo (unidade, integração com banco, ponta a ponta) passando.

## Escopo

1. **Git**
   - `git init` com branch padrão `main`.
   - Primeiro commit na `main` contendo só `CLAUDE.md`, `.gitignore` e este plano (`chore: initial commit`). É a única exceção à regra de não commitar na `main`, porque sem um commit a branch não existe e não há de onde criar a feature branch.
   - Todo o resto vai na branch `chore/scaffold`.
2. **Next.js** via `create-next-app`: App Router, TypeScript, Tailwind, ESLint, diretório `src/`, alias `@/*`, sem Turbopack customizado e sem React Compiler.
3. **TypeScript** em `strict` (já é o padrão do `create-next-app`; vou conferir e acrescentar `noUncheckedIndexedAccess`).
4. **Prettier** com `eslint-config-prettier`, para o ESLint não brigar com a formatação.
5. **shadcn/ui** inicializado (`components.json`, `src/components/ui/`, `src/lib/utils.ts`). Nenhum componente adicionado ainda; cada feature adiciona o que usar.
6. **Docker Compose** com PostgreSQL:
   - Um serviço `db`, volume nomeado e porta `5432`.
   - Script de inicialização que cria dois bancos: `personal_management` (dev) e `personal_management_test` (testes).
7. **Prisma**:
   - `prisma/schema.prisma` ainda **sem modelos**: os modelos entram com cada feature, via plano.
   - `prisma.config.ts` carregando o `.env`. O Prisma 7 não lê o `.env` sozinho e passou a configurar a conexão nesse arquivo.
   - `src/lib/db.ts` com o cliente Prisma em singleton. Isso evita abrir uma conexão nova a cada hot reload do `next dev`, que reexecuta os módulos.
   - `prisma/seed.ts` existente, mas vazio (com comentário). As categorias padrão entram na etapa 4, junto com o modelo `ActionCategory`.
8. **Variáveis de ambiente**: `.env` (fora do git), `.env.test` (fora do git) e `.env.example` (versionado), com `DATABASE_URL`.
9. **Vitest**:
   - Dois projetos: `unit` (sem banco) e `integration` (carrega o `.env.test`).
   - Os testes ficam ao lado do código, como `*.test.ts`. Os de integração usam o sufixo `*.int.test.ts`.
10. **Playwright**: só Chromium, com `webServer` subindo o `next dev` e testes em `e2e/`.
11. **Scripts no `package.json`**: `dev`, `build`, `start`, `lint`, `typecheck` (`tsc --noEmit`), `format`, `test` (Vitest, os dois projetos), `test:e2e` e `seed` configurado para `npx prisma db seed`.
12. **Página inicial** substituída por uma página mínima em pt-BR ("Gestão Pessoal") e `lang="pt-BR"` no layout.
13. **Front-end base** (convenções em `CLAUDE.md` › Front-end):
    - `src/app/loading.tsx`, `src/app/error.tsx` e `src/app/not-found.tsx` na raiz, em pt-BR e acessíveis.
    - Tema claro/escuro com `next-themes` (`ThemeProvider` em um Client Component próprio) e um botão de alternância acessível.
    - Link "Pular para o conteúdo" e `main` com `id` no layout.
14. **Pastas vazias da estrutura** (`src/modules/`, `src/components/`, `e2e/`) criadas conforme o `CLAUDE.md`, só quando houver arquivo nelas.

## Fora de escopo

- Qualquer modelo de domínio (Goal, Track etc.) e qualquer migration.
- Utilitário de datas no fuso `America/Fortaleza`: entra na etapa 3, onde é usado, com testes próprios.
- Layout e navegação da aplicação (menu, rotas `goals/`, `tracks/` etc.).
- CI, Husky e hooks de pre-commit.
- Autenticação e deploy (já estão em Pendências).

## Mudanças no modelo de dados

Nenhuma. O `schema.prisma` fica só com `generator` e `datasource`.

## Versões (consultadas no npm em 2026-11-16)

| Pacote | Versão | Observação |
| --- | --- | --- |
| Node | 26.10.0 (instalado) | |
| next / create-next-app | 16.4.6 | |
| react / react-dom | 19.3.1 | |
| typescript | **6.0.3** | A 7.0.2 é a `latest`, mas o `typescript-eslint` (usado pelo `eslint-config-next`) só aceita `<6.1.0`. Fico na 6.0 até ele suportar a 7. |
| prisma / @prisma/client | **7.10.1** | A tag `latest` da CLI `prisma` aponta para uma RC (`8.0.0-rc.33`), provavelmente um erro de publicação. Fixo a 7.10.1, igual ao `@prisma/client`. |
| tailwindcss | 4.3.5 | |
| shadcn (CLI) | 4.23.0 | |
| zod | 4.6.7 | |
| vitest | 5.1.0 | |
| @playwright/test | 1.65.1 | |
| eslint | 10.15.0 | Se o `eslint-config-next` der problema com a 10, uso a versão que o `create-next-app` instalar. |
| prettier | 3.10.1 | |
| PostgreSQL (imagem) | `postgres:18` | |

Antes de escrever código de cada ferramenta, vou ler a documentação da versão instalada (principalmente Next 16, Prisma 7 e shadcn 4).

## Dependências extras que preciso que você aprove

Não estão na lista do `CLAUDE.md`, mas são exigidas pela stack:

| Pacote | Por quê |
| --- | --- |
| `@prisma/adapter-pg` + `pg` (+ `@types/pg`) | O Prisma 7 se conecta ao Postgres por um *driver adapter*; sem ele o cliente não conecta. |
| `dotenv` | O Prisma 7 não carrega mais o `.env` sozinho, e o Vitest precisa carregar o `.env.test`. |
| `tsx` | Executa o `prisma/seed.ts` (TypeScript) sem compilar antes. |
| `vite` | É dependência par (*peer*) obrigatória do Vitest 5. |
| `vite-tsconfig-paths` | Faz o alias `@/*` funcionar nos testes do Vitest. |
| `eslint-config-prettier` | Desliga as regras do ESLint que conflitam com o Prettier. |
| Dependências que o `shadcn init` instala (`clsx`, `tailwind-merge`, `class-variance-authority`, `lucide-react`, `tw-animate-css`) | Fazem parte do shadcn/ui, que já está aprovado. |

## Arquivos afetados (todos novos)

```
.gitignore
.env.example
.prettierrc / .prettierignore
docker-compose.yml
docker/postgres/init.sql
package.json / package-lock.json
tsconfig.json
next.config.ts
eslint.config.mjs
postcss.config.mjs
components.json
prisma.config.ts
prisma/schema.prisma
prisma/seed.ts
vitest.config.ts
playwright.config.ts
src/app/layout.tsx
src/app/page.tsx
src/app/globals.css
src/lib/db.ts
src/lib/utils.ts
src/lib/smoke.test.ts
src/lib/db.int.test.ts
e2e/home.spec.ts
docs/plans/000-scaffold.md
```

## Testes

| Tipo | Arquivo | O que verifica |
| --- | --- | --- |
| Unidade | `src/lib/smoke.test.ts` | Testa o `cn()` do shadcn (junta classes e resolve conflitos do Tailwind). É um teste real e barato, e prova que o Vitest e o alias `@/*` funcionam. |
| Integração | `src/lib/db.int.test.ts` | Com o `.env.test`, o cliente de `src/lib/db.ts` executa `SELECT 1` e o banco conectado é o `personal_management_test`, nunca o de dev. |
| E2E | `e2e/home.spec.ts` | Abre `/`, vê o título "Gestão Pessoal" e `lang="pt-BR"` no `<html>`; a página passa no axe; o botão de tema alterna para escuro. |
| E2E | `e2e/not-found.spec.ts` | Uma rota inexistente mostra a página "não encontrada" em pt-BR, com link de volta ao início. |

## Critério de pronto

- `docker compose up -d` sobe o banco, com os dois bancos criados.
- `npm run dev` abre a página inicial.
- `npm run lint`, `npm run typecheck`, `npm test` e `npm run test:e2e` passando.
- Commits atômicos na `chore/scaffold`, sem merge nem push.

## Decisões

1. Dependências extras aprovadas, incluindo `next-themes` e `@axe-core/playwright`.
2. Commit inicial na `main` com `CLAUDE.md`, `.gitignore` e este plano.
3. Porta 5432.
