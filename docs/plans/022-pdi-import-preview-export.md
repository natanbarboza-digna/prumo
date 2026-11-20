# 022 — Prévia da importação e exportação do ciclo para planilha

Status: **proposto**, aguardando aprovação
Branch: `feat/pdi-import-preview-export`

Último plano do grupo PDI (vincular rotina existente, reordenar áreas e ações, prévia e exportação). Retoma o que ficou fora do plano 013.

## Objetivo

1. **Prévia:** hoje a importação grava o ciclo assim que a planilha passa na validação. Com a prévia, o app mostra o que vai ser criado e só grava depois de "Confirmar importação".
2. **Exportação:** baixar um ciclo existente como planilha, no **mesmo formato da importação**. Serve de backup legível, para levar o PDI de volta à empresa e para começar o próximo ciclo a partir do atual (exportar, ajustar, importar).

## Dependência (precisa da sua aprovação)

O `write-excel-file` hoje é só de desenvolvimento (planilha modelo e planilhas dos testes). A exportação gera o arquivo no servidor, então ele passa de `devDependencies` para `dependencies`, na mesma versão fixada (4.1.1). Nenhuma biblioteca nova entra. O `CLAUDE.md` deixa de dizer "só em desenvolvimento".

## Prévia da importação

### Fluxo

1. Em `/pdi/import`, escolher o arquivo e clicar em **"Conferir planilha"** (antes, "Importar").
2. Com erro, nada muda em relação a hoje: a lista de aba, linha e campo.
3. Sem erro, aparece a **prévia** no lugar do formulário:
   - o ciclo: título, período, status e gestor;
   - cada área, na ordem da planilha, com as suas ações (título, categoria, prazo e status);
   - os check-ins (data e resumo);
   - um resumo: "1 ciclo, 3 áreas, 8 ações e 2 check-ins serão criados."
4. **"Confirmar importação"** grava e leva para a página do ciclo. **"Escolher outro arquivo"** volta ao formulário, sem gravar nada.

### Onde fica o arquivo entre a prévia e a confirmação (pergunta 1)

- **Proposta:** o navegador guarda o arquivo escolhido e o reenvia na confirmação. O servidor valida tudo de novo antes de gravar, então uma mudança no meio do caminho (outra aba ativou um ciclo, uma categoria foi arquivada) aparece como erro, e nada é gravado.
- Alternativa descartada: guardar a planilha ou o resultado da leitura no servidor (tabela temporária ou arquivo) entre os dois passos. Precisaria de limpeza e de vínculo com a sessão, para um ganho que não existe com arquivos de no máximo 1 MB.

### Código

- **`src/modules/pdi/import/service.ts`:** a leitura e a validação viram `previewPdiImport(file)`, que devolve os problemas ou a prévia (os mesmos dados que seriam gravados, já resolvidos: categoria pelo nome cadastrado, datas e status). `importPdi(file)` chama `previewPdiImport` e grava. Assim a prévia e a gravação nunca discordam.
- **`src/modules/pdi/import/actions.ts`:** a action recebe `intent` (`preview` ou `confirm`) junto com o arquivo. `preview` devolve a prévia; `confirm` grava e redireciona.
- **`src/components/pdi/import-form.tsx`:** guarda o arquivo escolhido e mostra a prévia (`src/components/pdi/import-preview.tsx`, novo).

## Exportação

### Onde e como

- Botão **"Baixar planilha"** na página do ciclo, em qualquer status (inclusive encerrado, que é só leitura mas pode ser exportado).
- Arquivo `pdi-<título-do-ciclo>.xlsx` (título sem acentos e espaços, por exemplo `pdi-pdi-2026-1.xlsx`).
- Mesmas abas e colunas da importação (Ciclo, Áreas, Ações, Check-ins), mais a aba Instruções. Áreas e ações na ordem manual do plano 021, que a importação preserva.

### Rota para o download (pergunta 2)

- **Proposta:** um Route Handler `GET /pdi/[id]/export`. O `CLAUDE.md` reserva Route Handlers para consumidores externos, mas um download é o caso em que o navegador precisa de uma URL que responda com um arquivo: o botão vira um link comum (`<a href download>`), sem JavaScript. Uma Server Action devolveria os bytes para o cliente montar o arquivo, o que é mais código e só funciona com JavaScript.
- A rota chama `requireSession()` como as actions (o `proxy.ts` já barra quem não tem cookie, mas não valida a sessão) e responde 404 para ciclo inexistente.
- Registro a exceção no `CLAUDE.md`: "Route Handlers só se houver consumidor externo ou download de arquivo".

### O que a planilha exportada tem, e o que fica de fora

- **Tem:** todos os campos que a importação lê, com os mesmos textos (status em pt-BR, datas dd/mm/aaaa, área e categoria pelo nome).
- **Fica de fora:** vínculo das ações com objetivos e as rotinas vinculadas (a importação não lê nenhum dos dois, plano 013).

### Ciclo encerrado (pergunta 3)

- A importação aceita só "Planejado" ou "Ativo". Exportar um ciclo encerrado escreve "Encerrado", que a importação recusa com a mensagem de status de sempre.
- **Proposta:** manter assim. Exportar e reimportar um ciclo encerrado é raro, e a correção é trocar uma célula. Aceitar "Encerrado" na importação criaria um ciclo somente leitura direto da planilha, uma regra nova para um caso que não existe hoje.

### Código

- **`src/modules/pdi/export/workbook.ts`** (novo): `buildPdiWorkbook`, que hoje está em `src/test/pdi-workbook.ts`, sai da pasta de testes e passa a ser usado pela exportação, pelo `scripts/generate-pdi-template.ts` e pelos testes.
- **`src/modules/pdi/export/service.ts`** (novo): `exportCycle(id)` busca o ciclo (`getCycle`) e o converte nas linhas da planilha: datas como data, status e categoria como texto. Devolve o arquivo e o nome.
- **`src/app/(app)/pdi/[id]/export/route.ts`** (novo): o Route Handler.

## Fora de escopo

- Exportar a lista de ciclos inteira ou a evidência das rotinas.
- Editar dados na prévia (a correção continua na planilha).
- Atualizar um ciclo existente pela planilha (a importação continua criando um ciclo novo).
- Ler o formato da planilha da empresa (continua esperando um exemplo).

## Mudanças no modelo de dados

Nenhuma.

## Arquivos afetados

```
package.json, package-lock.json (write-excel-file em dependencies)
src/modules/pdi/import/{service,actions}.ts (+ testes)
src/modules/pdi/export/{workbook,service}.ts (novos, + teste)
src/test/pdi-workbook.ts (removido; os testes importam de export/workbook.ts)
scripts/generate-pdi-template.ts
src/components/pdi/{import-form,import-preview}.tsx
src/app/(app)/pdi/import/page.tsx, src/app/(app)/pdi/[id]/page.tsx, src/app/(app)/pdi/[id]/export/route.ts
e2e/pdi-import.spec.ts
CLAUDE.md (dependência, Route Handler de download, regras de prévia e exportação)
```

## Testes (escritos antes do código, em TDD)

### Integração

- `previewPdiImport` devolve o ciclo, as áreas com as ações na ordem da planilha e os check-ins, sem gravar nada; com erro, os mesmos problemas de hoje.
- `importPdi` continua passando nos testes atuais (agora por cima de `previewPdiImport`).
- `exportCycle`:
  - gera uma planilha que `previewPdiImport` lê sem erro, com os mesmos dados do ciclo (ida e volta), inclusive a ordem manual e campos vazios;
  - ciclo encerrado sai com "Encerrado" no status;
  - nome do arquivo sem acentos e espaços;
  - ciclo inexistente lança `PdiCycleNotFoundError`.

### Unidade

- O nome do arquivo a partir do título.

### E2E (`pdi-import.spec.ts`)

1. Importar a planilha válida mostra a prévia (resumo e áreas); "Confirmar importação" cria o ciclo e abre a página dele.
2. "Escolher outro arquivo" volta ao formulário sem criar nada.
3. Na página de um ciclo, "Baixar planilha" baixa um `.xlsx`; enviado de volta em `/pdi/import`, a prévia mostra as mesmas áreas e ações.
4. A página de importação com a prévia passa no axe.

Rodam o `pdi-import.spec.ts` e o `pdi.spec.ts` (a página do ciclo ganha o botão).

## Critério de pronto

- `npm run lint`, `npm run typecheck`, `npm test` e os e2e da área passando.
- `npm audit` em 0 avisos depois de mover a dependência.
- `CLAUDE.md` e este plano atualizados.

## Perguntas (cada uma com uma proposta)

1. **Onde fica o arquivo entre a prévia e a confirmação?** Proposta: no navegador, reenviado e validado de novo na confirmação.
2. **Route Handler para o download?** Proposta: sim, `GET /pdi/[id]/export`, com a exceção registrada no `CLAUDE.md`.
3. **Ciclo encerrado exportado com "Encerrado", que a importação recusa?** Proposta: sim, sem mudar a importação.
