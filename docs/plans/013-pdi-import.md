# 013 — Importação de PDI por planilha

Status: **aguardando aprovação**
Branch: `feat/pdi-import`

## Objetivo

Cadastrar um ciclo de PDI inteiro de uma vez a partir de uma planilha `.xlsx`, em vez de digitar ciclo, áreas, ações e check-ins um por um. Como não há um arquivo de exemplo da empresa, o app oferece uma **planilha modelo**: você copia os dados do PDI da empresa para ela e importa.

## Escopo

### Planilha modelo

- Arquivo `public/templates/modelo-pdi.xlsx`, baixado pelo link "Baixar planilha modelo" na tela de importação.
- **Abas e colunas** (cabeçalhos em pt-BR, na primeira linha; os nomes batem com os rótulos dos formulários):
  - **Ciclo** (uma linha de dados): Título, Início, Fim, Status (`Planejado` ou `Ativo`), Gestor, Objetivo de carreira, Autoavaliação, Feedback do gestor, Avaliação final.
  - **Áreas** (uma linha por área): Nome, Descrição, Resultado esperado.
  - **Ações** (uma linha por ação): Área (nome igual ao da aba Áreas), Categoria (nome de uma categoria cadastrada), Título, Descrição, Resultado esperado, Prazo, Status (`Não iniciada`, `Em andamento`, `Concluída`, `Cancelada`), Evidência, Comentário do gestor.
  - **Check-ins** (uma linha por check-in, opcional): Data, Resumo, Próximos passos, Anotações do gestor.
  - **Instruções**: o que cada coluna aceita, os status válidos e as categorias padrão.
- **Datas** aceitas como data do Excel ou texto `dd/mm/aaaa`; circulam no app como `AAAA-MM-DD`, como no resto do projeto.
- **Colunas vazias** viram campo vazio (o mesmo "opcional" dos formulários). Linhas totalmente vazias são ignoradas.
- O modelo é gerado por um script (`npm run pdi:template`, com `write-excel-file`) e versionado; não precisa de Route Handler nem de geração a cada download (pergunta 3).

### Tela de importação

- Botão **"Importar planilha"** na lista de ciclos (`/pdi`), ao lado de "Novo ciclo", levando a `/pdi/import`.
- A página tem o link da planilha modelo, um campo de arquivo (`.xlsx`, até 1 MB) e o botão "Importar".
- **Tudo ou nada** (pergunta 2): a planilha inteira é validada antes de gravar qualquer coisa.
  - **Com erro:** nada é criado e a página lista cada problema com aba, linha e campo, na mesma linguagem dos formulários. Ex.: "Ações, linha 4, Categoria: “Workshop” não existe. Categorias disponíveis: Curso, Leitura, Mentoria, Prática." ou "Ações, linha 7, Área: “Lideranca” não está na aba Áreas."
  - **Sem erro:** cria ciclo, áreas, ações e check-ins de uma vez (uma única gravação aninhada do Prisma, que é atômica) e redireciona para a página do ciclo, que já mostra tudo.
- O formulário segue o padrão do projeto: `useActionState`, botão desabilitado com "Importando…" durante o envio, erros ligados ao campo por `aria-describedby`.

### Regras (no service, testadas)

- Cada linha passa pelos **mesmos schemas Zod** dos formulários (`cycleInputSchema`, `areaInputSchema`, `actionInputSchema`, `checkInInputSchema`), depois de converter datas e rótulos de status.
- **Ciclo:** exatamente uma linha na aba Ciclo. Status `Ativo` com outro ciclo ativo é recusado (mesma regra de hoje, `ActiveCycleExistsError`).
- **Áreas:** pelo menos uma; nomes repetidos na planilha são recusados (não daria para saber a qual área uma ação pertence).
- **Ações:** a área tem que existir na aba Áreas (comparação sem diferenciar maiúsculas e espaços nas pontas); a categoria tem que existir e **não estar arquivada** (mesma regra dos formulários). Nenhum comportamento depende do nome da categoria: o nome só identifica qual é.
- **Abas obrigatórias:** Ciclo, Áreas e Ações. Check-ins é opcional. Arquivo que não é `.xlsx`, sem essas abas ou com cabeçalhos diferentes do modelo é recusado com uma mensagem dizendo para baixar o modelo.

## Fora de escopo

- Ler o formato próprio da planilha da empresa (não há exemplo; fica para quando houver um).
- Vincular ações a objetivos pela planilha (o vínculo continua sendo feito pela tela).
- Atualizar um ciclo existente pela planilha (a importação sempre cria um ciclo novo).
- Prévia antes de confirmar (pergunta 2) e exportar um ciclo para planilha.
- Criar rotinas a partir das ações importadas (continua pelo botão "Criar rotina" da ação).

## Mudanças no modelo de dados

Nenhuma. A importação cria registros nas tabelas que já existem.

## Dependências novas (pergunta 1)

| Pacote             | Uso                                  | Tipo              | Por quê                                                                                    |
| ------------------ | ------------------------------------ | ----------------- | ------------------------------------------------------------------------------------------ |
| `read-excel-file`  | Ler a planilha enviada, no servidor  | `dependencies`    | Mantido (versão 9.3.17, atualizada este mês), MIT, só lê `.xlsx`, 4 dependências pequenas. |
| `write-excel-file` | Gerar a planilha modelo, pelo script | `devDependencies` | Do mesmo autor, MIT, 1 dependência (`fflate`). Só roda quando o modelo muda.               |

Descartados: `xlsx` (a versão do npm, 0.18.5, foi abandonada pelos autores, que passaram a publicar fora do npm, e tem falhas de segurança conhecidas) e `exceljs` (última versão de 2024, com dependências antigas que o `npm audit` costuma apontar). Depois de instalar, confiro que o `npm audit` continua em 0.

## Organização do código

```
src/modules/pdi/import/
  sheets.ts        cabeçalhos esperados de cada aba e conversão de linhas em objetos (puro)
  values.ts        datas (data do Excel ou dd/mm/aaaa → AAAA-MM-DD) e rótulos de status → enum (puro)
  service.ts       importPdi(file): lê o arquivo, valida tudo, confere categorias e ciclo ativo, grava
  actions.ts       importPdiAction (Server Action): recebe o arquivo do FormData e chama o service
  *.test.ts        testes ao lado
src/app/pdi/import/page.tsx (+ loading.tsx)   tela de importação
src/components/pdi/import-form.tsx            formulário (Client Component: useActionState)
scripts/generate-pdi-template.ts              gera public/templates/modelo-pdi.xlsx
public/templates/modelo-pdi.xlsx              planilha modelo versionada
e2e/fixtures/                                 planilhas de teste (geradas pelo mesmo script)
```

- **Por que Server Action para o upload:** o formulário envia o arquivo dentro do `FormData`; a Server Action recebe um `File`, lê os bytes e chama o service. Não precisa de Route Handler, porque não há consumidor externo.
- **Por que o service separa ler e gravar:** a leitura do `.xlsx` vira objetos simples numa função pura, testável sem arquivo; a gravação usa o banco. Assim os testes de regra não precisam montar planilhas, e só alguns testes usam um `.xlsx` de verdade.

## Arquivos afetados

```
src/modules/pdi/import/{sheets,values,service,actions}.ts (+ testes)
src/app/pdi/import/page.tsx, loading.tsx
src/app/pdi/page.tsx                       (botão "Importar planilha")
src/components/pdi/import-form.tsx
scripts/generate-pdi-template.ts
public/templates/modelo-pdi.xlsx
e2e/pdi-import.spec.ts, e2e/fixtures/*.xlsx, e2e/mobile.spec.ts (página nova na lista)
package.json, package-lock.json            (dependências e script pdi:template)
CLAUDE.md                                  (pendência removida, comando novo, regras da importação)
```

## Testes (escritos antes do código, em TDD)

### Unidade

| Arquivo          | Casos                                                                                                                                                                                                                                                      |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `values.test.ts` | Data do Excel (objeto `Date`) e texto `dd/mm/aaaa` viram `AAAA-MM-DD`; data inválida (`31/02/2026`, `texto`) dá erro; rótulos de status de ciclo e de ação (com e sem acento/maiúsculas) viram o enum; rótulo desconhecido dá erro com os valores aceitos. |
| `sheets.test.ts` | Linhas com o cabeçalho do modelo viram objetos; linhas vazias são ignoradas; células vazias viram campo vazio; cabeçalho diferente do modelo é recusado com a aba e a coluna; aba obrigatória ausente é recusada.                                          |

### Integração (banco de teste)

| Arquivo               | Casos                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `service.int.test.ts` | Planilha completa (gerada no teste com `write-excel-file`) cria ciclo, áreas, ações e check-ins com os campos certos; categoria inexistente, categoria arquivada, área que não está na aba Áreas, área repetida e campo obrigatório vazio são recusados com aba, linha e campo, **sem criar nada**; ciclo `Ativo` com outro ativo é recusado; aba Check-ins ausente é aceita; arquivo que não é `.xlsx` é recusado. |

### E2E (`e2e/pdi-import.spec.ts`)

1. Na lista de ciclos, "Importar planilha" leva à tela; o link da planilha modelo baixa um `.xlsx`.
2. Enviar a planilha de teste válida leva à página do ciclo, com as áreas, as ações e os check-ins da planilha.
3. Enviar uma planilha com categoria inexistente mostra o erro com aba e linha, e nenhum ciclo novo aparece na lista.
4. A tela de importação passa no axe; ela entra na lista de páginas do `e2e/mobile.spec.ts`.

## Critério de pronto

- `npm run lint`, `npm run typecheck`, `npm test` e `npm run test:e2e` passando; `npm audit` em 0.
- Importação conferida no navegador com a planilha modelo preenchida.
- Pendência removida do `CLAUDE.md`, com as regras da importação registradas; este plano atualizado.

## Perguntas

1. **Dependências.** Proposta: `read-excel-file` (ler) e `write-excel-file` (gerar o modelo, só em desenvolvimento). Preciso da sua aprovação para as duas.
2. **Tudo ou nada, sem prévia.** Proposta: validar a planilha inteira e só gravar se não houver nenhum erro, mostrando a lista de erros. A alternativa é uma prévia (mostrar o que será criado e pedir confirmação), que exige guardar a planilha entre duas requisições.
3. **Modelo estático.** Proposta: planilha modelo gerada por script e versionada em `public/`. A alternativa é gerar a cada download, com as categorias cadastradas no momento listadas na aba Instruções, o que exigiria um Route Handler.
