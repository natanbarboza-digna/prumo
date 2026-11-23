# 031 — Gestão de tempo: registro do dia

Status: **proposto**, aguardando aprovação
Branch: `feat/time-tracking-day`

Primeiro dos três planos da gestão de tempo (alinhada em 2026-11-23 e registrada nas Pendências do `CLAUDE.md`): (1) registro do dia, (2) analíticos, (3) importação do `.md`.

## Objetivo

Trocar o `.md` de hoje (`**16/11**` e uma linha `HH:MM - o que foi feito` a cada 30 minutos) por uma tela "Tempo" onde o dia aparece em blocos prontos para preencher, com categoria e projeto, para os analíticos do plano 032 terem dados organizados.

## Como fica

### O dia

- **Começar o dia:** na primeira visita do dia, a tela pede a **hora de entrada** (já preenchida com a hora atual) e a **duração dos blocos** (15, 30 ou 60 minutos; padrão 30). Os dois ficam guardados no dia (pergunta 2).
- **Blocos alinhados ao relógio** (pergunta 1): com blocos de 30 minutos, eles começam em :00 e :30. A entrada e a saída são guardadas na hora exata; se a entrada é 08:15, o primeiro bloco é curto, de 08:15 a 08:30, e pode ficar vazio, como no `.md` de hoje.
- **A grade cresce com o dia:** enquanto o dia está aberto, aparecem os blocos da entrada até o bloco atual. Ao **encerrar o dia** (hora de saída, já preenchida com a hora atual), a grade vai até a saída.
- **Corrigir entrada e saída** depois é possível. Se a mudança deixar registros fora do expediente, o service recusa e a tela diz quais blocos ficariam de fora.
- **Outros dias:** setas "dia anterior" e "próximo dia" e o dia na URL (`/time?dia=AAAA-MM-DD`), para preencher um dia esquecido. Dias futuros não podem ser registrados.
- O dia não atravessa a meia-noite (saída depois da entrada, no mesmo dia).

### Cada bloco

Um bloco pode estar:

- **vazio** (conta como presença sem registro nos analíticos);
- **registrado:** texto livre, **categoria** (obrigatória) e **projeto ou cliente** (opcional);
- **pausa** (almoço, café): só o texto opcional, sem categoria nem projeto; desconta do tempo trabalhado;
- **dividido** em duas metades iguais (por exemplo, 14:00–14:15 e 14:15–14:30), cada uma com o seu registro ou pausa. Só uma divisão por bloco (pergunta 6).

Ações em cada bloco:

- **Salvar** o registro (o formulário fica no próprio bloco, sem trocar de página);
- **Repetir o anterior:** copia texto, categoria e projeto do registro anterior do dia;
- **Pausa**, **Dividir**, **Juntar** (desfaz a divisão, se as metades estiverem vazias ou iguais) e **Limpar**.

O texto sugere os textos já usados (lista do navegador, `datalist`), para "configuração digna relatórios" não precisar ser digitado de novo.

### Resumo do dia (no topo)

- **Presença:** da entrada à saída (ou até agora, com o dia aberto).
- **Trabalhado:** presença menos as pausas.
- **Pausas** e **sem registro** (blocos vazios).

A divisão por categoria e por projeto, as semanas e os meses ficam para o plano 032.

### Categorias e projetos

- **Categorias de tempo** (pergunta 3): um cadastro próprio, como as categorias de ação do PDI (criar, editar, arquivar; em uso não pode ser excluída). O seed cria **Atendimento, Chamados, Projeto, Reunião e Estudo**, e nenhum comportamento depende do nome. Categoria arquivada não aparece para registros novos e continua nos antigos.
- **Projetos e clientes** (pergunta 4): o campo é um texto com sugestões dos projetos ativos. **Um nome novo cria o projeto ao salvar o bloco**, sem ir a outra tela. Há uma tela simples para renomear e arquivar.
- As duas telas ficam em **`/time/categories`** e **`/time/projects`**, com links na tela do dia.

### No app

- Item **"Tempo"** no menu principal, depois de "Rotinas" (alinhado no grupo). Em 375 px o menu passa a rolar para o lado, como já acontece em 320 px; o `mobile.spec.ts` muda de acordo.
- A busca única, o painel e os vínculos com objetivos e PDI não mudam neste plano.

## Fora de escopo

- Analíticos por categoria, projeto, semana e mês, fragmentação e filtros (plano 032).
- Importação do `.md` (plano 033).
- Cronômetro de iniciar e parar, e horários livres fora da grade.
- Dia que atravessa a meia-noite; mais de uma entrada e saída no mesmo dia (a pausa cobre o almoço).
- Ligar registros a objetivos ou ações de PDI; tempo no painel e na busca.
- Dividir um bloco em mais de duas partes ou em partes diferentes.

## Mudanças no modelo de dados

Quatro tabelas novas. Horas do dia ficam no banco como **minutos desde a meia-noite** (`Int`), fáceis de somar e comparar, e circulam na aplicação como `"HH:MM"` (conversão em `src/lib/time-of-day.ts`, feita no service, como as datas).

- **`TimeDay`** (`time_days`): `date` (`@db.Date`, único), `startMinute`, `endMinute` (opcional: nulo com o dia aberto), `slotMinutes` (15, 30 ou 60).
- **`TimeEntry`** (`time_entries`): `dayId` (apaga junto com o dia), `startMinute`, `minutes` (duração), `kind` (`WORK`, `BREAK`), `description` (opcional na pausa), `categoryId` (obrigatório em `WORK`, nulo em `BREAK`; `onDelete: Restrict`), `projectId` (opcional; `onDelete: Restrict`). Único por (`dayId`, `startMinute`).
- **`TimeCategory`** (`time_categories`): `name` (único), `archived`.
- **`TimeProject`** (`time_projects`): `name` (único, sem diferenciar maiúsculas na busca do nome ao salvar), `archived`.

Migration com as tabelas e o enum; o seed de categorias entra no `prisma/seed.ts` e no `resetDatabase` dos e2e.

## Organização do código

- **`src/lib/time-of-day.ts`:** `"HH:MM"` ↔ minutos, hora atual no fuso do app (`nowInAppTimeZone`), arredondamento ao bloco.
- **`src/modules/time/`** (domínio novo):
  - `rules.ts` (puro): a grade do dia (`daySlots`: blocos alinhados ao relógio, primeiro e último curtos, até agora ou até a saída), a posição de cada registro na grade, a validação de um registro dentro de um bloco ou de uma metade, e o resumo (presença, trabalhado, pausas, sem registro).
  - `schemas.ts`: começar e encerrar o dia, registro do bloco, categoria e projeto.
  - `service.ts`: abrir, encerrar e corrigir o dia; salvar, repetir, dividir, juntar e limpar blocos; categorias e projetos (com criação do projeto pelo nome); erros como `FutureDayError`, `EntryOutsideDayError`, `CategoryArchivedError`.
  - `actions.ts`: as Server Actions, com `requireSession()` e a revalidação de `/time` (e de `/`, pela regra do projeto).
- **Telas:** `src/app/(app)/time/page.tsx` (o dia), `time/categories/…` e `time/projects/…`, cada uma com `loading.tsx`; componentes em `src/components/time/` (grade, bloco com o formulário, resumo, navegação entre dias). O formulário do bloco é um Client Component pequeno (estado de envio e de erro); a grade e o resumo são Server Components.
- **`e2e/factories.ts`:** `insertTimeDay` com os registros, e a verificação no `e2e-factories.int.test.ts`.

## Arquivos afetados

```
prisma/schema.prisma, prisma/migrations/<data>_add_time_tracking/, prisma/seed.ts
src/lib/time-of-day.ts (+ teste)
src/modules/time/{rules,schemas,service,actions,labels}.ts (+ testes)
src/modules/categories/defaults.ts ou equivalente (seed das categorias de tempo)
src/app/(app)/time/** (dia, categorias, projetos)
src/components/time/*.tsx, src/components/main-nav.tsx
e2e/factories.ts, e2e/helpers.ts (resetDatabase), src/test/e2e-factories.int.test.ts
e2e/time.spec.ts (novo), e2e/mobile.spec.ts (menu com cinco itens, páginas novas em PAGES), e2e/navigation.spec.ts
CLAUDE.md (modelo de domínio, regras, menu)
```

## Testes (escritos antes do código, em TDD)

### Unidade

- `time-of-day`: conversões, hora atual no fuso de Fortaleza (não em UTC), valores inválidos.
- `daySlots`: blocos de 15, 30 e 60 minutos alinhados ao relógio; entrada fora da grade (08:15) gera um primeiro bloco curto; saída fora da grade, um último curto; dia aberto vai até o bloco atual; dia encerrado vai até a saída.
- Registro na grade: cabe num bloco inteiro ou numa metade; recusa o que sai do bloco ou do expediente.
- Resumo: presença, trabalhado, pausas e sem registro, com e sem saída.
- Schemas: duração do bloco só 15, 30 ou 60; saída depois da entrada; categoria obrigatória no registro e ausente na pausa.

### Integração (service)

- Começar o dia uma vez só por data; dia futuro recusado.
- Salvar, repetir o anterior, pausa, dividir, juntar e limpar; um registro por início de bloco.
- Corrigir entrada ou saída: aceita quando todos os registros cabem; recusa quando algum fica de fora.
- Categoria arquivada recusada em registro novo; categoria em uso não pode ser excluída; projeto criado pelo nome ao salvar, sem duplicar ("Digna" e "digna" são o mesmo).

### E2E (`time.spec.ts`, dados pelas factories)

1. "Tempo" no menu abre o dia; começar o dia às 08:15 com blocos de 30 minutos mostra o bloco curto 08:15–08:30.
2. Preencher um bloco (texto, categoria e um projeto novo), "repetir o anterior" no seguinte e marcar uma pausa; o resumo mostra presença, trabalhado e pausas.
3. Dividir um bloco e preencher as duas metades.
4. Encerrar o dia; voltar ao dia anterior pela seta e preencher um bloco esquecido.
5. As páginas de tempo passam no axe, e o menu com cinco itens passa no `mobile.spec.ts` em 375 e 320 px.

Rodam o `time.spec.ts`, o `mobile.spec.ts` e o `navigation.spec.ts` (menu novo).

## Critério de pronto

- `npm run lint`, `npm run typecheck`, `npm test` e os e2e da área passando.
- Migration incluída e `npx prisma generate` rodado.
- `npm run container:up` e `npm run container:check` passando (plano 025).
- `CLAUDE.md` (modelo, regras, menu; tirar o item 1 da pendência) e este plano atualizados.

## Perguntas (cada uma com uma proposta)

1. **Blocos alinhados ao relógio?** Proposta: sim (:00 e :30 com blocos de 30 minutos), com o primeiro e o último blocos curtos quando a entrada ou a saída não caem na grade.
2. **Onde fica a duração do bloco?** Proposta: escolhida ao começar cada dia (padrão 30) e guardada nele, para mudar a duração não bagunçar os dias antigos. Sem tela de configurações geral.
3. **Categorias padrão?** Proposta: o seed cria Atendimento, Chamados, Projeto, Reunião e Estudo; você edita, arquiva e cria as suas.
4. **Projeto novo pelo próprio bloco?** Proposta: sim, digitar um nome que não existe cria o projeto ao salvar.
5. **Bloco vazio é permitido?** Proposta: sim; conta como "sem registro" no resumo e nos analíticos.
6. **Divisão:** só em duas metades iguais? Proposta: sim, como alinhado; partes diferentes ficam fora.
