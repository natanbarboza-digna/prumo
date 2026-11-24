# Prumo

Aplicação web de uso pessoal para gerir objetivos, trilhas de desenvolvimento, rotina diária e ciclos de PDI (Plano de Desenvolvimento Individual) trazidos da empresa. Um único usuário, com login (e-mail e senha). Roda localmente ou num VPS com Docker (`docs/deploy.md`): sem domínio, pelo IP em HTTP só com `docker-compose.prod.yml`; com domínio, somando `docker-compose.caddy.yml`, que põe o Caddy na frente com HTTPS (plano 039).

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
| `npm run check:commits`    | Confere as mensagens de um intervalo de commits (`-- main~5..main`)            |
| `npm run container:up`     | Constrói a imagem de produção, aplica as migrations e sobe o app em `:3200`    |
| `npm run container:check`  | Confere se o app do contêiner responde (`/login` e o redirecionamento)         |
| `npm run container:down`   | Para o app do contêiner (o banco continua no ar)                               |

## Estrutura de pastas

```
src/
  app/                  rotas do App Router; só composição de UI e chamada de actions
    (app)/              telas que exigem login (grupo de rotas: não muda a URL)
      goals/  tracks/  routines/  pdi/  books/  time/  search/  deadlines/  settings/categories/  settings/account/
    (auth)/login/       tela de login
  proxy.ts              redireciona para /login quem chega sem o cookie de sessão
  components/           componentes da aplicação
  components/ui/        componentes do shadcn/ui
  modules/<dominio>/    um diretório por domínio: goals, tracks, routines, pdi, books, time, categories, auth, dashboard e search (só leitura)
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

**Leituras** (plano 035)

- `Book`: title, authors, format (`PHYSICAL`, `EBOOK`, `AUDIOBOOK`), pages, genre, recommendedBy, notes, status (`TO_READ`, `READING`, `READ`, `ABANDONED`), reason (`PERSONAL`, `RECOMMENDATION`, `WORK`, `PDI`), dueDate (só para `WORK` e `PDI`), startedOn, finishedOn, goalId (opcional); durationMinutes (audiolivro), rating (1 a 5, só lido) e review (plano 036)
- `BookLog`: bookId, date, position (página, porcentagem ou minutos, conforme o formato). Único por (bookId, date)
- `BookQuote`: bookId, text, location (opcional)
- `ReadingGoal`: year (único), books (plano 037)

**Tempo** (plano 031)

- `TimeDay`: date (única), startMinute, endMinute (opcional: dia em aberto), slotMinutes (15, 30 ou 60, escolhido ao começar o dia)
- `TimeEntry`: dayId, startMinute, minutes, kind (`WORK`, `BREAK`), description, categoryId (obrigatório em `WORK`, nulo em `BREAK`), projectId (opcional). Único por (dayId, startMinute)
- `TimeCategory`: name, archived. `TimeProject`: name, archived
- Horas do dia ficam no banco como minutos desde a meia-noite e circulam como `"HH:MM"` (`src/lib/time-of-day.ts`).

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
- Etapas de trilha, ações de PDI, rotinas e livros podem se vincular a um objetivo; o objetivo mostra o progresso agregado desses itens (livro lido conta como concluído; abandonado fica fora, como ação cancelada).
- **Biblioteca de livros** (`/books`, plano 035): "preciso ler" é o livro na fila (`TO_READ`) com motivo Trabalho ou PDI (`isRequired`), que pode ter prazo; "quero ler" é o da fila com motivo Vontade própria ou Indicação. A situação muda pelos botões da página do livro (`bookActions` e `applyBookAction` em `src/modules/books/rules.ts`), que preenchem início e término; o formulário não tem situação e só guarda as datas que ela permite (`datesForStatus`). Datas no futuro são recusadas no service. Lista agrupada por `groupBooks` (Lendo, Preciso ler, Quero ler, Lidos, Abandonados) com o filtro `?situacao=` (SHELF padrão, READING, REQUIRED, WANTED, READ, ABANDONED, ALL). Livro obrigatório na fila ou lendo, com prazo, entra nos Prazos.
- **Progresso de leitura** (plano 036): o registro guarda onde parei (página no físico, porcentagem no e-book, tempo ouvido em HH:MM no audiolivro), um por dia (de novo no mesmo dia substitui), só em livro lendo, da data de início até hoje, entre os registros dos dias vizinhos e até o total. Progresso, ritmo dos últimos 14 dias e previsão de término contam só a leitura atual (registros desde `startedOn`; ler de novo recomeça). Livro com registros não troca de formato, e o total não fica abaixo da maior posição. Nota só para lido; resenha para lido e abandonado; trechos em qualquer situação.
- **Meta e analíticos de leitura** (`/books/analytics?ano=`, plano 037): meta de livros por ano (1 a 365), contando os lidos com término no ano; no ano atual, comparada com a parte da meta que os dias pedem (`goalProgress`). Analíticos por ano em `readingAnalytics` (`src/modules/books/analytics.ts`, puro): lidos por mês, páginas das últimas 12 semanas, páginas e horas do ano pelos registros (`dailyAmounts`: e-book convertido pelas páginas, posição que volta conta do zero), tempo médio por livro (início e término contando os dois dias), 5 autores e 5 gêneros sem diferenciar maiúsculas e acentos, nota média. O painel mostra o bloco "Leitura do ano" (meta e até 3 livros lendo) quando há livro ou meta.
- **Trilha arquivada** (plano 024): somente leitura (`TrackArchivedError` no service; excluir e desarquivar continuam possíveis). Sai da lista padrão de trilhas (filtro `?situacao=`: Ativas, Não iniciadas, Em andamento, Concluídas, Arquivadas e Todas), de "Trilhas em andamento" e dos prazos do painel. Continua na página do objetivo, com o selo "Arquivada", e as etapas dela continuam contando no progresso do objetivo.
- **Duplicar trilha** (plano 026): `duplicateTrack` cria "Cópia de …" (`copyTitle`, cortado em 120 caracteres) com a mesma descrição, o mesmo objetivo e as etapas na mesma ordem, todas "Não iniciada" e sem prazo. Funciona também na trilha arquivada; a cópia nasce ativa.
- **Rotina com meta semanal** (plano 017): `timesPerWeek` de 1 a 6, em quaisquer dias de segunda a domingo; guarda os 7 dias em `weekdays`, então qualquer dia pode ser registrado. Não tem "pulado" (`SkipNotAllowedError`). A adesão é em dias-meta: a meta de cada semana vira os dias previstos (proporcional numa semana incompleta no começo ou no fim), feitos contam até a meta, e a semana atual só conta o que já foi feito. Trocar o tipo de uma rotina mantém os registros.
- **Sequência (streak) da rotina** (plano 019): calculada dos registros, sem coluna nova. Dias fixos contam dias previstos seguidos com "feito" (pulado ou previsto sem registro quebra; dia não previsto não conta; hoje sem registro não quebra). Meta semanal conta semanas seguidas com a meta cumprida (semana fechada abaixo da meta quebra; a atual só soma quando cumprida). Rotina encerrada só tem recorde. Fora da página da rotina, aparece a partir de 2.
- **Busca única** (`/search?q=`, plano 027): lupa no cabeçalho; procura o termo (2 a 100 caracteres) como trecho em objetivos, trilhas, etapas, rotinas, ciclos e ações de PDI e livros (título e autores), sem diferenciar maiúsculas nem acentos (extensão `unaccent`, SQL em `src/modules/search/service.ts` com o termo sempre como parâmetro e `%`/`_` escapados por `likePattern`). Até 20 por grupo, mais recentes primeiro; itens arquivados, encerrados ou de ciclo encerrado aparecem com selo.
- **Gestão de tempo** (`/time`, plano 031): o dia começa com a hora de entrada e a duração dos blocos; os blocos se alinham ao relógio (entrada ou saída fora da grade geram um bloco curto) e, com o dia de hoje em aberto, vão até o bloco atual. Cada bloco é trabalho (texto, categoria obrigatória, projeto opcional criado pelo nome ao salvar, sem diferenciar maiúsculas), pausa ou vazio, e pode ser dividido em duas metades iguais. Corrigir entrada e saída é recusado se algum registro ficar de fora. Dias futuros não podem ser registrados. Categoria arquivada ou projeto arquivado não recebem registros novos; categoria em uso só pode ser arquivada. O seed cria as categorias de tempo Atendimento, Chamados, Projeto, Reunião e Estudo.
- **Analíticos de tempo** (`/time/analytics`, plano 032): período (`?periodo=` thisWeek padrão, lastWeek, thisMonth, lastMonth, last30, custom com `?de=` e `?ate=`) e filtros `?categoria=` e `?projeto=` (`none` = sem projeto), lidos por `analyticsQuery`; contas puras em `computeAnalytics` (`src/modules/time/analytics.ts`). Os filtros valem só para os blocos de trabalho; presença, pausas e sem registro são do dia inteiro. Atividades agrupadas pelo texto normalizado (`normalizeActivity`: sem maiúsculas, acentos e espaços extras). Troca de assunto: bloco de trabalho com texto normalizado ou projeto diferente do bloco de trabalho anterior do dia; pausas e vazios não contam nem zeram a comparação.
- **Importação do histórico de tempo** (`/time/import`, plano 033): cola-se o texto do `.md` (`**DD/MM**` ou `DD/MM`, e linhas `HH:MM - texto`, cada uma valendo até a linha seguinte), com o ano, a duração dos blocos, a categoria padrão e regras `palavra = Nome` de categoria e de projeto (contém a palavra, sem diferenciar maiúsculas nem acentos; a primeira vence; as regras ficam guardadas no navegador). Primeira linha "cheguei" (e variações) vira a entrada; última "fim do expediente" (e variações) vira a saída; "almoço", "pausa", "intervalo" e "café" viram pausa. Cada trecho, cortado nos blocos, precisa ser bloco inteiro ou meio bloco. Prévia antes de gravar, tudo ou nada (dia já registrado, dia futuro, data repetida, horário fora de ordem ou da grade, categoria inexistente ou arquivada e projeto arquivado recusam a importação inteira). Leitura em `src/modules/time/import/parse.ts` (pura) e conferência e gravação em `service.ts`.
- Datas de rotina e de registro são datas sem hora, no fuso `America/Fortaleza`. Nunca derive "hoje" de UTC.
- **Autenticação** (plano 014): uma conta só, criada pelo terminal (`npm run auth:create-user`); não há cadastro pela tela nem `userId` nas entidades. Senha com `scrypt` (mínimo de 12 caracteres); 5 senhas erradas seguidas bloqueiam a conta por 15 minutos; erro de login sempre genérico. Sessão no banco (tabela `sessions`, só o hash do token), 30 dias, renovada quando usada com menos de 15 dias restantes; trocar a senha encerra as outras sessões.
- **Importação de PDI por planilha** (`/pdi/import`, plano 013): sempre cria um ciclo novo; tudo ou nada (qualquer erro, nada é gravado, e a tela lista aba, linha e campo). Cada linha passa pelos mesmos schemas Zod dos formulários. Área e categoria das ações são identificadas pelo nome (sem diferenciar maiúsculas); categoria arquivada é recusada; ciclo `Ativo` com outro ativo também. Antes de gravar, a tela mostra uma prévia do que será criado; o navegador guarda o arquivo e o reenvia em "Confirmar importação", que valida tudo de novo (plano 022). As colunas ficam em `src/modules/pdi/import/sheets.ts`: ao mudá-las, rode `npm run pdi:template` e commite a planilha modelo e as planilhas dos e2e.
- **Exportação do ciclo** (`/pdi/[id]/export`, plano 022): planilha no mesmo formato da importação (áreas e ações na ordem manual), gerada por `exportCycle` com o mesmo `buildPdiWorkbook` da planilha modelo (`src/modules/pdi/export/workbook.ts`). Não leva vínculos com objetivos nem rotinas. Ciclo encerrado sai como "Encerrado", que a importação recusa.

## Workflow

1. **Plano antes do código.** Para cada feature, escreva um plano em `docs/plans/NNN-slug.md` com escopo, fora de escopo, mudanças no modelo de dados, arquivos afetados e lista de testes. Pare e aguarde aprovação explícita antes de implementar.
2. **TDD.** Escreva o teste, veja-o falhar, implemente o mínimo para passar, refatore. Regras de negócio são testadas no service contra um banco de teste separado (`.env.test`); fluxos de ponta a ponta, no Playwright.
3. **Branches.** Uma branch por feature a partir da `main` (`feat/goals-crud`, `fix/routine-log-date`). Nunca commite direto na `main`. Não faça merge nem push sem ser pedido.
4. **Commits.** Conventional Commits em inglês (`feat:`, `fix:`, `test:`, `refactor:`, `docs:`, `chore:`; também valem `ci`, `build`, `perf`, `style` e `revert`), pequenos e atômicos. Primeira linha `tipo(escopo opcional): descrição`, com a descrição em minúscula, sem ponto final e até 72 caracteres, e linha em branco antes do corpo. O hook `commit-msg` confere (regra em `src/lib/commit-message.ts`, plano 030); `npm run check:commits -- <intervalo>` confere vários commits.
5. **Pronto significa:** `npm run lint`, `npm run typecheck` e `npm test` passando, migration incluída quando o schema mudou e plano atualizado se o escopo mudou durante a implementação. **E2E:** rode só os arquivos e2e da área mexida (`npm run test:e2e:dev -- e2e/<área>.spec.ts`), inclusive antes do merge. **Não rode a bateria completa** (`npm run test:e2e`): ela fica para o CI, quando houver remoto, ou para o dono do projeto rodar quando quiser. **Contêiner:** toda feature termina com `npm run container:up` e `npm run container:check` passando, com o resultado registrado no plano (plano 025). O build não roda no hook de pre-commit, porque leva minutos.
6. **Hooks e CI.** Todo commit passa pelo `.githooks/pre-commit` (Prettier) e pelo `.githooks/commit-msg` (mensagem, depois lint, typecheck e testes de unidade); todo push, pelo `.githooks/pre-push` (`npm test` completo, que precisa do banco, e `npm audit`). **Commits `docs` e `chore` sem código** (plano 038) pulam lint, typecheck e testes, no commit, no push (quando todos os commits enviados são assim) e no CI; mensagem, Prettier e `npm audit` rodam sempre. Mexer em `package.json`, `package-lock.json`, `prisma/`, `src/`, `e2e/` ou `scripts/` roda tudo mesmo em `docs`/`chore`. A regra fica em `src/lib/hook-scope.ts` e é aplicada por `scripts/hook-scope.ts`. Os três são ligados pelo `npm install` (script `prepare`). Não pule o hook com `--no-verify`. O CI (`.github/workflows/ci.yml`, no GitHub) roda as mensagens de commit, integração, e2e e `npm audit`, com o job "Escopo" decidindo o que pular pela mesma regra; se o `prisma.config.ts` passar a exigir outra variável de ambiente, ela precisa entrar no `env` do workflow.

Não implemente nada fora do plano aprovado. Se surgir uma melhoria ou um problema fora do escopo, anote em "Pendências" abaixo e siga.

## Convenções

- Interface em pt-BR; código, nomes de arquivos, rotas e commits em inglês.
- Server Components por padrão; `"use client"` só onde houver interatividade.
- Toda entrada de usuário é validada com Zod no servidor, mesmo que o formulário já valide.
- Sem `any` e sem `@ts-ignore`; se for inevitável, comente o motivo.
- Segredos só em `.env` (fora do git); mantenha `.env.example` e `.env.production.example` atualizados. O cookie da sessão é `Secure` em produção (`sessionCookieSecure`, `src/modules/auth/cookie.ts`), a não ser com `SESSION_COOKIE_SECURE=false`, que existe só para o servidor sem domínio (plano 039). Os cabeçalhos `nosniff`, `X-Frame-Options` e `Referrer-Policy` saem do `next.config.ts`; o HSTS, do `Caddyfile`.
- **Banco:** IDs em UUID v7 (`@default(uuid(7)) @db.Uuid`); nomes de tabelas, colunas e enums em snake_case no banco (`@@map`/`@map`), camelCase no TypeScript. Datas sem hora são colunas `@db.Date` e circulam na aplicação como string `AAAA-MM-DD` (conversão em `src/lib/dates.ts`, feita no service).
- **Testes de banco:** `npm test` (integração) e `npm run test:e2e` usam o mesmo banco `_test` e limpam os dados; não rode os dois ao mesmo tempo. Helpers em `src/test/test-database.ts` e, para testes que precisam de uma ação de PDI, `src/test/pdi-fixtures.ts`; o `resetDatabase` dos e2e recria as categorias padrão. O Playwright roda com 1 worker pelo mesmo motivo; helpers de e2e em `e2e/helpers.ts`. **Dados de preparação dos e2e** vêm de `e2e/factories.ts` (SQL direto no banco de teste, plano 018) e o teste abre a página pela URL; a criação pela tela fica só nos testes que provam o formulário. Ao mudar uma coluna do schema, atualize a factory: `src/test/e2e-factories.int.test.ts` falha se ela ficar para trás.
- **Prisma 7:** depois de `npx prisma migrate dev`, rode `npx prisma generate` (o `migrate dev` não gera mais o cliente).
- **Reaproveite antes de criar:** campos Zod em `src/lib/form-fields.ts`; erros do Prisma (P2025, P2002, P2003) em `src/lib/prisma-errors.ts`; formulários com o hook `src/components/forms/use-schema-form.ts` + `FormActions` (opção `readForm` para campos repetidos, como grupos de checkbox); opções de objetivo e de categoria dos formulários em `src/modules/goals/options.ts` e `src/modules/categories/options.ts`; aviso de somente leitura no lugar de um formulário com `ClosedCycleNotice` (PDI) e `ArchivedTrackNotice` (trilhas); exclusão com `ConfirmDeleteButton` e outras confirmações com `ConfirmActionButton` (`triggerAriaLabel` quando o botão se repete numa lista); botões de form com `SubmitButton`; regras puras de rotina (dia previsto, estado, adesão, período de evidência, calendário do mês com `monthCalendar`, `monthRange` e `parseMonth`, meta semanal com `weekProgress`, sequência com `routineStreak`, adesão das últimas 12 semanas com `weeklyAdherence` e `combineWeeklyAdherence`) em `src/modules/routines/rules.ts`, que não acessa o banco e pode ser importado pelos services de rotinas e de PDI sem importação circular; "esta ação aceita rotina?" com `routineBlocker` (`src/modules/pdi/service.ts`); diferença em dias entre datas com `daysBetween` e segunda-feira da semana com `mondayOf` (`src/lib/dates.ts`); horas do dia com `parseTimeOfDay`, `formatTimeOfDay` e `minutesNowInAppTimeZone` (`src/lib/time-of-day.ts`); grade e resumo do dia de tempo com `daySlots`, `placeEntries` e `daySummary` (`src/modules/time/rules.ts`); período dos analíticos com `periodRange` e `analyticsQuery` (`src/modules/time/period.ts`); regras `palavra = Nome` com `parseRules` e `matchRule` (`src/modules/time/import/rules.ts`); barras de horas e porcentagem com `ShareBars`; item de prazo com `DeadlineItem`; selo da situação do livro com `BookStateBadge` e lista de livros com `BookList`; progresso, ritmo e previsão de leitura com `bookProgress`, `readingPace` e `finishForecast` (`src/modules/books/rules.ts`) e o bloco `ReadingProgress`; barras verticais com tabela para leitor de tela com `ColumnBars` e ranking com barra proporcional com `RankedList` (`src/components/books/analytics/`); duração em HH:MM acima de 24 h com `parseDuration` (`src/modules/books/schemas.ts`); esvaziar todas as tabelas com `truncateStatement` (`src/lib/truncate.ts`); fechar o buraco numa lista com ordem manual com `closeGap` (`src/lib/positions.ts`) e as setas de reordenar com `MoveButtons`; blocos do painel com `DashboardCard` e `EmptyCardText`; indicadores com `KpiStrip` e `kpiItems`; anel de progresso em SVG com `ProgressRing`; barras da semana com `weekTimeBars` e fatias por categoria (cinco e "Outras") com `categoryShares` (`src/modules/dashboard/rules.ts`); porcentagens inteiras que somam 100 com `percentages` (`src/modules/time/analytics.ts`); abas Trilhas | PDI com `DevelopmentTabs`; calendário mensal da rotina com `RoutineCalendar` (mês na URL, `?mes=AAAA-MM`); gráfico de barras da adesão semanal com `WeeklyAdherenceChart` (CSS puro, tabela `sr-only` para leitores de tela, plano 029); marca com `BrandMark`; estado concluído com a variante `success` do `Badge` (a única cor além do vermelho de atraso).
- **Sessão:** toda Server Action começa com `await requireSession()` (`src/modules/auth/session.ts`), porque uma action pode ser chamada sem passar pela tela. Toda página nova vai dentro de `src/app/(app)/`, cujo layout valida a sessão (num componente dentro de `<Suspense>`) antes de renderizar a página. Os e2e já começam logados (cookie da conta de teste no `playwright.config.ts`, conta recriada pelo `resetDatabase`); para testar sem login, use `test.use({ storageState: { cookies: [], origins: [] } })`.
- **Menu principal:** Hoje, Objetivos, Desenvolvimento, Rotinas e Tempo (planos 015 e 031); no celular, a faixa do menu rola para o lado. Trilhas, PDI e Leituras ficam juntos em Desenvolvimento, com as abas `DevelopmentTabs` no topo das três listas; as URLs continuam `/tracks`, `/pdi` e `/books` (plano 035). Um item do `MainNav` fica marcado para todos os prefixos em `sections`.
- **Painel inicial:** `/` mostra dados de todos os módulos via `getDashboard` (`src/modules/dashboard/service.ts`). Desde o plano 034: indicadores no topo (`kpis`: rotinas de hoje, adesão em 30 dias, trabalhado na semana, prazos atrasados contando os escondidos, PDI concluído), depois Hoje e Prazos (até 5 por grupo), Tempo da semana (`timeWeek`, com as contas dos analíticos) e PDI (anel), e Objetivos e trilhas num bloco só. Toda Server Action que muda dados deve revalidar também `/` (cada módulo tem sua função `revalidate…Screens`).
- **Tela de prazos** (`/deadlines`, plano 028): aberta por "Ver todos os prazos" no bloco Prazos do painel, fora do menu. Usa o mesmo `listDeadlines` do painel (etapas de trilhas ativas, ações de ciclos não encerrados, objetivos não iniciados ou em andamento e livros obrigatórios não terminados), agrupado por `groupDeadlinesByWeek`: atrasados sempre primeiro, depois por semana (segunda a domingo). Filtros `?periodo=` (7, 30 padrão, 90, all) e `?tipo=` (STEP, ACTION, GOAL, BOOK); sem limite de itens.

### Front-end

- **Acessibilidade:** HTML semântico (`main`, `nav`, títulos em ordem, `button` para ação e `a` para navegação); todo campo com `label` e erro ligado por `aria-describedby`; navegação completa por teclado com foco visível; contraste WCAG AA. Regras `jsx-a11y` do ESLint ativas.
- **Estados de tela:** toda rota trata carregamento (`loading.tsx`/`Suspense`), erro (`error.tsx`) e não encontrado (`not-found.tsx`). Lista vazia mostra mensagem com a próxima ação.
- **Formulários:** mesmo schema Zod no cliente e no servidor; erros do servidor por campo via `useActionState`; botão desabilitado com indicação durante o envio; confirmação antes de ação destrutiva.
- **Desempenho:** Server Components por padrão, `"use client"` no menor componente possível; `next/font` e `next/image`; nada de buscar dados no cliente quando o servidor pode entregar pronto.
- **Responsivo e consistente:** mobile-first; cores, espaçamentos e raios só pelos tokens do tema (Tailwind/shadcn), sem valores arbitrários soltos. **Cores de gráfico** vêm de `--chart-1` a `--chart-5` (`bg-chart-N`), na ordem das maiores fatias e nunca recicladas: a partir da sexta, soma-se em "Outras" em cinza (plano 034). Ao trocar a paleta, rode o validador de paleta nos dois temas. Tema claro/escuro via `next-themes`.
- **Testes:** no Playwright, localize por papel e nome acessível (`getByRole`); cada página principal passa na verificação do axe (espere o `h1` antes, para não analisar o "Carregando…"). `e2e/mobile.spec.ts` confere o cabeçalho e a ausência de rolagem horizontal em 375 e 320 px; página nova entra na lista `PAGES` dele. **`sr-only` numa `<table>` não esconde a largura dela:** ponha a classe numa `div` em volta (plano 029).
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

- **Grupo Conta** (alinhado em 2026-11-23, adiado pelo dono do projeto; falta escrever os planos):
  - **Autenticação em dois fatores (TOTP)**, a fazer primeiro: ativação em "Minha conta" com QR code e confirmação por código; o login pede o código depois da senha; 8 códigos de recuperação de uso único (só o hash no banco); desativação pela tela (senha e código) ou por um comando de emergência no terminal. Código calculado com o `crypto` do Node; segredo cifrado com uma chave nova no `.env` (`AUTH_ENCRYPTION_KEY`). Muda o modelo (segredo e data de ativação no usuário, tabela de códigos de recuperação). **Decisões em aberto:** aprovar a dependência `qrcode` (sem ela, a chave aparece em texto para digitar no app) e se vai em um plano ou em dois (ativação e login; depois os códigos de recuperação).
  - **Sessões ativas em "Minha conta"**, depois dos dois fatores: lista dos aparelhos logados com o último uso, "Encerrar" em cada um e "Encerrar todas as outras". Sem dependência nova; talvez um campo de último uso e o navegador de origem na tabela `sessions`.
  - **Descartados:** recuperação de senha por e-mail (pediria serviço de envio e dependência; o reset pelo terminal resolve para uma conta só) e login com Google ou GitHub (descartado no plano 014).
- **Biblioteca: o que ficou para depois** (planos 035 a 037 feitos): ligar livro a rotina ("li tal livro na rotina") e a ação de PDI (concluir o livro como evidência); importar um histórico (perguntar ao dono se existe lista no Goodreads, Skoob, planilha ou `.md`); meta em páginas ou horas, período livre e comparação entre anos nos analíticos (plano 037).
- **Gestão de tempo: o que ficou para depois** (planos 031 a 033 feitos): horas extras sobre uma jornada esperada e comparação com o período anterior nos analíticos (plano 032); ligar registros de tempo a objetivos ou ações de PDI, com o tempo como evidência; enviar o `.md` como arquivo e mesclar com dias já registrados na importação (plano 033).

Melhorias deixadas fora de escopo ficam registradas na seção "Fora de escopo" de cada plano em `docs/plans/`.
