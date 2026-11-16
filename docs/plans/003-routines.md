# 003 — Rotinas e registro diário (tela "Hoje")

Status: **implementado em 2026-11-16**, aprovado no mesmo dia (ver "Decisões")
Branch: `feat/routines`

## Objetivo

Cadastrar rotinas recorrentes (em quais dias da semana, a partir de quando, até quando) e registrar, dia a dia, se cada uma foi feita ou pulada. A tela **Hoje** reúne as rotinas do dia para marcar rápido. Cada rotina mostra o histórico recente e a **taxa de adesão**, que a etapa 5 vai reaproveitar como evidência nas ações de PDI.

## Escopo

### Modelo e banco

- Modelos `Routine` e `RoutineLog`, enums `Weekday` e `RoutineLogStatus`, relação `Routine.goal` e a migration `add_routines` (detalhes em "Mudanças no modelo de dados").
- `pdiActionId` **não** entra agora: a coluna é criada na etapa 5, junto com o modelo `PdiAction`, porque a FK precisa da tabela de destino.

### Datas (`src/lib/dates.ts`)

Funções novas, todas sobre strings `AAAA-MM-DD` e sem depender do fuso da máquina:

- `weekdayOf(date)`: dia da semana (`MON` … `SUN`) de uma data, calculado em UTC sobre a meia-noite da própria data.
- `addDays(date, n)` e `eachDay(from, to)`: aritmética e intervalo de datas.
- `formatLongDate(date)`: "segunda-feira, 16 de novembro", em pt-BR.

### Domínio (`src/modules/routines/`)

- **`schemas.ts`**
  - `routineInputSchema`:
    - `title`: obrigatório, até 120 caracteres.
    - `description`: opcional, até 2000 caracteres.
    - `weekdays`: pelo menos um dia, sem repetição.
    - `timeOfDay`: opcional, no formato `HH:MM`, de 00:00 a 23:59.
    - `startDate`: obrigatória.
    - `endDate`: opcional; precisa ser igual ou posterior ao início (o erro aparece no campo `endDate`).
    - `goalId`: opcional, UUID.
  - `routineLogInputSchema`: `status` (`DONE`/`SKIPPED`) e `note` (opcional, até 500 caracteres).
  - **`readRoutineForm(formData)`**: converte o `FormData` em valores, juntando os vários checkboxes `weekdays` numa lista. A mesma função é usada no navegador e na action. (Hoje o `useSchemaForm` usa `Object.fromEntries`, que perde campos repetidos; ele ganha a opção `readForm`, ver "Ajustes compartilhados".)
- **`service.ts`**
  - **Regras puras (testadas sem banco):**
    - `isScheduledOn(routine, date)`: verdadeiro se `startDate ≤ date`, se `endDate` está vazia ou `date ≤ endDate`, e se o dia da semana está em `weekdays`.
    - `routineStateOn(routine, today)`: `UPCOMING` (começa no futuro), `ACTIVE` ou `ENDED` (terminou antes de hoje).
    - `computeAdherence(routine, logs, from, to)` devolve `{ scheduled, done, skipped, missed, rate }`.
      - Considera só os dias programados dentro do período, e nunca depois de hoje.
      - `DONE` conta como feito; `SKIPPED` conta como pulado, não como feito.
      - Dia programado sem registro conta como perdido.
      - Registros em dias que deixaram de ser programados (porque a rotina foi editada) são ignorados.
      - `rate` vai de 0 a 100, inteiro; com 0 dias programados, dá 0.
  - **Rotinas:**
    - `listRoutines({ state, today })`: `active` traz as em andamento e as futuras; `ended`, as encerradas. Ordem: horário (as sem horário por último), depois título.
    - `getRoutine(id)`, `createRoutine`, `updateRoutine` e `deleteRoutine` (excluir a rotina exclui os registros). Erro: `RoutineNotFoundError`.
    - Um `goalId` inexistente lança `GoalNotFoundError`.
    - `endRoutine(id, today)` preenche `endDate = today`. Para uma rotina que ainda não começou, lança `RoutineNotStartedError` (o caminho é excluir).
  - **Registro diário:**
    - `listRoutinesForDay(date)`: as rotinas programadas no dia, cada uma com o registro daquele dia (ou nenhum), na mesma ordem da lista.
    - `logRoutine(routineId, date, input, today)`: cria ou substitui o registro do dia, pela unicidade de `(routineId, date)`. Recusa data futura (`FutureDateError`) e dia em que a rotina não está programada (`RoutineNotScheduledError`).
    - `clearLog(routineId, date)`: desfaz o registro.
    - `getRoutineHistory(routineId, today, days = 14)`: os dias programados da janela `[hoje − 13, hoje]`, dentro do período da rotina, do mais recente para o mais antigo, cada um com seu registro.
    - `getAdherence(routineId, today, days = 30)`: aplica `computeAdherence` nos últimos 30 dias.
- **`actions.ts`**: criar, editar, excluir e encerrar rotina; registrar feito/pulado, com nota opcional; desfazer registro.

### Objetivos

- O detalhe do objetivo ganha a seção **"Rotinas"**: as rotinas vinculadas, cada uma com a adesão dos últimos 30 dias. Elas **não entram** no "X de Y" do `getGoalProgress` (ver pergunta 1).
- O aviso ao excluir um objetivo passa a citar trilhas **e rotinas**: as duas continuam existindo, sem vínculo.

### Telas

| Rota                                    | Conteúdo                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/today`                                | Título "Hoje" com a data por extenso, resumo "2 de 4 feitas" e as rotinas do dia na ordem do horário. Cada item tem título, horário, objetivo, estado (pendente / feita / pulada) e, se houver, a nota. Ações: **Feito** e **Pular**, num mesmo formulário com um campo "Nota (opcional)" que abre sob demanda, e **Desfazer** quando já há registro. Sem rotinas no dia: "Nenhuma rotina para hoje" e o link "Criar rotina". |
| `/routines`                             | Lista com filtro "Ativas" (padrão, inclui as que ainda vão começar, com o selo "Começa em dd/mm") e "Encerradas". Cada cartão: título, dias e horário ("Seg, Qua, Sex · 07:00"), objetivo e adesão em 30 dias. Lista vazia mostra mensagem com o botão "Criar rotina".                                                                                                                                                        |
| `/routines/new` e `/routines/[id]/edit` | Formulário: título, descrição, **dias da semana** (grupo de checkboxes com `fieldset`/`legend`), horário (`type="time"`), início (padrão: hoje), fim (opcional) e objetivo.                                                                                                                                                                                                                                                   |
| `/routines/[id]`                        | Detalhe: programação, período, objetivo, adesão em 30 dias (barra e "18 de 20 dias feitos, 90%") e **histórico dos últimos 14 dias programados**. No histórico, cada dia tem Feito, Pular e Desfazer, para corrigir um dia esquecido. Ações da rotina: Editar, Encerrar (com confirmação; não aparece em rotina futura) e Excluir (com confirmação).                                                                          |

- O menu principal ganha **"Hoje"** (primeiro item) e **"Rotinas"**.
- Dias da semana exibidos de segunda a domingo: Seg, Ter, Qua, Qui, Sex, Sáb, Dom. Nos checkboxes, o nome acessível é o nome completo ("Segunda-feira").
- Seguindo as convenções do `CLAUDE.md`: `loading.tsx` em toda rota, `not-found.tsx` nas rotas com `[id]`, ids via `useId` e axe em todas as páginas novas.

### Ajustes compartilhados

- `useSchemaForm` ganha a opção `readForm(formData)` (padrão: o `Object.fromEntries` atual), para formulários com campos repetidos.
- `src/lib/form-fields.ts` ganha `requiredDateOnly()`.

### Componentes shadcn/ui a adicionar

`checkbox` (Radix; nenhuma dependência nova).

## Fora de escopo

- Vínculo da rotina com ação de PDI (`pdiActionId`) e as regras de categoria `allowsRoutine` (etapa 5).
- Sequência de dias seguidos ("streak"), metas de frequência ("3x por semana") e lembretes ou notificações.
- Registrar dias futuros, ou dias além da janela de 14 dias pela interface. O service aceita qualquer data passada programada; só a tela limita a janela.
- Calendário mensal de registros.
- Transformar `/` em "Hoje": a página inicial vira painel na etapa 6.

## Mudanças no modelo de dados

```prisma
enum Weekday {
  MON
  TUE
  WED
  THU
  FRI
  SAT
  SUN

  @@map("weekday")
}

enum RoutineLogStatus {
  DONE
  SKIPPED

  @@map("routine_log_status")
}

model Routine {
  id          String       @id @default(uuid(7)) @db.Uuid
  title       String       @db.VarChar(120)
  description String?
  weekdays    Weekday[]
  timeOfDay   String?      @map("time_of_day") @db.VarChar(5)
  startDate   DateTime     @map("start_date") @db.Date
  endDate     DateTime?    @map("end_date") @db.Date
  goalId      String?      @map("goal_id") @db.Uuid
  goal        Goal?        @relation(fields: [goalId], references: [id], onDelete: SetNull)
  logs        RoutineLog[]
  createdAt   DateTime     @default(now()) @map("created_at")
  updatedAt   DateTime     @updatedAt @map("updated_at")

  @@index([goalId])
  @@map("routines")
}

model RoutineLog {
  id        String           @id @default(uuid(7)) @db.Uuid
  routineId String           @map("routine_id") @db.Uuid
  routine   Routine          @relation(fields: [routineId], references: [id], onDelete: Cascade)
  date      DateTime         @db.Date
  status    RoutineLogStatus
  note      String?          @db.VarChar(500)
  createdAt DateTime         @default(now()) @map("created_at")
  updatedAt DateTime         @updatedAt @map("updated_at")

  @@unique([routineId, date])
  @@map("routine_logs")
}

// Goal ganha a relação inversa:
//   routines Routine[]
```

- **`weekdays` como lista de enum** (um array nativo do Postgres): é legível no banco e no código, e a regra "pelo menos um dia" fica no schema e no service.
- **`timeOfDay` como texto `HH:MM`**. Uma coluna `TIME` voltaria do Prisma como `Date`, com data e fuso artificiais; o texto já sai ordenável e é fácil de validar.
- **`@@unique([routineId, date])`** garante no banco um registro por rotina por dia, como manda o `CLAUDE.md`. "Marcar de novo" substitui o registro (upsert).
- **`onDelete`** segue os mesmos critérios das trilhas: excluir o objetivo desfaz o vínculo (`SetNull`); excluir a rotina exclui os registros (`Cascade`).

## Arquivos afetados

```
prisma/schema.prisma                                    (Routine, RoutineLog, enums, relação em Goal)
prisma/migrations/<timestamp>_add_routines/             (nova)
src/lib/dates.ts, dates.test.ts                         (weekdayOf, addDays, eachDay, formatLongDate)
src/lib/form-fields.ts                                  (requiredDateOnly)
src/modules/routines/schemas.ts, schemas.test.ts        (novos)
src/modules/routines/service.ts                         (novo)
src/modules/routines/service.test.ts                    (novo: regras puras)
src/modules/routines/service.int.test.ts                (novo)
src/modules/routines/actions.ts, labels.ts              (novos)
src/app/today/**                                        (página Hoje)
src/app/routines/**                                     (lista, formulários, detalhe)
src/app/goals/[id]/page.tsx                             (seção Rotinas)
src/components/routines/*                               (formulário, itens do dia, histórico, cartões)
src/components/forms/use-schema-form.ts                 (opção readForm)
src/components/goals/delete-goal-button.tsx             (aviso sobre rotinas)
src/components/main-nav.tsx                             (Hoje, Rotinas)
src/components/ui/checkbox.tsx                          (shadcn)
e2e/helpers.ts, e2e/routines.spec.ts                    (novo spec e helper createRoutine)
```

## Testes (escritos antes do código, em TDD)

### Unidade

| Arquivo                                | Casos                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/dates.test.ts`                | `weekdayOf` para datas conhecidas (16/11/2026 = `MON`, 15/11/2026 = `SUN`), inclusive na virada de ano; `addDays` atravessando mês e ano e com valor negativo; `eachDay` inclusivo e vazio quando `from > to`; `formatLongDate` em pt-BR.                                                                                                                                                                                      |
| `src/modules/routines/schemas.test.ts` | Um dia só (valor único do `FormData`) vira lista; nenhum dia é recusado; dia repetido é deduplicado; dia inválido é recusado; `timeOfDay` aceita `07:30` e recusa `7:30`, `24:00` e `12:60`; início obrigatório; fim antes do início é recusado no campo `endDate`; fim igual ao início é aceito; `goalId` vazio vira `null`; nota com até 500 caracteres; mensagens em pt-BR. `readRoutineForm` junta checkboxes repetidos.   |
| `src/modules/routines/service.test.ts` | `isScheduledOn`: dia de início, dia de fim, depois do fim, antes do início, dia da semana fora da lista, rotina sem fim. `routineStateOn`: futura, ativa, terminando hoje (ainda ativa) e encerrada. `computeAdherence`: conta feitos, pulados e perdidos; ignora dias futuros; ignora registros em dias não programados; respeita início e fim dentro do período; 0 dias programados dá taxa 0; arredondamento (2 de 3 = 67). |

### Integração (banco de teste)

| Arquivo                                    | Casos                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/modules/routines/service.int.test.ts` | Criar com e sem objetivo; `goalId` inexistente lança `GoalNotFoundError`; `weekdays` e datas gravados sem deslocar o dia. `listRoutines` separa ativas, futuras e encerradas e ordena por horário (as sem horário no fim). `listRoutinesForDay` traz só as programadas no dia (dia da semana e período), com o registro daquele dia. `logRoutine` cria; marcar de novo substitui (continua um registro só); recusa data futura e dia não programado. `clearLog` remove. `getRoutineHistory` traz até 14 dias programados, do mais recente para o mais antigo, sem passar do início. `getAdherence` calcula pelos registros reais. `endRoutine` preenche o fim; numa rotina futura, lança `RoutineNotStartedError`. Excluir a rotina remove os registros. Excluir o objetivo deixa `goalId = null`. Erros de "não encontrado" para id inexistente ou malformado. |

### E2E (`e2e/routines.spec.ts`)

1. "Hoje" sem rotinas mostra a mensagem e o link "Criar rotina".
2. Criar uma rotina para todos os dias, com horário, faz ela aparecer em "Hoje" com o horário.
3. **Feito** atualiza para "1 de 1 feita"; **Desfazer** volta para pendente.
4. **Pular** com nota mostra "Pulada" e a nota.
5. Rotina programada só em dias que não incluem hoje não aparece em "Hoje", mas aparece em "Rotinas". O dia de hoje é calculado no teste pela mesma função `todayInAppTimeZone`.
6. Formulário sem nenhum dia marcado mostra o erro no grupo "Dias da semana"; fim antes do início mostra o erro no campo de fim.
7. O detalhe mostra o registro de hoje no histórico e a adesão. Corrigir o dia pelo histórico atualiza a adesão.
8. **Encerrar** move a rotina para "Encerradas" e tira ela de "Hoje".
9. O detalhe do objetivo mostra a rotina vinculada.
10. "Hoje", lista, detalhe e formulário de rotina passam no axe.

## Critério de pronto

- `npm run lint`, `npm run typecheck`, `npm test` e `npm run test:e2e` passando.
- Migration `add_routines` incluída.
- Este plano atualizado se o escopo mudar durante a implementação.

## Mudanças durante a implementação

- **`computeAdherence(routine, logs, period, today)`**: recebe `today` além do período, para ignorar dias futuros. **Hoje só conta depois de registrado**: o dia ainda não acabou, e contá-lo como perdido derrubaria a taxa toda manhã.
- **`listRoutines`** aceita `goalId` (seção do objetivo) e já devolve a adesão de 30 dias de cada rotina (`RoutineSummary`).
- **Histórico** é a janela fixa `[hoje − 13, hoje]` (constante `HISTORY_DAYS`), mostrando só os dias programados dela, como descrito no service.
- **Encerrar** preenche `endDate = hoje`: a rotina ainda vale hoje e passa para "Encerradas" a partir de amanhã. O selo **"Termina hoje"** deixa isso visível, e o diálogo de confirmação explica. Encerrar uma rotina já encerrada mantém a data original. O e2e 8 foi ajustado: verifica o selo e que uma rotina com fim no passado sai de "Hoje" e aparece em "Encerradas".
- **`weekdays`** é normalizado para a ordem da semana (segunda primeiro) no schema, além de deduplicado.
- **Opções de objetivo** saíram de `src/app/tracks/goal-options.ts` para `src/modules/goals/options.ts` (com o tipo `GoalOption`), usadas pelos formulários de trilha e de rotina.
- **`useSchemaForm`**: além de `readForm`, o foco no primeiro campo inválido procura primeiro pelo `id` do campo. No grupo de dias, o primeiro checkbox recebe esse `id`; os `input` com `name="weekdays"` são escondidos pelo Radix e não recebem foco.
- **Checkboxes do Radix e reset do formulário**: depois de cada envio, o React reseta o formulário e o Radix volta ao _primeiro_ `defaultChecked`. Cada checkbox tem `key` com o estado marcado, para que os valores devolvidos após erro do servidor apareçam.
- **"Criar rotina" no objetivo** abre `/routines/new?goalId=…`, como em trilhas.
- **`labels.ts`** ganhou testes de unidade (`scheduleText`, `adherenceText`, `doneTodayText`). Sem dias para contar, o texto é "Nenhum dia para contar ainda".
- **`/routines` chama `connection()`**: a página lê o relógio (para "hoje") antes de acessar o banco, e o Next recusa `new Date()` durante a pré-renderização.
- **Menu**: "Hoje", "Objetivos", "Trilhas", "Rotinas"; a lista quebra linha em telas estreitas.

## Decisões

1. Rotinas aparecem no objetivo numa seção própria, com a adesão dos últimos 30 dias, sem entrar no "X de Y" das etapas.
2. A página da rotina permite marcar ou corrigir os últimos 14 dias programados, nunca dias futuros.
3. A semana é exibida de segunda a domingo.
4. "Pulada" conta como não feita na taxa de adesão (feitos ÷ dias programados).
