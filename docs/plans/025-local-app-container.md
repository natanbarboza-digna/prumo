# 025 — Aplicação em contêiner local, construída a cada feature

Status: **implementado em 2026-11-20**, aprovado com a porta 3200
Branch: `chore/local-app-container`

Diretriz nova pedida pelo dono do projeto em 2026-11-20: a aplicação roda num contêiner, e toda funcionalidade nova atualiza e constrói esse contêiner. Alinhado antes do plano:

- **O que roda no contêiner:** o **build de produção**, com a mesma imagem do VPS (`Dockerfile`, plano 014), ao lado do desenvolvimento. O dia a dia continua no host (`npm run dev`, Vitest, Playwright), que é rápido no Windows.
- **Quando:** no **critério de pronto** de cada feature, antes de pedir o merge.

## Objetivo

Pegar cedo o que só quebra no build de produção (o `next build` com `output: standalone`, a imagem, as migrations rodando pelo contêiner `migrate`) e ter sempre, em `http://localhost:3200`, a versão da branch rodando como vai rodar no servidor.

## Como fica

### `docker-compose.yml` (local)

Ganha dois serviços, iguais aos do `docker-compose.prod.yml`, num **perfil** do Compose chamado `app`:

- **`migrate`** (alvo `tools` do `Dockerfile`): aplica as migrations e as categorias padrão no banco de desenvolvimento (`prumo`) e sai.
- **`app`** (alvo `runner`): o servidor de produção, publicado em **`localhost:3200`** (o `npm run dev` usa a 3000 e os e2e usam a 3100). Só sobe depois que o `migrate` termina sem erro. Tem um healthcheck, que pede `/login` com o `fetch` do Node, porque a imagem `node:26-slim` não tem `curl`.

Com o perfil, **`docker compose up -d` continua subindo só o banco**: os testes e o `npm run dev` não mudam. O contêiner da aplicação só sobe quando pedido.

Os dois serviços usam o mesmo banco do `npm run dev` (dados e conta de login são os mesmos), pela rede interna do Compose (`db:5432`).

### Scripts novos no `package.json`

| Comando                   | O que faz                                                                                            |
| ------------------------- | ---------------------------------------------------------------------------------------------------- |
| `npm run container:up`    | `docker compose --profile app up -d --build`: constrói as imagens, aplica as migrations e sobe o app |
| `npm run container:check` | Espera o app responder e confere `/login` (200) e `/` sem sessão (redireciona para `/login`)         |
| `npm run container:down`  | Para o `app` e remove os contêineres do perfil, mantendo o banco no ar                               |

O `container:check` é um script em TypeScript (`scripts/check-container.ts`, rodado com o `tsx`, que já é dependência), com o `fetch` do Node: nenhuma dependência nova. Ele tenta por até 90 segundos e sai com erro, mostrando os últimos logs do contêiner, se o app não responder.

### Diretriz no `CLAUDE.md`

- **Stack:** "PostgreSQL em Docker Compose (só o banco no contêiner; a aplicação roda no host)" passa a dizer que a aplicação roda no host para desenvolver e também num contêiner local com o build de produção.
- **Comandos:** os três scripts novos.
- **Workflow, "Pronto significa":** acrescenta "`npm run container:up` e `npm run container:check` passando" e o registro do resultado no plano. Vale para toda feature, inclusive as que não mexem em Docker.
- O hook de pre-commit **não** roda o build do contêiner (levaria minutos a cada commit); ele fica no critério de pronto.

## Fora de escopo

- Rodar o Playwright ou o Vitest contra o contêiner (continuam no host; os e2e usam o build pelo `next start` na porta 3100).
- Desenvolver dentro do contêiner (descartado no alinhamento).
- Mudar o `Dockerfile` ou o `docker-compose.prod.yml` (a imagem já é a de produção; se o build local revelar algum problema nela, entra como correção neste plano e fica registrado).
- Publicar a imagem num registro (Docker Hub, GHCR) ou o deploy automático pelo CI (grupo Ferramentas).

## Mudanças no modelo de dados

Nenhuma.

## Arquivos afetados

```
docker-compose.yml (serviços migrate e app, perfil "app")
package.json (scripts container:up, container:check, container:down)
scripts/check-container.ts (novo)
CLAUDE.md (Stack, Comandos, Workflow)
docs/deploy.md (uma nota: a mesma imagem pode ser testada localmente)
```

## Verificação

Não há regra de negócio, então não há teste de unidade novo. A verificação é rodar a diretriz pela primeira vez:

1. `docker compose up -d` sobe só o banco (o perfil não interfere).
2. `npm run container:up` constrói as duas imagens e sobe o `app`; o `migrate` termina sem erro.
3. `npm run container:check` passa.
4. Login no `http://localhost:3200` com a conta de desenvolvimento, pelo navegador do app, com uma captura de tela como prova.
5. `npm run container:down` para o app e o banco continua no ar.
6. `npm run lint`, `npm run typecheck` e `npm test` passando (os testes não usam o contêiner, mas confirmam que nada mudou para eles).

## Depois deste plano

O plano 024 (arquivar trilhas), guardado num `git stash` na branch `feat/archive-tracks`, é retomado e já fecha com a diretriz nova.

## Critério de pronto

- Os passos da verificação passando e registrados neste plano.
- `CLAUDE.md` atualizado com a diretriz.

## Resultado

1. `docker compose config --services` sem perfil: só `db`; com `--profile app`: `db`, `migrate` e `app`. Depois do `container:down`, `docker compose up -d` subiu só o banco.
2. `npm run container:up`: as duas imagens construídas sem erro; o `migrate` saiu com código 0 ("8 migrations found", nada pendente) e o `app` ficou `healthy`.
3. `npm run container:check`: "/login responde com a página de login" e "/ sem sessão redireciona para /login".
4. A página de login, servida pelo contêiner em `http://localhost:3200`, aberta no navegador do app. **Não fiz o login:** a conta do banco de desenvolvimento usa a senha do dono do projeto, que não é digitada por mim; a conta dos e2e só existe no banco de teste. O login fica para o dono conferir.
5. `npm run container:down` removeu o `app` e o `migrate`, e o banco continuou no ar. O app foi subido de novo (`docker compose --profile app up -d`) e ficou rodando.
6. `npm run lint`, `npm run typecheck` e `npm test` (484 testes) passando.

## Mudanças durante a implementação

- O passo 4 virou "abrir a página de login", pelo motivo acima.
- O `migrate` imprime o aviso do Prisma sobre a versão 8 disponível; é só informativo (a versão 7.10 é fixada de propósito, plano 011).

## Decisão

1. Porta 3200.

## Pergunta (com proposta)

1. **Porta do app no contêiner?** Proposta: 3200, para não brigar com o `npm run dev` (3000) nem com os e2e (3100).
