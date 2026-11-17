# Prumo

Aplicação web de uso pessoal para gerir objetivos, trilhas de desenvolvimento, rotina diária e ciclos de PDI (Plano de Desenvolvimento Individual) trazidos da empresa. Um único usuário, rodando localmente.

O dono do projeto vem de Python/Django e está aprendendo Next.js e TypeScript. Ao tomar uma decisão específica dessas tecnologias (Server vs Client Component, Server Action, tipagem não óbvia), explique o porquê em uma ou duas frases.

## Stack

- Next.js (App Router) + TypeScript em modo `strict`
- PostgreSQL em Docker Compose (só o banco no contêiner; a aplicação roda no host)
- Prisma como ORM, com migrations versionadas
- Tailwind CSS + shadcn/ui
- Zod para validação, com o mesmo schema no formulário e no servidor
- Server Actions para mutações; Route Handlers só se houver consumidor externo
- Vitest (unidade e integração) e Playwright (fluxos principais)
- ESLint + Prettier
- `next-themes` (tema claro/escuro) e `@axe-core/playwright` (verificação de acessibilidade nos e2e)

Dependências de suporte já aprovadas: `@prisma/adapter-pg`, `pg`, `@types/pg`, `dotenv`, `tsx`, `vite`, `eslint-config-prettier`, `semver` e `@types/semver` (comparação de versões no `check:versions`) e as que o `shadcn` instala (`cn`, `class-variance-authority`, `lucide-react`, `tw-animate-css`, `radix-ui`, o próprio `shadcn` como devDependency por causa do `shadcn/tailwind.css`).

Versões fixadas por incompatibilidade: TypeScript 6.0 (o `typescript-eslint` ainda não aceita a 7), ESLint 9 (os plugins `react`, `jsx-a11y` e `import` do `eslint-config-next` ainda não aceitam a 10) e Prisma 7.10 (a tag `latest` aponta para a RC do Prisma 8). Rode `npm run check:versions` para saber se alguma já pode subir. Ao subir o Prisma, teste sem o `SerialClient` (`src/lib/db.ts`, plano 010); se o aviso de depreciação do `pg` não voltar, remova a classe. O projeto roda em Node 26 (`engines` e `.nvmrc`), com `@types/node` na mesma versão.

Scripts de instalação liberados no npm (`allowScripts` no `package.json`): `prisma`, `@prisma/engines` e `esbuild`. Ao atualizar um deles, o npm pede nova aprovação.

Use as versões estáveis atuais no momento do scaffold e consulte a documentação da versão instalada antes de usar uma API do framework: não confie na memória para Next.js, Prisma ou shadcn/ui, porque mudam com frequência.

Não adicione dependências fora desta lista sem perguntar antes.

## Comandos

Estes scripts devem existir no `package.json` desde o scaffold:

| Comando                  | O que faz                                                          |
| ------------------------ | ------------------------------------------------------------------ |
| `docker compose up -d`   | Sobe o PostgreSQL                                                  |
| `npm run dev`            | Servidor de desenvolvimento                                        |
| `npm run lint`           | ESLint                                                             |
| `npm run typecheck`      | `next typegen` + `tsc --noEmit`                                    |
| `npm run format`         | Prettier                                                           |
| `npm test`               | Vitest                                                             |
| `npm run test:e2e`       | Playwright                                                         |
| `npx prisma migrate dev` | Cria e aplica migration                                            |
| `npx prisma db seed`     | Dados iniciais (categorias padrão)                                 |
| `npm run db:seed:demo`   | Dados de demonstração (banco vazio; `-- --reset` apaga tudo antes) |
| `npm run check:versions` | Diz se as versões fixadas (ver "Stack") já podem subir             |

## Estrutura de pastas

```
src/
  app/                  rotas do App Router; só composição de UI e chamada de actions
    goals/  tracks/  routines/  pdi/  settings/categories/
  components/           componentes da aplicação
  components/ui/        componentes do shadcn/ui
  modules/<dominio>/    um diretório por domínio: goals, tracks, routines, pdi, categories, dashboard (só leitura)
    schemas.ts          schemas Zod
    service.ts          regras de negócio e acesso ao banco
    actions.ts          Server Actions (validam com Zod e chamam o service)
    *.test.ts           testes ao lado do código
  lib/                  db.ts (cliente Prisma), datas, utilitários
  demo/                 dados de demonstração (seed-demo.ts), testados contra o banco de teste
prisma/                 schema.prisma, migrations/, seed.ts, seed-demo.ts (linha de comando da demonstração)
e2e/                    testes Playwright
docs/plans/             planos de feature (ver Workflow)
```

Regras de negócio ficam em `service.ts`, nunca em componentes ou em `actions.ts`. Isso é o que permite testá-las sem a UI.

## Modelo de domínio

Nomes de entidades e campos em inglês no código. Os campos abaixo são o ponto de partida; mudanças no modelo passam por plano aprovado.

**Objetivos**

- `Goal`: title, description, status (`NOT_STARTED`, `IN_PROGRESS`, `DONE`, `ARCHIVED`), targetDate

**Trilhas**

- `Track`: title, description, goalId (opcional)
- `TrackStep`: trackId, title, order, status, dueDate, resourceUrl, notes

**Rotina**

- `Routine`: title, description, weekdays (dias da semana em que se aplica), timeOfDay (opcional), startDate, endDate (opcional), goalId (opcional), pdiActionId (opcional)
- `RoutineLog`: routineId, date, status (`DONE`, `SKIPPED`), note. Único por (routineId, date)

**PDI**

- `PdiCycle`: title, startDate, endDate, status (`PLANNED`, `ACTIVE`, `CLOSED`), managerName, careerObjective, selfAssessment, managerFeedback, finalRating (opcional)
- `PdiArea` (área de desenvolvimento ou competência): cycleId, name, description, expectedOutcome
- `ActionCategory`: name, allowsRoutine (boolean), archived (boolean)
- `PdiAction`: areaId, categoryId, title, description, expectedResult, dueDate, status (`NOT_STARTED`, `IN_PROGRESS`, `DONE`, `CANCELLED`), evidence, managerComment, goalId (opcional)
- `PdiCheckIn`: cycleId, date, summary, nextSteps, managerNotes

Os campos de `PdiCycle`, `PdiArea`, `PdiAction` e `PdiCheckIn` foram validados pelo dono do projeto contra o formulário da empresa (plano 004).

## Regras de negócio

- Categorias de ação são um cadastro gerenciado pelo usuário (criar, editar, arquivar). O seed cria: "Prática" (`allowsRoutine = true`), "Curso", "Leitura" e "Mentoria" (`allowsRoutine = false`).
- Nenhum comportamento depende do nome da categoria. O que libera a criação de rotina é `allowsRoutine`.
- Só é possível criar uma rotina a partir de uma ação de PDI se a categoria dela tiver `allowsRoutine = true`. A regra é validada no service, não só escondendo o botão.
- A rotina criada a partir de uma ação fica vinculada por `pdiActionId`. Os registros (`RoutineLog`) aparecem na ação como evidência, com a taxa de adesão no período.
- Ao concluir ou cancelar uma ação com rotina vinculada, o usuário escolhe entre encerrar a rotina (preenche `endDate`) ou mantê-la sem vínculo.
- Mudar a categoria de uma ação ou desligar `allowsRoutine` não apaga rotinas já existentes; só bloqueia novas.
- A adesão que conta como evidência é a do período em que a rotina e o ciclo se sobrepõem, até hoje. Uma ação pode ter várias rotinas; ao encerrá-las pela conclusão da ação, a que ainda não começou é excluída (plano 005).
- Categoria arquivada não pode ser atribuída a novas ações. Categoria em uso não pode ser excluída, só arquivada.
- Ciclo com status `CLOSED` é somente leitura.
- Etapas de trilha, ações de PDI e rotinas podem se vincular a um objetivo; o objetivo mostra o progresso agregado desses itens.
- Datas de rotina e de registro são datas sem hora, no fuso `America/Fortaleza`. Nunca derive "hoje" de UTC.

## Workflow

1. **Plano antes do código.** Para cada feature, escreva um plano em `docs/plans/NNN-slug.md` com escopo, fora de escopo, mudanças no modelo de dados, arquivos afetados e lista de testes. Pare e aguarde aprovação explícita antes de implementar.
2. **TDD.** Escreva o teste, veja-o falhar, implemente o mínimo para passar, refatore. Regras de negócio são testadas no service contra um banco de teste separado (`.env.test`); fluxos de ponta a ponta, no Playwright.
3. **Branches.** Uma branch por feature a partir da `main` (`feat/goals-crud`, `fix/routine-log-date`). Nunca commite direto na `main`. Não faça merge nem push sem ser pedido.
4. **Commits.** Conventional Commits em inglês (`feat:`, `fix:`, `test:`, `refactor:`, `docs:`, `chore:`), pequenos e atômicos.
5. **Pronto significa:** `npm run lint`, `npm run typecheck` e `npm test` passando, migration incluída quando o schema mudou e plano atualizado se o escopo mudou durante a implementação.

Não implemente nada fora do plano aprovado. Se surgir uma melhoria ou um problema fora do escopo, anote em "Pendências" abaixo e siga.

## Convenções

- Interface em pt-BR; código, nomes de arquivos, rotas e commits em inglês.
- Server Components por padrão; `"use client"` só onde houver interatividade.
- Toda entrada de usuário é validada com Zod no servidor, mesmo que o formulário já valide.
- Sem `any` e sem `@ts-ignore`; se for inevitável, comente o motivo.
- Segredos só em `.env` (fora do git); mantenha `.env.example` atualizado.
- **Banco:** IDs em UUID v7 (`@default(uuid(7)) @db.Uuid`); nomes de tabelas, colunas e enums em snake_case no banco (`@@map`/`@map`), camelCase no TypeScript. Datas sem hora são colunas `@db.Date` e circulam na aplicação como string `AAAA-MM-DD` (conversão em `src/lib/dates.ts`, feita no service).
- **Testes de banco:** `npm test` (integração) e `npm run test:e2e` usam o mesmo banco `_test` e limpam os dados; não rode os dois ao mesmo tempo. Helpers em `src/test/test-database.ts` e, para testes que precisam de uma ação de PDI, `src/test/pdi-fixtures.ts`; o `resetDatabase` dos e2e recria as categorias padrão. O Playwright roda com 1 worker pelo mesmo motivo; helpers de e2e em `e2e/helpers.ts`.
- **Prisma 7:** depois de `npx prisma migrate dev`, rode `npx prisma generate` (o `migrate dev` não gera mais o cliente).
- **Reaproveite antes de criar:** campos Zod em `src/lib/form-fields.ts`; erros do Prisma (P2025, P2002, P2003) em `src/lib/prisma-errors.ts`; formulários com o hook `src/components/forms/use-schema-form.ts` + `FormActions` (opção `readForm` para campos repetidos, como grupos de checkbox); opções de objetivo e de categoria dos formulários em `src/modules/goals/options.ts` e `src/modules/categories/options.ts`; exclusão com `ConfirmDeleteButton` e outras confirmações com `ConfirmActionButton`; botões de form com `SubmitButton`; regras puras de rotina (dia previsto, estado, adesão, período de evidência) em `src/modules/routines/rules.ts`, que não acessa o banco e pode ser importado pelos services de rotinas e de PDI sem importação circular; "esta ação aceita rotina?" com `routineBlocker` (`src/modules/pdi/service.ts`); diferença em dias entre datas com `daysBetween` (`src/lib/dates.ts`); esvaziar todas as tabelas com `truncateStatement` (`src/lib/truncate.ts`); blocos do painel com `DashboardCard` e `EmptyCardText`; marca com `BrandMark`; estado concluído com a variante `success` do `Badge` (a única cor além do vermelho de atraso).
- **Painel inicial:** `/` mostra dados de todos os módulos via `getDashboard` (`src/modules/dashboard/service.ts`). Toda Server Action que muda dados deve revalidar também `/` (cada módulo tem sua função `revalidate…Screens`).

### Front-end

- **Acessibilidade:** HTML semântico (`main`, `nav`, títulos em ordem, `button` para ação e `a` para navegação); todo campo com `label` e erro ligado por `aria-describedby`; navegação completa por teclado com foco visível; contraste WCAG AA. Regras `jsx-a11y` do ESLint ativas.
- **Estados de tela:** toda rota trata carregamento (`loading.tsx`/`Suspense`), erro (`error.tsx`) e não encontrado (`not-found.tsx`). Lista vazia mostra mensagem com a próxima ação.
- **Formulários:** mesmo schema Zod no cliente e no servidor; erros do servidor por campo via `useActionState`; botão desabilitado com indicação durante o envio; confirmação antes de ação destrutiva.
- **Desempenho:** Server Components por padrão, `"use client"` no menor componente possível; `next/font` e `next/image`; nada de buscar dados no cliente quando o servidor pode entregar pronto.
- **Responsivo e consistente:** mobile-first; cores, espaçamentos e raios só pelos tokens do tema (Tailwind/shadcn), sem valores arbitrários soltos. Tema claro/escuro via `next-themes`.
- **Testes:** no Playwright, localize por papel e nome acessível (`getByRole`); cada página principal passa na verificação do axe (espere o `h1` antes, para não analisar o "Carregando…"). `e2e/mobile.spec.ts` confere o cabeçalho e a ausência de rolagem horizontal em 375 e 320 px; página nova entra na lista `PAGES` dele.
- **Cache Components / Activity (Next 16):** leitura de `params`, `searchParams`, `usePathname()` ou do banco precisa estar dentro de `<Suspense>` ou de uma rota com `loading.tsx` (inclusive rotas filhas, como `[id]/edit`). O Next mantém as últimas páginas visitadas escondidas no DOM: use `useId` para `id`s de campos, feche diálogos e limpe formulários já enviados num cleanup de `useLayoutEffect`, e nunca use `getByLabel` nos e2e (ele acha elementos escondidos).

## Roteiro

0. Scaffold, ferramentas, banco no Docker, um teste de fumaça de cada tipo
1. Objetivos
2. Trilhas e etapas
3. Rotinas e registro diário (tela "Hoje")
4. Categorias de ação e ciclos de PDI
5. Criação de rotina a partir de ação de PDI
6. Painel inicial com visão consolidada

## Pendências

- **Autenticação.** Hoje não há login nem tabela de usuário, porque a aplicação roda só na máquina do dono. É obrigatória antes de qualquer deploy fora dela; vai exigir adicionar `userId` às entidades por migration.
- **Deploy.** Ainda não definido (roda só localmente).
- **Importação de PDI por arquivo.** Fora de escopo por enquanto; o cadastro é manual.
- **`npm audit`.** Em 2026-11-16: 10 avisos moderados, todos em ferramentas de desenvolvimento (via `minimatch`). Não usar `npm audit fix --force`, que faz downgrade de pacotes.
- **CI e hooks de pre-commit.** Lint, typecheck e testes só rodam à mão; ficaram fora do scaffold (plano 000).
