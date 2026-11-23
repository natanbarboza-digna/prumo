# 037 — Biblioteca: meta anual e analíticos de leitura

Status: **proposto**, aguardando aprovação
Branch: `feat/reading-analytics`

Último dos três planos da biblioteca (035: cadastro e situações; 036: progresso, avaliação e trechos). Segue o ponto 5 da discussão, aceito pelo dono do projeto: **meta anual** ("ler 12 livros em 2027") com o progresso, e **analíticos**: livros lidos por mês, páginas por semana, tempo médio por livro, autores e gêneros mais lidos.

## Objetivo

Ver, ao longo do ano, se estou lendo o quanto quero e como leio: em que meses, em que ritmo, quanto tempo levo por livro e o que mais leio.

## Como fica

### Meta anual (pergunta 1)

- Uma meta por ano: **número de livros** (de 1 a 365). Definida e alterada na tela de analíticos; sem meta, a tela convida a criar ("Definir meta de 2026").
- **Conta:** livros com situação **Lido** e término naquele ano. Ler de novo e terminar outra vez no mesmo ano conta uma vez (o término é um só).
- **No ritmo:** a meta proporcional aos dias passados do ano. Exemplo, em 24/11 com meta de 12: esperados 10,7; com 9 lidos, "1 livro atrás do ritmo"; com 12, "1 livro à frente". Ano passado mostra só o resultado ("Meta cumprida: 13 de 12").

### Tela de analíticos (`/books/analytics`, pergunta 5)

- Link **"Ver analíticos"** no topo de Leituras. Filtro **`?ano=`** (padrão: o ano atual), com os anos que têm livros terminados ou registros de leitura.
- **Topo:** anel da meta (o `ProgressRing` do plano 034) com "9 de 12 livros" e o texto do ritmo; ao lado, os números do ano: **lidos**, **abandonados**, **páginas lidas**, **horas ouvidas** e **nota média**.
- **Livros lidos por mês:** 12 barras (janeiro a dezembro) pelo mês do término, com o número em cada uma; tabela para leitor de tela (regra do plano 029).
- **Páginas por semana:** as últimas 12 semanas até hoje (no ano passado, as 12 últimas semanas dele), segunda a domingo, em barras.
- **Tempo médio por livro:** média de dias entre início e término dos lidos no ano ("23 dias por livro"), com o mais rápido e o mais demorado.
- **Autores e gêneros mais lidos:** os 5 de cada, por número de livros lidos no ano, com barra proporcional. Autores e gêneros agrupados sem diferenciar maiúsculas, acentos e espaços (o `normalizeActivity` do plano 032), mostrando a grafia mais recente.
- Sem nenhum livro terminado nem registro no ano: "Nenhuma leitura registrada em 2026." com link para Leituras.

### Páginas e horas (pergunta 3)

- **Páginas lidas** vêm dos registros de leitura (plano 036): o que cada dia acrescentou ao anterior, somado pela data do registro. E-book entra convertido pelas páginas do livro, quando informadas (porcentagem × páginas ÷ 100); sem páginas, fica fora. Quando a posição volta para trás (o livro foi lido de novo), o registro conta a partir do zero.
- **Horas ouvidas:** a mesma soma para audiolivros, em minutos.
- Livros terminados sem registros não entram nas páginas (não se sabe quando foram lidas), mas contam nos livros lidos.

### Tempo médio por livro (pergunta 4)

- Dias entre início e término, contando os dois (começou e terminou no mesmo dia = 1 dia). Livros sem data de início ficam fora da média.

### Painel (pergunta 2)

- Um bloco **"Leitura do ano"** na última linha, ao lado de "Objetivos e trilhas" (que passa a ocupar duas colunas de três no computador): anel da meta com "9 de 12 livros" e o ritmo, e os livros que estou lendo com a porcentagem (até 3). Sem meta: "Defina uma meta de leitura" com link; sem nada lendo, só a meta. No celular, empilhado.
- O bloco aparece só se houver algum livro cadastrado ou meta definida.

## Fora de escopo

- Meta em páginas ou horas, metas mensais.
- Período livre nos analíticos (só por ano) e comparação entre anos.
- Gráficos com interação (tooltips) e de linha.
- Ligação com rotinas e com ações de PDI; importação de histórico (continuam nas Pendências).
- Exportar os analíticos.

## Mudanças no modelo de dados

Migration nova:

```prisma
model ReadingGoal {
  id        String   @id @default(uuid(7)) @db.Uuid
  year      Int      @unique
  books     Int
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("reading_goals")
}
```

## Organização do código

- **`src/modules/books/analytics.ts`** (puro): `goalProgress` (lidos, esperado no ritmo, à frente ou atrás), `readingAnalytics(books, logs, year, today)` com lidos por mês, páginas por semana, páginas e horas do ano, tempo médio, autores e gêneros, nota média; `dailyAmounts` (o que cada registro acrescentou, com a regra de quando a posição volta).
- **`schemas.ts`:** meta (ano e livros) e `?ano=` (`analyticsYearSchema`, com o ano atual como padrão).
- **`service.ts`:** `getReadingGoal`, `setReadingGoal`, `readingYears` e a leitura dos dados de um ano para os analíticos.
- **`actions.ts`** e **`labels.ts`** (ritmo da meta, tempo médio, meses).
- **Página** `src/app/(app)/books/analytics/` (com `loading.tsx`) e componentes em `src/components/books/analytics/`: anel e números, barras por mês e por semana, listas de autores e gêneros, formulário da meta.
- **Painel:** `getDashboard` ganha `reading` (meta do ano e livros lendo); componente `reading-card.tsx`; grade da última linha em `page.tsx`.

## Arquivos afetados

```
prisma/schema.prisma, prisma/migrations/<nova>/
src/modules/books/{analytics,schemas,service,actions,labels}.ts (+ testes)
src/app/(app)/books/analytics/**, src/app/(app)/books/page.tsx (link)
src/components/books/analytics/*, src/components/dashboard/reading-card.tsx, src/app/(app)/page.tsx
src/modules/dashboard/service.ts (+ teste)
src/demo/seed-demo.ts (meta do ano), e2e/factories.ts (insertReadingGoal), src/test/e2e-factories.int.test.ts
e2e/books-analytics.spec.ts (novo), e2e/home.spec.ts, e2e/mobile.spec.ts (PAGES)
CLAUDE.md (modelo, regras, reaproveitamento; a biblioteca sai das Pendências, ficando o que é para depois)
```

## Testes (escritos antes do código, em TDD)

### Unidade

- `goalProgress`: esperado proporcional ao dia do ano (inclusive ano bissexto), à frente, atrás e em dia; ano passado só com o resultado.
- `dailyAmounts`: soma por dia, e-book convertido pelas páginas (e fora sem páginas), audiolivro em minutos, posição que volta conta do zero.
- `readingAnalytics`: lidos por mês, páginas das 12 semanas, tempo médio (com o mais rápido e o mais demorado, mesmo dia = 1, sem início fora), autores e gêneros agrupados sem acento e maiúsculas, nota média sem os sem nota, ano sem leitura.
- Schemas da meta e do `?ano=`; rótulos do ritmo ("1 livro atrás do ritmo", "2 livros à frente", "no ritmo").

### Integração

- Definir e trocar a meta de um ano; anos com leitura; os dados de um ano lidos do banco.
- `getDashboard` com e sem meta, com livros lendo (até 3, com a porcentagem).
- Factory e demonstração em dia.

### E2E (`books-analytics.spec.ts`, dados pelas factories)

1. Definir a meta pela tela e ver o anel e o ritmo.
2. Com livros e registros, ver os números do ano, as barras por mês e por semana e os autores mais lidos; trocar de ano pelo filtro.
3. Ano sem leitura mostra a mensagem.
4. O bloco "Leitura do ano" no painel (`home.spec.ts`); axe nos dois temas; `/books/analytics` em `PAGES` do `mobile.spec.ts`.

## Critério de pronto

- `npm run lint`, `npm run typecheck`, `npm test` e os e2e da área passando, com a migration e `npx prisma generate`.
- Capturas da tela de analíticos e do painel em 1280 e 375 px, conferidas.
- `npm run container:up` e `npm run container:check` passando (plano 025).
- `CLAUDE.md` e este plano atualizados.

## Perguntas (cada uma com uma proposta)

1. **Meta em número de livros por ano?** Proposta: sim, contando os lidos com término no ano.
2. **Bloco "Leitura do ano" no painel**, ao lado de "Objetivos e trilhas"? Proposta: sim, com a meta e os livros lendo.
3. **Páginas pelos registros de leitura**, com e-book convertido e audiolivro em horas à parte? Proposta: sim.
4. **Tempo médio = dias entre início e término** dos lidos no ano? Proposta: sim.
5. **Analíticos só por ano** (`?ano=`)? Proposta: sim, sem período livre por enquanto.
