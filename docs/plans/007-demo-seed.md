# 007 — Dados de demonstração

Status: **implementado em 2026-11-16**, aprovado no mesmo dia com as propostas das perguntas (ver "Decisões")
Branch: `chore/demo-seed`

## Objetivo

Um comando que enche o banco de desenvolvimento com dados realistas e coerentes entre si, para abrir o app e ver todas as telas funcionando: painel com atrasados e próximos prazos, tela Hoje com rotinas, adesão com histórico, PDI ativo com evidência de rotina, ciclo encerrado e objetivos com progresso agregado.

## Escopo

### Comando

- **`npm run db:seed:demo`** roda `tsx prisma/seed-demo.ts` contra o banco do `.env`.
- **O `npx prisma db seed` continua igual** (só as categorias padrão; pergunta 1). Assim o seed inicial nunca mistura dados de exemplo com dados reais.
- **Segurança:**
  - Recusa rodar se o banco já tiver qualquer objetivo, trilha, rotina ou ciclo, com a mensagem "O banco já tem dados. Use --reset para apagar tudo e recriar a demonstração."
  - **`--reset`** (pergunta 2) apaga todos os dados (todas as tabelas, menos o histórico de migrations), recria as categorias padrão e depois a demonstração. Só roda com a flag explícita.
  - Recusa um banco cujo nome termina em `_test`: os testes limpam esse banco a cada execução, então a demonstração sumiria.
- **Datas relativas a hoje** (`todayInAppTimeZone`), para os dados nunca "envelhecerem": um atraso é sempre de alguns dias atrás, um prazo próximo é sempre daqui a alguns dias.
- **Os dados passam pelos services** (`createGoal`, `createRoutine`, `logRoutine`, `createAction`…), não por SQL nem pelo Prisma direto. Assim as regras de negócio valem também para a demonstração, e o seed serve de teste de fumaça do sistema. Duas exceções, porque os services não permitem de propósito: o ciclo encerrado é criado ativo e depois fechado com `closeCycle`, e os registros antigos de rotina usam o `today` real como referência (o service só recusa datas futuras).
- **Sem aleatoriedade:** quais dias da rotina foram feitos, pulados ou ficaram sem registro segue um padrão fixo, para o resultado ser o mesmo a cada execução.

### Conteúdo (em pt-BR; datas em dias a partir de hoje, `H`)

**Objetivos**

- "Conduzir reuniões em inglês": em andamento, data-alvo `H+12`.
- "Migrar o projeto pessoal para Next.js": em andamento, sem data-alvo.
- "Tirar a certificação AWS": não iniciado, data-alvo `H+90`.
- "Organizar a rotina de estudos": concluído.

**Trilhas**

- "Inglês para reuniões" (objetivo: reuniões em inglês), 5 etapas: 2 concluídas, 1 em andamento com prazo `H+5`, 1 atrasada (prazo `H−3`), 1 sem prazo.
- "Next.js App Router" (objetivo: migrar para Next.js), 4 etapas: 1 concluída, 1 em andamento com prazo `H+10`, 2 não iniciadas, uma delas com link de recurso.
- "Fundamentos de AWS" (sem objetivo), 3 etapas não iniciadas: trilha "não iniciada", para conferir que não aparece em "Trilhas em andamento".

**Rotinas**

- "Ler 20 minutos": todos os dias, 07:00, desde `H−40`, objetivo "Organizar a rotina de estudos". Registros nos últimos 40 dias com cerca de 80% feitos, alguns pulados com nota, alguns sem registro; hoje ainda sem registro.
- "Exercício": segunda, quarta e sexta, 18:30, desde `H−30`, cerca de 60% feitos.
- "Flashcards de inglês": seg a sex, desde `H−20`, objetivo "Conduzir reuniões em inglês".
- "Meditação": todos os dias, de `H−60` a `H−31` (encerrada), para a lista de rotinas encerradas e o histórico.

**PDI**

- **Ciclo encerrado** "PDI 2025/2": de `H−240` a `H−61`, gestor "Mariana Souza", com objetivo de carreira, autoavaliação, feedback do gestor e nota final "Atende plenamente". Uma área, 2 ações concluídas e 1 cancelada, 1 check-in.
- **Ciclo ativo** "PDI 2026/1": de `H−60` a `H+120`, mesmo gestor, objetivo de carreira preenchido.
  - Área "Comunicação":
    - "Praticar apresentações em inglês" (Prática, em andamento, prazo `H+45`, objetivo reuniões em inglês) com **rotina criada a partir da ação** ("Ensaiar apresentação", ter e qui, desde `H−30`) e registros: aparece como evidência com adesão.
    - "Curso de comunicação assertiva" (Curso, atrasada: prazo `H−2`).
  - Área "Liderança técnica":
    - "Mentoria com tech lead" (Mentoria, em andamento, prazo `H+7`).
    - "Ler 'O Programador Pragmático'" (Leitura, concluída, com evidência em texto e comentário do gestor).
  - 2 check-ins: `H−45` e `H−15`.
- **Ciclo planejado** "PDI 2026/2": de `H+121` a `H+300`, sem áreas.

Com isso, o painel mostra: rotinas de hoje (conforme o dia da semana), 2 atrasados (etapa e ação), próximos prazos (etapa, ação e objetivo), PDI ativo com ação atrasada, adesão das rotinas vinculadas e último check-in, 2 objetivos e 2 trilhas em andamento.

### Saída

Ao terminar, o comando imprime um resumo: quantos objetivos, trilhas, etapas, rotinas, registros, ciclos e ações criou.

## Fora de escopo

- Dados aleatórios ou volume grande (teste de desempenho).
- Usar a demonstração nos testes e2e (eles continuam montando os dados pela interface).
- Um botão na interface para gerar ou apagar a demonstração.

## Mudanças no modelo de dados

Nenhuma.

## Organização do código

- **`src/demo/seed-demo.ts`**: `seedDemo(today)` com toda a criação de dados, chamando os services, e `assertCanSeed()`/`resetAllData()` para as verificações de segurança. Fica em `src/` para o Vitest testar contra o banco de teste (o Vitest só procura testes em `src/`).
- **`prisma/seed-demo.ts`**: só a linha de comando. Lê `--reset`, recusa bancos `_test`, chama as funções acima com o `today` real e imprime o resumo.
- **`package.json`**: script `db:seed:demo`.
- Se `resetAllData` precisar do mesmo `TRUNCATE` que `src/test/test-database.ts` já faz, o trecho é extraído para uma função comum em vez de copiado.

## Arquivos afetados

```
src/demo/seed-demo.ts            (novo)
src/demo/seed-demo.int.test.ts   (novo)
prisma/seed-demo.ts              (novo)
package.json                     (script db:seed:demo)
src/test/test-database.ts        (só se o TRUNCATE for extraído)
CLAUDE.md                        (comando na tabela e src/demo na estrutura de pastas)
```

## Testes (escritos antes do código, em TDD)

### Integração (`src/demo/seed-demo.int.test.ts`, banco de teste)

1. Num banco só com as categorias, `seedDemo` cria as quantidades esperadas de objetivos, trilhas, etapas, rotinas, ciclos, áreas, ações e check-ins.
2. `getDashboard(today)` depois do seed: não é primeiro uso; tem 2 atrasados (uma etapa e uma ação); tem objetivo, etapa e ação nos próximos 14 dias; o PDI ativo tem 1 ação atrasada, adesão das rotinas vinculadas e último check-in em `H−15`; 2 objetivos e 2 trilhas em andamento.
3. A ação "Praticar apresentações em inglês" tem a rotina vinculada e registros como evidência (`getActionDetail`).
4. O ciclo "PDI 2025/2" está encerrado; há exatamente um ciclo ativo e um planejado.
5. Rodar duas vezes com datas diferentes (`today` de uma segunda e de um domingo) funciona, sem depender do dia da semana.
6. `assertCanSeed` recusa quando já há dados e aceita um banco só com categorias.
7. `resetAllData` apaga tudo e deixa as categorias padrão, permitindo rodar o seed de novo.

A recusa de banco `_test` fica na linha de comando e é conferida à mão (rodar `npm run db:seed:demo` com o `.env.test`).

## Critério de pronto

- `npm run lint`, `npm run typecheck` e `npm test` passando.
- `npm run db:seed:demo` rodado no banco de desenvolvimento e o app conferido no navegador (painel, Hoje, uma ação de PDI com evidência).
- `CLAUDE.md` e este plano atualizados.

## Mudanças durante a implementação

- **Data-alvo do objetivo de inglês** passou de `H+20` para `H+12`, para cair nos "Próximos 14 dias" do painel, como o plano prometia.
- **Entradas validadas pelos schemas Zod** antes de chegar aos services (`goalInputSchema.parse(...)` etc.), como acontece nos formulários. Os services recebem dados já validados, então sem isso a demonstração pularia essa camada.
- **O `TRUNCATE` foi extraído** para `src/lib/truncate.ts` (`APP_TABLES_QUERY` e `truncateStatement`), usado por `src/test/test-database.ts` e pelo `--reset`.
- **A recusa do banco `_test`** foi conferida à mão: o comando imprime a mensagem e sai com código 1, sem tocar no banco.
- **Registros de rotina** vão até ontem; hoje fica sem registro para ser marcado na tela Hoje ou no painel. Na primeira execução foram 89 registros.
- **Ciclo encerrado:** os textos de autoavaliação, feedback e nota final são preenchidos já na criação, antes de fechar o ciclo.

## Decisões

1. Comando separado, `npm run db:seed:demo`; o `npx prisma db seed` continua só com as categorias.
2. Sem `--reset`, o comando recusa banco com dados; com `--reset`, apaga tudo e recria.
3. O conteúdo e os temas propostos foram aceitos.
