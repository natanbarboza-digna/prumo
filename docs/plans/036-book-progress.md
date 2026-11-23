# 036 — Biblioteca: progresso de leitura, avaliação e trechos

Status: **implementado em 2026-11-24**, aprovado com as propostas das cinco perguntas (ver "Decisões")
Branch: `feat/book-progress`

Segundo dos três planos da biblioteca (o primeiro, cadastro e situações, é o 035; o terceiro, meta anual e analíticos, vem depois). Segue o ponto 3 da discussão, aceito pelo dono do projeto: progresso por **registros de leitura por dia**, com minutos no audiolivro e porcentagem no e-book; e o ponto 4: ao terminar, **avaliação de 1 a 5**, **resenha** e **trechos**.

## Objetivo

Saber onde estou em cada livro que estou lendo, em que ritmo e quando devo terminar; e, ao terminar, guardar o que achei e os trechos que marquei.

## Como fica

### Unidade de progresso (pergunta 1)

| Formato    | O registro diz         | Total do livro                               |
| ---------- | ---------------------- | -------------------------------------------- |
| Físico     | a página em que parei  | `pages` (já existe, opcional)                |
| E-book     | a porcentagem          | sempre 100                                   |
| Audiolivro | o tempo ouvido (HH:MM) | `durationMinutes` (novo, opcional, em HH:MM) |

Sem o total (livro físico sem páginas ou audiolivro sem duração), o registro funciona, mas não há porcentagem nem previsão; a página do livro diz o que falta preencher.

### Registro de leitura (pergunta 2)

- Na página do livro **sendo lido**, um bloco **"Progresso"** com um formulário curto: data (padrão hoje) e **onde parei** ("Página", "Porcentagem" ou "Tempo ouvido", conforme o formato).
- O registro guarda a **posição alcançada**, não a quantidade lida: "parei na página 72". A quantidade do dia é a diferença para o registro anterior. Assim, um erro se corrige no registro seguinte, sem conta de cabeça.
- **Um registro por dia** (`BookLog` único por livro e data): registrar de novo no mesmo dia substitui.
- Regras (no service):
  - só para livro **Lendo**;
  - data entre o início da leitura e hoje;
  - posição de 1 até o total (quando há total), e **não menor** que a do registro anterior nem maior que a do seguinte, dentro da leitura atual (registros a partir de `startedOn`).
- Lista dos registros da leitura atual, do mais recente ao mais antigo: data, posição e quanto foi lido no dia ("+32 páginas"). Cada um pode ser excluído, com confirmação.
- **Ler de novo** começa uma leitura nova: os registros antigos ficam guardados, mas o progresso só conta os da leitura atual.

### Progresso e previsão (pergunta 3)

- Barra de progresso com o texto: "Página 120 de 456 (26%)", "45% lido" ou "3h20 de 10h (33%)".
- **Ritmo:** média por dia nos **últimos 14 dias** (o que avançou nesse período dividido por 14, ou pelos dias desde o início da leitura, se ela começou há menos tempo). Exemplo: "Ritmo: 18 páginas por dia".
- **Previsão de término:** hoje mais o que falta dividido pelo ritmo. Exemplo: "Previsão de término: 12/12/2026". Sem total ou com ritmo zero, sem previsão.
- Livro com prazo: a previsão diz se chega a tempo ("depois do prazo, 01/12/2026", em vermelho).
- Livro **Lido** mostra o progresso completo; **Abandonado** mostra onde parou.
- Na lista de livros, o item de quem está **Lendo** ganha a porcentagem ("26%"), quando há total.

### Avaliação, resenha e trechos (pergunta 4)

- **Avaliação** de 1 a 5 (opcional), só para livro **Lido**. Na página do livro, um bloco "Avaliação" com as cinco notas (botões de opção) e a **resenha** (texto, até 5.000 caracteres). Salvar não muda a situação.
- **Resenha** também para livro **Abandonado** (para lembrar por que parei), sem nota.
- Na lista de livros, o lido com nota mostra "★ 4".
- **Trechos:** em qualquer situação, um bloco "Trechos" com o texto (até 2.000 caracteres) e a página ou posição (opcional). Lista do mais recente ao mais antigo; cada trecho pode ser editado e excluído.
- Ler de novo mantém nota, resenha e trechos.

### Formato e total depois dos registros (pergunta 5)

- **Trocar o formato** de um livro com registros é recusado ("Este livro tem registros de leitura; o formato não pode mudar."), porque página, porcentagem e tempo não se convertem.
- **Total menor** que a maior posição registrada também é recusado.

## Fora de escopo

- Meta anual e analíticos (páginas por semana, livros por mês…): plano 3.
- Gráfico de ritmo na página do livro (fica para os analíticos).
- Ligar o registro de leitura a uma rotina ("Ler 20 minutos") e livro como evidência de ação de PDI.
- Leitura em paralelo de mais de uma edição; histórico separado por leitura além do que `startedOn` já separa.
- Bloco de leituras no painel.

## Mudanças no modelo de dados

Migration nova:

```prisma
model Book {
  // … campos do plano 035
  durationMinutes Int?        @map("duration_minutes")  // audiolivro
  rating          Int?        @db.SmallInt              // 1 a 5, só lido
  review          String?
  logs            BookLog[]
  quotes          BookQuote[]
}

model BookLog {
  id        String   @id @default(uuid(7)) @db.Uuid
  bookId    String   @map("book_id") @db.Uuid
  book      Book     @relation(fields: [bookId], references: [id], onDelete: Cascade)
  date      DateTime @db.Date
  /// Page, percentage or minutes reached, depending on the book's format.
  position  Int
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@unique([bookId, date])
  @@map("book_logs")
}

model BookQuote {
  id        String   @id @default(uuid(7)) @db.Uuid
  bookId    String   @map("book_id") @db.Uuid
  book      Book     @relation(fields: [bookId], references: [id], onDelete: Cascade)
  text      String
  /// Page, percentage or "HH:MM", as typed.
  location  String?  @db.VarChar(20)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@index([bookId])
  @@map("book_quotes")
}
```

Excluir o livro exclui registros e trechos.

## Organização do código

- **`src/modules/books/rules.ts`** (puro): unidade por formato, total, progresso (`bookProgress`), ritmo e previsão (`readingPace`, `finishForecast`), registros da leitura atual, limites da posição de um registro.
- **`schemas.ts`:** registro (data e posição, com `HH:MM` no audiolivro via `parseTimeOfDay`), avaliação e resenha, trecho; `durationMinutes` no formulário do livro.
- **`service.ts`:** `logReading`, `deleteBookLog`, `rateBook`, `createQuote`, `updateQuote`, `deleteQuote`; `getBook` traz registros e trechos; `updateBook` recusa troca de formato e total menor; `listBooks` traz a posição atual.
- **`actions.ts`** e **`labels.ts`** (textos de progresso, ritmo, previsão e quantidade do dia).
- **Componentes** em `src/components/books/`: `reading-progress.tsx`, `reading-log-form.tsx`, `reading-log-list.tsx`, `rating-form.tsx`, `quote-form.tsx` e `quote-list.tsx`; `book-form.tsx` (duração do audiolivro) e `book-list.tsx` (porcentagem e nota).
- **Página do livro:** blocos Progresso, Avaliação e Trechos.

## Arquivos afetados

```
prisma/schema.prisma, prisma/migrations/<nova>/
src/modules/books/* (+ testes)
src/components/books/*, src/app/(app)/books/[id]/page.tsx (e rotas de edição de trecho, se preciso)
src/demo/seed-demo.ts (registros, nota e trechos), e2e/factories.ts, src/test/e2e-factories.int.test.ts
e2e/books.spec.ts, e2e/mobile.spec.ts
CLAUDE.md (modelo, regras, reaproveitamento; plano 2 da biblioteca feito nas Pendências)
```

## Testes (escritos antes do código, em TDD)

### Unidade

- Unidade e total por formato; progresso com e sem total; texto de progresso nos três formatos.
- Registros da leitura atual (os de antes de `startedOn` ficam fora) e a quantidade do dia.
- Limites da posição: entre o registro anterior e o seguinte, até o total.
- Ritmo em 14 dias e em leitura mais curta; previsão com e sem ritmo, antes e depois do prazo.
- Schemas: posição inteira e positiva, `HH:MM` no audiolivro, porcentagem até 100, nota de 1 a 5, limites de texto.

### Integração

- Registrar, substituir no mesmo dia, excluir; recusas (livro não lendo, data fora da leitura, posição fora dos limites).
- Ler de novo separa a leitura atual.
- Avaliar só lido; resenha em lido e abandonado; trechos criar, editar e excluir.
- Trocar formato com registros e total menor que a posição: recusados.
- Excluir livro leva registros e trechos; factory e demonstração em dia.

### E2E (`books.spec.ts`)

1. Registrar duas leituras num livro físico e ver a página, a porcentagem, o ritmo e a previsão.
2. Audiolivro com duração: registrar em `HH:MM`.
3. Marcar como lido, dar nota e resenha, e ver a nota na lista.
4. Adicionar, editar e excluir um trecho.
5. Axe na página do livro com os blocos novos; `mobile.spec.ts` sem rolagem lateral.

## Critério de pronto

- `npm run lint`, `npm run typecheck`, `npm test` e os e2e da área passando, com a migration e `npx prisma generate`.
- `npm run container:up` e `npm run container:check` passando (plano 025).
- `CLAUDE.md` e este plano atualizados.

## Mudanças durante a implementação

- **Registro do mesmo dia:** como ele substitui o do dia, os limites da posição ignoram o registro daquele dia (`positionBounds`); o e2e de recusa usa uma página anterior ao registro de outro dia.
- **Edição de trecho** numa rota própria (`/books/[id]/quotes/[quoteId]/edit`), como a edição de etapa; volta para `#trechos` da página do livro.
- **Mensagens de recusa** da posição no formato do campo ("Informe de 20 a 400.", "Informe de 00:40 a 10:00."), e a data mostra o início da leitura.
- **Formulário do livro:** a duração (HH:MM) aparece no lugar das páginas quando o formato é Audiolivro; o formato passou a ser um campo controlado para isso.
- **Nota na lista:** "★ 4" com " de 5" só para leitor de tela, sem `aria-label` num `span` (o axe recusa e o `CLAUDE.md` proíbe `getByLabel` nos e2e).
- **Botão do registro** abaixo dos campos: alinhar ao lado pedia um valor arbitrário de margem, que o `CLAUDE.md` proíbe.
- **Demonstração:** sete registros no livro que está sendo lido, um trecho e a nota 4 no livro lido.
- **Verificações:**
  - `npm run lint`, `npm run typecheck`, Prettier e `npm test` (675 testes);
  - e2e: `books.spec.ts` (10), `mobile.spec.ts` (com a página do livro em 320 px), `goals.spec.ts`, `search.spec.ts`, `deadlines.spec.ts` e `home.spec.ts`, todos passando;
  - capturas da página do livro lendo (1280 e 375 px) e lido, conferidas;
  - `npm run container:up` (13 migrations, nenhuma pendente) e `npm run container:check` passando.

## Decisões

1. Unidade por formato: página, porcentagem e tempo ouvido contra a duração.
2. O registro guarda onde parei; a quantidade do dia é calculada.
3. Ritmo dos últimos 14 dias para a previsão.
4. Nota só para lido; resenha para lido e abandonado; trechos em qualquer situação.
5. Trocar o formato de um livro com registros é recusado.

## Perguntas (cada uma com uma proposta)

1. **Unidade por formato** (página, porcentagem, tempo ouvido com a duração do audiolivro)? Proposta: sim.
2. **O registro guarda onde parei**, não quanto li? Proposta: sim; a quantidade do dia é calculada.
3. **Ritmo dos últimos 14 dias** para a previsão? Proposta: sim.
4. **Nota só para lido, resenha para lido e abandonado, trechos em qualquer situação?** Proposta: sim.
5. **Trocar o formato de um livro com registros** é recusado? Proposta: sim.
