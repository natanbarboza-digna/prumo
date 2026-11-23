# 032 — Gestão de tempo: analíticos

Status: **implementado em 2026-11-24**, aprovado com as propostas das perguntas (ver "Decisões")
Branch: `feat/time-analytics`

Segundo dos três planos da gestão de tempo (registro do dia no plano 031; importação do `.md` no plano 033).

## Objetivo

Responder, a partir dos blocos registrados: quanto trabalhei no período, em quê (categoria e projeto), quais atividades tomaram mais tempo e o quanto os dias foram picotados.

## Como fica

### Onde

- Página **`/time/analytics`** ("Analíticos de tempo"), aberta por um link **"Analíticos"** no topo da tela do dia (e a tela de analíticos tem "← Tempo"). O menu continua com cinco itens.

### Período e filtros (na URL)

- **Período** (pergunta 1), `?periodo=`: **Esta semana** (padrão), Semana passada, Este mês, Mês passado, Últimos 30 dias e **Personalizado** (`?de=AAAA-MM-DD&ate=AAAA-MM-DD`, com dois campos de data). Semanas de segunda a domingo, como nas rotinas e nos prazos.
- **Categoria** (`?categoria=`) e **projeto** (`?projeto=`), opcionais, com as ativas e as arquivadas que tiverem registros no período. "Sem projeto" também é uma opção.
- Os filtros de categoria e projeto valem para os blocos de trabalho. Presença, pausas e sem registro são do dia inteiro e não mudam com eles (a tela diz isso).
- Valores inválidos caem no padrão; os filtros se combinam e cada link mantém os outros.

### Blocos da página

1. **Totais do período:**
   - dias registrados;
   - presença, trabalhado, pausas e sem registro (a mesma conta do resumo do dia, somada);
   - **média trabalhada por dia registrado**;
   - **dia mais longo** (data e horas trabalhadas, com link para o dia);
   - com filtro de categoria ou projeto, mais uma linha: "tempo filtrado".
2. **Por categoria:** cada categoria com as horas e a porcentagem do trabalho do período, em barras horizontais (CSS, como o gráfico de adesão do plano 029), maiores primeiro.
3. **Por projeto:** o mesmo, com "Sem projeto" no fim.
4. **Atividades que mais tomaram tempo:** as 10 maiores, agrupadas pelo texto do bloco sem diferenciar maiúsculas, acentos e espaços nas pontas ("Configuração digna relatórios" e "configuração Digna relatórios" contam juntas), com as horas, a quantidade de blocos e a categoria mais usada.
5. **Por dia:** uma linha por dia registrado, com trabalhado, pausas, sem registro e **trocas de assunto**, e link para o dia.
6. **Fragmentação** (pergunta 2): **trocas de assunto por dia**, em média no período e em cada dia (bloco 5). Uma troca é quando um bloco de trabalho tem atividade diferente (texto normalizado ou projeto) do bloco de trabalho anterior no mesmo dia; pausas e blocos vazios não contam como troca, mas não "zeram" a comparação (trabalho antes e depois do almoço com a mesma atividade não é troca).

- Período sem nenhum dia registrado: "Nenhum registro neste período.", com link para a tela do dia.
- Todas as horas aparecem como no resumo do dia ("7h30", "45min").

### Acessibilidade

As barras são decorativas; cada linha mostra o nome, as horas e a porcentagem em texto, então nenhum dado depende só da barra.

## Fora de escopo

- **Horas extras sobre uma jornada esperada** (pergunta 3): pediria guardar a jornada (por dia da semana ou fixa), uma configuração que o app ainda não tem.
- **Comparação com o período anterior** (pergunta 4) e gráficos de evolução ao longo das semanas.
- Exportar os analíticos (planilha ou CSV), analíticos no painel inicial e na busca.
- Importação do `.md` (plano 033).

## Mudanças no modelo de dados

Nenhuma.

## Organização do código

- **`src/modules/time/analytics.ts`** (puro): recebe os dias com os registros e os filtros, e devolve os totais, as somas por categoria, por projeto e por atividade, as linhas por dia e as trocas de assunto. Reaproveita o `daySummary` do plano 031 (cada dia do período é passado como encerrado; um dia de hoje em aberto conta até agora). A normalização do texto (minúsculas, sem acentos, espaços aparados) fica numa função própria.
- **`src/modules/time/schemas.ts`:** o período (`thisWeek`, `lastWeek`, `thisMonth`, `lastMonth`, `last30`, `custom`) e os filtros da URL; `periodRange(period, today)` devolve as datas de início e fim.
- **`src/modules/time/service.ts`:** `listTimeDays(from, to)` com os registros, numa consulta só.
- **Telas:** `src/app/(app)/time/analytics/page.tsx` com `loading.tsx`; componentes em `src/components/time/analytics/` (filtros, totais, barras, atividades, dias).

## Arquivos afetados

```
src/modules/time/{analytics,schemas,service,labels}.ts (+ testes)
src/app/(app)/time/analytics/{page,loading}.tsx, src/app/(app)/time/page.tsx (link)
src/components/time/analytics/*.tsx
e2e/time.spec.ts (ou e2e/time-analytics.spec.ts), e2e/mobile.spec.ts (página nova em PAGES)
CLAUDE.md (regra e reaproveitamento)
```

## Testes (escritos antes do código, em TDD)

### Unidade

- `periodRange`: esta semana e a passada (segunda a domingo, também com hoje num domingo), este mês e o passado (inclusive janeiro → dezembro do ano anterior), últimos 30 dias, personalizado (início depois do fim é recusado).
- Normalização: maiúsculas, acentos e espaços.
- Totais: soma de presença, trabalhado, pausas e sem registro de vários dias; média por dia registrado; dia mais longo (empate: o mais recente).
- Por categoria e por projeto: horas e porcentagens que somam 100%, ordem, "Sem projeto".
- Atividades: agrupa textos iguais depois de normalizados, conta blocos, escolhe a categoria mais usada, limita a 10.
- Trocas: atividades iguais seguidas não contam; diferente conta; pausa no meio não zera; projeto diferente com o mesmo texto conta; dia sem trabalho tem 0.
- Filtros: categoria e projeto restringem as somas de trabalho, e não presença nem pausas.

### Integração

- `listTimeDays` traz só os dias do intervalo, com os registros, a categoria e o projeto.

### E2E (dados pelas factories)

1. O link "Analíticos" abre a página na semana atual; com dois dias registrados, os totais, as barras por categoria e por projeto e a lista de atividades mostram os números certos.
2. Os filtros de período (semana passada, personalizado) e de projeto mudam os números e ficam na URL.
3. Período vazio mostra a mensagem; a página passa no axe e entra no `mobile.spec.ts`.

Rodam o `time.spec.ts` (ou o novo `time-analytics.spec.ts`) e o `mobile.spec.ts`.

## Critério de pronto

- `npm run lint`, `npm run typecheck`, `npm test` e os e2e da área passando.
- `npm run container:up` e `npm run container:check` passando (plano 025).
- `CLAUDE.md` (regra; atualizar a pendência) e este plano atualizados.

## Mudanças durante a implementação

- **Período num módulo próprio:** `periodRange` e `analyticsQuery` ficaram em `src/modules/time/period.ts` (puro), e não em `schemas.ts`: a URL é lida por uma função que cai no padrão, sem schema Zod.
- **TDD:** os testes do período foram escritos junto com a implementação, sem rodar antes para vê-los falhar. As contas (`analytics.ts`) e o `listTimeDays` seguiram o ciclo completo (falharam antes de existir).
- **Filtros num formulário só** (GET, botão "Aplicar"), em vez de links por filtro: período, datas do personalizado, categoria e projeto vão juntos para a URL, então sempre se combinam e funcionam sem JavaScript.
- **Porcentagens por maior resto:** somam sempre 100 (66,7 / 33,3 viram 67 / 33).
- **Texto de cada atividade:** a grafia do registro mais recente do grupo.
- **Tabela "Por dia"** com rolagem lateral própria em telas estreitas (a página não rola).
- **Verificação visual:** capturas com dados em 900 e 320 px, por um teste temporário que foi apagado.
- **Docker:** o Docker Desktop fechou no meio da verificação; o contêiner foi reconstruído de novo depois de reabri-lo, e o check desta branch passou.
- **Verificações:**
  - `npm run lint`, `npm run typecheck`, Prettier e `npm test` (591 testes);
  - e2e: `time-analytics.spec.ts` (3), `time.spec.ts` (5) e `mobile.spec.ts` (6);
  - `npm run container:up` (11 migrations, nenhuma pendente) e `npm run container:check` passando.

## Decisões

1. Períodos: esta semana (padrão), semana passada, este mês, mês passado, últimos 30 dias e personalizado.
2. Troca de assunto: texto normalizado ou projeto diferente entre blocos de trabalho seguidos; pausas e vazios não contam.
3. Horas extras sobre uma jornada esperada: para depois.
4. Comparação com o período anterior: para depois.

## Perguntas (cada uma com uma proposta)

1. **Períodos e padrão?** Proposta: esta semana (padrão), semana passada, este mês, mês passado, últimos 30 dias e personalizado.
2. **Como contar a fragmentação?** Proposta: trocas de assunto entre blocos de trabalho seguidos do dia (texto normalizado ou projeto diferente), sem contar pausas e vazios como troca.
3. **Horas extras sobre uma jornada esperada?** Proposta: deixar para depois. Precisaria de uma configuração (jornada fixa ou por dia da semana) que ainda não existe. Se você quiser agora, a forma mais simples é uma jornada fixa (por exemplo, 8h) guardada numa tabela de configurações nova, e a página mostraria o saldo do período.
4. **Comparação com o período anterior?** Proposta: deixar para depois, para manter este plano focado. Se você quiser agora, cabe nos totais ("+2h30 em relação à semana passada"), sem consulta extra pesada.
