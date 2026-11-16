# 001 — Objetivos (CRUD)

Status: **implementado em 2026-11-16**, aprovado no mesmo dia (merge do scaffold na `main`, exclusão definitiva com confirmação, UUID v7 + snake_case e limites de campos aprovados)
Branch: `feat/goals-crud`

## Objetivo

Cadastrar, listar, ver, editar, arquivar e excluir objetivos. É a primeira feature com banco, então também estabelece os padrões que as próximas vão repetir: schema Zod compartilhado, service testado contra o banco de teste, Server Action fina, formulário acessível com erros por campo e e2e rodando contra o banco de teste.

## Escopo

### Modelo e banco

- Modelo `Goal` e enum `GoalStatus`, com a migration `add_goals` (detalhes em "Mudanças no modelo de dados").

### Domínio (`src/modules/goals/`)

- **`schemas.ts`**: um único `goalInputSchema` (Zod), usado no formulário e na action. Regras:
  - `title`: obrigatório, sem espaços nas pontas, de 1 a 120 caracteres.
  - `description`: opcional, até 2000 caracteres; string vazia vira `null`.
  - `status`: um dos valores do enum, padrão `NOT_STARTED`.
  - `targetDate`: opcional, no formato `AAAA-MM-DD` e precisa ser uma data válida (`2026-02-30` é recusada). Data no passado é aceita, porque você pode cadastrar objetivos antigos.
  - Mensagens de erro em pt-BR.
- **`service.ts`** (regras e acesso ao banco):
  - `listGoals({ status? })`: sem filtro, traz todos **menos os arquivados**. Ordem: data-alvo mais próxima primeiro, sem data no fim e, em empate, os mais recentes primeiro.
  - `getGoal(id)`: lança `GoalNotFoundError` se não existir.
  - `createGoal(input)`, `updateGoal(id, input)`, `deleteGoal(id)`: as duas últimas lançam `GoalNotFoundError`.
  - `isGoalOverdue(goal, today)`: função pura. O objetivo está atrasado quando tem data-alvo anterior a `today` e status `NOT_STARTED` ou `IN_PROGRESS`.
- **`actions.ts`**: `createGoalAction`, `updateGoalAction`, `deleteGoalAction`.
  - Validam o `FormData` com o `goalInputSchema`. Com erro, devolvem os erros por campo e os valores digitados, para o formulário não perder o que você escreveu.
  - Sem erro, chamam o service, revalidam `/goals` e redirecionam: criar e editar levam ao detalhe; excluir leva à lista.

### Datas (`src/lib/dates.ts`)

Antecipa uma parte do utilitário de datas que estava previsto para a etapa 3, porque "atrasado" precisa saber qual é o dia de hoje.

- `todayInAppTimeZone()`: devolve "hoje" em `America/Fortaleza` como `AAAA-MM-DD`, calculado com `Intl.DateTimeFormat`, sem dependência nova e sem partir de UTC.
- `parseDateOnly` / `formatDateOnly`: convertem entre `AAAA-MM-DD` e o `Date` que o Prisma usa para colunas `@db.Date` (meia-noite UTC).
- `formatDateForDisplay`: exibe `16/11/2026`, com formatação pt-BR.

### Telas (`src/app/goals/`)

Todas são Server Components, menos o formulário e o diálogo de exclusão. Esses dois precisam de estado no navegador: erros, envio em andamento e diálogo aberto.

| Rota               | Conteúdo                                                                                                                                                                                                                                                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/goals`           | Lista em cartões com título, status (badge), data-alvo e um selo "Atrasado". Filtro por status via `?status=`, com links acessíveis: "Ativos" (padrão, sem arquivados), "Não iniciado", "Em andamento", "Concluído" e "Arquivado". Se a lista estiver vazia, mostra uma mensagem com o botão "Criar objetivo". |
| `/goals/new`       | Formulário de criação.                                                                                                                                                                                                                                                                                         |
| `/goals/[id]`      | Detalhe: título, status, data-alvo, descrição e as ações "Editar" e "Excluir". Arquivar é uma mudança de status, feita na edição.                                                                                                                                                                              |
| `/goals/[id]/edit` | O mesmo formulário, preenchido.                                                                                                                                                                                                                                                                                |

- Cada rota tem `loading.tsx`. O `[id]` inexistente cai em `not-found.tsx` com a mensagem "Objetivo não encontrado".
- Formulário: `label` em todo campo, erro ligado ao campo por `aria-describedby` e `aria-invalid`, e foco levado ao primeiro campo com erro. Validação no cliente com o mesmo schema e no servidor via `useActionState`. O botão fica desabilitado, com o texto "Salvando…", durante o envio.
- Excluir pede confirmação num `AlertDialog` ("Excluir objetivo? Essa ação não pode ser desfeita.").
- Status em pt-BR: Não iniciado, Em andamento, Concluído, Arquivado.
- **Navegação**: o cabeçalho ganha um `nav` com o link "Objetivos", marcado com `aria-current="page"` quando você está na seção. Esse componente vai receber os próximos módulos.

### Componentes shadcn/ui a adicionar

`input`, `textarea`, `label`, `select`, `badge`, `card` e `alert-dialog`. Antes de adicionar, vou conferir no registro da versão instalada se há um componente de campo de formulário (`field`) que substitua a montagem manual de label + erro.

### Infraestrutura de testes

- **Integração**: um `globalSetup` do Vitest roda `prisma migrate deploy` no banco de teste antes da suíte. Um helper `resetDatabase()` (`TRUNCATE` de todas as tabelas, exceto `_prisma_migrations`) roda antes de cada teste.
- **E2E**: o servidor do Playwright passa a usar o `DATABASE_URL` do `.env.test`, para os testes não sujarem seus dados de desenvolvimento. Um `globalSetup` aplica as migrations e limpa o banco antes da suíte.
- Para não brigarem pelo mesmo banco, `npm test` e `npm run test:e2e` não devem rodar ao mesmo tempo. Vou anotar isso no `CLAUDE.md`.

## Fora de escopo

- Progresso agregado do objetivo (etapas de trilha, ações de PDI, rotinas): depende das etapas 2 a 5.
- Busca por texto, paginação e ordenação escolhida pelo usuário.
- Descrição com Markdown ou rich text (por enquanto é texto simples, com quebras de linha preservadas).
- Mensagens de sucesso em toast (exigiriam uma dependência nova; o redirecionamento já mostra o resultado).
- Painel inicial (etapa 6): a página `/` continua como está.

## Mudanças no modelo de dados

```prisma
enum GoalStatus {
  NOT_STARTED
  IN_PROGRESS
  DONE
  ARCHIVED
}

model Goal {
  id          String     @id @default(uuid(7)) @db.Uuid
  title       String     @db.VarChar(120)
  description String?
  status      GoalStatus @default(NOT_STARTED)
  targetDate  DateTime?  @map("target_date") @db.Date
  createdAt   DateTime   @default(now()) @map("created_at")
  updatedAt   DateTime   @updatedAt @map("updated_at")

  @@index([status])
  @@map("goals")
}
```

Duas convenções que valem para todos os modelos daqui em diante:

- **IDs em UUID v7.** São únicos sem depender de sequência e ordenáveis por criação, e não expõem quantos registros existem na URL (`/goals/1`, `/goals/2`).
- **Nomes no banco em snake_case** (`goals`, `target_date`) via `@@map`/`@map`, com camelCase no código TypeScript. Assim, SQL escrito à mão no Postgres não precisa de aspas, como no padrão do Django.

## Arquivos afetados

```
prisma/schema.prisma                         (modelo Goal)
prisma/migrations/<timestamp>_add_goals/     (nova)
src/lib/dates.ts                             (novo)
src/lib/dates.test.ts                        (novo)
src/modules/goals/schemas.ts                 (novo)
src/modules/goals/schemas.test.ts            (novo)
src/modules/goals/service.ts                 (novo)
src/modules/goals/service.test.ts            (novo: isGoalOverdue, unidade)
src/modules/goals/service.int.test.ts        (novo: CRUD contra o banco)
src/modules/goals/actions.ts                 (novo)
src/modules/goals/labels.ts                  (novo: rótulos pt-BR dos status)
src/app/goals/page.tsx, loading.tsx
src/app/goals/new/page.tsx
src/app/goals/[id]/page.tsx, loading.tsx, not-found.tsx
src/app/goals/[id]/edit/page.tsx
src/components/goal-form.tsx                 (Client Component)
src/components/delete-goal-button.tsx        (Client Component)
src/components/main-nav.tsx                  (Client Component: usa usePathname para o aria-current)
src/components/ui/*                          (componentes shadcn listados acima)
src/app/layout.tsx                           (inclui o nav)
src/test/db.ts                               (novo: resetDatabase)
src/test/global-setup.ts                     (novo: migrate deploy no banco de teste)
vitest.config.mts                            (globalSetup no projeto integration)
playwright.config.ts                         (DATABASE_URL de teste + globalSetup)
e2e/global-setup.ts                          (novo)
e2e/goals.spec.ts                            (novo)
package.json                                 (zod)
CLAUDE.md                                    (convenções de ID/snake_case e nota sobre os testes)
```

## Testes (escritos antes do código, em TDD)

### Unidade

| Arquivo                             | Casos                                                                                                                                                                                                                                                                                                             |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/dates.test.ts`             | `todayInAppTimeZone` às 23h30 de Fortaleza (02h30 UTC do dia seguinte) devolve o dia local; às 00h30 local, idem. `parseDateOnly`/`formatDateOnly` fazem ida e volta sem deslocar o dia. Data inválida (`2026-02-30`) é recusada. `formatDateForDisplay` devolve `dd/mm/aaaa`.                                    |
| `src/modules/goals/schemas.test.ts` | Título vazio ou só com espaços é recusado; título com 121 caracteres é recusado; espaços nas pontas são removidos; descrição vazia vira `null`; status inválido é recusado; status ausente vira `NOT_STARTED`; data mal formatada ou inexistente é recusada; data vazia vira `null`; as mensagens estão em pt-BR. |
| `src/modules/goals/service.test.ts` | `isGoalOverdue`: data passada + `IN_PROGRESS` = atrasado; data passada + `DONE` ou `ARCHIVED` = não; data igual a hoje = não; sem data = não.                                                                                                                                                                     |

### Integração (banco de teste)

| Arquivo                                 | Casos                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/modules/goals/service.int.test.ts` | Criar com o mínimo grava status `NOT_STARTED` e datas de criação. Criar com data-alvo grava o dia certo, sem deslocar pelo fuso. `listGoals()` exclui os arquivados e respeita a ordem definida. `listGoals({ status: "ARCHIVED" })` traz só os arquivados. `getGoal` com ID inexistente lança `GoalNotFoundError`. `updateGoal` altera os campos e o `updatedAt`. `updateGoal` e `deleteGoal` com ID inexistente lançam `GoalNotFoundError`. `deleteGoal` remove o registro. |

### E2E (`e2e/goals.spec.ts`)

1. Lista vazia mostra a mensagem e o botão "Criar objetivo".
2. Criar um objetivo com título, descrição e data leva ao detalhe com os dados, e ele aparece na lista.
3. Enviar o formulário sem título mostra o erro ao lado do campo, com o foco nele, e não sai da página.
4. Editar o status para "Arquivado" tira o objetivo da lista padrão e faz ele aparecer no filtro "Arquivado".
5. Excluir pede confirmação; "Cancelar" mantém o objetivo e "Excluir" o remove e volta à lista.
6. Objetivo com data passada e status "Em andamento" mostra o selo "Atrasado".
7. Lista, formulário e detalhe passam no axe.

## Critério de pronto

- `npm run lint`, `npm run typecheck`, `npm test` e `npm run test:e2e` passando.
- Migration `add_goals` incluída.
- Este plano atualizado se o escopo mudar durante a implementação.

## Mudanças durante a implementação

- **Enum no banco em snake_case** (`goal_status`, via `@@map`), seguindo a mesma convenção das tabelas.
- **Componentes de objetivo em `src/components/goals/`** (`goal-form`, `goal-list`, `goal-filter`, `goal-status-badge`, `delete-goal-button`) em vez de soltos em `src/components/`.
- **shadcn:** usei `field` (label + erro) e `native-select` no lugar de `label` + `select`. O `<select>` nativo funciona sem JavaScript e é acessível por padrão. O `field` trouxe `label` e `separator` como dependências.
- **`goalStatusFilterSchema`** em `schemas.ts` (com testes): `?status=` inválido vira "sem filtro".
- **`src/app/goals/[id]/load-goal.ts`**: converte `GoalNotFoundError` em `notFound()` para o detalhe e a edição.
- **`src/app/goals/[id]/edit/loading.tsx`**: ao navegar do detalhe para a edição, o segmento `[id]` é reaproveitado, então o `loading.tsx` dele não cobre a página filha e o Next acusava leitura fora de Suspense.
- **`MainNav` com `<Suspense>`**: ler `usePathname()` fora de Suspense é acusado pelo Next 16. O fallback é o mesmo menu sem destaque.
- **Activity (páginas visitadas ficam escondidas no DOM):** com Cache Components, o Next esconde as últimas 3 rotas com `display: none` em vez de desmontá-las. Consequências tratadas:
  - O formulário usa `useId` para os `id`s dos campos. Antes, o formulário escondido e o visível tinham `id`s iguais e o nome acessível saía duplicado ("Título Título").
  - O formulário é limpo quando escondido após um envio válido, e o diálogo de exclusão é fechado quando a página é escondida.
  - Nos e2e, campos são localizados com `getByRole`, que ignora elementos escondidos (`getByLabel` não ignora).
- **`src/lib/db.ts`** não exige `DATABASE_URL` sob `NODE_ENV=test`, para os testes unitários poderem importar `service.ts` (o cliente só conecta na primeira consulta). Os testes de integração continuam com a trava de `_test`.
- **Helpers de banco de teste** concentrados em `src/test/test-database.ts` (ler `.env.test`, migrar, limpar), usados pelo Vitest e pelo Playwright. O Playwright sempre sobe um servidor novo (`reuseExistingServer: false`) para garantir o banco de teste.
- **Timeouts do Playwright** maiores (60 s por teste, 15 s por expectativa), porque o `next dev` compila cada rota na primeira visita.
- **E2E extra:** depois de salvar, voltar a "Novo objetivo" mostra o formulário vazio.
- **Testes de integração determinísticos:** ordem por `createdAt` e checagem de `updatedAt` fixam as datas via SQL, para não depender de duas gravações caírem em milissegundos diferentes.

## Decisões

1. Merge da `chore/scaffold` na `main` (fast-forward) e `feat/goals-crud` criada a partir dela.
2. Exclusão definitiva permitida, com confirmação. Na etapa 2, excluir um objetivo desfaz o vínculo dos itens (`goalId` → `null`).
3. UUID v7 e snake_case no banco para todos os modelos.
4. Título até 120 e descrição até 2000 caracteres.
