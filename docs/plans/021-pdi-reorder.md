# 021 — Reordenar áreas e ações do PDI

Status: **implementado em 2026-11-20**, aprovado com as propostas das perguntas (ver "Decisões")
Branch: `feat/pdi-reorder`

Segundo plano do grupo PDI (vincular rotina existente, reordenar áreas e ações, prévia e exportação da planilha). Retoma o que ficou fora do plano 004.

## Objetivo

Hoje a página do ciclo mostra as áreas na ordem de criação e as ações de cada área por prazo (sem prazo por último), depois por criação. Não dá para pôr a área mais importante primeiro, nem seguir a ordem do formulário da empresa.

Este plano dá a áreas e ações uma **ordem manual**, mudada com botões "Mover para cima" e "Mover para baixo", como já existe nas etapas de trilha.

## Regras

- **Áreas:** ordem dentro do ciclo. **Ações:** ordem dentro da área.
- **Botões:** "Mover para cima" e "Mover para baixo" (setas, como nas etapas), com nome acessível que diz o item ("Mover para cima: Comunicação"). O primeiro não sobe e o último não desce (botão desabilitado). Arrastar fica de fora: é pior para teclado e leitor de tela.
- **Item novo** vai para o fim (da lista de áreas do ciclo, ou da lista de ações da área).
- **Ação que muda de área** pela edição vai para o fim da área nova, e a área antiga fecha o buraco.
- **Excluir** área ou ação fecha o buraco (posições sempre 1, 2, 3…), como nas etapas.
- **Ciclo encerrado** é somente leitura: sem botões, e o service recusa (`CycleClosedError`).
- **Importação por planilha** grava a ordem das linhas de cada aba.

### A ordem manual substitui a ordem por prazo (pergunta 1)

- **Proposta:** na página do ciclo, as ações passam a seguir só a ordem manual. Misturar as duas (prazo primeiro, ordem manual no empate) deixaria os botões sem efeito na maior parte dos casos.
- A migration preenche as posições com a **ordem atual** (áreas por criação; ações por prazo, depois criação), então nada muda na tela no dia da migração.
- O prazo continua visível em cada ação, e o atraso continua destacado.
- **Outras listas não mudam** (pergunta 2): ações no objetivo, prazos no painel e qualquer lista fora do ciclo continuam por prazo, porque ali a pergunta é "o que vence primeiro".

## Fora de escopo

- Arrastar e soltar.
- Mover uma ação para outra área pelos botões (continua pela edição da ação).
- Ordem manual de check-ins (continuam por data).
- Prévia e exportação da planilha (próximo plano).

## Mudanças no modelo de dados

- `PdiArea.order Int` (coluna `position`, como em `TrackStep`, porque `order` é palavra reservada do SQL), com `@@unique([cycleId, order])`.
- `PdiAction.order Int` (coluna `position`), com `@@unique([areaId, order])`.
- **Migration** em três passos: adiciona as colunas aceitando nulo, preenche com `ROW_NUMBER()` na ordem atual, e só então as torna obrigatórias e cria os índices únicos.

## Organização do código

- **`src/modules/pdi/service.ts`:**
  - `createArea` e `createAction` põem o item no fim (`_max` + 1, numa transação, como `createStep`).
  - `updateAction` que troca de área: fim da área nova e fecha o buraco da antiga.
  - `deleteArea` e `deleteAction` fecham o buraco.
  - `moveArea(id, direction)` e `moveAction(id, direction)`: trocam com o vizinho; nas pontas não fazem nada; ciclo encerrado lança `CycleClosedError`.
  - A página do ciclo (`getCycle`) passa a ordenar áreas e ações por `order`. `actionOrder` (por prazo) continua nas outras listas.
  - O "fechar o buraco" e a "troca com o vizinho" com índice único já existem nas etapas (`moveStep`, `deleteStep`). Se der para extrair um helper comum sem complicar, extraio; senão, repito o padrão com um comentário apontando para as etapas.
- **`src/modules/pdi/import/service.ts`:** grava `order` pela posição da linha (as áreas na ordem da aba de áreas; as ações na ordem em que aparecem, dentro de cada área).
- **`src/modules/pdi/actions.ts`:** `moveAreaAction` e `moveActionAction`, com `requireSession()` e a revalidação das telas de PDI.
- **Telas:** botões de seta no cabeçalho de cada área e em cada ação da página do ciclo (`src/components/pdi/action-list.tsx` e a página do ciclo), só com o ciclo aberto.
- **`e2e/factories.ts`:** `insertCycle` grava a posição de áreas e ações (o `e2e-factories.int.test.ts` passa a conferir a ordem).

## Arquivos afetados

```
prisma/schema.prisma, prisma/migrations/<data>_pdi_order/
src/modules/pdi/{service,actions}.ts (+ testes), src/modules/pdi/import/service.ts (+ teste)
src/components/pdi/action-list.tsx, src/app/(app)/pdi/[id]/page.tsx
src/demo/seed-demo.ts (se criar áreas e ações direto no banco)
e2e/factories.ts, src/test/e2e-factories.int.test.ts
e2e/pdi.spec.ts
CLAUDE.md (regra da ordem)
```

## Testes (escritos antes do código, em TDD)

### Integração (service, banco de teste)

- Área e ação novas vão para o fim; a primeira de cada lista é 1.
- `moveArea` e `moveAction` trocam com o vizinho; nas pontas não mudam nada; ação só troca dentro da própria área.
- Excluir área ou ação fecha o buraco.
- Ação que muda de área vai para o fim da nova, e a antiga fecha o buraco.
- Ciclo encerrado: `moveArea` e `moveAction` lançam `CycleClosedError`.
- `getCycle` devolve áreas e ações na ordem manual, mesmo com prazos fora de ordem; `listActionsForGoal` e as ações com prazo continuam por prazo.
- Importação: áreas e ações ficam na ordem das linhas da planilha.
- Migration: um teste que confira o preenchimento não vale o custo (roda uma vez); confiro à mão no banco de desenvolvimento e registro no plano (ver "Mudanças durante a implementação").

### E2E (`pdi.spec.ts`, dados pelas factories)

1. Na página do ciclo, "Mover para baixo" na primeira área a põe em segundo lugar; "Mover para cima" numa ação a põe antes da vizinha; a primeira tem "Mover para cima" desabilitado.
2. Ciclo encerrado não mostra os botões.

Rodam o `pdi.spec.ts` e, porque a importação muda, o `pdi-import.spec.ts`.

## Critério de pronto

- `npm run lint`, `npm run typecheck`, `npm test` e os e2e da área passando.
- Migration incluída e `npx prisma generate` rodado.
- `CLAUDE.md` e este plano atualizados.

## Mudanças durante a implementação

- **Migration `20261120190000_add_pdi_order`**, escrita à mão (o `migrate dev` não roda fora de um terminal interativo). Os índices únicos `(cycle_id, position)` e `(area_id, position)` substituem os índices simples de `cycle_id` e `area_id`, que começam pela mesma coluna. Conferida no banco de desenvolvimento: as 7 ações dos 2 ciclos ficaram na mesma ordem de antes, e `prisma migrate diff` contra o schema dá migration vazia.
- **`closeGap` (`src/lib/positions.ts`):** o "fechar o buraco" com índice único virou um helper usado pelas etapas de trilha (`deleteStep`) e por áreas e ações. A troca com o vizinho continua repetida em cada função (`moveStep`, `moveArea`, `moveAction`), porque generalizá-la pediria acessar o modelo do Prisma por nome, sem tipos.
- **`MoveButtons` (`src/components/move-buttons.tsx`):** as setas de área e de ação. A lista de etapas continua com as suas, iguais, para não mexer nas trilhas além do necessário.
- **`ActionList` ganhou `reorderable`**, ligado só na página do ciclo; a lista de ações do objetivo não tem setas.
- **Excluir área ou ação** passou a usar `deleteMany` na transação: se outra aba já excluiu, nada acontece (antes, `ignoreGone`).
- **Testes que criam áreas e ações direto pelo Prisma** (objetivos e categorias) passaram a informar a posição.
- **E2E:** rodaram o `pdi.spec.ts` e o `pdi-import.spec.ts` (12 testes) e, por causa do `closeGap`, o `tracks.spec.ts` (8). Na primeira rodada do `tracks.spec.ts`, "cria uma trilha vinculada a um objetivo" falhou esperando o título da trilha criada pelo formulário, que não passa pelo código mudado; na segunda, os 8 passaram.

## Decisões

1. A ordem manual substitui a ordem por prazo na página do ciclo; a migration começou com a ordem anterior.
2. As outras listas (objetivo, painel) continuam por prazo.
3. Setas iguais às das etapas, com o nome do item no rótulo acessível.

## Perguntas (cada uma com uma proposta)

1. **A ordem manual substitui a ordem por prazo na página do ciclo?** Proposta: sim. A migration começa com a ordem atual, então nada muda até você mexer.
2. **E as outras listas (objetivo, painel)?** Proposta: continuam por prazo.
3. **Botões com seta, como nas etapas, ou com texto ("Subir", "Descer")?** Proposta: setas, iguais às etapas, com o nome do item no rótulo acessível.
