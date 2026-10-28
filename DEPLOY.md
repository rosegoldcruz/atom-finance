# Deploy ATOM on one Linux box

ATOM runs as three long-lived containers: the web UI, the API, and Postgres. Caddy is optional and only starts with the `proxy` profile. Nothing here is serverless, and the database lives on a Docker volume.

## On aeon-server

1. Install Docker Engine and the Compose plugin.
2. Clone the repo and check out the release you want.
3. Create the env file and replace every `<password>` and `<long-random-string>` placeholder. Do not commit that file.

   ```bash
   cp .env.example .env
   openssl rand -hex 32   # use this as AUTH_SECRET
   ```

   Set `POSTGRES_PASSWORD` and use that same value in place of `<password>` inside `DATABASE_URL`. Set `APP_ORIGIN` to the URL operators will open, for example `https://atom.example.com`. Set `COOKIE_SECURE=true` when that URL is HTTPS.

4. Start the desk:

   ```bash
   docker compose up -d --build
   ```

   Open `http://<server>:8080`. Postgres is bound to `127.0.0.1` only.

5. Create the first workspace in the UI, or load the sample scanner logs:

   ```bash
   docker compose exec api npx tsx scripts/seed.ts
   ```

   If `SEED_USER_PASSWORD` is unset, the command prints a one-time password. Copy it from the logs. It is not written into the image or the repo. The ingestion key is printed once inside the container at `data/local-ingestion-key.txt`.

## Optional Caddy

Point DNS at the box, set `ATOM_DOMAIN` and `ACME_EMAIL` in `.env`, open ports 80 and 443, then:

```bash
docker compose --profile proxy up -d
```

Caddy terminates TLS and forwards `/api` to the API and everything else to the web container. Set `APP_ORIGIN` to `https://$ATOM_DOMAIN`.

## Operations

- Logs: `docker compose logs -f api`
- Backups: `docker compose exec postgres pg_dump -U atom atom > atom.sql`
- Updates: `git pull && docker compose up -d --build`
- The volume `atom_postgres` keeps the database across recreates. Do not run `docker compose down -v` unless you mean to delete it.

The API process is `tsx server/index.ts` after `prisma migrate deploy`. In production it exits on boot if `AUTH_SECRET` or `DATABASE_URL` is missing or still contains a placeholder (`change-me`, `<password>`, or `<long-random-string>`).

## Scanner

From the machine that writes the CSVs:

```bash
npm run ingest -- --url https://atom.example.com --key "$ATOM_INGEST_KEY" \
  --ledger logs/paper_ledger.csv \
  --opportunities logs/opportunities.csv \
  --circular logs/circular.csv
```

That client only reads local files and POSTs them. It does not sign or send transactions.
