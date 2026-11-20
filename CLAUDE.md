# Prumo

Aplicação web de uso pessoal para gerir objetivos, trilhas de desenvolvimento, rotina diária e ciclos de PDI (Plano de Desenvolvimento Individual) trazidos da empresa. Um único usuário, com login (e-mail e senha). Roda localmente ou num VPS com Docker (`docs/deploy.md`).

O dono do projeto vem de Python/Django e está aprendendo Next.js e TypeScript. Ao tomar uma decisão específica dessas tecnologias (Server vs Client Component, Server Action, tipagem não óbvia), explique o porquê em uma ou duas frases.

## Stack

- Next.js (App Router) + TypeScript em modo `strict`
- PostgreSQL em Docker Compose. A aplicação roda no host para desenvolver e testar, e também num contêiner local com o build de produção (mesma imagem do VPS), em `localhost:3200`, atrás do perfil `app` do Compose (plano 025)
- Prisma como ORM, com migrations versionadas
- Tailwind CSS + shadcn/ui
- Zod para validação, com o mesmo schema no formulário e no servidor
- Server Actions para mutações; Route Handlers só se houver consumidor externo ou download de arquivo (`/pdi/[id]/export`, plano 022)
- Vitest (unidade e integração) e Playwright (fluxos principais)
- ESLint + Prettier
- `next-themes` (tema claro/escuro) e `@axe-core/playwright` (verificação de acessibilidade nos e2e)

Dependências de suporte já aprovadas: `@prisma/adapter-pg`, `pg`, `@types/pg`, `dotenv`, `tsx`, `vite`, `eslint-config-prettier`, `semver` e `@types/semver` (comparação de versões no `check:versions`), `read-excel-file` (leitura da planilha de PDI) e `write-excel-file` (exportação do ciclo, planilha modelo e planilhas de teste; dependência de produção desde o plano 022) e as que o `shadcn` instala (`cn`, `class-variance-authority`, `lucide-react`, `tw-animate-css`, `radix-ui`, o próprio `shadcn` como devDependency por causa do `shadcn/tailwind.css`).

Versões fixadas por incompatibilidade: TypeScript 6.0 (o `typescript-eslint` ainda não aceita a 7), ESLint 9 (os plugins `react`, `jsx-a11y` e `import` do `eslint-config-next` ainda não aceitam a 10) e Prisma 7.10 (a tag `latest` aponta para a RC do Prisma 8). Rode `npm run check:versions` para saber se alguma já pode subir. Ao subir o Prisma, teste sem o `SerialClient` (`src/lib/db.ts`, plano 010); se o aviso de depreciação do `pg` não voltar, remova a classe. O projeto roda em Node 26 (`engines` e `.nvmrc`), com `@types/node` na mesma versão.

Scripts de instalação liberados no npm (`allowScripts` no `package.json`): `prisma`, `@prisma/engines` e `esbuild`. Ao atualizar um deles, o npm pede nova aprovação.

`overrides` no `package.json`: o `minimatch` do `@ts-morph/common` (usado pela CLI do `shadcn`) é forçado para `^11.0.1`, que corrige uma falha de negação de serviço (plano 012). Quando o `shadcn` passar a usar o `ts-morph` 28 ou mais novo, remova essa entrada. O `effect` do `@prisma/config` (CLI do Prisma) é forçado para `3.22.5`, que corrige um ReDoS (GHSA-7589-6fvf-x4pw, plano 023); quando o Prisma trouxer o `effect` 3.22.1 ou mais novo (ao subir para o Prisma 8, por exemplo), remova essa entrada. `npm audit` deve ficar em 0 avisos; nunca use `npm audit fix --force`.

Use as versões estáveis atuais no momento do scaffold e consulte a documentação da versão instalada antes de usar uma API do framework: não confie na memória para Next.js, Prisma ou shadcn/ui, porque mudam com frequência.

Não adicione dependências fora desta lista sem perguntar antes.

## Comandos

Estes scripts devem existir no `package.json` desde o scaffold:

| Comando                    | O que faz                                                                      |
| -------------------------- | ------------------------------------------------------------------------------ |
| `docker compose up -d`     | Sobe o PostgreSQL                                                              |
| `npm run dev`              | Servidor de desenvolvimento                                                    |
| `npm run lint`             | ESLint                                                                         |
| `npm run typecheck`        | `next typegen` + `tsc --noEmit`                                                |
| `npm run format`           | Prettier                                                                       |
| `npm test`                 | Vitest                                                                         |
| `npm run test:e2e`         | Playwright contra o build (bateria completa: só no CI ou quando o dono pedir)  |
| `npm run test:e2e:dev`     | Playwright contra o `next dev` (para iterar num spec: `-- e2e/<área>.spec.ts`) |
| `npx prisma migrate dev`   | Cria e aplica migration                                                        |
| `npx prisma db seed`       | Dados iniciais (categorias padrão)                                             |
| `npm run db:seed:demo`     | Dados de demonstração (banco vazio; `-- --reset` apaga tudo antes)             |
| `npm run check:versions`   | Diz se as versões fixadas (ver "Stack") já podem subir                         |
| `npm run pdi:template`     | Gera a planilha modelo de PDI e as planilhas dos e2e                           |
| `npm run auth:create-user` | Cria a conta única (ou troca a senha com `-- --reset-password`)                |
| `npm run container:up`     | Constrói a imagem de produção, aplica as migrations e sobe o app em `:3200`    |
| `npm run container:check`  | Confere se o app do contêiner responde (`/login` e o redirecionamento)         |
| `npm run container:down`   | Para o app do contêiner (o banco continua no ar)                               |

## Estrutura de pastas

```
src/
  app/                  rotas do App Router; só composição de UI e chamada de actions
    (app)/              telas que exigem login (grupo de rotas: não muda a URL)
      goals/  tracks/  routines/  pdi/  search/  deadlines/  settings/categories/  settings/account/
    (auth)/login/       tela de login
  proxy.ts              redireciona para /login quem chega sem o cookie de sessão
  components/           componentes da aplicação
  components/ui/        componentes do shadcn/ui
  modules/<dominio>/    um diretório por domínio: goals, tracks, routines, pdi, categories, auth, dashboard e search (só leitura)
    schemas.ts          schemas Zod
    service.ts          regras de negócio e acesso ao banco
    actions.ts          Server Actions (validam com Zod e chamam o service)
    *.test.ts           testes ao lado do código
  lib/                  db.ts (cliente Prisma), datas, utilitários
  demo/                 dados de demonstração (seed-demo.ts), testados contra o banco de teste
prisma/                 schema.prisma, migrations/, seed.ts, seed-demo.ts (linha de comando da demonstração)
deploy/                 Caddyfile e backup.sh do deploy (com Dockerfile e docker-compose.prod.yml na raiz)
e2e/                    testes Playwright
docs/plans/             planos de feature (ver Workflow)
```

Regras de negócio ficam em `service.ts`, nunca em componentes ou em `actions.ts`. Isso é o que permite testá-las sem a UI.

## Modelo de domínio

Nomes de entidades e campos em inglês no código. Os campos abaixo são o ponto de partida; mudanças no modelo passam por plano aprovado.

**Objetivos**

- `Goal`: title, description, status (`NOT_STARTED`, `IN_PROGRESS`, `DONE`, `ARCHIVED`), targetDate

**Trilhas**

- `Track`: title, description, goalId (opcional), archivedAt (opcional: arquivada, plano 024)
- `TrackStep`: trackId, title, order, status, dueDate, resourceUrl, notes

**Rotina**

- `Routine`: title, description, weekdays (dias da semana em que se aplica), timesPerWeek (opcional: meta semanal, plano 017), timeOfDay (opcional), startDate, endDate (opcional), goalId (opcional), pdiActionId (opcional)
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
- Uma rotina existente, sem vínculo e não encerrada, também pode ser vinculada pela página da ação, com a mesma regra da criação. Desvincular (na página da rotina ou da ação) mantém a rotina e os registros; ciclo encerrado não deixa desvincular (plano 020).
- Ao concluir ou cancelar uma ação com rotina vinculada, o usuário escolhe entre encerrar a rotina (preenche `endDate`) ou mantê-la sem vínculo.
- Mudar a categoria de uma ação ou desligar `allowsRoutine` não apaga rotinas já existentes; só bloqueia novas.
- A adesão que conta como evidência é a do período em que a rotina e o ciclo se sobrepõem, até hoje. Uma ação pode ter várias rotinas; ao encerrá-las pela conclusão da ação, a que ainda não começou é excluída (plano 005).
- Categoria arquivada não pode ser atribuída a novas ações. Categoria em uso não pode ser excluída, só arquivada.
- Ciclo com status `CLOSED` é somente leitura.
- **Ordem manual de áreas e ações** (plano 021): coluna `position` (1, 2, 3…, única por ciclo ou por área), mudada pelas setas da página do ciclo. Item novo vai para o fim; ação que troca de área vai para o fim da nova; excluir fecha o buraco. Só a página do ciclo segue essa ordem: as outras listas de ações (objetivo, painel) continuam por prazo.
- Etapas de trilha, ações de PDI e rotinas podem se vincular a um objetivo; o objetivo mostra o progresso agregado desses itens.
- **Trilha arquivada** (plano 024): somente leitura (`TrackArchivedError` no service; excluir e desarquivar continuam possíveis). Sai da lista padrão de trilhas (filtro `?situacao=`: Ativas, Não iniciadas, Em andamento, Concluídas, Arquivadas e Todas), de "Trilhas em andamento" e dos prazos do painel. Continua na página do objetivo, com o selo "Arquivada", e as etapas dela continuam contando no progresso do objetivo.
- **Duplicar trilha** (plano 026): `duplicateTrack` cria "Cópia de …" (`copyTitle`, cortado em 120 caracteres) com a mesma descrição, o mesmo objetivo e as etapas na mesma ordem, todas "Não iniciada" e sem prazo. Funciona também na trilha arquivada; a cópia nasce ativa.
- **Rotina com meta semanal** (plano 017): `timesPerWeek` de 1 a 6, em quaisquer dias de segunda a domingo; guarda os 7 dias em `weekdays`, então qualquer dia pode ser registrado. Não tem "pulado" (`SkipNotAllowedError`). A adesão é em dias-meta: a meta de cada semana vira os dias previstos (proporcional numa semana incompleta no começo ou no fim), feitos contam até a meta, e a semana atual só conta o que já foi feito. Trocar o tipo de uma rotina mantém os registros.
- **Sequência (streak) da rotina** (plano 019): calculada dos registros, sem coluna nova. Dias fixos contam dias previstos seguidos com "feito" (pulado ou previsto sem registro quebra; dia não previsto não conta; hoje sem registro não quebra). Meta semanal conta semanas seguidas com a meta cumprida (semana fechada abaixo da meta quebra; a atual só soma quando cumprida). Rotina encerrada só tem recorde. Fora da página da rotina, aparece a partir de 2.
- **Busca única** (`/search?q=`, plano 027): lupa no cabeçalho; procura o termo (2 a 100 caracteres) como trecho em objetivos, trilhas, etapas, rotinas, ciclos e ações de PDI, sem diferenciar maiúsculas nem acentos (extensão `unaccent`, SQL em `src/modules/search/service.ts` com o termo sempre como parâmetro e `%`/`_` escapados por `likePattern`). Até 20 por grupo, mais recentes primeiro; itens arquivados, encerrados ou de ciclo encerrado aparecem com selo.
- Datas de rotina e de registro são datas sem hora, no fuso `America/Fortaleza`. Nunca derive "hoje" de UTC.
- **Autenticação** (plano 014): uma conta só, criada pelo terminal (`npm run auth:create-user`); não há cadastro pela tela nem `userId` nas entidades. Senha com `scrypt` (mínimo de 12 caracteres); 5 senhas erradas seguidas bloqueiam a conta por 15 minutos; erro de login sempre genérico. Sessão no banco (tabela `sessions`, só o hash do token), 30 dias, renovada quando usada com menos de 15 dias restantes; trocar a senha encerra as outras sessões.
- **Importação de PDI por planilha** (`/pdi/import`, plano 013): sempre cria um ciclo novo; tudo ou nada (qualquer erro, nada é gravado, e a tela lista aba, linha e campo). Cada linha passa pelos mesmos schemas Zod dos formulários. Área e categoria das ações são identificadas pelo nome (sem diferenciar maiúsculas); categoria arquivada é recusada; ciclo `Ativo` com outro ativo também. Antes de gravar, a tela mostra uma prévia do que será criado; o navegador guarda o arquivo e o reenvia em "Confirmar importação", que valida tudo de novo (plano 022). As colunas ficam em `src/modules/pdi/import/sheets.ts`: ao mudá-las, rode `npm run pdi:template` e commite a planilha modelo e as planilhas dos e2e.
- **Exportação do ciclo** (`/pdi/[id]/export`, plano 022): planilha no mesmo formato da importação (áreas e ações na ordem manual), gerada por `exportCycle` com o mesmo `buildPdiWorkbook` da planilha modelo (`src/modules/pdi/export/workbook.ts`). Não leva vínculos com objetivos nem rotinas. Ciclo encerrado sai como "Encerrado", que a importação recusa.

## Workflow

1. **Plano antes do código.** Para cada feature, escreva um plano em `docs/plans/NNN-slug.md` com escopo, fora de escopo, mudanças no modelo de dados, arquivos afetados e lista de testes. Pare e aguarde aprovação explícita antes de implementar.
2. **TDD.** Escreva o teste, veja-o falhar, implemente o mínimo para passar, refatore. Regras de negócio são testadas no service contra um banco de teste separado (`.env.test`); fluxos de ponta a ponta, no Playwright.
3. **Branches.** Uma branch por feature a partir da `main` (`feat/goals-crud`, `fix/routine-log-date`). Nunca commite direto na `main`. Não faça merge nem push sem ser pedido.
4. **Commits.** Conventional Commits em inglês (`feat:`, `fix:`, `test:`, `refactor:`, `docs:`, `chore:`), pequenos e atômicos.
5. **Pronto significa:** `npm run lint`, `npm run typecheck` e `npm test` passando, migration incluída quando o schema mudou e plano atualizado se o escopo mudou durante a implementação. **E2E:** rode só os arquivos e2e da área mexida (`npm run test:e2e:dev -- e2e/<área>.spec.ts`), inclusive antes do merge. **Não rode a bateria completa** (`npm run test:e2e`): ela fica para o CI, quando houver remoto, ou para o dono do projeto rodar quando quiser. **Contêiner:** toda feature termina com `npm run container:up` e `npm run container:check` passando, com o resultado registrado no plano (plano 025). O build não roda no hook de pre-commit, porque leva minutos.
6. **Hook de pre-commit e CI.** Todo commit passa pelo `.githooks/pre-commit` (Prettier, lint, typecheck e testes de unidade), ligado pelo `npm install` (script `prepare`). Não pule o hook com `--no-verify`. O CI (`.github/workflows/ci.yml`) roda tudo, inclusive integração, e2e e `npm audit`, quando o projeto estiver no GitHub; se o `prisma.config.ts` passar a exigir outra variável de ambiente, ela precisa entrar no `env` do workflow.

Não implemente nada fora do plano aprovado. Se surgir uma melhoria ou um problema fora do escopo, anote em "Pendências" abaixo e siga.

## Convenções

- Interface em pt-BR; código, nomes de arquivos, rotas e commits em inglês.
- Server Components por padrão; `"use client"` só onde houver interatividade.
- Toda entrada de usuário é validada com Zod no servidor, mesmo que o formulário já valide.
- Sem `any` e sem `@ts-ignore`; se for inevitável, comente o motivo.
- Segredos só em `.env` (fora do git); mantenha `.env.example` atualizado.
- **Banco:** IDs em UUID v7 (`@default(uuid(7)) @db.Uuid`); nomes de tabelas, colunas e enums em snake_case no banco (`@@map`/`@map`), camelCase no TypeScript. Datas sem hora são colunas `@db.Date` e circulam na aplicação como string `AAAA-MM-DD` (conversão em `src/lib/dates.ts`, feita no service).
- **Testes de banco:** `npm test` (integração) e `npm run test:e2e` usam o mesmo banco `_test` e limpam os dados; não rode os dois ao mesmo tempo. Helpers em `src/test/test-database.ts` e, para testes que precisam de uma ação de PDI, `src/test/pdi-fixtures.ts`; o `resetDatabase` dos e2e recria as categorias padrão. O Playwright roda com 1 worker pelo mesmo motivo; helpers de e2e em `e2e/helpers.ts`. **Dados de preparação dos e2e** vêm de `e2e/factories.ts` (SQL direto no banco de teste, plano 018) e o teste abre a página pela URL; a criação pela tela fica só nos testes que provam o formulário. Ao mudar uma coluna do schema, atualize a factory: `src/test/e2e-factories.int.test.ts` falha se ela ficar para trás.
- **Prisma 7:** depois de `npx prisma migrate dev`, rode `npx prisma generate` (o `migrate dev` não gera mais o cliente).
- **Reaproveite antes de criar:** campos Zod em `src/lib/form-fields.ts`; erros do Prisma (P2025, P2002, P2003) em `src/lib/prisma-errors.ts`; formulários com o hook `src/components/forms/use-schema-form.ts` + `FormActions` (opção `readForm` para campos repetidos, como grupos de checkbox); opções de objetivo e de categoria dos formulários em `src/modules/goals/options.ts` e `src/modules/categories/options.ts`; aviso de somente leitura no lugar de um formulário com `ClosedCycleNotice` (PDI) e `ArchivedTrackNotice` (trilhas); exclusão com `ConfirmDeleteButton` e outras confirmações com `ConfirmActionButton` (`triggerAriaLabel` quando o botão se repete numa lista); botões de form com `SubmitButton`; regras puras de rotina (dia previsto, estado, adesão, período de evidência, calendário do mês com `monthCalendar`, `monthRange` e `parseMonth`, meta semanal com `weekProgress`, sequência com `routineStreak`) em `src/modules/routines/rules.ts`, que não acessa o banco e pode ser importado pelos services de rotinas e de PDI sem importação circular; "esta ação aceita rotina?" com `routineBlocker` (`src/modules/pdi/service.ts`); diferença em dias entre datas com `daysBetween` e segunda-feira da semana com `mondayOf` (`src/lib/dates.ts`); item de prazo com `DeadlineItem`; esvaziar todas as tabelas com `truncateStatement` (`src/lib/truncate.ts`); fechar o buraco numa lista com ordem manual com `closeGap` (`src/lib/positions.ts`) e as setas de reordenar com `MoveButtons`; blocos do painel com `DashboardCard` e `EmptyCardText`; abas Trilhas | PDI com `DevelopmentTabs`; calendário mensal da rotina com `RoutineCalendar` (mês na URL, `?mes=AAAA-MM`); marca com `BrandMark`; estado concluído com a variante `success` do `Badge` (a única cor além do vermelho de atraso).
- **Sessão:** toda Server Action começa com `await requireSession()` (`src/modules/auth/session.ts`), porque uma action pode ser chamada sem passar pela tela. Toda página nova vai dentro de `src/app/(app)/`, cujo layout valida a sessão (num componente dentro de `<Suspense>`) antes de renderizar a página. Os e2e já começam logados (cookie da conta de teste no `playwright.config.ts`, conta recriada pelo `resetDatabase`); para testar sem login, use `test.use({ storageState: { cookies: [], origins: [] } })`.
- **Menu principal:** Hoje, Objetivos, Desenvolvimento e Rotinas (plano 015). Trilhas e PDI ficam juntos em Desenvolvimento, com as abas `DevelopmentTabs` no topo das duas listas; as URLs continuam `/tracks` e `/pdi`. Um item do `MainNav` fica marcado para todos os prefixos em `sections`.
- **Painel inicial:** `/` mostra dados de todos os módulos via `getDashboard` (`src/modules/dashboard/service.ts`). Toda Server Action que muda dados deve revalidar também `/` (cada módulo tem sua função `revalidate…Screens`).
- **Tela de prazos** (`/deadlines`, plano 028): aberta por "Ver todos os prazos" no bloco Prazos do painel, fora do menu. Usa o mesmo `listDeadlines` do painel (etapas de trilhas ativas, ações de ciclos não encerrados e objetivos não iniciados ou em andamento), agrupado por `groupDeadlinesByWeek`: atrasados sempre primeiro, depois por semana (segunda a domingo). Filtros `?periodo=` (7, 30 padrão, 90, all) e `?tipo=` (STEP, ACTION, GOAL); sem limite de itens.

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

Nenhuma no momento.

Melhorias deixadas fora de escopo ficam registradas na seção "Fora de escopo" de cada plano em `docs/plans/`.
