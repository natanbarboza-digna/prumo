# 028 — Tela de prazos

Status: **implementado em 2026-11-20**, aprovado com as propostas das perguntas (ver "Decisões")
Branch: `feat/deadlines-page`

Primeiro plano do grupo Painel e interface (tela de prazos, gráfico de adesão semanal; personalização do painel descartada no alinhamento). Retoma o que ficou fora do plano 006.

## Objetivo

O bloco "Prazos" do painel mostra só os atrasados e os próximos 14 dias, até 10 de cada. Esta tela mostra **todos os prazos**, com filtros de período e de tipo, para planejar a semana e o mês.

## Como fica

### Onde

- Página **`/deadlines`**, aberta pelo link **"Ver todos os prazos"** no bloco Prazos do painel (o bloco ganha o `more` do `DashboardCard`, como os outros).
- **Não entra no menu principal** (pergunta 1): o menu tem quatro itens e já ocupa a linha inteira no celular (plano 009). Na tela de prazos, nenhum item do menu fica marcado, como na busca.

### O que aparece

As mesmas fontes do painel, com as mesmas regras:

- **Etapas** de trilha não concluídas, com prazo, de trilhas não arquivadas;
- **Ações de PDI** não iniciadas ou em andamento, com prazo, de ciclos não encerrados;
- **Objetivos** não iniciados ou em andamento, com data-alvo.

Cada item mostra o tipo e de onde vem (trilha ou ciclo), o título com link e "Atrasado há 3 dias", "Hoje", "Amanhã" ou "Em 5 dias" (o mesmo `dueText` do painel).

### Filtros (na URL, como os das listas)

- **Período** (pergunta 2), `?periodo=`: **Próximos 30 dias** (padrão), Próximos 7 dias, Próximos 90 dias, Todos. Os **atrasados aparecem sempre**, em qualquer período: são os que mais pedem atenção.
- **Tipo**, `?tipo=`: **Todos** (padrão), Etapas, Ações de PDI, Objetivos.
- Valor inválido na URL cai no padrão. Os dois filtros se combinam, e cada link de um filtro mantém o outro.

### Agrupamento (pergunta 3)

- **Atrasados** primeiro, do mais antigo para o mais recente.
- Depois, **por semana** (segunda a domingo, como nas rotinas): "Esta semana", "Próxima semana" e, daí em diante, "Semana de 7/12 a 13/12". Dentro do grupo, por data e depois por título.
- Cada grupo com título e contagem; grupo vazio não aparece.
- **Sem limite** de itens: com poucas dezenas de prazos, a lista inteira cabe.
- Lista vazia: "Nenhum prazo atrasado nem nos próximos 30 dias." (com o período escolhido), com um link para "Todos" quando o período não é "Todos".

## Fora de escopo

- Gráfico de adesão semanal (próximo plano).
- Calendário mensal de prazos, exportar para agenda (iCal) e lembretes.
- Mudar o horizonte de 14 dias do bloco do painel (continua igual).
- Concluir itens direto da tela de prazos (continua pela página de cada item).

## Mudanças no modelo de dados

Nenhuma.

## Organização do código

- **`src/modules/dashboard/rules.ts`** (puro): `groupDeadlinesByWeek(items, today, { periodDays })` devolve os atrasados e as semanas; reaproveita a ordenação do `groupDeadlines`. A semana usa o mesmo "segunda a domingo" das regras de rotina (`weekdayOf`, `addDays`).
- **`src/modules/dashboard/schemas.ts`** (novo): `deadlinePeriodSchema` e `deadlineKindFilterSchema`.
- **`src/modules/dashboard/service.ts`:** `listDeadlines(today)` junta as três fontes num `Deadline[]` (o mesmo trecho que o `getDashboard` já monta, extraído para os dois usarem). O filtro de tipo é aplicado na lista, sem consulta nova.
- **`src/modules/dashboard/labels.ts`:** títulos das semanas, dos filtros e da lista vazia.
- **Telas:** `src/app/(app)/deadlines/page.tsx` com `loading.tsx`; `src/components/deadlines/{deadline-filters,deadline-list}.tsx`. O item da lista reaproveita o visual do bloco do painel (extraído para `deadline-item.tsx`, usado pelos dois).

## Arquivos afetados

```
src/modules/dashboard/{rules,schemas,service,labels}.ts (+ testes)
src/components/dashboard/deadlines-card.tsx, src/components/deadlines/*.tsx
src/app/(app)/deadlines/{page,loading}.tsx
e2e/deadlines.spec.ts (novo), e2e/mobile.spec.ts (página nova em PAGES), e2e/home.spec.ts (link novo)
CLAUDE.md (regra e estrutura)
```

## Testes (escritos antes do código, em TDD)

### Unidade

- `groupDeadlinesByWeek`: atrasados primeiro (do mais antigo); "Esta semana" começa hoje e vai até domingo; "Próxima semana"; semanas seguintes com o intervalo; o período corta o que passa do horizonte (hoje + N − 1 dias), menos os atrasados; "Todos" não corta; hoje num domingo (a semana atual é só hoje); grupo vazio fica de fora.
- Schemas: valores válidos, ausentes e inválidos.
- Textos: título de cada semana e da lista vazia por período.

### Integração (service)

- `listDeadlines` traz etapas, ações e objetivos com as regras do painel (sem etapa concluída nem de trilha arquivada, sem ação de ciclo encerrado, sem objetivo concluído ou arquivado), com `href` e `source` certos.
- O `getDashboard` continua igual (os testes atuais do painel seguem passando).

### E2E (dados pelas factories)

1. O link "Ver todos os prazos" do painel abre a tela; aparecem os atrasados e os grupos por semana.
2. O filtro de tipo "Etapas" deixa só as etapas e mantém o período; o período "Todos" mostra um prazo de daqui a 60 dias que não aparecia nos 30.
3. A tela passa no axe, e `/deadlines` entra no `mobile.spec.ts`.

Rodam o `deadlines.spec.ts`, o `home.spec.ts` e o `mobile.spec.ts`.

## Critério de pronto

- `npm run lint`, `npm run typecheck`, `npm test` e os e2e da área passando.
- `npm run container:up` e `npm run container:check` passando (plano 025).
- `CLAUDE.md` e este plano atualizados.

## Mudanças durante a implementação

- **`mondayOf` foi para `src/lib/dates.ts`** (era privada em `src/modules/routines/rules.ts`), com teste próprio; as regras de rotina e a tela de prazos usam a mesma função.
- **`listDeadlines()` não recebe `today`:** as três consultas não dependem da data; quem corta por período é o `groupDeadlinesByWeek`. O `getDashboard` usa o mesmo `toDeadlines`, sem consulta a mais.
- **O texto de cada prazo é o `dueText` do painel** ("Vence hoje", "Vence em 20/11/2026", "Venceu em 10/11/2026"), não "Atrasado há 3 dias" como o plano descrevia: o plano mandava reaproveitar o `dueText`, e mantive o texto dele.
- **Página fora do layout de lista:** sem `error.tsx` próprio (o de `src/app/(app)/` cobre) e com um link "← Painel" no topo, já que a tela não está no menu.
- **Ids dos títulos dos grupos com `useId`**, pelo motivo de sempre (cópias escondidas das páginas visitadas).
- **E2E:** o localizador dos itens pegava também os links dos filtros (que também são listas); passou a olhar só dentro das seções de prazos.
- **Verificações:**
  - `npm run lint`, `npm run typecheck` e `npm test` (522 testes);
  - e2e: `deadlines.spec.ts` (3 testes), `home.spec.ts` (5) e `mobile.spec.ts` (5);
  - `npm run container:up` e `npm run container:check` passando.

## Decisões

1. A tela não entra no menu; o acesso é pelo link do bloco Prazos.
2. Próximos 30 dias por padrão; atrasados aparecem sempre.
3. Agrupamento por semana, de segunda a domingo.

## Perguntas (cada uma com uma proposta)

1. **A tela entra no menu principal?** Proposta: não; o acesso é pelo link do bloco Prazos do painel.
2. **Período padrão e atrasados?** Proposta: próximos 30 dias por padrão, e os atrasados sempre aparecem, em qualquer período.
3. **Agrupar por semana?** Proposta: sim, segunda a domingo, com "Esta semana" e "Próxima semana" nomeadas.
