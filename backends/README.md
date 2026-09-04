# Great Lakes Bank digital banking backend

This directory is the API and database layer used by the banking interface in the project root.

## Services

- `api/` — Express 5 and TypeScript modular-monolith API (container port 3000, host port 3001)
- `database/init/` — MariaDB schema applied when the database volume is first created
- `docker-compose.yml` — MariaDB and API development stack

## Start

From this directory, run `docker compose up --build -d`. Start the banking interface from the project root with `npm run start -- --port 3002 --host 0.0.0.0` after running `npm run build`.

The customer interface uses HTTP-only session cookies and calls `http://localhost:3001`. Customer profiles, KYC decisions, accounts, transactions, linked accounts, card status, and QR payments are stored in MariaDB. Browser local storage is not used for banking records.

Demo bank staff credentials are `admin@greatlakesbank.test` / `Admin123!`. Change all credentials and secrets before any non-demo deployment.
