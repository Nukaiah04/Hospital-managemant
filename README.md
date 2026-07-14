# CareFlow Hospital Management System

A small full-stack project for learning DevOps and web development. It has a dashboard, patient/doctor/appointment management, bills, payments, billing reports, and PostgreSQL storage.

## Run locally

1. Install [Node.js 20+](https://nodejs.org/) and PostgreSQL 16+.
2. Create a database named `hospital_db` and a matching user, or use Docker below.
3. Copy `.env.example` to `.env` and set `DATABASE_URL` for your database.
4. Run `npm install`.
5. Run `npm start`.
6. Open `http://localhost:3000`.

For automatic restart while learning, use `npm run dev`.

## Run with Docker

```bash
docker compose up --build
```

Open `http://localhost:3000`. This starts both the application and PostgreSQL. Stop it with `docker compose down`; your database data remains in the Docker volume. To delete all database data too, run `docker compose down -v`.

## API endpoints

- `GET /api/health` — health check for Docker/Kubernetes monitoring
- `GET`, `POST /api/patients`
- `DELETE /api/patients/:id`
- `GET /api/doctors`
- `GET`, `POST /api/appointments`
- `DELETE /api/appointments/:id`
- `GET`, `POST /api/bills`
- `DELETE /api/bills/:id`
- `GET /api/reports/billing` — total billed, collected payments, and balances

## Good next DevOps steps

Add a database (PostgreSQL), environment variables, automated tests, a CI pipeline, and Kubernetes manifests after you are comfortable with this version.
