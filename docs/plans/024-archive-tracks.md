# 024 — Arquivar trilhas, com filtro na lista

Status: **proposto**, aguardando aprovação
Branch: `feat/archive-tracks`

Primeiro plano do grupo Listas (arquivar trilhas, duplicar trilha, busca única). Retoma o que ficou fora do plano 002.

## Objetivo

Hoje a lista de trilhas mostra todas, sem filtro: as concluídas e as abandonadas ficam misturadas com as que estão em andamento. Este plano permite **arquivar** uma trilha (sai do caminho, mas continua guardada) e dá à lista de trilhas um **filtro**, como o da lista de objetivos.

## Regras

### Arquivar e desarquivar

- Botão **"Arquivar trilha"** na página da trilha, com confirmação (`ConfirmActionButton`), para trilhas em qualquer situação. Na trilha arquivada, o botão vira **"Desarquivar"** (sem confirmação, porque não perde nada).
- **Trilha arquivada é somente leitura** (pergunta 1), como o ciclo de PDI encerrado: sem editar a trilha, sem criar, editar, mover, concluir ou excluir etapas. Um aviso no topo diz "Trilha arquivada: somente leitura. Desarquive para fazer alterações." O service recusa (`TrackArchivedError`).
- **Excluir** continua possível na trilha arquivada (é o jeito de se livrar dela de vez).

### Onde a trilha arquivada aparece

| Lugar                               | Comportamento                                               |
| ----------------------------------- | ----------------------------------------------------------- |
| Lista de trilhas                    | Fora do filtro padrão; aparece em "Arquivadas" e em "Todas" |
| Painel: "Trilhas em andamento"      | Fora                                                        |
| Painel: prazos atrasados e próximos | As etapas dela ficam fora                                   |
| Página do objetivo                  | Continua na lista, com o selo "Arquivada" (pergunta 2)      |
| Progresso do objetivo               | As etapas dela **continuam contando** (pergunta 2)          |
| Busca única (plano futuro)          | Aparece, com o selo                                         |

### Filtro da lista de trilhas (pergunta 3)

Links no topo, iguais ao filtro de objetivos, com o filtro na URL (`?situacao=`):

- **Ativas** (padrão): todas as não arquivadas, em qualquer situação.
- **Não iniciadas**, **Em andamento**, **Concluídas**: só entre as não arquivadas, pela situação calculada das etapas (a mesma de hoje).
- **Arquivadas**.
- **Todas**.

Lista vazia num filtro mostra uma mensagem própria ("Nenhuma trilha arquivada.") e, no filtro padrão, continua convidando a criar a primeira trilha.

## Fora de escopo

- Duplicar trilha (próximo plano) e busca (plano seguinte).
- Arquivar etapas individuais.
- Arquivamento automático de trilhas concluídas.
- Paginação e arrastar etapas (descartados no alinhamento do grupo).

## Mudanças no modelo de dados

- `Track.archivedAt DateTime?` (coluna `archived_at`, `timestamptz`). Nulo: ativa. Com data: arquivada desde então, mostrada como "Arquivada em 20/11/2026".
- Migration simples (coluna nova, nula para as trilhas existentes). Sem índice: a lista tem poucas dezenas de linhas.

## Organização do código

- **`src/modules/tracks/service.ts`:**
  - `TrackSummary` ganha `archivedAt` (string `AAAA-MM-DD` no fuso do app, ou nulo).
  - `archiveTrack(id)` e `unarchiveTrack(id)`; arquivar uma arquivada (ou o contrário) não faz nada.
  - `listTracks({ goalId?, filter? })`: o filtro da lista (`ACTIVE`, `NOT_STARTED`, `IN_PROGRESS`, `DONE`, `ARCHIVED`, `ALL`). A página do objetivo continua pedindo todas as trilhas dele.
  - `listOpenStepsWithDueDate` deixa de fora as etapas de trilhas arquivadas; o painel pede só as não arquivadas.
  - Toda mudança na trilha ou nas etapas checa `assertTrackOpen` (somente leitura), menos excluir a trilha.
- **`src/modules/tracks/schemas.ts`:** `trackFilterSchema` (valor inválido na URL cai no padrão, como em objetivos).
- **`src/modules/tracks/actions.ts`:** `archiveTrackAction` e `unarchiveTrackAction`, com `requireSession()` e as revalidações de sempre (trilhas, objetivos, `/`).
- **Telas:** filtro na lista (`src/components/tracks/track-filter.tsx`, no molde do `GoalFilter`), selo "Arquivada" na lista e na página do objetivo, aviso e botões na página da trilha; os botões de etapa somem na trilha arquivada.
- **`e2e/factories.ts`:** `insertTrack` aceita `archivedAt`.

## Arquivos afetados

```
prisma/schema.prisma, prisma/migrations/<data>_add_track_archived_at/
src/modules/tracks/{service,schemas,actions,labels}.ts (+ testes)
src/modules/dashboard/service.ts (+ teste)
src/components/tracks/{track-filter,track-list,step-list}.tsx, src/components/tracks/track-badges.tsx
src/app/(app)/tracks/page.tsx, src/app/(app)/tracks/[id]/page.tsx, src/app/(app)/goals/[id]/page.tsx
e2e/factories.ts, src/test/e2e-factories.int.test.ts, e2e/tracks.spec.ts
CLAUDE.md (modelo de domínio e regra)
```

## Testes (escritos antes do código, em TDD)

### Integração (service)

- Arquivar grava a data; desarquivar limpa; repetir não muda nada.
- Trilha arquivada recusa editar a trilha e criar, editar, mover, mudar status e excluir etapas (`TrackArchivedError`); aceita ser excluída e desarquivada.
- `listTracks` com cada filtro: padrão sem as arquivadas; "Em andamento", "Concluídas" e "Não iniciadas" só entre as ativas; "Arquivadas"; "Todas".
- `listTracks({ goalId })` traz também as arquivadas; o progresso do objetivo conta as etapas delas.
- `listOpenStepsWithDueDate` e o painel (`getDashboard`) deixam de fora a trilha arquivada.

### Unidade

- `trackFilterSchema`: valor válido, ausente e inválido.

### E2E (`tracks.spec.ts`, dados pelas factories)

1. Arquivar pela página da trilha (com confirmação): aparece o aviso de somente leitura, os botões de etapa somem, e a trilha sai da lista padrão e aparece em "Arquivadas".
2. Desarquivar devolve a edição e a trilha à lista padrão.
3. Os filtros "Em andamento" e "Concluídas" mostram só as trilhas certas, e a página passa no axe.

Rodam o `tracks.spec.ts` e, porque o painel e a página do objetivo mudam, o `home.spec.ts` e o `goals.spec.ts`.

## Critério de pronto

- `npm run lint`, `npm run typecheck`, `npm test` e os e2e da área passando.
- Migration incluída e `npx prisma generate` rodado.
- `CLAUDE.md` e este plano atualizados.

## Perguntas (cada uma com uma proposta)

1. **Trilha arquivada é somente leitura?** Proposta: sim, como o ciclo encerrado; desarquivar devolve a edição. Excluir continua possível.
2. **Na página do objetivo, a trilha arquivada some ou fica?** Proposta: fica, com o selo "Arquivada", e as etapas dela continuam contando no progresso do objetivo. Arquivar é tirar da frente, não apagar o que foi feito.
3. **Filtro padrão da lista?** Proposta: "Ativas" (todas as não arquivadas), com "Não iniciadas", "Em andamento", "Concluídas", "Arquivadas" e "Todas".
