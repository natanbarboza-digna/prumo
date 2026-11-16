# 005 — Rotina a partir de ação de PDI

Status: **implementado em 2026-11-16**, aprovado no mesmo dia com as propostas das perguntas (ver "Decisões")
Branch: `feat/pdi-routines`

## Objetivo

Transformar uma ação de PDI em prática diária. Uma ação cuja categoria tem `allowsRoutine = true` pode gerar uma rotina vinculada (`pdiActionId`). Os registros dessa rotina viram evidência da ação, com a taxa de adesão no período do ciclo. Ao concluir ou cancelar a ação, o usuário decide o destino da rotina.

## Escopo

### Criar rotina a partir de uma ação

- **Botão "Criar rotina"** na ação, nas duas telas: na lista do ciclo e na nova página da ação. Ele aparece só quando as três condições valem:
  - a categoria tem `allowsRoutine = true`;
  - a ação não está `DONE` nem `CANCELLED`;
  - o ciclo não está `CLOSED`.
- **A regra fica no service, não só na tela.** `createRoutine` recebe o `pdiActionId` opcional e recusa nestes casos:
  - ação inexistente: `PdiActionNotFoundError`;
  - categoria sem `allowsRoutine`: `CategoryDisallowsRoutineError`;
  - ação concluída ou cancelada: `ActionFinishedError`;
  - ciclo encerrado: `CycleClosedError`.
- **Fluxo:** o botão leva a `/routines/new?pdiActionId=…`, que abre o formulário de rotina de sempre já preenchido:
  - título igual ao da ação;
  - objetivo igual ao da ação;
  - início hoje;
  - fim igual ao prazo da ação, se o prazo for hoje ou depois (pergunta 4).
- **Na tela do formulário:**
  - Um aviso no topo diz "Vinculada à ação de PDI: _título_ (_ciclo_)".
  - O `pdiActionId` vai num campo escondido.
  - Se a ação não puder receber rotina, a página mostra o motivo e um link de volta, em vez do formulário.
  - Depois de criar, volta para a página da ação.
- **Uma ação pode ter mais de uma rotina** (pergunta 1), por exemplo duas práticas diferentes para a mesma ação.
- **O vínculo não muda na edição da rotina.** `updateRoutine` ignora `pdiActionId`. O detalhe e o formulário de edição mostram o vínculo como informação.
- **Categorias que mudam depois:** trocar a categoria da ação ou desligar `allowsRoutine` não apaga nem desvincula as rotinas existentes. Só bloqueia rotinas novas.

### Evidência na ação

- **Nova página da ação** `/pdi/[id]/actions/[actionId]`, com:
  - os dados da ação;
  - a seção **"Rotinas vinculadas"**: título, dias, estado ("Ativa", "Começa em", "Termina hoje", "Encerrada") e a **adesão no período** ("80% · 12 de 15 dias feitos, 1 pulado, 2 sem registro");
  - a seção **"Registros"**: feitos e pulados, do mais recente para o mais antigo, com a nota de cada um.
- **Período da evidência** (pergunta 2): a interseção entre o período da rotina e o do ciclo, até hoje. Em fórmula: de `max(início da rotina, início do ciclo)` até `min(fim da rotina, fim do ciclo, hoje)`. Assim, um registro feito depois do fim do ciclo não conta para aquele PDI. O cálculo reaproveita `computeAdherence`; hoje só entra depois de registrado.
- **Na lista do ciclo,** cada ação com rotina mostra uma linha curta: "Rotina: 80% de adesão". Se houver mais de uma, mostra a média ponderada pelos dias previstos, com o texto "2 rotinas: 75% de adesão".
- O título da ação, na lista do ciclo e na página do objetivo, vira link para a página da ação.
- Ciclo encerrado mostra a evidência normalmente, só para leitura.

### Concluir ou cancelar uma ação com rotina

- **Campo no formulário da ação:** "O que fazer com as rotinas vinculadas?", com duas opções:
  - **Encerrar a rotina:** preenche `endDate` com hoje; ela continua vinculada como evidência.
  - **Manter a rotina, sem vínculo:** `pdiActionId` vira `null`; a rotina segue normal e deixa de aparecer na ação.
- **Quando o campo aparece:** só se o status escolhido for `DONE` ou `CANCELLED` e a ação tiver rotina ainda não encerrada (ativa ou que ainda vai começar). A página de edição informa ao formulário quantas rotinas estão nessa situação.
- **No servidor:** nessa situação, `updateAction` exige a escolha (`RoutineOutcomeRequiredError`, com o erro no campo). A atualização da ação e das rotinas acontece numa transação.
- **Rotina que ainda não começou** e recebe "Encerrar" é excluída (pergunta 3). Ela não tem registros, porque o app não aceita registro antes do início. O texto da opção avisa isso quando for o caso.
- **Rotinas já encerradas** continuam vinculadas, qualquer que seja a escolha, para preservar a evidência.
- Voltar uma ação concluída para "Em andamento" não mexe nas rotinas.

### Exclusões

- **Excluir uma ação** com rotinas desfaz o vínculo (`onDelete: SetNull`): as rotinas continuam, sem vínculo. O texto da confirmação avisa. O mesmo vale ao excluir uma área ou um ciclo.
- **Excluir uma rotina vinculada** apaga os registros dela, como hoje, e a evidência some da ação. A confirmação avisa isso.

### Rotinas

- **Detalhe da rotina:** linha "Ação de PDI: _título_", com link para a página da ação.
- **Lista de rotinas:** ganha o selo "PDI" nas rotinas vinculadas.

## Fora de escopo

- Vincular uma rotina já existente a uma ação, ou desvincular manualmente pela tela da rotina (o vínculo nasce na criação e só muda pela conclusão ou cancelamento da ação). Fica anotado em Pendências se fizer falta.
- Copiar a evidência para o campo de texto `evidence` da ação.
- Rotina vinculada a mais de uma ação.
- Painel inicial (etapa 6).

## Mudanças no modelo de dados

```prisma
model Routine {
  // ...campos atuais
  pdiActionId String?    @map("pdi_action_id") @db.Uuid
  pdiAction   PdiAction? @relation(fields: [pdiActionId], references: [id], onDelete: SetNull)

  @@index([pdiActionId])
}

model PdiAction {
  // ...campos atuais
  routines Routine[]
}
```

Migration `add_routine_pdi_action`: uma coluna opcional, a chave estrangeira e o índice. Nenhum dado existente muda.

## Organização do código

- **Regras puras em arquivo próprio.** `isScheduledOn`, `routineStateOn` e `computeAdherence` saem de `src/modules/routines/service.ts` e vão para `src/modules/routines/rules.ts`, junto com o novo `evidencePeriod`. Esse arquivo não acessa o banco.
- **Por que mover:** o service de PDI precisa dessas regras para calcular a evidência e encerrar rotinas, e o service de rotinas precisa dos erros de PDI para validar a criação. Se os dois services importassem um ao outro, haveria importação circular. Com as regras num arquivo sem banco, cada service importa só o que precisa.
- **O que fica em cada service:**
  - `routines/service.ts`: valida o `pdiActionId` na criação.
  - `pdi/service.ts`:
    - `getActionDetail`: ação, rotinas, adesão e registros;
    - um resumo de adesão por ação para a lista do ciclo;
    - a escolha de destino das rotinas dentro de `updateAction`.

## Arquivos afetados

```
prisma/schema.prisma, prisma/migrations/<timestamp>_add_routine_pdi_action/
src/modules/routines/rules.ts                       (novo: regras puras + evidencePeriod)
src/modules/routines/{service,schemas,actions}.ts   (pdiActionId na criação, redirect para a ação)
src/modules/pdi/{service,schemas,actions}.ts        (evidência, routineOutcome, novos erros)
src/modules/pdi/labels.ts                           (textos de adesão da evidência)
src/app/routines/new/page.tsx                       (?pdiActionId=, aviso e campo escondido)
src/app/routines/[id]/page.tsx                      (link para a ação)
src/app/pdi/[id]/actions/[actionId]/page.tsx        (nova página da ação) + loading.tsx
src/app/pdi/[id]/actions/[actionId]/edit/page.tsx   (passa as rotinas em vigor ao formulário)
src/app/pdi/[id]/page.tsx, src/app/goals/[id]/page.tsx  (título da ação vira link)
src/components/pdi/{action-list,action-form}.tsx    (botão Criar rotina, resumo, campo de destino)
src/components/pdi/action-evidence.tsx              (novo: rotinas vinculadas e registros)
src/components/routines/{routine-form,routine-list}.tsx  (aviso de vínculo, selo PDI)
e2e/helpers.ts, e2e/pdi-routines.spec.ts            (novo)
```

## Testes (escritos antes do código, em TDD)

### Unidade

| Arquivo                                | Casos                                                                                                                                                                                                                                                                                                     |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/modules/routines/rules.test.ts`   | Os testes atuais de `isScheduledOn`, `routineStateOn` e `computeAdherence` (movidos). `evidencePeriod`: rotina dentro do ciclo; rotina que começa antes do ciclo; rotina sem fim; ciclo já encerrado (corta no fim do ciclo); rotina que começa depois de hoje ou depois do fim do ciclo (período vazio). |
| `src/modules/pdi/schemas.test.ts`      | `routineOutcome` aceita `END`/`UNLINK`, é opcional e recusa outros valores.                                                                                                                                                                                                                               |
| `src/modules/pdi/service.test.ts`      | Combinação de adesões de várias rotinas (ponderada pelos dias previstos; 0 sem dias).                                                                                                                                                                                                                     |
| `src/modules/routines/schemas.test.ts` | `pdiActionId` opcional na criação; vazio vira `null`; UUID inválido é recusado.                                                                                                                                                                                                                           |

### Integração (banco de teste)

| Arquivo                                    | Casos                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/modules/routines/service.int.test.ts` | Criar com ação de categoria que permite rotina; recusar categoria sem `allowsRoutine`, ação concluída, ação cancelada, ciclo encerrado e ação inexistente; duas rotinas para a mesma ação; `updateRoutine` não altera o vínculo; desligar `allowsRoutine` ou trocar a categoria mantém as rotinas existentes e bloqueia novas.                                                                                                                                                                                                                                                                                                                    |
| `src/modules/pdi/service.int.test.ts`      | `getActionDetail` traz rotinas, adesão no período (registros fora do ciclo não contam) e registros em ordem decrescente; concluir sem escolha, com rotina em vigor, lança `RoutineOutcomeRequiredError`; concluir sem rotina em vigor não exige escolha; `END` encerra hoje e mantém o vínculo; `END` exclui a rotina que ainda não começou; `UNLINK` desfaz o vínculo e não mexe no fim; rotina já encerrada continua vinculada nos dois casos; cancelar segue as mesmas regras; falha no meio não deixa a ação atualizada sem as rotinas (transação); excluir a ação deixa a rotina sem vínculo; resumo de adesão por ação no detalhe do ciclo. |

### E2E (`e2e/pdi-routines.spec.ts`)

1. Ação de categoria "Prática" mostra "Criar rotina"; ação de "Curso" não mostra.
2. Criar rotina a partir da ação: o formulário vem preenchido (título, objetivo, fim = prazo) com o aviso de vínculo. Depois de salvar, a página da ação lista a rotina, e o detalhe da rotina tem o link para a ação.
3. Registrar a rotina na tela "Hoje" faz a ação mostrar o registro e a adesão.
4. Concluir a ação: o campo de destino aparece. Sem escolher, mostra o erro. Com "Encerrar a rotina", a rotina fica "Termina hoje" e continua na ação.
5. Cancelar outra ação com "Manter sem vínculo": a rotina sai da ação e continua em `/routines`, sem o selo PDI.
6. Desligar `allowsRoutine` na categoria: o botão some, e a rotina existente continua na ação.
7. A página da ação e o formulário de rotina vinculada passam no axe.

## Critério de pronto

- `npm run lint`, `npm run typecheck`, `npm test` e `npm run test:e2e` passando.
- Migration `add_routine_pdi_action` incluída.
- `CLAUDE.md` atualizado (regras novas e lista de reaproveitamento) e este plano atualizado se o escopo mudar.

## Mudanças durante a implementação

- **`routineBlocker`** (regra pura no service de PDI) diz por que uma ação não aceita rotina: ciclo encerrado, ação concluída ou cancelada, ou categoria sem `allowsRoutine`, nessa ordem. `createRoutine` usa a regra para lançar o erro certo, e as telas a usam para mostrar o botão ou o motivo. Os textos ficam em `routineBlockerText` (`src/modules/pdi/labels.ts`).
- **`combineAdherence`** também ficou em `src/modules/routines/rules.ts` (e não no service de PDI), porque é uma regra pura de adesão.
- **O vínculo na criação** é lido por um schema separado (`routineLinkSchema`). O Zod 4 não permite estender um schema que tem `refine`, e assim a edição da rotina nem conhece o campo. `createRoutine` recebe o id como segundo argumento.
- **`updateAction` recebe `today`** como terceiro argumento opcional (o padrão é `todayInAppTimeZone()`), para que os testes fixem a data.
- **O campo de destino das rotinas** aparece e some só com CSS (`group-has-[option[value=DONE]:checked]`), sem estado no React. Depois de um erro do servidor, o select de status é remontado (`key`) para continuar mostrando o status enviado; sem isso, o reset do formulário feito pelo React voltava ao status original e escondia o campo com o erro.
- **Fixture compartilhada** `src/test/pdi-fixtures.ts` (ciclo, área, categoria e ação) para os testes de integração de rotinas e de PDI.
- **Formulário de edição da rotina** também mostra o aviso de vínculo, com link para a ação.
- **Sem teste de falha no meio da transação.** Simular uma falha entre a atualização das rotinas e a da ação exigiria injetar um erro no Prisma. A garantia vem do `$transaction`.
- **Rotas com relógio:** a página da ação chama `connection()` antes de ler "hoje"; em `/routines/new`, "hoje" passou a ser lido depois da primeira consulta ao banco.

## Decisões

1. Uma ação pode ter várias rotinas, sem limite.
2. A adesão como evidência conta a interseção entre o período da rotina e o do ciclo, até hoje.
3. Ao escolher "Encerrar", uma rotina que ainda não começou é excluída (ela não pode ter registros).
4. O fim da rotina vem preenchido com o prazo da ação quando o prazo é hoje ou depois.
