# 002 — Trilhas e etapas

Status: **implementado em 2026-11-16**, aprovado no mesmo dia (etapas com três status, status da trilha derivado, reordenação por botões e links em nova aba)
Branch: `feat/tracks`

## Objetivo

Cadastrar trilhas de desenvolvimento, cada uma com etapas ordenadas que você conclui uma a uma, e opcionalmente vincular a trilha a um objetivo. O objetivo passa a mostrar o progresso das etapas das trilhas ligadas a ele: é o primeiro pedaço do "progresso agregado" das regras de negócio.

## Escopo

### Modelo e banco

- Modelos `Track` e `TrackStep`, enum `TrackStepStatus` e relação `Track.goal` (detalhes em "Mudanças no modelo de dados"), com a migration `add_tracks`.

### Domínio (`src/modules/tracks/`)

- **`schemas.ts`**:
  - `trackInputSchema`: `title` (obrigatório, até 120), `description` (opcional, até 2000) e `goalId` (opcional; precisa ser um UUID, e vazio vira `null`).
  - `trackStepInputSchema`:
    - `title`: obrigatório, até 160 caracteres.
    - `status`: padrão `NOT_STARTED`.
    - `dueDate`: opcional, `AAAA-MM-DD` válido.
    - `resourceUrl`: opcional; precisa ser uma URL `http://` ou `https://`, com até 2000 caracteres (`javascript:` e similares são recusados).
    - `notes`: opcional, até 5000 caracteres.
  - Mensagens de erro em pt-BR, no mesmo padrão de `goals`.
- **`service.ts`**:
  - **Trilhas:**
    - `listTracks()` traz cada trilha com o objetivo vinculado (id e título) e a contagem de etapas (total e concluídas). Ordem: as mais recentes primeiro.
    - `getTrack(id)` traz a trilha com as etapas em ordem.
    - `createTrack`, `updateTrack` e `deleteTrack` (excluir a trilha exclui as etapas). Erro: `TrackNotFoundError`.
    - Um `goalId` que não existe lança `GoalNotFoundError`, verificado no service.
  - **Etapas:**
    - `createStep(trackId, input)` coloca a etapa no fim da trilha.
    - `updateStep(stepId, input)`.
    - `setStepStatus(stepId, status)` serve ao botão "Concluir/Reabrir".
    - `moveStep(stepId, "up" | "down")` troca a posição com a vizinha, numa transação. Na ponta, não faz nada.
    - `deleteStep(stepId)` remove a etapa e fecha o buraco na numeração.
    - Erro: `TrackStepNotFoundError`.
  - **Regras puras (testadas sem banco):**
    - `isStepOverdue(step, today)`: a etapa está atrasada quando tem prazo anterior a hoje e não está `DONE`.
    - `deriveTrackStatus(counts)`: "Não iniciada" quando a trilha não tem etapas ou nenhuma começou; "Concluída" quando tem pelo menos uma etapa e todas estão concluídas; "Em andamento" nos demais casos.
    - `progressPercent(done, total)`: inteiro de 0 a 100; com 0 etapas, dá 0.
- **`actions.ts`**: actions de criar, editar e excluir trilha; criar, editar e excluir etapa; concluir/reabrir; mover para cima/baixo. Mesmo padrão de `goals`: validar com Zod, chamar o service, revalidar e redirecionar.

### Objetivos (`src/modules/goals/`)

- `getGoalProgress(goalId)` no service de objetivos devolve `{ done, total }` somando as etapas das trilhas vinculadas. A soma fica no domínio do objetivo porque, nas etapas 3 a 5, a mesma função vai somar também as ações de PDI e as rotinas.
- O diálogo de exclusão de objetivo passa a avisar: "As trilhas vinculadas continuarão existindo, sem vínculo."

### Telas

| Rota                                                          | Conteúdo                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/tracks`                                                     | Lista em cartões: título, objetivo vinculado (link), status derivado (badge) e barra de progresso com o texto "3 de 5 etapas concluídas". Lista vazia mostra mensagem com o botão "Criar trilha".                                                                                                                                                 |
| `/tracks/new` e `/tracks/[id]/edit`                           | Formulário com título, descrição e objetivo. O objetivo é um `select` com "Nenhum" e os objetivos não arquivados; se a trilha já aponta para um arquivado, ele também aparece.                                                                                                                                                                    |
| `/tracks/[id]`                                                | Detalhe: descrição, objetivo, progresso e a **lista ordenada de etapas**. Cada etapa mostra número, título, status, prazo, selo "Atrasada", link do recurso e anotações, com as ações Concluir/Reabrir, Mover para cima, Mover para baixo, Editar e Excluir. A página também tem os botões "Adicionar etapa", "Editar trilha" e "Excluir trilha". |
| `/tracks/[id]/steps/new` e `/tracks/[id]/steps/[stepId]/edit` | Formulário da etapa.                                                                                                                                                                                                                                                                                                                              |
| `/goals/[id]`                                                 | Nova seção "Trilhas", com as trilhas vinculadas (título, progresso) e o progresso agregado do objetivo. Sem trilhas, mostra: "Nenhuma trilha vinculada" e o link "Criar trilha".                                                                                                                                                                  |

- O menu principal ganha "Trilhas".
- Toda rota tem `loading.tsx`, as rotas com `[id]` têm `not-found.tsx` e todo id de campo vem de `useId`, seguindo as convenções do `CLAUDE.md`.
- **Reordenação por botões**, não por arrastar: funciona com teclado e leitor de tela e não exige dependência nova. Os botões têm nome acessível completo ("Mover etapa 'X' para cima"). Na primeira e na última etapa, o botão correspondente fica desabilitado.
- O link do recurso abre em nova aba, com `rel="noopener noreferrer"` e o aviso "(abre em nova aba)" para leitores de tela.
- Excluir trilha e excluir etapa pedem confirmação.

### Componentes shadcn/ui a adicionar

`progress` (barra de progresso acessível, baseada em Radix; nenhuma dependência nova).

## Fora de escopo

- Arrastar e soltar para reordenar.
- Arquivar trilha: o modelo não tem esse campo. Se você quiser, entra num plano futuro.
- Vincular uma **etapa** individual a um objetivo. O modelo prevê o vínculo na trilha, e o progresso do objetivo vem das etapas dessas trilhas.
- Progresso agregado com ações de PDI e rotinas (etapas 3 a 5).
- Filtros e busca na lista de trilhas.
- Duplicar trilha ou usar trilha como modelo.

## Mudanças no modelo de dados

```prisma
enum TrackStepStatus {
  NOT_STARTED
  IN_PROGRESS
  DONE

  @@map("track_step_status")
}

model Track {
  id          String      @id @default(uuid(7)) @db.Uuid
  title       String      @db.VarChar(120)
  description String?
  goalId      String?     @map("goal_id") @db.Uuid
  goal        Goal?       @relation(fields: [goalId], references: [id], onDelete: SetNull)
  steps       TrackStep[]
  createdAt   DateTime    @default(now()) @map("created_at")
  updatedAt   DateTime    @updatedAt @map("updated_at")

  @@index([goalId])
  @@map("tracks")
}

model TrackStep {
  id          String          @id @default(uuid(7)) @db.Uuid
  trackId     String          @map("track_id") @db.Uuid
  track       Track           @relation(fields: [trackId], references: [id], onDelete: Cascade)
  title       String          @db.VarChar(160)
  order       Int             @map("position")
  status      TrackStepStatus @default(NOT_STARTED)
  dueDate     DateTime?       @map("due_date") @db.Date
  resourceUrl String?         @map("resource_url") @db.VarChar(2000)
  notes       String?
  createdAt   DateTime        @default(now()) @map("created_at")
  updatedAt   DateTime        @updatedAt @map("updated_at")

  @@unique([trackId, order])
  @@map("track_steps")
}

// Goal ganha a relação inversa:
//   tracks Track[]
```

- **`order` vira a coluna `position`**, porque `ORDER` é palavra reservada do SQL.
- **`@@unique([trackId, order])`** garante no banco que duas etapas não ocupem a mesma posição. Por isso a troca de posição usa um valor temporário dentro da transação.
- **`onDelete: SetNull`** em `Track.goal` aplica a decisão do plano 001: excluir um objetivo desfaz o vínculo e mantém as trilhas.
- **`onDelete: Cascade`** em `TrackStep.track`: etapas não existem sem a trilha.

## Arquivos afetados

```
prisma/schema.prisma                                   (Track, TrackStep, relação em Goal)
prisma/migrations/<timestamp>_add_tracks/              (nova)
src/modules/tracks/schemas.ts, schemas.test.ts         (novos)
src/modules/tracks/service.ts                          (novo)
src/modules/tracks/service.test.ts                     (novo: regras puras)
src/modules/tracks/service.int.test.ts                 (novo)
src/modules/tracks/actions.ts, labels.ts               (novos)
src/modules/goals/service.ts, service.int.test.ts      (getGoalProgress)
src/app/tracks/**                                      (páginas, loading, not-found)
src/app/goals/[id]/page.tsx                            (seção Trilhas)
src/components/tracks/*                                (formulários, lista, etapas, diálogos)
src/components/goals/delete-goal-button.tsx            (aviso sobre trilhas)
src/components/main-nav.tsx                            (link Trilhas)
src/components/ui/progress.tsx                         (shadcn)
e2e/tracks.spec.ts                                     (novo)
e2e/goals.spec.ts                                      (seção Trilhas no objetivo)
```

## Testes (escritos antes do código, em TDD)

### Unidade

| Arquivo                              | Casos                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/modules/tracks/schemas.test.ts` | Título obrigatório e limites; `goalId` vazio vira `null`; `goalId` que não é UUID é recusado; `resourceUrl` aceita `https://…` e `http://…`; recusa `javascript:alert(1)`, `ftp://…` e texto solto; vazio vira `null`; prazo inválido é recusado; status padrão `NOT_STARTED`; limites de anotações; mensagens em pt-BR. |
| `src/modules/tracks/service.test.ts` | `isStepOverdue` (prazo passado e não concluída; concluída; prazo igual a hoje; sem prazo). `deriveTrackStatus` (0 etapas; nenhuma começada; uma em andamento; algumas concluídas; todas concluídas). `progressPercent` (0 de 0, 1 de 3 = 33, 3 de 3 = 100).                                                              |

### Integração (banco de teste)

| Arquivo                                  | Casos                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/modules/tracks/service.int.test.ts` | Criar trilha com e sem objetivo; `goalId` inexistente lança `GoalNotFoundError`. `listTracks` traz contagens corretas e o título do objetivo. `getTrack` traz etapas em ordem; id inexistente ou malformado lança `TrackNotFoundError`. Etapas novas entram no fim (posições 1, 2, 3). `moveStep` para cima e para baixo troca posições; na ponta, não muda nada. `deleteStep` fecha o buraco (1, 2, 3 → remove a 2 → 1, 2). `setStepStatus` altera só o status. Excluir trilha remove as etapas. Excluir o objetivo deixa a trilha com `goalId = null`. Erros de "não encontrado" para etapa inexistente. |
| `src/modules/goals/service.int.test.ts`  | `getGoalProgress`: sem trilhas dá `{ done: 0, total: 0 }`; soma etapas de duas trilhas vinculadas e ignora trilhas de outros objetivos.                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

### E2E (`e2e/tracks.spec.ts` e `e2e/goals.spec.ts`)

1. Lista de trilhas vazia mostra a mensagem e o botão "Criar trilha".
2. Criar trilha vinculada a um objetivo leva ao detalhe com o objetivo exibido.
3. Adicionar três etapas: elas aparecem numeradas 1, 2 e 3, e "Mover para cima" na terceira a coloca em segundo.
4. Concluir uma etapa atualiza o progresso para "1 de 3 etapas concluídas" e o status da trilha para "Em andamento"; concluir todas mostra "Concluída".
5. Etapa com prazo passado e não concluída mostra "Atrasada".
6. Formulário de etapa com URL inválida mostra o erro no campo.
7. Excluir etapa e excluir trilha pedem confirmação.
8. O detalhe do objetivo mostra a trilha vinculada e o progresso agregado.
9. Lista, detalhe e formulários de trilha passam no axe.

## Critério de pronto

- `npm run lint`, `npm run typecheck`, `npm test` e `npm run test:e2e` passando.
- Migration `add_tracks` incluída.
- Este plano atualizado se o escopo mudar durante a implementação.

## Mudanças durante a implementação

- **Refatorações compartilhadas** (para não triplicar código entre objetivos, trilhas e etapas):
  - `src/lib/form-fields.ts`: construtores Zod reaproveitados (`requiredText`, `optionalText`, `optionalDateOnly`, `optionalUuid`, `optionalHttpUrl`, `isUuid`). O schema de objetivos passou a usá-los, com o mesmo comportamento (testes inalterados).
  - `src/lib/prisma-errors.ts`: `isRecordNotFound` para o erro P2025 do Prisma, usado pelos services de objetivos e trilhas.
  - `src/components/forms/use-schema-form.ts`: hook com a lógica dos formulários (validação no navegador, erros por campo, foco, `useId`, limpeza por Activity). `GoalForm`, `TrackForm` e `StepForm` usam o hook, e `FormActions`/`FormErrorMessage` cuidam dos botões e da mensagem geral.
  - `ConfirmDeleteButton` e `SubmitButton` genéricos. `DeleteGoalButton` virou um invólucro fino sobre o primeiro.
- **`getStep`** no service de trilhas, usado pela action de excluir etapa para saber para qual trilha voltar.
- **`listTracks({ goalId })`** para a seção "Trilhas" do objetivo.
- **"Criar trilha" no objetivo** abre `/tracks/new?goalId=…` com o objetivo já escolhido.
- **Opções de objetivo no formulário de trilha** (`src/app/tracks/goal-options.ts`): objetivos não arquivados mais o atual, quando ele foi arquivado depois ("(arquivado)").
- **`/tracks/[id]/steps/[stepId]/not-found.tsx`**: mensagem própria para etapa inexistente ou de outra trilha.
- **Concluir/reabrir e mover** usam `refresh()` (de `next/cache`) para re-renderizar a página atual sem redirecionar.
- **`/tracks` chama `connection()`**: a página não lê dados da URL, então isso deixa explícito que ela é renderizada a cada requisição.
- **Correção no `progress` do shadcn**: o componente não repassava `value` ao Radix, e a barra ficava sem `aria-valuenow`. Corrigido em `src/components/ui/progress.tsx`, com comentário.
- **E2E**: helpers em `e2e/helpers.ts` (limpar banco, criar objetivo/trilha/etapa, axe), usados por `goals.spec.ts` e `tracks.spec.ts`. O Playwright passou a usar **1 worker**, porque os dois arquivos limpam o mesmo banco de teste. Contagens de texto usam `.filter({ visible: true })` para ignorar as páginas escondidas pelo Activity.
- **Prisma 7**: `migrate dev` não roda mais o `generate`. É preciso rodar `npx prisma generate` depois de criar a migration (o `postinstall` só cobre o `npm install`).

## Decisões

1. Etapas com três status: `NOT_STARTED`, `IN_PROGRESS` e `DONE`.
2. Status da trilha derivado das etapas, sem campo no banco.
3. Reordenação por botões "para cima/para baixo".
4. Links de recurso abrem em nova aba.
