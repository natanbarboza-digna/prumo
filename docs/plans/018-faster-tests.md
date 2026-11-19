# 018 — Testes e2e mais rápidos

Status: **aguardando aprovação**
Branch: `chore/faster-tests`

## Objetivo

A bateria completa de e2e leva de 6 a 10 minutos (66 testes, um de cada vez). Este plano corta esse tempo com duas mudanças combinadas: rodar os e2e contra o build de produção em vez do `next dev`, e criar os dados de preparação direto no banco em vez de preencher formulários. A regra de rodar só os e2e da área mexida (já no `CLAUDE.md`) continua valendo.

## Medições (2026-11-19)

| Spec                              | Testes | Tempo                                 |
| --------------------------------- | ------ | ------------------------------------- |
| pdi-routines                      | 6      | 76 s                                  |
| routines                          | 13     | 61 s                                  |
| tracks                            | 8      | 50 s                                  |
| pdi                               | 7      | 47 s                                  |
| home                              | 5      | 36 s                                  |
| goals                             | 8      | 34 s                                  |
| mobile                            | 5      | 24 s                                  |
| categories                        | 3      | 23 s                                  |
| auth                              | 4      | 16 s                                  |
| pdi-import, navigation, not-found | 7      | 20 s                                  |
| **Total**                         | **66** | **387 s** (mais a subida do servidor) |

- **Onde vai o tempo:** os specs mais lentos são os que montam muitos dados pela interface antes de testar algo (criar ciclo, área e ação de PDI; criar rotina e registrar dias; criar trilha e etapas). O `next dev` ainda compila cada página na primeira visita.
- **Build x dev:** o `pdi-routines` levou **74 s contra o build** (`next start`) e **125 s contra o `next dev`**, cerca de 40% menos. O build em si leva **66 s**.

## Escopo

### 1. E2E contra o build

- `npm run test:e2e` passa a fazer o build e a subir o servidor de produção (`next start`) para os testes, na porta 3100 de sempre e com o banco de teste.
- **`npm run test:e2e:dev`** (novo) roda contra o `next dev`, como hoje: para iterar num único spec, em que o build de 66 s não compensa (pergunta 1).
- O cookie de sessão é `secure` em produção. O Chromium aceita cookie `secure` em `http://localhost`, então o login e o `storageState` continuam funcionando; o primeiro passo da implementação é confirmar isso.
- **`output: "standalone"` só no Docker** (pergunta 2): o `next start` avisa que não combina com o modo `standalone`. O `next.config.ts` passa a ligar o `standalone` só quando a variável `NEXT_OUTPUT=standalone` estiver definida, e o `Dockerfile` a define no build da imagem. O deploy não muda.

### 2. Dados de preparação direto no banco

- **`e2e/factories.ts`** (novo): funções que gravam dados prontos no banco de teste com SQL, no mesmo estilo do `seedTestDatabase` (o Playwright não consegue importar o cliente do Prisma, que é um módulo ES):
  - `insertGoal`, `insertTrack` (com etapas), `insertRoutine` (com registros), `insertCycle` (com áreas, ações e check-ins) e `categoryId(nome)`.
  - Cada função devolve os ids criados, para o teste abrir a página certa direto pela URL.
- **Testes que mudam:** a preparação de dados passa para as factories quando **não é o que o teste quer provar**. Por exemplo, "concluir a ação pede o destino da rotina" não precisa criar ciclo, área e ação pela tela. Specs atingidos: `pdi-routines`, `pdi`, `routines`, `tracks`, `home`, `goals`, `mobile` e `navigation`.
- **Continua pela tela** (pergunta 3): pelo menos um teste de criação por entidade (objetivo, trilha e etapa, rotina, ciclo, área, ação, check-in), porque o formulário em si precisa ser testado. Os helpers de UI atuais (`createGoal`, `createRoutine`…) ficam para esses testes.
- **Proteção contra divergência:** um teste de integração (Vitest) grava com cada factory e lê com os services do app. Se uma coluna mudar no schema e a factory ficar desatualizada, esse teste falha antes dos e2e.

### Meta

- Bateria completa em **menos da metade** do tempo de hoje, com o build incluído. Meço antes e depois e registro neste plano.

## Fora de escopo

- Testes em paralelo (vários workers com bancos separados).
- Mudar os testes de unidade e integração (o `npm test` leva cerca de 1 minuto).
- Reaproveitar um build anterior quando o código não mudou (cache de build entre execuções).

## Mudanças no modelo de dados

Nenhuma.

## Arquivos afetados

```
playwright.config.ts                 (servidor de build ou de dev, conforme o script)
package.json                         (test:e2e com build; test:e2e:dev)
next.config.ts, Dockerfile           (standalone só com NEXT_OUTPUT=standalone)
e2e/factories.ts                     (novo)
src/test/e2e-factories.int.test.ts   (novo: factories x services)
e2e/{pdi-routines,pdi,routines,tracks,home,goals,mobile,navigation}.spec.ts
CLAUDE.md                            (comandos e convenção de testes)
.github/workflows/ci.yml             (o e2e do CI passa a usar o build)
```

## Testes

- **Integração:** cada factory grava dados que os services leem com os mesmos valores (objetivo, trilha com etapas, rotina com registros, ciclo com área, ação e check-in).
- **E2E:** a bateria inteira continua passando, com os mesmos testes, só com a preparação trocada. Nenhum teste é removido.
- **Imagem Docker:** o build da imagem continua gerando o `standalone` (confiro que `.next/standalone/server.js` existe na imagem).

## Critério de pronto

- `npm run lint`, `npm run typecheck`, `npm test` e `npm run test:e2e` passando.
- Tempo da bateria completa medido antes e depois, registrado neste plano.
- `CLAUDE.md` e este plano atualizados.

## Perguntas

1. **Modo dev para iterar.** Proposta: `npm run test:e2e` com build (bateria completa e antes do merge) e `npm run test:e2e:dev` com o servidor de desenvolvimento (um spec durante o trabalho). A alternativa é só o modo build.
2. **`standalone` só no Docker.** Proposta: ligar o `standalone` por variável de ambiente, definida no `Dockerfile`. A alternativa é rodar os e2e com o `server.js` do `standalone`, copiando os arquivos estáticos para ele a cada execução.
3. **Um teste de criação pela tela por entidade.** Proposta: manter, e trocar o resto da preparação por factories. A alternativa é trocar tudo e confiar só nos testes que já existem para cada formulário.
