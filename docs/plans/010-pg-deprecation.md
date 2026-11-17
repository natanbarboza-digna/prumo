# 010 — Aviso de depreciação do `pg`

Status: **aguardando aprovação**
Branch: `fix/pg-deprecation`

## Objetivo

Acabar com o aviso que aparece nos testes de integração e nos e2e:

> DeprecationWarning: Calling client.query() when the client is already executing a query is deprecated and will be removed in pg@9.0.

E garantir que o app continue funcionando quando o `pg` 9 chegar, já que nessa versão o aviso vira erro.

## Diagnóstico

- **De onde vem.** Rodei os testes com `--trace-deprecation`. A pilha termina em `PgTransaction.performIO` do `@prisma/adapter-pg` 7.10.1, chamando `Client.query` do `pg` 8.23.1. Ou seja: dentro de uma transação, o Prisma manda uma consulta nova para a mesma conexão antes de a anterior terminar.
- **Não é o nosso código.** As quatro transações explícitas do projeto (`updateAction` no PDI; criar, mover e excluir etapa nas trilhas) fazem uma consulta de cada vez, com `await`. Os testes de rotinas, que não usam `$transaction`, também mostram o aviso. Quem dispara consultas em paralelo é o próprio Prisma: o interpretador de consultas dele busca relações (`include`) ao mesmo tempo, inclusive nas transações implícitas que abre sozinho em operações como `upsert` e `update` com `include`.
- **Por que hoje funciona.** O `pg` 8 ainda enfileira a segunda consulta e só avisa. No `pg` 9 essa fila sai e a segunda consulta passa a falhar.
- **Sem correção pronta.** O Prisma 7.10.1 é a versão estável mais nova (o Prisma 8 ainda está em desenvolvimento), e o `pg` 8.23.1 também é a mais nova; o `pg` 9 não saiu. Não achei um issue aberto no repositório do Prisma com essa mensagem.
- **Onde aparece:** testes de PDI, rotinas, painel e demonstração. Uma vez por processo, porque o Node só mostra cada aviso de depreciação uma vez.

## Opções

1. **Fila de consultas por conexão (proposta).** Uma subclasse pequena do `Client` do `pg` (`SerialClient`, em `src/lib/db.ts`) que espera a consulta anterior terminar antes de enviar a próxima: é a mesma fila que o `pg` 8 faz hoje por dentro, só que do nosso lado, sem o aviso e sem depender dela no `pg` 9. O `PrismaPg` recebe um `Pool` do `pg` configurado com essa classe (a opção `Client` do `Pool` existe para isso).
   - O desempenho não muda: o Postgres já executa uma consulta por vez em cada conexão; hoje a fila existe, só fica dentro do `pg`.
   - Só a forma usada pelo Prisma (promessa, com objeto de configuração) passa pela fila; chamadas com callback ou objetos "submittable" (cursores, streams) vão direto para o `pg`, como hoje. O projeto não usa nenhuma das duas.
   - Quando o Prisma corrigir o problema, a classe pode sair sem mudar mais nada.
2. **Só conter.** Deixar como está, com o `pg` fixado em `8.23.1` (já está exato no `package.json`), e esperar a correção do Prisma. O aviso continua aparecendo.
3. **Esconder o aviso** (`--no-deprecation` ou filtro de `process.on("warning")`). Descartada: tira o sintoma e esconde avisos futuros que importam.

## Escopo (opção 1)

- `src/lib/db.ts`: classe `SerialClient` e criação do `PrismaPg` a partir de um `Pool` que a usa. Comentário explicando o motivo e quando remover.
- `prisma/seed.ts`, `prisma/seed-demo.ts` e o cliente dos testes usam o mesmo `db`, então ficam cobertos sem mudança.
- **Pendências do `CLAUDE.md`:** o item do aviso sai. Entra uma linha na seção "Versões fixadas": "ao atualizar o Prisma, testar sem o `SerialClient` (`src/lib/db.ts`); se o aviso não voltar, remover a classe".

## Fora de escopo

- Atualizar o Prisma ou o `pg` (não há versão nova).
- Abrir issue no repositório do Prisma (posso redigir o texto se você quiser abrir).
- Mexer nas consultas do projeto: elas já são sequenciais.

## Mudanças no modelo de dados

Nenhuma.

## Arquivos afetados

```
src/lib/db.ts
src/lib/db.int.test.ts        (testes novos)
CLAUDE.md
```

## Testes (escritos antes do código, em TDD)

### Integração (`src/lib/db.int.test.ts`)

1. **Reproduz o aviso:** uma transação com duas consultas disparadas juntas (`Promise.all([tx.goal.count(), tx.pdiCycle.count()])`) não emite nenhum `DeprecationWarning` (capturado com `process.on("warning")`). Sem a correção, este teste falha.
2. **Ordem preservada:** duas consultas disparadas juntas no mesmo `SerialClient` terminam na ordem em que foram enviadas e devolvem os resultados certos.
3. **Erro não trava a fila:** se a primeira consulta falha (SQL inválido), a segunda, enviada logo depois, ainda roda e devolve o resultado.
4. **Transação continua atômica:** um erro no meio de uma transação com consultas em paralelo desfaz tudo (nenhuma linha gravada).

### Conferência geral

- `npm test` e `npm run test:e2e` inteiros sem nenhuma linha "DeprecationWarning" na saída.

## Critério de pronto

- `npm run lint`, `npm run typecheck`, `npm test` e `npm run test:e2e` passando, sem o aviso.
- `CLAUDE.md` e este plano atualizados.

## Perguntas

1. **Opção.** Proposta: a 1, fila de consultas por conexão. A alternativa é a 2, só conter e esperar o Prisma.
