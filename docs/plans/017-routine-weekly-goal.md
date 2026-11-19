# 017 — Rotinas com meta semanal ("3x por semana")

Status: **implementado em 2026-11-19**, aprovado com as propostas das perguntas (ver "Decisões")
Branch: `feat/routine-weekly-goal`

Segundo dos três planos do grupo Rotinas (calendário, metas de frequência, streak).

## Objetivo

Hoje toda rotina tem dias fixos (por exemplo, seg, qua e sex). Muitos hábitos não funcionam assim: "exercício 3x por semana" vale em qualquer dia. Este plano cria o segundo tipo de rotina, **meta semanal**: N vezes por semana, em quaisquer dias, de segunda a domingo.

## Escopo

### Dois tipos de rotina

- **Dias fixos** (como hoje): a rotina vale nos dias da semana marcados.
- **Meta semanal** (novo): a rotina vale qualquer dia, e a semana (segunda a domingo) conta como cumprida quando há pelo menos N dias feitos. N vai de 1 a 6 (7 vezes por semana é o mesmo que "todos os dias" com dias fixos).

### Mudança no modelo de dados

```prisma
model Routine {
  // ...campos atuais
  /// Meta semanal: quantos dias por semana. Null nas rotinas de dias fixos.
  timesPerWeek Int? @map("times_per_week") @db.SmallInt
}
```

- Migration `add_routine_times_per_week`: uma coluna opcional; as rotinas existentes continuam de dias fixos (`null`).
- **Uma rotina com meta semanal guarda os 7 dias em `weekdays`.** Assim, tudo o que pergunta "a rotina vale neste dia?" (tela Hoje, histórico, validação do registro, painel) continua funcionando sem mudança: qualquer dia pode ser registrado. Só o cálculo de adesão, o calendário e os textos olham para `timesPerWeek`.
- Regra no schema Zod e no service: com `timesPerWeek`, `weekdays` é preenchido com os 7 dias pelo próprio service (o formulário não manda dias).

### Formulário

- Novo campo **"Como a rotina se repete"**, com duas opções: "Em dias fixos da semana" (mostra os dias, como hoje) e "Algumas vezes por semana" (mostra um seletor "Quantas vezes por semana", de 1 a 6).
- O campo que não se aplica some só com CSS, como o campo de destino das rotinas do PDI (sem estado no React).
- **Trocar o tipo de uma rotina existente é permitido** (pergunta 4): os registros ficam; só muda como a adesão passa a ser contada.

### Adesão (pergunta 3)

Para continuar somando rotinas dos dois tipos no painel e na evidência do PDI, a meta semanal também é contada em **dias**, só que **dias-meta**:

- Em cada semana do período, os dias previstos são **N** (a meta), e os feitos são **os dias feitos, até N** (fazer 5 vezes numa meta de 3 conta 3: não compensa outra semana).
- **Semana incompleta no começo ou no fim da rotina** (por exemplo, começou numa quinta): a meta é proporcional aos dias disponíveis, sem passar de N. Com 3x por semana e só 4 dias disponíveis, a meta é 3; com 2 dias disponíveis, é 2.
- **Semana atual:** só conta o que já foi feito (a semana ainda não acabou), como "hoje" nas rotinas de dias fixos. Ou seja, a semana atual nunca derruba a adesão antes de terminar.
- "Pulado" não existe nesse tipo (pergunta 2), então `skipped` é sempre 0, e `missed` é a meta que faltou nas semanas já fechadas.

### Tela Hoje (pergunta 1)

- A rotina de meta semanal aparece **todos os dias**, com o progresso da semana: "1 de 3 nesta semana".
- Quando a meta da semana é cumprida, ela continua na lista, com "Meta da semana cumprida", e ainda dá para registrar mais dias.
- Só o botão **"Feito"** (e "Desfazer"): "Pular" não faz sentido quando nenhum dia é obrigatório.

### Página da rotina e calendário

- "Quando" mostra "3 vezes por semana" (e o horário, se houver).
- **Histórico:** os últimos 14 dias, todos registráveis, também só com "Feito".
- **Calendário:** dia feito fica verde com ✓, como hoje; dia sem registro fica só com o número (não é "sem registro", porque nenhum dia era obrigatório). Cada semana ganha uma **oitava coluna "Meta"**, com "2/3" ou "3/3 ✓"; a semana atual mostra o progresso sem marcar falta.
- O resumo do mês fica: "Em novembro: 10 de 12 dias-meta, 83% de adesão."

### Onde mais aparece

- Lista de rotinas, página do objetivo, evidência do PDI e painel: o texto de quando ("3x por semana") e a adesão já calculada pelo novo `computeAdherence`; nenhuma tela nova.
- **Demonstração:** a rotina "Exercício" passa a ser meta semanal (3x por semana), para o tipo aparecer no app de demonstração.

## Fora de escopo

- Metas por mês ("10 vezes no mês") ou por dia ("2 vezes por dia").
- Semana começando no domingo ou configurável.
- Streak (próximo plano, que vai contar semanas seguidas para esse tipo).
- Lembretes.

## Organização do código

- `src/modules/routines/rules.ts`: `Schedule` ganha `timesPerWeek`; `computeAdherence` passa a tratar os dois tipos (a parte nova, `weeklyGoalAdherence`, separada e testada); `weekProgress(routine, logs, date)` devolve "feitos e meta" da semana de uma data; `monthCalendar` ganha a coluna da semana.
- `src/modules/routines/schemas.ts`: campo `frequency` (`DAYS` ou `WEEKLY`) e `timesPerWeek`, com a regra de que cada tipo exige o seu campo.
- `src/modules/routines/service.ts`: grava os 7 dias nas metas semanais; `listRoutinesForDay` devolve também o progresso da semana; recusa "Pulado" em meta semanal (`SkipNotAllowedError`).
- Componentes: `routine-form.tsx`, `log-controls.tsx` (sem "Pular" no tipo novo), `routine-calendar.tsx`, tela Hoje, painel e textos em `labels.ts`.

## Arquivos afetados

```
prisma/schema.prisma, prisma/migrations/<timestamp>_add_routine_times_per_week/
src/modules/routines/{rules,schemas,service,actions,labels}.ts (+ testes)
src/components/routines/{routine-form,log-controls,routine-calendar,routine-list}.tsx
src/components/dashboard/today-card.tsx, src/app/(app)/today/page.tsx
src/app/(app)/routines/[id]/page.tsx, src/app/(app)/routines/[id]/edit/page.tsx
src/components/pdi/action-evidence.tsx (texto de quando)
src/demo/seed-demo.ts (+ teste)
e2e/routines.spec.ts, e2e/helpers.ts
CLAUDE.md (modelo de domínio e regras)
```

## Testes (escritos antes do código, em TDD)

### Unidade

- **`weeklyGoalAdherence`:** semanas fechadas com meta cumprida, não cumprida e passada (5 feitos numa meta de 3 contam 3); semana incompleta no início (começou na quinta) e no fim (terminou na terça) com meta proporcional; semana atual conta só o feito; período que corta uma semana ao meio (os 30 dias da adesão).
- **`weekProgress`:** progresso da semana de hoje, segunda e domingo como limites.
- **`monthCalendar` com meta semanal:** dia sem registro não é "sem registro"; coluna da semana com "2/3", "3/3" e a semana atual.
- **Schema:** cada tipo exige o seu campo; `timesPerWeek` só de 1 a 6; o tipo "dias fixos" continua exigindo pelo menos um dia.
- **Textos:** "3 vezes por semana", "1 de 3 nesta semana", "Meta da semana cumprida", resumo do mês em dias-meta.

### Integração

- Criar uma rotina de meta semanal grava os 7 dias; editar troca o tipo nos dois sentidos sem apagar registros.
- `logRoutine` aceita qualquer dia e recusa "pulado" (`SkipNotAllowedError`).
- `listRoutinesForDay` traz a meta semanal todo dia, com o progresso da semana.
- Evidência do PDI e painel somam uma rotina de cada tipo.
- Demonstração: "Exercício" é meta semanal.

### E2E

1. Criar uma rotina "3 vezes por semana" pelo formulário (o seletor aparece só nessa opção).
2. Na tela Hoje, ela mostra "0 de 3 nesta semana", não tem "Pular", e "Feito" muda para "1 de 3".
3. O calendário mostra a coluna "Meta" com o progresso da semana.
4. Formulário, tela Hoje e página da rotina passam no axe.

## Critério de pronto

- `npm run lint`, `npm run typecheck`, `npm test` e `npm run test:e2e` passando; migration incluída.
- Capturas do formulário, da tela Hoje e do calendário de uma meta semanal conferidas.
- `CLAUDE.md` e este plano atualizados.

## Mudanças durante a implementação

- **`frequency` não é gravado:** é só um campo do formulário. O schema Zod transforma a entrada: na meta semanal, `weekdays` vira os 7 dias e `timesPerWeek` fica com N; nos dias fixos, `timesPerWeek` vira `null`. O banco só tem `timesPerWeek`.
- **Checagens do schema que só olham para o tipo** (pelo menos um dia nos dias fixos; quantas vezes na meta semanal) usam `when` com "nenhum erro em `frequency`, `weekdays` ou `timesPerWeek`", para os erros aparecerem junto com os outros campos.
- **Edição de uma meta semanal** abre com os dias desmarcados: se o tipo for trocado para dias fixos, não vêm os 7 dias marcados.
- **`scheduleText` recebe a rotina** (`weekdays`, `timesPerWeek`, `timeOfDay`) em vez de dois parâmetros; as quatro telas que o usam foram atualizadas.
- **Evidência do PDI** passou a carregar `timesPerWeek` (`EvidenceRoutine`); sem isso, uma rotina semanal vinculada a uma ação seria contada como diária.
- **Estado `OPEN` ("livre")** no calendário para um dia sem registro de meta semanal; a legenda da meta semanal só mostra "feita", e a coluna "Meta" tem nome acessível próprio ("semana em andamento, 1 de 3").
- **Testes de integração do painel e da evidência do PDI** com os dois tipos de rotina foram escritos depois da correção da evidência, como proteção contra regressão (não foram vistos falhando antes).
- **`expectNoAxeViolations` espera o `<title>`:** na bateria completa, o axe rodou logo depois do "Feito" (uma Server Action), no instante em que o Next atualiza a página e o título fica vazio, e acusou `document-title`. O helper dos e2e agora espera um título não vazio antes de analisar; vale para todos os testes.
- **Demonstração:** "Exercício" virou meta semanal de 3 vezes, com um padrão de registros sem "pulado".

## Decisões

1. A meta semanal aparece na tela Hoje todos os dias, com o progresso, e continua depois de cumprida.
2. Sem "Pular" na meta semanal.
3. Adesão em dias-meta.
4. Trocar o tipo de uma rotina existente é permitido, mantendo os registros.
