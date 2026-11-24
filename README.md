# Prumo

Aplicação web de uso pessoal para gerir objetivos, trilhas de desenvolvimento, rotina diária, ciclos de PDI, leituras e tempo de trabalho. Uma conta só, com e-mail e senha.

**Stack:** Next.js (App Router) e TypeScript, PostgreSQL com Prisma, Tailwind e shadcn/ui, Zod, Vitest e Playwright.

## Como rodar

Precisa de **Node 26** (veja `.nvmrc`) e **Docker**.

```bash
cp .env.example .env            # ajuste a senha do banco, se quiser
cp .env.example .env.test       # troque o banco da DATABASE_URL para prumo_test
docker compose up -d            # sobe o PostgreSQL (cria também o banco de teste)
npm install                     # instala e liga os hooks do git
npx prisma migrate deploy       # cria as tabelas
npx prisma db seed              # categorias padrão
npm run auth:create-user        # cria a conta (e-mail e senha de 12+ caracteres)
npm run dev                     # http://localhost:3000
```

Para ver o app com dados de exemplo: `npm run db:seed:demo` (com o banco vazio).

## Testes

```bash
npm test                                      # unidade e integração (precisa do banco)
npm run test:e2e:dev -- e2e/<área>.spec.ts    # e2e de uma área
```

`npm test` e os e2e usam o mesmo banco de teste: não rode os dois ao mesmo tempo.

## Build de produção

`npm run container:up` constrói a imagem e sobe o app em `http://localhost:3200`; `npm run container:check` confere se ele responde. Para publicar num servidor, veja [docs/deploy.md](docs/deploy.md): pelo IP, sem domínio e sem HTTPS (`docker-compose.prod.yml`), ou com domínio e HTTPS pelo Caddy (somando `docker-compose.caddy.yml`).

## Mais

- [CLAUDE.md](CLAUDE.md): regras de negócio, convenções e fluxo de trabalho.
- [docs/plans/](docs/plans/): um plano por funcionalidade.
