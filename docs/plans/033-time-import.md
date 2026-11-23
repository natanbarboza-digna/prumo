# 033 — Gestão de tempo: importação do histórico do `.md`

Status: **implementado em 2026-11-24**, aprovado com as propostas das perguntas (ver "Decisões")
Branch: `feat/time-import`

Último dos três planos da gestão de tempo (registro do dia no 031, analíticos no 032).

## Objetivo

Trazer para o Prumo o histórico que hoje está no `.md`, no formato:

```
**16/11**
08:15 - cheguei
08:30 - olhei a caixa de e-mail, chamados
09:00 - atendi ao chamado de pasta segura
…
12:30 - almoço
13:30 - resolvendo usuário da máxima (caruaru), removendo processo do Protheus
…
18:30 - fim do expediente
```

Depois de importados, os dias aparecem na tela Tempo e nos analíticos como se tivessem sido registrados lá.

## Como fica

### Onde e como

- Página **`/time/import`** ("Importar histórico"), com link na tela Tempo.
- O texto é **colado** num campo (pergunta 6), com: o **ano** das datas (padrão: o ano atual), a **duração dos blocos** (15, 30 ou 60; padrão 30), a **categoria padrão** e, opcionais, as **regras por palavra** (abaixo).
- **"Conferir"** mostra a prévia; **"Confirmar importação"** grava. Como na importação do PDI (planos 013 e 022): o navegador guarda o que foi enviado e reenvia na confirmação, que valida tudo de novo; **tudo ou nada**, e qualquer problema lista a linha e o motivo, sem gravar nada.

### Como o texto é lido

- **Dia:** uma linha só com a data, `**16/11**` ou `16/11` (dia e mês, com ou sem negrito). Linhas em branco são ignoradas.
- **Registro:** `HH:MM - texto` (aceita também `HH:MM – texto` e `HH:MM: texto`). O horário é o **início**; o registro vai até o horário da linha seguinte do mesmo dia.
- **Marcos** (pergunta 1), reconhecidos sem diferenciar maiúsculas nem acentos:
  - **entrada:** a primeira linha do dia, se o texto for "cheguei", "chegada", "entrada" ou "início". Vira a hora de entrada e não gera registro (o trecho até a próxima linha fica vazio, como no `.md`). Se a primeira linha for outra coisa, a entrada é o horário dela e ela vira registro.
  - **saída:** a última linha do dia, se o texto começar por "fim do expediente", "fim", "saída" ou "saindo". Vira a hora de saída. Sem essa linha, a saída é o horário da última linha mais um bloco.
  - **pausa:** "almoço", "pausa", "intervalo" ou "café" (o texto inteiro, ou começando por uma dessas palavras). Vira um bloco de pausa, com o texto como nota.
- **Duração maior que um bloco** (por exemplo, o almoço de 12:30 a 13:30 com blocos de 30): vira um registro por bloco, com o mesmo texto.
- **Horários na grade** (pergunta 4): cada trecho, depois de cortado nos blocos, precisa ser um bloco inteiro ou meio bloco (como no plano 031). Com blocos de 30, `14:00` e `14:15` funcionam (duas metades); `10:10` não, e a linha aparece como problema. A entrada e a saída podem ficar fora da grade (o primeiro e o último bloco ficam curtos, como na tela).

### Categoria e projeto de cada registro (perguntas 2 e 3)

O registro de trabalho exige categoria (plano 031), então "entrar vazio" não é possível sem mudar o modelo. Proposta:

- **Categoria padrão** (obrigatória no formulário): a que cada registro recebe quando nenhuma regra serve.
- **Regras por palavra**, uma por linha, no formato `palavra = Nome`:
  - num campo de **categorias**: `chamado = Chamados`, `atend = Atendimento`, `configuração = Projeto`, `reunião = Reunião`;
  - num campo de **projetos**: `digna = Digna`, `máxima = Máxima`, `bluepex = Bluepex`.
  - Valem quando o texto do registro **contém** a palavra (sem diferenciar maiúsculas nem acentos); **a primeira regra que serve vence**. A categoria precisa existir e estar ativa; o projeto é criado se for novo (como no bloco).
- A prévia mostra a categoria e o projeto de cada registro, para conferir antes de gravar. Depois, qualquer bloco pode ser corrigido na tela do dia.
- O navegador guarda as regras digitadas (no próprio aparelho), para não precisar digitá-las de novo na próxima importação.

### Prévia

- Um resumo: "Serão criados 12 dias e 210 registros (185 de trabalho e 25 pausas)."
- Por dia: data, entrada e saída, e os registros com horário, texto, categoria e projeto (ou "Pausa").
- Os projetos novos que serão criados.

### O que é recusado (tudo ou nada)

- Linha que não é data nem registro (exceto em branco), registro antes da primeira data.
- Data inválida (31/02), dia no futuro, **dia que já tem registro no Prumo** (pergunta 5), a mesma data duas vezes no texto.
- Horários fora de ordem ou repetidos no mesmo dia, ou fora da grade.
- Texto com mais de 300 caracteres; categoria de uma regra que não existe ou está arquivada; projeto arquivado.
- Texto colado com mais de 200 KB.

## Fora de escopo

- Enviar o `.md` como arquivo (colar resolve; o arquivo é texto).
- Atualizar ou mesclar com um dia já registrado.
- Exportar os dias de volta para `.md`.
- Regras guardadas no servidor ou aprendidas dos registros.

## Mudanças no modelo de dados

Nenhuma. A importação grava `TimeDay` e `TimeEntry` como a tela.

## Organização do código

- **`src/modules/time/import/parse.ts`** (puro): lê o texto em dias e linhas, reconhece os marcos, corta os trechos nos blocos (com `daySlots` e `fitsSlot` do plano 031) e aplica as regras. Devolve a prévia ou a lista de problemas (linha e motivo).
- **`src/modules/time/import/rules.ts`** (puro): lê as regras `palavra = Nome` e escolhe a primeira que serve, com a normalização dos analíticos (`normalizeActivity`).
- **`src/modules/time/import/service.ts`:** confere no banco (dias já registrados, categorias ativas, projetos arquivados) e grava tudo numa transação.
- **`src/modules/time/import/actions.ts`:** prévia e confirmação, como a importação do PDI.
- **Telas:** `src/app/(app)/time/import/page.tsx` com `loading.tsx`; o formulário com a prévia em `src/components/time/import/` (Client Component, como o do PDI).

## Arquivos afetados

```
src/modules/time/import/{parse,rules,service,actions}.ts (+ testes)
src/app/(app)/time/import/{page,loading}.tsx, src/app/(app)/time/page.tsx (link)
src/components/time/import/*.tsx
e2e/time-import.spec.ts (novo), e2e/mobile.spec.ts (página nova em PAGES)
CLAUDE.md (regra; tirar a gestão de tempo das Pendências)
```

## Testes (escritos antes do código, em TDD)

### Unidade

- **Leitura:** o exemplo de 16/11 inteiro vira um dia de 08:15 a 18:30, com o bloco 08:15–08:30 vazio, o almoço como pausa de 12:30 a 13:30 (dois blocos) e os demais registros; datas com e sem negrito; `–` e `:` como separador.
- **Marcos:** primeira linha que não é chegada vira registro; dia sem "fim do expediente" termina um bloco depois da última linha.
- **Grade:** trechos de um bloco, de vários blocos e de meio bloco; horário fora da grade é problema.
- **Problemas:** linha estranha, registro antes da data, data inválida, data repetida, horário fora de ordem, texto longo; cada um com o número da linha.
- **Regras:** leitura do formato, linha mal escrita, primeira regra vence, sem diferenciar maiúsculas e acentos, categoria padrão quando nada serve.

### Integração

- Grava os dias e registros numa transação; recusa dia já registrado, categoria arquivada ou inexistente nas regras e projeto arquivado, sem gravar nada; cria os projetos novos uma vez só.

### E2E (`time-import.spec.ts`)

1. O link "Importar histórico" abre a página; colar o exemplo de 16/11 com regras mostra a prévia (resumo, almoço como pausa, categorias e projetos certos); confirmar grava, e a tela do dia 16/11 mostra os blocos.
2. Um texto com problema lista a linha e o motivo e não grava nada.
3. A página passa no axe e entra no `mobile.spec.ts`.

Rodam o `time-import.spec.ts`, o `time.spec.ts` e o `mobile.spec.ts`.

## Critério de pronto

- `npm run lint`, `npm run typecheck`, `npm test` e os e2e da área passando.
- `npm run container:up` e `npm run container:check` passando (plano 025).
- `CLAUDE.md` (regra; a gestão de tempo sai das Pendências, ficando registrado o que foi para depois) e este plano atualizados.

## Mudanças durante a implementação

- **Linha de cada regra:** `parseRules` devolve a linha de cada regra (`WordRule.line`), para as mensagens sobre categoria inexistente ou arquivada apontarem a linha certa mesmo com linhas em branco ou mal escritas no meio.
- **Nomes das regras** são comparados com os cadastrados sem diferenciar maiúsculas nem acentos e trocados pela grafia cadastrada (`projeto = …` vale para a categoria "Projeto").
- **Categoria padrão inválida** (vazia, inexistente ou arquivada) para a conferência na hora, sem ler o texto.
- **Texto sem nenhum dia** é recusado ("Nenhum dia encontrado no texto.").
- **Campos de regras não controlados:** o valor salvo no navegador é posto direto no campo por uma ref no carregamento; um `setState` dentro do efeito é recusado pela regra `react-hooks/set-state-in-effect` do lint.
- **Depois de confirmar**, a tela vai para o último dia importado (`/time?dia=…`).
- **Verificações:**
  - `npm run lint`, `npm run typecheck`, Prettier e `npm test` (605 testes);
  - e2e: `time-import.spec.ts` (2), `time.spec.ts` (5) e `mobile.spec.ts` (6);
  - `npm run container:up` (11 migrations, nenhuma pendente) e `npm run container:check` passando.

## Decisões

1. Marcos: entrada, saída e pausa com as palavras propostas.
2. Categoria padrão no formulário mais regras por palavra (o trabalho exige categoria).
3. Regras de projeto no mesmo formato, opcionais.
4. Horário fora da grade recusa a linha.
5. Dia já registrado recusa a importação inteira.
6. O texto é colado.

## Perguntas (cada uma com uma proposta)

1. **Marcos:** entrada ("cheguei", "chegada", "entrada", "início" na primeira linha), saída ("fim do expediente", "fim", "saída", "saindo" na última) e pausa ("almoço", "pausa", "intervalo", "café")? Proposta: sim, com essas palavras.
2. **Categoria dos registros importados:** como o trabalho exige categoria, proposta: uma categoria padrão escolhida no formulário mais regras por palavra, em vez de "entrar vazio" (que pediria mudar o modelo).
3. **Regras de projeto também?** Proposta: sim, no mesmo formato, opcionais.
4. **Horários fora da grade:** recusar a linha (proposta) ou arredondar para o bloco mais próximo?
5. **Dia já registrado no Prumo:** recusar a importação inteira, listando os dias (proposta), ou pular esses dias?
6. **Colar o texto** em vez de enviar o arquivo? Proposta: colar.
