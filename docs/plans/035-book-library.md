# 035 — Biblioteca de livros: cadastro, situações e lista

Status: **proposto**, aguardando aprovação
Branch: `feat/book-library`

Primeiro dos três planos da biblioteca, alinhada com o dono do projeto em 2026-11-24 (todas as propostas da discussão aceitas):

1. **035 (este):** cadastro, situações e lista com filtros.
2. Progresso por registros de leitura, conclusão, avaliação, resenha e trechos.
3. Meta anual e analíticos de leitura.

Depois dos três, e fora deles: ligação com rotinas e com ações de PDI, e importação de um histórico. Capa e busca por ISBN ficam de fora (pediriam um serviço externo).

## Objetivo

Controlar os livros que estou **lendo**, que **preciso ler** e que **quero ler**, guardando também os **lidos** e os **abandonados**, numa aba **Leituras** em Desenvolvimento.

## Como fica

### Situação e motivo (pontos 1 e 2 da discussão)

- **Situação** (`status`): `TO_READ` (na fila), `READING` (lendo), `READ` (lido) e `ABANDONED` (abandonado).
- **Motivo** (`reason`), o "por quê" do livro: `PERSONAL` (vontade própria), `RECOMMENDATION` (indicação), `WORK` (trabalho) e `PDI`.
- **"Preciso ler"** não é uma situação à parte: é um livro na fila com motivo **Trabalho** ou **PDI** (`isRequired`, regra pura). "Quero ler" é a fila com motivo **Vontade própria** ou **Indicação**. Assim, o livro não perde o motivo quando passa a "Lendo" ou "Lido".
- **Prazo** (`dueDate`, opcional): só para livros obrigatórios. O service recusa prazo em livro de vontade própria ou indicação.

### Dados do livro

| Campo            | Regra                                                                  |
| ---------------- | ---------------------------------------------------------------------- |
| Título           | obrigatório, até 200 caracteres                                        |
| Autor(es)        | obrigatório, até 200 caracteres, em texto livre ("Fulano e Beltrano")  |
| Formato          | Físico, E-book ou Audiolivro (`PHYSICAL`, `EBOOK`, `AUDIOBOOK`)        |
| Páginas          | opcional, de 1 a 10.000 (o plano 2 usa para o progresso)               |
| Gênero           | opcional, até 60 caracteres, texto livre                               |
| Quem indicou     | opcional, até 120 caracteres                                           |
| Notas            | opcional, até 2.000 caracteres                                         |
| Objetivo         | opcional (`goalId`), como trilhas, ações e rotinas                     |
| Início e término | datas opcionais (`startedOn`, `finishedOn`), preenchidas pela situação |

Sem cadastro manual de capa nem ISBN.

### Mudar a situação

- Botões na página do livro, conforme a situação atual: **"Começar a ler"** (fila → lendo), **"Marcar como lido"** e **"Abandonar"** (lendo → lido ou abandonado), **"Voltar para a fila"** (lendo ou abandonado → fila) e **"Ler de novo"** (lido → lendo).
- Começar preenche `startedOn` com hoje (se vazio); lido e abandonado preenchem `finishedOn` com hoje; voltar para a fila limpa os dois; ler de novo troca `startedOn` por hoje e limpa `finishedOn`.
- O formulário de edição deixa corrigir as duas datas (término não pode ser antes do início, nem as duas no futuro).
- Livro lido ou abandonado **não** é somente leitura: dá para editar e excluir.

### Lista (`/books`)

- Aba **Leituras** nas `DevelopmentTabs` (Trilhas | PDI | Leituras); o item Desenvolvimento do menu passa a marcar também `/books`.
- Filtro na URL (`?situacao=`), como nas trilhas:
  - **Na estante** (padrão): lendo, preciso ler e quero ler, nessa ordem de grupos;
  - **Lendo**, **Preciso ler**, **Quero ler**, **Lidos**, **Abandonados** e **Todos**.
- Ordem dentro de cada grupo: lendo pelo início mais recente; preciso ler pelo prazo (sem prazo por último); quero ler pelo cadastro mais recente; lidos e abandonados pelo término mais recente.
- Cada item mostra título (link), autor(es), formato, motivo e, quando houver, prazo (vermelho se atrasado) ou datas de início e término.
- Lista vazia: no padrão, "Nenhum livro na estante." com "Cadastrar livro"; nos filtros, uma mensagem própria ("Nenhum livro abandonado.").

### Páginas

- `/books/new`, `/books/[id]` e `/books/[id]/edit`, com `loading.tsx`, `error.tsx` e `not-found.tsx`.
- Formulário com `useSchemaForm` e o mesmo schema Zod no cliente e no servidor; o campo de prazo só aparece com motivo Trabalho ou PDI.
- Exclusão com `ConfirmDeleteButton`.

### Ligações neste plano (ponto 6)

- **Objetivo:** o livro pode ter um objetivo vinculado. A página do objetivo lista os livros dele, e o progresso do objetivo passa a contá-los: **lido** conta como concluído e **abandonado** fica fora da conta, como a ação de PDI cancelada.
- **Busca única:** um grupo **Livros**, procurando no título e no(s) autor(es), com selo para lido e abandonado.
- **Prazos:** livro obrigatório na fila ou lendo, com prazo, entra nos Prazos do painel e na tela `/deadlines` (tipo novo "Livro", filtro `?tipo=BOOK`).
- **Painel:** nenhum bloco novo neste plano. Livros entram no painel pelos Prazos e, no plano 3, pela meta anual.

## Fora de escopo

- Registros de leitura, página atual, previsão de término, avaliação, resenha e trechos (plano 2).
- Meta anual e analíticos (plano 3).
- Ligação com rotinas ("li tal livro na rotina") e com ações de PDI (livro como evidência).
- Importação de histórico (Goodreads, Skoob, planilha ou `.md`).
- Capa, busca por ISBN e qualquer serviço externo.
- Etiquetas em tabela própria (o gênero é texto livre).
- Bloco de leituras no painel.

## Mudanças no modelo de dados

Migration nova:

```prisma
enum BookStatus {
  TO_READ
  READING
  READ
  ABANDONED
  @@map("book_status")
}

enum BookReason {
  PERSONAL
  RECOMMENDATION
  WORK
  PDI
  @@map("book_reason")
}

enum BookFormat {
  PHYSICAL
  EBOOK
  AUDIOBOOK
  @@map("book_format")
}

model Book {
  id            String     @id @default(uuid(7)) @db.Uuid
  title         String
  authors       String
  format        BookFormat @default(PHYSICAL)
  pages         Int?
  genre         String?
  recommendedBy String?    @map("recommended_by")
  notes         String?
  status        BookStatus @default(TO_READ)
  reason        BookReason @default(PERSONAL)
  dueDate       DateTime?  @map("due_date") @db.Date
  startedOn     DateTime?  @map("started_on") @db.Date
  finishedOn    DateTime?  @map("finished_on") @db.Date
  goalId        String?    @map("goal_id") @db.Uuid
  goal          Goal?      @relation(fields: [goalId], references: [id], onDelete: SetNull)
  createdAt     DateTime   @default(now()) @map("created_at")
  updatedAt     DateTime   @updatedAt @map("updated_at")

  @@index([status])
  @@map("books")
}
```

`Goal` ganha `books Book[]`. Excluir um objetivo desvincula os livros, como as trilhas.

## Organização do código

- **`src/modules/books/`**: `schemas.ts` (formulário e filtro), `rules.ts` (puro: `isRequired`, transições de situação e datas, grupos e ordem da lista), `service.ts` (CRUD, mudar situação, listar com filtro, abertos com prazo), `actions.ts`, `labels.ts`.
- **`src/app/(app)/books/`**: lista, novo, página do livro e edição.
- **`src/components/books/`**: formulário, item da lista, botões de situação, filtro.
- **Ajustes:** `DevelopmentTabs` e `MainNav` (aba e prefixo), `goals/service.ts` (livros na página e no progresso do objetivo), `search/service.ts` (grupo Livros), `dashboard/service.ts` e `rules.ts` (prazo de livro, `DeadlineKind` "BOOK"), `dashboard/labels.ts` e `schemas.ts` (rótulo e filtro do tipo).
- **Suporte:** `e2e/factories.ts` (`insertBook`), `src/test/e2e-factories.int.test.ts`, `src/demo/seed-demo.ts` (alguns livros nas cinco situações), `truncateStatement` já cobre tabelas novas.

## Arquivos afetados

```
prisma/schema.prisma, prisma/migrations/<nova>/
src/modules/books/* (+ testes), src/app/(app)/books/**, src/components/books/*
src/components/development-tabs.tsx, src/components/main-nav.tsx
src/modules/{goals,search,dashboard}/* (+ testes), src/app/(app)/goals/[id]/page.tsx
src/demo/seed-demo.ts, e2e/factories.ts, src/test/e2e-factories.int.test.ts
e2e/books.spec.ts (novo), e2e/mobile.spec.ts (PAGES), e2e/search.spec.ts, e2e/deadlines.spec.ts
CLAUDE.md (modelo, regras, menu, reaproveitamento; a biblioteca sai das Pendências, ficando os planos 2 e 3)
```

## Testes (escritos antes do código, em TDD)

### Unidade

- `isRequired`: trabalho e PDI são obrigatórios; vontade própria e indicação não.
- Transições: quais botões cada situação oferece e as datas que cada uma preenche ou limpa (começar com início já preenchido mantém a data; ler de novo troca).
- Grupos e ordem da lista em cada filtro (prazo vazio por último, desempate pelo título).
- Schema: campos obrigatórios e limites, prazo recusado sem motivo obrigatório, término antes do início, datas no futuro.
- Rótulos de situação, motivo e formato.

### Integração

- Criar, editar e excluir livro; objetivo excluído desvincula.
- Mudar situação grava as datas certas; transição inválida é recusada.
- Lista por filtro, com a ordem de cada grupo.
- Progresso do objetivo com livros (lido conta, abandonado fica fora).
- Busca acha livro pelo título e pelo autor, sem acento e sem diferenciar maiúsculas.
- Prazos: livro obrigatório com prazo na fila ou lendo entra; lido, abandonado e livro sem prazo, não.
- Factory do e2e em dia com o schema; seed de demonstração com livros.

### E2E (`books.spec.ts`, dados pelas factories)

1. Cadastrar um livro pela tela (o campo de prazo aparece só com Trabalho ou PDI) e vê-lo em "Quero ler".
2. Começar a ler, marcar como lido e ver o livro mudar de grupo, com as datas.
3. Os filtros mostram cada situação e as mensagens de lista vazia.
4. Editar e excluir com confirmação.
5. A aba Leituras e o menu Desenvolvimento marcado em `/books`; axe na lista e na página do livro, claro e escuro.

Também rodam `search.spec.ts`, `deadlines.spec.ts` e `mobile.spec.ts` (com `/books` em `PAGES`).

## Critério de pronto

- `npm run lint`, `npm run typecheck`, `npm test` e os e2e da área passando, com a migration incluída e `npx prisma generate` rodado.
- `npm run container:up` e `npm run container:check` passando (plano 025).
- `CLAUDE.md` e este plano atualizados.

## Perguntas (cada uma com uma proposta)

1. **Livros no progresso do objetivo?** Proposta: sim, lido conta como concluído e abandonado fica fora, como ação cancelada.
2. **Prazo de livro nos Prazos do painel e em `/deadlines` já neste plano?** Proposta: sim, é pouco código e é o que dá sentido ao "preciso ler" com prazo.
3. **Filtro padrão "Na estante" (lendo, preciso e quero ler)?** Proposta: sim, como "Ativas" nas trilhas; lidos e abandonados ficam nos filtros próprios.
4. **Gênero em texto livre?** Proposta: sim; etiquetas em tabela própria só se os analíticos (plano 3) pedirem.
