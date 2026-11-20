# 029 — Gráfico de adesão semanal

Status: **implementado em 2026-11-20**, aprovado com as propostas das perguntas (ver "Decisões")
Branch: `feat/weekly-adherence-chart`

Último plano do grupo Painel e interface (tela de prazos, gráfico de adesão semanal; personalização descartada). Retoma os "gráficos" que ficaram fora do plano 006.

## Objetivo

Hoje a adesão é um número só ("80% em 30 dias"). Um gráfico com as **últimas 12 semanas** mostra a tendência: se o hábito está firmando ou caindo.

## Como fica

### Onde (pergunta 1)

- **Página da rotina:** abaixo da adesão e da sequência, "Adesão por semana", com as 12 semanas daquela rotina.
- **Painel, bloco Hoje:** abaixo da linha "Adesão em 30 dias", o mesmo gráfico somando **as rotinas ativas** (como a adesão de 30 dias já faz). Compacto: barras mais baixas e sem os rótulos de cada semana.

### O que cada barra mostra

- **Uma barra por semana** (segunda a domingo), das 11 semanas anteriores até a **semana atual** (a última, marcada "esta semana").
- A altura é a **adesão da semana**: dias feitos sobre dias previstos, com a mesma regra de hoje (`computeAdherence`): previsto sem registro conta como não feito, hoje sem registro não conta, e a meta semanal usa dias-meta (plano 017), proporcional numa semana incompleta e, na semana atual, só o que já foi feito.
- **Semana sem dia previsto** (antes da rotina começar, depois de encerrada, ou só com dias não previstos): sem barra, com um traço, e o texto "sem dias previstos". **Não é 0%** (pergunta 2).
- Rotina com menos de 12 semanas de vida: as semanas anteriores ao início aparecem vazias (traço), para o eixo ser sempre o mesmo.
- Na página da rotina, o percentual aparece em cima de cada barra e a data da segunda-feira embaixo ("16/11"); no celular, embaixo, só semana sim, semana não, para caber em 320 px.

### Como é desenhado (sem biblioteca, como combinado no alinhamento)

- Barras em CSS (`div` com altura em %) dentro de um `<figure>` com legenda. Cores só pelos tokens do tema (`bg-primary` para a barra, `bg-muted` para o fundo), funcionando no tema claro e no escuro.
- **Acessibilidade:** as barras são decorativas (`aria-hidden`). A mesma informação vai numa **tabela** com legenda ("Semana", "Adesão"), visível só para leitores de tela (`sr-only`). Assim nenhum dado fica só na cor ou na altura.

## Fora de escopo

- Escolher o número de semanas, gráfico por mês ou por dia.
- Gráfico de progresso de objetivos, trilhas ou ciclos.
- Comparar rotinas num mesmo gráfico.
- Biblioteca de gráficos (descartada no alinhamento do grupo).

## Mudanças no modelo de dados

Nenhuma.

## Organização do código

- **`src/modules/routines/rules.ts`** (puro): `weeklyAdherence(routine, logs, today, weeks = 12)` devolve `[{ monday, sunday, adherence | null }]`, da mais antiga para a atual, com `null` na semana sem dia previsto. Reaproveita `computeAdherence` e `mondayOf`. `combineWeeklyAdherence(lists)` soma semana a semana (para o painel), com o mesmo `combineAdherence` de hoje.
- **`src/modules/routines/service.ts`:** `getWeeklyAdherence(routineId, today)` para a página da rotina; `listRoutines` já carrega os registros (plano 019), então o painel calcula a soma sem consulta nova.
- **`src/modules/dashboard/service.ts`:** o bloco `today` ganha `weekly`.
- **`src/modules/routines/labels.ts`:** "esta semana", "sem dias previstos", legenda e cabeçalhos da tabela.
- **`src/components/routines/weekly-adherence-chart.tsx`** (novo, Server Component): o gráfico, com a variante compacta para o painel.

## Arquivos afetados

```
src/modules/routines/{rules,service,labels}.ts (+ testes)
src/modules/dashboard/service.ts (+ teste)
src/components/routines/weekly-adherence-chart.tsx (novo)
src/app/(app)/routines/[id]/page.tsx, src/components/dashboard/today-card.tsx
e2e/routines.spec.ts, e2e/home.spec.ts
CLAUDE.md (reaproveitamento)
```

## Testes (escritos antes do código, em TDD)

### Unidade (`rules`)

- 12 semanas, da mais antiga à atual, segunda a domingo, com a atual contendo hoje.
- Dias fixos: feitos sobre previstos por semana; pulado e previsto sem registro contam como não feitos; hoje sem registro não conta.
- Meta semanal: semana fechada com a meta; semana incompleta no início com a meta proporcional; semana atual só com o que já foi feito.
- Semana sem dia previsto (antes do início, depois do fim): `null`, não 0.
- `combineWeeklyAdherence`: soma semana a semana; semana `null` em todas continua `null`.
- Textos: rótulo da semana atual e de semana sem dias previstos.

### Integração

- `getWeeklyAdherence` lê os registros gravados; o painel traz `today.weekly` somando só as rotinas ativas.

### E2E (dados pelas factories)

1. Na página de uma rotina diária com registros nas duas últimas semanas, a tabela do gráfico tem 12 linhas, e a da semana passada mostra a adesão certa; uma semana antes do início mostra "sem dias previstos".
2. O painel mostra o gráfico no bloco Hoje, e a página passa no axe nos temas claro e escuro (o `home.spec.ts` já testa os dois).

Rodam o `routines.spec.ts`, o `home.spec.ts` e o `mobile.spec.ts` (o gráfico precisa caber em 320 px).

## Critério de pronto

- `npm run lint`, `npm run typecheck`, `npm test` e os e2e da área passando.
- `npm run container:up` e `npm run container:check` passando (plano 025).
- `CLAUDE.md` e este plano atualizados.

## Mudanças durante a implementação

- **Meta semanal na semana incompleta:** o plano falava em meta "proporcional", mas a regra do plano 017 (já no código) é a meta limitada aos dias disponíveis (`min(meta, dias)`). O gráfico usa o `computeAdherence` de sempre, então segue essa regra; um teste meu partia da regra errada e foi corrigido.
- **Três estados por semana:** `null` (nenhum dia previsto na semana inteira: "sem dias previstos", sem barra), adesão com 0 dias contados (a semana atual antes do primeiro registro: "nada para contar ainda", sem barra) e adesão normal.
- **`RoutineSummary` ganhou `weekly`:** a lista de rotinas já carrega todos os registros (plano 019), então o painel soma as semanas sem consulta nova.
- **No painel**, o gráfico aparece quando alguma semana tem dados (não só quando há rotina hoje).
- **Celular:** a captura em 320 px mostrou barras desalinhadas e datas sobrepostas. As datas escondidas passaram de `hidden` para `invisible` (mantêm a altura das colunas) e aparecem uma a cada três semanas, a partir da mais antiga, para a da última coluna não passar da borda.
- **`sr-only` numa tabela não funciona:** a `<table>` ignora a largura e o `overflow` da classe e alargava a página em 320 px (358 px). A classe foi para uma `div` em volta. Registrado no `CLAUDE.md`.
- **Teste novo no `mobile.spec.ts`:** a página de uma rotina com o gráfico em 320 px sem rolagem lateral (foi ele que achou o problema da tabela).
- **Verificação visual:** capturas do gráfico em 800 px (claro e escuro) e em 320 px, por um teste temporário que foi apagado.
- **Verificações:**
  - `npm run lint`, `npm run typecheck` e `npm test` (533 testes);
  - e2e: `routines.spec.ts` (17), `home.spec.ts` (6) e `mobile.spec.ts` (6);
  - `npm run container:up` e `npm run container:check` passando.

## Decisões

1. Gráfico completo na página da rotina e compacto no bloco Hoje do painel, somando as rotinas ativas.
2. Semana sem dia previsto fica sem barra, com "sem dias previstos".
3. Doze semanas.

## Perguntas (cada uma com uma proposta)

1. **Onde o gráfico aparece?** Proposta: na página da rotina (completo) e no bloco Hoje do painel (compacto, somando as rotinas ativas).
2. **Semana sem dia previsto?** Proposta: sem barra, com "sem dias previstos", em vez de 0%, para não parecer que a rotina foi abandonada.
3. **12 semanas?** Proposta: sim, cerca de três meses, o bastante para ver tendência e ainda caber no celular.
