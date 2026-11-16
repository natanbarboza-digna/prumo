# 006 — Painel inicial

Status: **implementado em 2026-11-16**, aprovado no mesmo dia com as propostas das perguntas (ver "Decisões")
Branch: `feat/dashboard`

## Objetivo

Trocar a página inicial (`/`), que hoje só tem título e descrição, por um painel que responde em uma tela: o que fazer hoje, o que está atrasado ou vence logo, como andam os objetivos e trilhas em andamento, e como está o PDI ativo. O painel só lê dados. Cada bloco leva à tela que já existe para agir; a exceção é o registro das rotinas do dia (pergunta 1).

## Escopo

O painel tem cinco blocos, nesta ordem (mobile em coluna única; a partir de `md`, duas colunas para os blocos menores).

### 1. Hoje

- Título "Hoje" com a data por extenso, como em `/today`.
- **Rotinas previstas para hoje** com os mesmos controles de registro da tela Hoje (`LogControls`: Feito, Pular, Desfazer), mais o resumo "2 de 5 feitas" (`doneTodayText`).
- **Adesão dos últimos 30 dias** somando as rotinas ativas (`combineAdherence` sobre a adesão que `listRoutines` já calcula): "Adesão em 30 dias: 82%".
- Sem rotina hoje: "Nenhuma rotina para hoje." com link "Criar rotina".
- Link "Abrir Hoje" para `/today`.

### 2. Atrasados e próximos prazos

- Uma lista única que junta três fontes:
  - etapas de trilha não concluídas (com `dueDate`);
  - ações de PDI não concluídas nem canceladas, de ciclos que não estão encerrados (com `dueDate`);
  - objetivos `NOT_STARTED` ou `IN_PROGRESS` (com `targetDate`).
- Dois grupos: **"Atrasados"** (prazo antes de hoje) e **"Próximos 14 dias"** (de hoje até hoje + 13; pergunta 2). Ordem por data e, no empate, por título.
- Cada item mostra o tipo ("Etapa", "Ação de PDI", "Objetivo"), o título como link para a tela do item, a origem (nome da trilha ou do ciclo) e a data. "Vence hoje" para hoje e o selo de atraso que já existe para os atrasados.
- No máximo 10 itens por grupo, com "e mais N" quando houver mais. O "mais" não leva a lugar nenhum: não existe tela de prazos (fora de escopo).
- Sem nada: "Nenhum prazo atrasado nem nos próximos 14 dias."

### 3. PDI

- **Ciclo ativo** (há no máximo um):
  - título como link para o ciclo, período e "faltam N dias" (ou "termina hoje", ou "terminou há N dias" se o fim já passou e o ciclo continua ativo);
  - progresso das ações (`ActionProgress`, que já existe: concluídas de não canceladas);
  - quantas ações estão atrasadas;
  - adesão das rotinas vinculadas no ciclo, combinando a evidência de todas as ações (`getRoutineEvidenceByAction` + `combineAdherence`), só se houver rotina vinculada;
  - último check-in: "Último check-in: 02/11/2026 (há 14 dias)" ou "Nenhum check-in ainda", com link para registrar um.
- **Sem ciclo ativo:** se houver ciclo planejado, mostra o mais próximo ("Próximo ciclo: _título_, começa em _data_"); senão, "Nenhum ciclo ativo." com link "Criar ciclo".

### 4. Objetivos em andamento

- Objetivos `IN_PROGRESS`, ordenados pela data-alvo (sem data por último), no máximo 5, com "Ver todos" para `/goals`.
- Cada um com o título (link), a data-alvo, o selo de atraso e a barra de progresso agregado que já existe na página do objetivo (`GoalProgress`).
- Sem objetivo em andamento: "Nenhum objetivo em andamento." com link "Ver objetivos".

### 5. Trilhas em andamento

- Trilhas cujo status derivado é `IN_PROGRESS` (`deriveTrackStatus`), no máximo 5, com "Ver todas" para `/tracks`.
- Cada uma com o título (link), o objetivo vinculado e a barra de progresso que já existe (`TrackProgress`).
- Sem trilha em andamento: "Nenhuma trilha em andamento." com link "Ver trilhas".

### Primeiro uso

- Se não houver nenhum objetivo, trilha, rotina nem ciclo, o painel mostra um bloco de boas-vindas no lugar dos cinco blocos, com uma linha por área e o link para criar o primeiro item ("Criar objetivo", "Criar trilha", "Criar rotina", "Criar ciclo de PDI").

### Atualização depois de mudanças

- As actions de objetivos, trilhas, rotinas, PDI e categorias passam a revalidar também `/`. Sem isso, o Next pode mostrar uma versão antiga do painel guardada no cache do navegador depois de uma alteração feita em outra tela.

## Fora de escopo

- Gráficos, histórico de adesão por semana ou qualquer visual além das barras de progresso já existentes.
- Personalizar o painel (esconder, reordenar blocos ou mudar o horizonte de 14 dias).
- Uma tela própria de prazos (a lista do painel é limitada a 10 por grupo).
- Mudar a navegação: o nome "Gestão Pessoal" no cabeçalho já leva a `/` (pergunta 4).
- Notificações ou lembretes.

## Mudanças no modelo de dados

Nenhuma. O painel só lê o que já existe.

## Organização do código

- **Novo módulo `src/modules/dashboard/`**, sem `schemas.ts` nem `actions.ts`, porque o painel não grava nada:
  - `rules.ts`: regras puras, sem banco. `groupDeadlines(items, today, horizonDays)` separa atrasados e próximos, ordena e corta no horizonte. `cycleTimeText`/`daysUntil` para "faltam N dias".
  - `service.ts`: `getDashboard(today)`, que busca tudo em paralelo (`Promise.all`) chamando os services dos outros módulos e devolve um objeto com um campo por bloco. Uma única função facilita testar o painel inteiro sem a tela.
- **Funções novas nos services existentes**, para não buscar demais nem fazer uma consulta por item:
  - `goals/service.ts`: `getGoalsProgress(goalIds)`, o progresso de vários objetivos com contagens agrupadas (`groupBy`) em vez de quatro consultas por objetivo. `getGoalProgress` passa a usá-la.
  - `tracks/service.ts`: `listOpenStepsWithDueDate()` (etapas não concluídas com prazo, com o título da trilha).
  - `pdi/service.ts`: `listOpenActionsWithDueDate()` (ações abertas com prazo de ciclos não encerrados, com o título do ciclo) e `getLastCheckInDate(cycleId)`.
- **A página** `src/app/page.tsx` é um Server Component: chama `connection()` (lê "hoje" antes do banco, como `/today`), depois `getDashboard(today)`, e compõe os blocos. A raiz já tem `loading.tsx`, então o Next mostra o "Carregando…" enquanto os dados chegam. Só `LogControls` é Client Component, e ele já existe.
- **Componentes** em `src/components/dashboard/`, um por bloco (`today-card.tsx`, `deadlines-card.tsx`, `pdi-card.tsx`, `goals-card.tsx`, `tracks-card.tsx`, `welcome.tsx`), todos Server Components. Cada bloco é uma `section` com `h2`, para a página ter títulos em ordem e regiões nomeadas.

## Arquivos afetados

```
src/app/page.tsx                                   (painel)
src/modules/dashboard/{rules,service}.ts           (novos)
src/modules/dashboard/rules.test.ts, service.int.test.ts  (novos)
src/modules/dashboard/labels.ts (+ .test.ts)       (textos: "Vence hoje", "faltam N dias", "há N dias", tipos de prazo)
src/modules/goals/service.ts                       (getGoalsProgress)
src/modules/tracks/service.ts                      (listOpenStepsWithDueDate)
src/modules/pdi/service.ts                         (listOpenActionsWithDueDate, getLastCheckInDate)
src/modules/{goals,tracks,routines,pdi,categories}/actions.ts  (revalidar "/")
src/components/dashboard/*.tsx                     (novos)
e2e/home.spec.ts                                   (reescrito: vazio, preenchido, registro, axe)
CLAUDE.md                                          (lista de reaproveitamento, se surgir algo reutilizável)
```

## Testes (escritos antes do código, em TDD)

### Unidade

| Arquivo                                | Casos                                                                                                                                                                                                                                                             |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/modules/dashboard/rules.test.ts`  | `groupDeadlines`: separa atrasados (antes de hoje) e próximos (hoje até hoje + 13); exclui depois do horizonte; ordena por data e título; limita a 10 por grupo e informa quantos ficaram de fora; listas vazias. Dias até o fim do ciclo: futuro, hoje, passado. |
| `src/modules/dashboard/labels.test.ts` | "Vence hoje"; "faltam 1 dia"/"faltam N dias" (singular e plural); "termina hoje"; "terminou há N dias"; "há N dias" do check-in; "Adesão em 30 dias" com e sem dias para contar.                                                                                  |

### Integração (banco de teste)

| Arquivo                                     | Casos                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/modules/goals/service.int.test.ts`     | `getGoalsProgress` dá o mesmo resultado que `getGoalProgress` para vários objetivos; objetivo sem itens fica 0 de 0; lista vazia não consulta nada.                                                                                                                                                                                                                                                                              |
| `src/modules/tracks/service.int.test.ts`    | `listOpenStepsWithDueDate` traz só etapas não concluídas com prazo, com o título da trilha.                                                                                                                                                                                                                                                                                                                                      |
| `src/modules/pdi/service.int.test.ts`       | `listOpenActionsWithDueDate` exclui concluídas, canceladas, sem prazo e de ciclo encerrado; `getLastCheckInDate` devolve a data mais recente ou `null`.                                                                                                                                                                                                                                                                          |
| `src/modules/dashboard/service.int.test.ts` | Banco vazio marca o primeiro uso; rotinas de hoje com os registros e o resumo; adesão de 30 dias só das rotinas ativas; prazos juntam etapa, ação e objetivo e ignoram itens concluídos; objetivos em andamento ordenados e limitados a 5; trilhas só com status derivado em andamento; ciclo ativo com progresso, atrasadas, adesão das rotinas vinculadas e último check-in; sem ciclo ativo, mostra o planejado mais próximo. |

### E2E (`e2e/home.spec.ts`, reescrito)

1. Banco vazio: aparece o bloco de boas-vindas com os quatro links de criação; o título continua "Gestão Pessoal" e `lang="pt-BR"`.
2. Com dados (objetivo em andamento com data-alvo, trilha com uma etapa feita e uma atrasada, rotina diária, ciclo ativo com ação atrasada): cada bloco mostra o item certo, e a etapa e a ação aparecem em "Atrasados" com link para a tela delas.
3. Marcar "Feito" numa rotina no painel atualiza o resumo ("1 de 1 feita") e o registro aparece em `/today`.
4. O painel vazio e o preenchido passam no axe.
5. O teste de tema escuro continua.

## Critério de pronto

- `npm run lint`, `npm run typecheck`, `npm test` e `npm run test:e2e` passando.
- Sem migration (o schema não muda).
- Plano atualizado se o escopo mudar; `CLAUDE.md` atualizado se surgir algo reaproveitável.

## Mudanças durante a implementação

- **Prazos sem selo de atraso.** O grupo "Atrasados" já diz que o item está atrasado; cada item mostra "Venceu em _data_" em vermelho, "Vence hoje" ou "Vence em _data_" (`dueText`).
- **Textos no singular:** "Falta 1 dia" e "Terminou há 1 dia" (o plano dizia "faltam N dias" para todos).
- **`daysBetween`** foi para `src/lib/dates.ts`, com testes, porque é cálculo de datas e não regra do painel. `rules.ts` ficou só com `groupDeadlines` e as constantes (horizonte de 14 dias, limite de 10 prazos e de 5 objetivos/trilhas).
- **Primeiro uso** conta as rotinas direto no banco (`db.routine.count()`), já que `listRoutines` calcula a adesão de cada uma e o painel só precisa saber se existe alguma.
- **Trilhas em andamento** aparecem na ordem da lista de trilhas (as mais recentes primeiro).
- **Objetivos no painel** usam a barra `Progress` direto: `GoalProgressSummary` é uma seção inteira com `h2` e `id` fixo, feita para a página do objetivo.
- **Componentes de apoio** `DashboardCard` (seção com `h2` e link "Ver todos") e `EmptyCardText` (mensagem de lista vazia com o link da próxima ação), em `src/components/dashboard/dashboard-card.tsx`.
- **Revalidação:** `setStepStatusAction` (concluir/reabrir etapa) também passou a revalidar `/tracks` e `/`; antes só fazia `refresh()` da página atual.
- **Bloco de boas-vindas** tem o título "Por onde começar".

## Decisões

1. As rotinas do dia podem ser registradas no painel, com os mesmos botões da tela Hoje.
2. O horizonte dos próximos prazos é de 14 dias.
3. Objetivos não concluídos com data-alvo entram na lista de prazos.
4. A navegação não ganha link "Início"; o nome no cabeçalho leva ao painel.
