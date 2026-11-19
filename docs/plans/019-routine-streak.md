# 019 — Sequência (streak) das rotinas

Status: **implementado em 2026-11-20**, aprovado com as propostas das perguntas (ver "Decisões")
Branch: `feat/routine-streak`

Último dos três planos do grupo Rotinas (calendário, metas de frequência, streak).

## Objetivo

Mostrar há quanto tempo a rotina está sendo cumprida sem falhar: a **sequência atual** e o **recorde**. É um incentivo simples para não quebrar o hábito.

## Regras (já combinadas)

### Rotina de dias fixos: conta dias

- A sequência é a quantidade de **dias previstos seguidos com "feito"**.
- **Dia pulado quebra** a sequência. **Dia previsto que passou sem registro** também quebra.
- **Dia não previsto não conta e não quebra**: com seg, qua e sex, feito na segunda e na quarta é uma sequência de 2, mesmo com a terça no meio.
- **Hoje sem registro não quebra** (o dia ainda não acabou) e não soma; feito hoje, soma.

### Rotina de meta semanal: conta semanas

- A sequência é a quantidade de **semanas seguidas com a meta cumprida** (segunda a domingo; meta proporcional numa semana incompleta no começo ou no fim, como na adesão do plano 017).
- **Semana fechada sem a meta quebra**.
- **Semana atual** ainda não cumprida não quebra e não soma; cumprida, já soma.

### Recorde e rotinas encerradas

- O **recorde** é a maior sequência em todo o histórico da rotina.
- **Rotina encerrada** (pergunta 3): só mostra o recorde. A "sequência atual" não faz sentido depois do fim.

## Onde aparece (perguntas 1 e 2)

- **Página da rotina:** sempre, junto da adesão: "Sequência atual: 5 dias · Recorde: 12 dias" (ou "semanas"). Sem nenhum dia feito ainda: "Nenhuma sequência ainda".
- **Tela Hoje e card "Hoje" do painel:** ao lado do nome, só quando a sequência atual é de **2 ou mais**: "5 dias seguidos", "3 semanas seguidas". Abaixo disso o número não diz muito e só ocupa espaço.
- **Lista de rotinas:** a sequência atual (com o mesmo limite de 2), na linha que já mostra quando a rotina acontece.

## Fora de escopo

- Notificações ou comemorações ao bater um recorde.
- "Congelar" a sequência (dias de folga que não quebram) e histórico de sequências.
- Sequência para objetivos, trilhas ou ações de PDI.

## Mudanças no modelo de dados

Nenhuma. A sequência é calculada a partir dos registros que já existem.

## Organização do código

- **`src/modules/routines/rules.ts`** (regras puras): `routineStreak(routine, logs, today)` devolve `{ unit: "DAYS" | "WEEKS", current, best }`, com `current = null` para rotina encerrada. Reaproveita `isScheduledOn`, `weekProgress` e o cálculo de meta proporcional da meta semanal.
- **`src/modules/routines/service.ts`:** `getRoutine`/página da rotina, `listRoutines` e `listRoutinesForDay` passam a devolver a sequência. Para isso buscam os registros desde o início da rotina, só `date` e `status` (alguns milhares de linhas, no pior caso, para um app de uso pessoal).
- **`src/modules/routines/labels.ts`:** "5 dias seguidos", "1 semana seguida", "Sequência atual: …", "Recorde: …", "Nenhuma sequência ainda".
- Telas: página da rotina, tela Hoje, card "Hoje" do painel e lista de rotinas.

## Arquivos afetados

```
src/modules/routines/{rules,service,labels}.ts (+ testes)
src/app/(app)/routines/[id]/page.tsx, src/app/(app)/today/page.tsx
src/components/dashboard/today-card.tsx, src/components/routines/routine-list.tsx
e2e/routines.spec.ts
CLAUDE.md (regra da sequência)
```

## Testes (escritos antes do código, em TDD)

### Unidade (`rules.test.ts` ou arquivo próprio)

- **Dias fixos:** feitos seguidos somam; pulado quebra; previsto sem registro quebra; dia não previsto no meio não quebra; hoje sem registro não quebra nem soma; hoje feito soma; o recorde é a maior sequência, mesmo que já tenha sido quebrada; nenhum feito dá 0 e 0.
- **Meta semanal:** semanas com a meta somam; semana fechada sem a meta quebra; semana atual incompleta não quebra; semana atual cumprida soma; semana incompleta no começo da rotina usa a meta proporcional.
- **Rotina encerrada:** `current` nulo e `best` calculado até o fim.
- **Textos:** singular e plural de dias e semanas; texto da página com e sem recorde.

### Integração (`service.int.test.ts`)

- `listRoutinesForDay`, `listRoutines` e a página da rotina trazem a sequência certa, a partir dos registros gravados.

### E2E (`routines.spec.ts`, com dados pelas factories)

1. Uma rotina diária com os 3 dias anteriores feitos mostra "3 dias seguidos" na tela Hoje; marcar "Feito" hoje muda para "4 dias seguidos".
2. A página da rotina mostra "Sequência atual" e "Recorde".

Só o `routines.spec.ts` roda, conforme a regra do `CLAUDE.md`.

## Critério de pronto

- `npm run lint`, `npm run typecheck`, `npm test` e o e2e de rotinas passando.
- `CLAUDE.md` e este plano atualizados.

## Mudanças durante a implementação

- **Testes de unidade num arquivo próprio** (`src/modules/routines/streak.test.ts`), com as regras e os textos.
- **`getRoutineStreak(routineId, today)`** no service, para a página da rotina; `listRoutines` e `listRoutinesForDay` passaram a carregar todos os registros da rotina (antes, só os do período da adesão ou da semana).
- **Os 2 e2e de sequência foram escritos depois da implementação** (as regras e o service seguiram TDD). Rodaram o `routines.spec.ts` (15 testes) e, porque a mudança também tocou o card "Hoje" do painel e a lista de rotinas do objetivo, o `home.spec.ts` e o `goals.spec.ts` (13 testes).
- **No card "Hoje" do painel**, o progresso da meta semanal e a sequência ficam na mesma linha.

## Decisões

1. Página da rotina sempre; tela Hoje, painel e lista de rotinas só com a sequência atual.
2. Fora da página da rotina, a partir de 2 (dias ou semanas).
3. Rotina encerrada mostra só o recorde.
