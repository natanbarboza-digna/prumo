# 016 — Calendário mensal da rotina

Status: **implementado em 2026-11-19**, aprovado com as propostas das perguntas (ver "Decisões")
Branch: `feat/routine-calendar`

Primeiro dos três planos do grupo Rotinas (calendário, depois metas de frequência, depois streak). Lembretes ficaram para depois; registrar dias antigos ficou de fora.

## Objetivo

Ver, na página de uma rotina, um mês inteiro de uma vez: em cada dia, se a rotina estava prevista e se foi feita, pulada ou ficou sem registro. Hoje a página só mostra a lista dos últimos 14 dias previstos.

## Escopo

### Na página da rotina

- Seção nova **"Calendário"**, entre a adesão e o "Histórico" (pergunta 1).
- Mostra **um mês por vez**, começando pelo mês atual, com links **"‹ Mês anterior"** e **"Próximo mês ›"**.
- O mês fica na URL (`/routines/<id>?mes=2026-10`), para o link e o voltar do navegador funcionarem. Um valor inválido ou fora do período da rotina volta para o mês atual.
- **Navegação limitada ao período da rotina** (pergunta 2): do mês de início até o mês atual (ou até o mês do fim, se a rotina já acabou). Nos extremos, o link correspondente não aparece.
- O calendário é **só para ver**. Marcar e corrigir dias continua pelo "Histórico" e pela tela Hoje (registrar dias antigos pelo calendário ficou fora deste grupo).

### Cada dia

| Estado       | Quando                                                         | Visual                                 |
| ------------ | -------------------------------------------------------------- | -------------------------------------- |
| Feita        | Previsto, com registro "feito"                                 | Fundo verde (`success`) e ✓            |
| Pulada       | Previsto, com registro "pulado"                                | Fundo neutro e –                       |
| Sem registro | Previsto, já passou, sem registro                              | Contorno vermelho (`destructive`) e !  |
| Pendente     | Previsto para hoje, ainda sem registro                         | Contorno destacado                     |
| Não prevista | Dia da semana fora da rotina, ou antes do início/depois do fim | Só o número, apagado                   |
| Futuro       | Depois de hoje                                                 | Só o número, apagado (previsto ou não) |

- **Cor nunca sozinha:** cada estado tem também um símbolo (✓, –, !) e um nome para leitor de tela. Abaixo do calendário, uma legenda com os estados.
- **Hoje** tem um contorno a mais, como referência, em qualquer estado.

### Resumo do mês

- Abaixo do calendário (pergunta 3): "Em outubro: 18 feitas, 2 puladas e 3 sem registro, 78% de adesão", contando só os dias previstos do mês até hoje. Reaproveita `computeAdherence`.

### Acessibilidade e layout

- Uma `<table>` com `<caption>` (o mês, por exemplo "Novembro de 2026") e cabeçalho com os dias da semana (Seg a Dom, segunda primeiro, como no resto do app).
- Cada dia tem um nome acessível completo: "segunda-feira, 3 de novembro: feita".
- Cabe em 320 px: 7 colunas de largura igual, número do dia e símbolo em tamanho pequeno.

## Fora de escopo

- Registrar ou corrigir um dia pelo calendário (e, com isso, dias além da janela de 14).
- Calendário com várias rotinas juntas (por exemplo, na tela Hoje ou no painel).
- Vista anual ou semanal.

## Mudanças no modelo de dados

Nenhuma.

## Organização do código

- **`src/modules/routines/rules.ts`** (regras puras, já existe): `monthCalendar(routine, logs, month, today)` devolve as semanas do mês (segunda a domingo, com os dias de fora do mês para completar a primeira e a última semana) e o estado de cada dia; `monthRange(routine, today)` devolve o primeiro e o último mês navegáveis; `parseMonth("2026-10")` valida o parâmetro.
- **`src/modules/routines/service.ts`:** `getRoutineMonth(routineId, month, today)` busca os registros do mês e chama as regras.
- **`src/modules/routines/labels.ts`:** nomes dos estados, do mês ("novembro de 2026") e o texto do resumo.
- **`src/components/routines/routine-calendar.tsx`** (Server Component: só mostra dados, nenhuma interação no navegador; os links de mês são `<Link>` comuns).
- **`src/app/(app)/routines/[id]/page.tsx`:** lê `searchParams.mes` e mostra a seção. A rota já tem `loading.tsx`, que cobre a leitura de `searchParams` exigida pelo Cache Components.

## Arquivos afetados

```
src/modules/routines/{rules,service,labels}.ts (+ testes)
src/components/routines/routine-calendar.tsx      (novo)
src/app/(app)/routines/[id]/page.tsx
e2e/routines.spec.ts
CLAUDE.md                                          (RoutineCalendar e monthCalendar na lista de reaproveitamento)
```

## Testes (escritos antes do código, em TDD)

### Unidade (`rules.test.ts` e `labels.test.ts`)

- `monthCalendar`: novembro de 2026 começa num domingo, então a primeira semana tem 6 dias de outubro antes; a grade sempre tem semanas completas de segunda a domingo; cada estado (feita, pulada, sem registro, pendente hoje, não prevista por dia da semana, não prevista antes do início e depois do fim, futuro); um registro fora dos dias previstos não aparece.
- `monthRange`: rotina ativa (do mês de início ao mês atual); rotina encerrada (até o mês do fim); rotina que começa no futuro (só o mês de início).
- `parseMonth`: aceita `2026-10`; recusa `2026-13`, `26-10` e texto; mês fora do intervalo cai no mês padrão.
- Textos: nome do mês em pt-BR, nome acessível de cada dia e o resumo (com singular e plural).

### Integração (`service.int.test.ts`)

- `getRoutineMonth` traz só os registros do mês pedido e devolve o resumo com os mesmos números de `computeAdherence`.

### E2E (`routines.spec.ts`)

1. Depois de marcar "Feito" hoje na tela Hoje, o calendário da rotina mostra hoje como "feita" (pelo nome acessível) e o resumo conta 1 feita.
2. "‹ Mês anterior" muda o mês na URL e no título do calendário; no mês de início, o link de mês anterior não aparece.
3. A página da rotina com o calendário passa no axe.

## Critério de pronto

- `npm run lint`, `npm run typecheck`, `npm test` e `npm run test:e2e` passando.
- Capturas do calendário em 320 px e em 1280 px, nos temas claro e escuro, conferidas.
- `CLAUDE.md` e este plano atualizados.

## Mudanças durante a implementação

- **Estado `OUTSIDE`** para os dias do mês anterior e do seguinte que completam as semanas: a célula fica vazia, e esses dias não entram no resumo.
- **"Hoje" aparece também quando não é dia previsto:** o contorno de hoje é mostrado em qualquer estado, como referência, inclusive num dia fora da rotina.
- **Testes de unidade num arquivo próprio** (`src/modules/routines/calendar.test.ts`), com as regras e os textos do calendário, em vez de crescer `rules.test.ts` e `labels.test.ts`.
- **Os e2e do calendário foram escritos depois da implementação** (as regras e o service seguiram TDD; os e2e não foram vistos falhando antes).
- **Legenda** com os quatro estados que têm marca visual (feita, pulada, sem registro, pendente); "não prevista" e "futuro" são só o número do dia e ficam fora dela.

## Decisões

1. O calendário fica entre a adesão e o "Histórico".
2. A navegação vai só pelos meses do período da rotina, do início até hoje (ou até o fim).
3. A linha de resumo do mês aparece abaixo do calendário.
