# 034 — Redesenho do painel inicial

Status: **implementado em 2026-11-24**, aprovado com as propostas das quatro perguntas (ver "Decisões")
Branch: `feat/dashboard-redesign`

Pedido do dono do projeto em 2026-11-24: o painel mostra os dados "crus"; quer mais gráficos e uma distribuição melhor. A proposta visual (indicadores no topo, gráficos de adesão, de tempo e do PDI, e a grade abaixo) foi aprovada antes deste plano.

## Objetivo

Trocar a grade atual de cinco blocos iguais (plano 006) por um painel com **indicadores no topo**, **gráficos** e uma **hierarquia** clara: o que pede ação hoje primeiro, depois a semana, depois o longo prazo.

## Como fica

### 1. Faixa de indicadores (topo)

Cinco números grandes, cada um com um rótulo curto e link para a tela dele:

| Indicador            | Valor                                       | Leva a            |
| -------------------- | ------------------------------------------- | ----------------- |
| Rotinas hoje         | "2 de 3" (feitas sobre as do dia)           | `/today`          |
| Adesão em 30 dias    | "78%" (a mesma soma de hoje)                | `/routines`       |
| Trabalhado na semana | "26h30" (segunda a hoje)                    | `/time/analytics` |
| Prazos atrasados     | "2", em vermelho quando houver; "0" sem cor | `/deadlines`      |
| PDI concluído        | "40%" do ciclo ativo; "—" sem ciclo ativo   | o ciclo           |

No celular, os indicadores ficam em duas colunas.

### 2. Grade (computador)

```
[ indicadores: 5 colunas                                  ]
[ Hoje (largo)                     ][ Prazos (estreito)   ]
[ Tempo da semana (largo)          ][ PDI (estreito)      ]
[ Objetivos e trilhas em andamento (largura toda)         ]
```

No celular, tudo empilhado na mesma ordem.

### 3. Blocos

- **Hoje:** a lista de rotinas do dia com os botões "Feito" e "Pular" (como hoje) e, abaixo, o **gráfico de adesão das 12 semanas** (plano 029) em tamanho completo. A linha "Adesão em 30 dias" sai do bloco (virou indicador).
- **Prazos:** atrasados e próximos 14 dias como hoje, mas **até 5 por grupo** (antes 10) e mais compacto; "Ver todos" leva à tela de prazos (plano 028).
- **Tempo da semana** (novo no painel): barras das **horas trabalhadas por dia** (segunda a domingo; a de hoje em destaque, dias futuros vazios) e uma **barra dividida por categoria** com a legenda (categoria e porcentagem). Os números vêm das contas dos analíticos (plano 032). Sem nenhum dia registrado na semana: "Nenhum registro de tempo esta semana." com link para a tela Tempo.
- **PDI:** um **anel de progresso** (ações concluídas sobre o total, sem as canceladas) com, ao lado: "2 de 5 ações", atrasadas, dias restantes e a adesão das rotinas vinculadas. Sem ciclo ativo, o texto de hoje (próximo planejado ou "Criar ciclo").
- **Objetivos e trilhas em andamento:** os dois blocos de hoje viram um só, em duas colunas (objetivos à esquerda, trilhas à direita), com barras de progresso; até 5 de cada, como hoje.
- O bloco de boas-vindas do primeiro uso continua igual.

### 4. Como os gráficos são desenhados (pergunta 1)

- **Sem biblioteca:** barras em CSS (como os planos 029 e 032) e o anel em **SVG** (dois círculos, o de progresso com `stroke-dasharray`).
- Cada gráfico tem o dado em texto ou numa tabela para leitor de tela (`sr-only` numa `div`, regra do plano 029); as formas são decorativas.

### 5. Cores (pergunta 2)

- Hoje o projeto só usa cor para "concluído" (verde) e "atrasado" (vermelho). Os gráficos precisam distinguir categorias.
- **Proposta:** usar os tokens `--chart-1` a `--chart-5` que o shadcn já define em `globals.css` (hoje em tons de cinza), com uma **paleta de cinco tons** que tenha contraste no tema claro e no escuro. A barra de categorias usa os cinco na ordem das maiores; categorias além da quinta somam num "Outras" em cinza.
- O verde e o vermelho continuam reservados para "concluído" e "atrasado". O `CLAUDE.md` passa a dizer que as cores de gráfico vêm de `--chart-*`.

## Fora de escopo

- Personalizar o painel (esconder ou reordenar blocos), descartado no plano 006 e no alinhamento do grupo Painel.
- Gráficos com interação (tooltips, alternar período) e gráficos de linha.
- Mudar as outras telas para a paleta nova (analíticos e adesão continuam como estão; podem adotar `--chart-*` depois).
- Biblioteca de gráficos.

## Mudanças no modelo de dados

Nenhuma.

## Organização do código

- **`src/modules/dashboard/service.ts`:** o `Dashboard` ganha `kpis` (os cinco números) e `timeWeek` (horas por dia e por categoria da semana atual, calculadas com `listTimeDays` e `computeAnalytics` do plano 032). `DEADLINE_LIMIT` do painel passa a 5.
- **`src/modules/dashboard/rules.ts`** (puro): `weekTimeBars(days, today)` (as sete barras, com hoje marcado e dias futuros vazios) e `categoryShares(shares)` (os cinco maiores e "Outras").
- **`src/modules/dashboard/labels.ts`:** rótulos dos indicadores.
- **Componentes** em `src/components/dashboard/`: `kpi-strip.tsx`, `time-week-card.tsx`, `progress-ring.tsx` (o anel em SVG, reaproveitável), `goals-tracks-card.tsx`; `today-card.tsx`, `deadlines-card.tsx` e `pdi-card.tsx` ajustados; `goals-card.tsx` e `tracks-card.tsx` substituídos.
- **`src/app/(app)/page.tsx`:** a grade nova.
- **`src/app/globals.css`:** a paleta `--chart-1` a `--chart-5` nos dois temas.

## Arquivos afetados

```
src/modules/dashboard/{service,rules,labels}.ts (+ testes)
src/components/dashboard/*.tsx, src/app/(app)/page.tsx, src/app/globals.css
e2e/home.spec.ts, e2e/mobile.spec.ts
CLAUDE.md (painel, cores de gráfico, reaproveitamento)
```

## Testes (escritos antes do código, em TDD)

### Unidade

- `weekTimeBars`: sete dias de segunda a domingo, horas trabalhadas de cada um, hoje marcado, dias futuros com zero; semana sem registros.
- `categoryShares`: até cinco categorias e "Outras" somando o resto; porcentagens que somam 100.
- Rótulos dos indicadores (com e sem ciclo ativo, com zero prazos atrasados).

### Integração

- `getDashboard` traz os `kpis` certos (rotinas de hoje, adesão, horas da semana, atrasados contando também os que passam do limite da lista, PDI) e o `timeWeek` a partir dos registros de tempo; o limite de prazos é 5.

### E2E (`home.spec.ts`, dados pelas factories)

1. Com dados, os cinco indicadores mostram os números certos e levam às telas certas.
2. O bloco "Tempo da semana" mostra as barras e a legenda por categoria; sem registros, a mensagem.
3. O PDI mostra o anel com a porcentagem e o texto ao lado.
4. O painel passa no axe nos temas claro e escuro (como hoje) e no `mobile.spec.ts` em 375 e 320 px sem rolagem lateral.

Rodam o `home.spec.ts` e o `mobile.spec.ts`.

## Critério de pronto

- `npm run lint`, `npm run typecheck`, `npm test` e os e2e da área passando.
- Capturas do painel em 1280, 768 e 375 px, nos temas claro e escuro, conferidas.
- `npm run container:up` e `npm run container:check` passando (plano 025).
- `CLAUDE.md` e este plano atualizados.

## Mudanças durante a implementação

- **Paleta:** os cinco primeiros tons da paleta de referência, sem o verde-água (parecido demais com o verde de "concluído"): azul, laranja, violeta, amarelo e magenta, com um passo próprio para o tema escuro. Conferidos com o validador de paleta (separação para daltonismo e visão normal) contra a superfície do bloco nos dois temas. No claro, amarelo e magenta ficam abaixo de 3:1 contra o fundo, por isso a legenda sempre mostra nome, porcentagem e horas em texto. "Outras" usa o cinza do texto secundário.
- **"Trabalhado"** segue a regra do plano 031 (presença menos pausas; o dia de hoje em aberto conta até agora), a mesma dos analíticos. A barra por categoria soma só os blocos de trabalho. Por isso `getDashboard` recebe o minuto atual (`nowMinute`), lido pela página junto com "hoje".
- **Primeiro uso:** um dia de tempo registrado também tira o painel das boas-vindas. Sem isso, quem só usasse a gestão de tempo nunca veria o bloco novo.
- **`percentages`** (`src/modules/time/analytics.ts`) passou a ser exportada e é usada por `categoryShares`, para as porcentagens somarem 100 do mesmo jeito dos analíticos.
- **Nome dos links dos indicadores:** vem do próprio texto ("Prazos atrasados 2"). Um `aria-label` com dois-pontos foi recusado pelo axe (`label-content-name-mismatch`), e um ":" escondido ganha espaços em volta no nome acessível.
- **Grade:** `grid-cols-1` no celular. Sem isso, a coluna da grade cresce até a largura mínima do conteúdo (os gráficos) e a página rolava para o lado (509 px em 375).
- **Bloco Hoje:** o gráfico das 12 semanas aparece em tamanho completo (sem `compact`), e a linha "Adesão em 30 dias" saiu (virou indicador).
- **Objetivos e trilhas:** objetivo sem nenhum em andamento leva a "Criar objetivo"; cada coluna tem o seu link "Ver objetivos" e "Ver trilhas".
- **Verificações:**
  - `npm run lint`, `npm run typecheck`, Prettier e `npm test` (618 testes);
  - e2e: `home.spec.ts` (8) e `mobile.spec.ts` (7);
  - capturas em 1280, 768 e 375 px nos temas claro e escuro, conferidas (nenhuma rolagem lateral, legenda legível);
  - `npm run container:up` e `npm run container:check` passando.

## Decisões

1. Sem biblioteca de gráficos: barras em CSS e anel em SVG.
2. Paleta nos tokens `--chart-1` a `--chart-5`; verde e vermelho só para concluído e atrasado.
3. "Trabalhado na semana" vai de segunda até hoje.
4. Prazos no painel: 5 por grupo, com "Ver todos".

## Perguntas (cada uma com uma proposta)

1. **Biblioteca de gráficos?** Proposta: não; CSS e SVG, como nos planos 029 e 032.
2. **Paleta nos tokens `--chart-1` a `--chart-5`?** Proposta: sim, cinco tons para os dois temas, mantendo o verde e o vermelho só para concluído e atrasado.
3. **"Trabalhado na semana" conta de segunda até hoje?** Proposta: sim (a semana atual, como os analíticos).
4. **Prazos no painel: 5 por grupo?** Proposta: sim, com "Ver todos" para a lista completa.
