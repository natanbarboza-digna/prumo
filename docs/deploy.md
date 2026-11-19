# Deploy do Prumo num VPS

Guia para colocar o Prumo no ar num servidor seu, com Docker e HTTPS automático (plano 014). Tudo roda em contêineres: o Postgres, o app e o Caddy, que recebe as conexões da internet e cuida do certificado.

## O que você precisa

- Um **VPS** com Linux (Ubuntu 24.04 ou Debian 12, por exemplo), 1 GB de RAM ou mais e 10 GB de disco. Qualquer provedor serve (Hetzner, DigitalOcean, Oracle Cloud etc.).
- Um **domínio** (ou subdomínio), como `prumo.seudominio.com`.
- O projeto num **repositório Git** que o servidor consiga clonar (por exemplo, um repositório privado no GitHub com uma _deploy key_).

## 1. Apontar o domínio

No painel de DNS do domínio, crie um registro **A** (e **AAAA**, se o VPS tiver IPv6) com o nome escolhido apontando para o IP do servidor. Espere a propagação (de minutos a algumas horas): `ping prumo.seudominio.com` deve responder com o IP do VPS.

## 2. Preparar o servidor

Entre no servidor por SSH e instale o Docker (com o plugin Compose) seguindo a documentação oficial (`docs.docker.com/engine/install`). Depois:

```bash
sudo usermod -aG docker "$USER"   # para usar docker sem sudo (saia e entre de novo no SSH)
sudo ufw allow OpenSSH
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

Só as portas 22 (SSH), 80 e 443 ficam abertas. O banco e o app não têm porta exposta: só o Caddy fala com eles, pela rede interna do Docker.

## 3. Baixar o projeto e configurar

```bash
sudo mkdir -p /opt/prumo && sudo chown "$USER" /opt/prumo
git clone <url-do-repositório> /opt/prumo
cd /opt/prumo
cp .env.production.example .env.production
nano .env.production
```

Preencha:

- `DOMAIN`: o domínio do passo 1;
- `ACME_EMAIL`: seu e-mail (o Let's Encrypt avisa por ele se o certificado tiver problema);
- `POSTGRES_PASSWORD`: uma senha longa e aleatória, gerada com `openssl rand -base64 32`.

O arquivo `.env.production` fica só no servidor; ele nunca vai para o Git.

## 4. Subir

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

A primeira vez leva alguns minutos (montar a imagem). Na ordem, o Compose:

1. sobe o Postgres;
2. roda o serviço `migrate`, que aplica as migrations e cria as categorias padrão, e termina;
3. sobe o app;
4. sobe o Caddy, que pede o certificado HTTPS ao Let's Encrypt.

Para acompanhar: `docker compose -f docker-compose.prod.yml --env-file .env.production logs -f`.

## 5. Criar a sua conta

O Prumo tem uma conta só, criada pelo terminal (não existe tela de cadastro):

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm migrate npm run auth:create-user
```

Ele pergunta o e-mail e a senha (pelo menos 12 caracteres; ela não aparece enquanto você digita). Depois, abra `https://prumo.seudominio.com` e entre.

**Esqueceu a senha?** O mesmo comando com `-- --reset-password` troca a senha, desbloqueia a conta e encerra todas as sessões:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm migrate npm run auth:create-user -- --reset-password
```

## 6. Agendar o backup

O `deploy/backup.sh` gera um dump compactado do banco em `/opt/prumo/backups` e guarda os 14 mais recentes. Agende no `cron` do servidor (`crontab -e`):

```
0 3 * * * cd /opt/prumo && ./deploy/backup.sh >> backups/backup.log 2>&1
```

Vale copiar os backups para fora do servidor de vez em quando (outro computador ou um armazenamento na nuvem): se o VPS sumir, os backups dentro dele somem junto.

## Atualizar para uma versão nova

```bash
cd /opt/prumo
./deploy/backup.sh
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

O serviço `migrate` aplica as migrations novas antes de o app novo subir.

## Restaurar um backup

```bash
cd /opt/prumo
docker compose -f docker-compose.prod.yml --env-file .env.production stop app
gunzip -c backups/prumo-AAAAMMDD-HHMMSS.sql.gz \
  | docker compose -f docker-compose.prod.yml --env-file .env.production exec -T db \
      sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
docker compose -f docker-compose.prod.yml --env-file .env.production start app
```

O dump apaga e recria as tabelas antes de inserir os dados, então o banco volta exatamente ao estado do backup.

## Problemas comuns

- **O certificado não sai:** confira se o DNS já aponta para o servidor e se as portas 80 e 443 estão abertas (o Let's Encrypt precisa acessar a porta 80). Os logs do Caddy dizem o motivo: `docker compose ... logs caddy`.
- **O app não sobe:** veja `docker compose ... logs migrate app`. Se o `migrate` falhou, o app nem tenta subir.
- **Pouca memória durante o build:** em VPS de 1 GB, crie um arquivo de swap de 2 GB antes do primeiro `up --build`.
