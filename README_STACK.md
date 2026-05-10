# Vinyl-Check Vue/Capacitor/FastAPI Migration

## Structure

- `apps/mobile`: Vue 3 + Vite + Pinia + Vue Router + Capacitor app
- `backend`: FastAPI API skeleton
- `database/schema.sql`: PostgreSQL schema
- `src`: previous React prototype, kept for reference

## Run Mobile Prototype

```powershell
cd apps/mobile
npm install
npm run dev -- --port 5174
```

## Run FastAPI

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Database

Use PostgreSQL and apply:

```sql
\i database/schema.sql
```

The current Vue app still uses local mock state for fast prototyping. The FastAPI routes and PostgreSQL schema are ready for replacing mock calls with real API calls.
