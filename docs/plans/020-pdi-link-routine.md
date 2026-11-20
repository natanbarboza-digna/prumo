# 020 — Vincular uma rotina existente a uma ação de PDI

Status: **implementado em 2026-11-20**, aprovado com as propostas das perguntas (ver "Decisões")
Branch: `feat/pdi-link-routine`

Primeiro plano do grupo PDI (vincular rotina existente, reordenar áreas e ações, prévia e exportação da planilha). Retoma o que ficou fora do plano 005.

## Objetivo

Hoje o vínculo entre rotina e ação de PDI só nasce quando a rotina é criada pelo botão "Criar rotina" da ação, e só muda quando a ação é concluída ou cancelada. Quem já tinha uma rotina (por exemplo, "Ler 20 minutos" criada antes do ciclo) não consegue usá-la como evidência sem criar outra.

Este plano permite:

- **vincular** uma rotina que já existe a uma ação, pela página da ação;
- **desvincular** uma rotina de uma ação, pela página da rotina e pela lista de rotinas da ação.

## Regras

### Vincular

- A ação precisa aceitar rotina: vale o mesmo `routineBlocker` da criação (ciclo não encerrado, ação não concluída nem cancelada, categoria com `allowsRoutine`). Validado no service, não só escondendo o seletor.
- **Quais rotinas aparecem** (pergunta 1): só as **sem vínculo** e **não encerradas** (`endDate` vazio ou de hoje em diante). Rotina vinculada a outra ação não aparece; para trocar, desvincule antes.
- Rotinas que ainda não começaram podem ser vinculadas.
- Os registros que a rotina já tem passam a contar como evidência normalmente: a adesão é sempre calculada no período em que rotina e ciclo se sobrepõem (plano 005), então registros de antes do ciclo continuam fora da conta.
- Sem rotina disponível, a página da ação mostra só "Criar rotina".

### Desvincular

- Limpa o `pdiActionId`. A rotina e os registros continuam; só deixam de contar como evidência da ação.
- **Onde** (pergunta 2): na página da rotina, ao lado do link para a ação, e em cada rotina da lista "Rotinas vinculadas" da ação.
- Pede confirmação (`ConfirmActionButton`): "Os registros de “Ler” deixam de contar como evidência da ação “Praticar inglês”. A rotina continua."
- **Ciclo encerrado** (pergunta 3): não permite desvincular, porque o ciclo é somente leitura e a evidência dele não deve mudar depois de fechado. O botão não aparece e o service recusa (`CycleClosedError`).
- Ação concluída ou cancelada em ciclo aberto: permite desvincular (corrigir um vínculo errado não depende do status da ação).

## Fora de escopo

- Escolher a ação pelo formulário da rotina (o vínculo continua partindo da ação).
- Vincular uma rotina a mais de uma ação.
- Vincular rotinas encerradas (pergunta 1).
- Reordenar áreas e ações, prévia e exportação da planilha (próximos planos do grupo).

## Mudanças no modelo de dados

Nenhuma. O vínculo continua sendo o `pdiActionId` da rotina.

## Organização do código

- **`src/modules/pdi/service.ts`** (ou `routines/service.ts`, ao lado de `assertActionTakesRoutine`, que já está lá):
  - `listLinkableRoutines(today)`: rotinas sem vínculo e não encerradas, por título.
  - `linkRoutine(actionId, routineId, today)`: valida a ação com a regra de `assertActionTakesRoutine` e a rotina (existe, sem vínculo, não encerrada). Erros novos: `RoutineAlreadyLinkedError` e `RoutineEndedError`.
  - `unlinkRoutine(routineId)`: rotina sem vínculo é um no-op; ciclo encerrado lança `CycleClosedError`.
- **`src/modules/pdi/schemas.ts`**: schema Zod do formulário de vínculo (`routineId` UUID).
- **`src/modules/pdi/actions.ts`**: `linkRoutineAction` e `unlinkRoutineAction`, com `requireSession()` e revalidação das telas de rotina, de PDI e de `/`.
- **Telas:**
  - `src/app/(app)/pdi/[id]/actions/[actionId]/page.tsx`: formulário "Vincular rotina existente" (um `select` com as rotinas disponíveis e o botão "Vincular"), ao lado de "Criar rotina", só quando a ação aceita rotina e há rotina disponível.
  - `src/components/pdi/action-evidence.tsx`: botão "Desvincular" em cada rotina, quando o ciclo não está encerrado.
  - `src/app/(app)/routines/[id]/page.tsx`: botão "Desvincular" ao lado do link da ação, com a mesma condição.

## Arquivos afetados

```
src/modules/pdi/{service,schemas,actions,labels}.ts (+ testes)
src/modules/routines/service.ts (se as funções ficarem lá)
src/app/(app)/pdi/[id]/actions/[actionId]/page.tsx
src/components/pdi/action-evidence.tsx, src/components/pdi/link-routine-form.tsx (novo)
src/app/(app)/routines/[id]/page.tsx
e2e/pdi-routines.spec.ts
CLAUDE.md (regra do vínculo)
```

## Testes (escritos antes do código, em TDD)

### Integração (service, banco de teste)

- `listLinkableRoutines` traz rotinas sem vínculo e não encerradas (inclusive as que ainda não começaram); deixa de fora as vinculadas e as encerradas.
- `linkRoutine` grava o `pdiActionId`, e `getActionDetail` passa a mostrar a rotina com a adesão no período do ciclo.
- `linkRoutine` recusa: ciclo encerrado, ação concluída ou cancelada, categoria sem `allowsRoutine`, rotina já vinculada, rotina encerrada, rotina ou ação inexistente.
- `unlinkRoutine` limpa o vínculo e mantém a rotina e os registros; recusa com ciclo encerrado; aceita ação concluída em ciclo aberto.

### Unidade

- Schema do formulário de vínculo (UUID obrigatório) e os textos novos de erro.

### E2E (dados pelas factories)

1. Na página de uma ação "Prática", vincular uma rotina existente pelo seletor: ela aparece em "Rotinas vinculadas", e a página da rotina mostra o link para a ação.
2. Desvincular pela página da rotina, com confirmação: a rotina some da ação e continua na lista de rotinas.
3. Ciclo encerrado: a página da ação e a da rotina não mostram "Desvincular" nem o seletor.

Rodam só o `pdi-routines.spec.ts` e o `routines.spec.ts` (a página da rotina muda), conforme a regra do `CLAUDE.md`.

## Critério de pronto

- `npm run lint`, `npm run typecheck`, `npm test` e os e2e da área passando.
- `CLAUDE.md` e este plano atualizados.

## Mudanças durante a implementação

- **Tudo no módulo de rotinas:** `listLinkableRoutines`, `linkRoutine` e `unlinkRoutine` ficaram em `src/modules/routines/service.ts` (ao lado de `assertActionTakesRoutine`, sem importação circular com o PDI), e `linkRoutineAction`/`unlinkRoutineAction` em `src/modules/routines/actions.ts`, que já revalida as telas de rotina, de PDI e `/`. O schema do formulário é o `linkExistingRoutineSchema` (`routines/schemas.ts`), e o texto da confirmação, `unlinkRoutineText` (`routines/labels.ts`). Nada mudou em `pdi/`.
- **`Routine.pdiAction.cycleClosed`:** a rotina passou a saber se o ciclo da ação está encerrado, para a página da rotina esconder "Desvincular da ação".
- **Página da rotina:** "Desvincular da ação" fica na fila de botões (Editar, Encerrar, Excluir), não ao lado do link da ação.
- **`ConfirmActionButton` ganhou `triggerAriaLabel`:** na ação, cada rotina tem um "Desvincular" com nome acessível próprio ("Desvincular a rotina Manhã").
- **E2E:** com o diálogo de confirmação aberto, o resto da página sai da árvore de acessibilidade, então os testes esperam o diálogo fechar antes de conferir que o vínculo sumiu. Rodaram o `pdi-routines.spec.ts` (9 testes) e, porque as páginas da ação e da rotina mudaram, o `routines.spec.ts` e o `pdi.spec.ts` (22 testes).

## Decisões

1. Só rotinas sem vínculo e não encerradas podem ser vinculadas; trocar de ação exige desvincular antes.
2. Desvincular na página da rotina e na lista de rotinas da ação.
3. Ciclo encerrado não deixa desvincular.
