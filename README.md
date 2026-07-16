# Job Application Tracker

A full-stack app to track job applications, statuses, and deadlines, with automated
email notifications via SendGrid. Built with **React**, **Flask**, and **PostgreSQL**,
containerized with **Docker**, and deployable to **Google Cloud**.

## Features
- Add, update, and delete job applications (company, role, status, dates, notes)
- Filter applications by status
- Live stats dashboard (counts by status)
- Automated email notifications:
  - Confirmation when an application is added
  - Alert when a status changes (e.g., Applied → Interviewing)
  - Deadline reminders (3 days, 1 day, and day-of) via a background scheduler
- Fully containerized with Docker Compose (frontend + backend + Postgres)

## Tech Stack
- **Frontend:** React, Vite, Axios
- **Backend:** Flask, Flask-SQLAlchemy, APScheduler
- **Database:** PostgreSQL
- **Email:** SendGrid API
- **DevOps:** Docker, Docker Compose, Google Cloud Run (deployment target)

## Project Structure
```
job-tracker/
├── backend/
│   ├── app.py              # Flask app: models, routes, email logic, scheduler
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── index.html         # Vite entry HTML
│   ├── vite.config.mjs
│   ├── src/
│   │   ├── App.jsx         # Main UI: form, list, stats
│   │   ├── api.js          # Axios API client
│   │   └── main.jsx        # React bootstrap
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

## Running Locally with Docker (recommended)

1. Copy the backend env file and add your SendGrid key (optional — app runs fine without it, emails just get skipped/logged):
   ```
   cp backend/.env.example backend/.env
   ```
2. From the project root:
   ```
   export SENDGRID_API_KEY=your_key_here   # optional
   docker compose up --build
   ```
3. Open:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000/api/health

## Running Without Docker (manual dev setup)

**Backend**
```
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/job_tracker
export SENDGRID_API_KEY=your_key_here   # optional
flask --app app.py init-db
python app.py
```

**Frontend**
```
cd frontend
npm install
npm run dev
```

The Vite dev server runs on http://localhost:5173 by default.

## API Endpoints

| Method | Endpoint                  | Description                  |
|--------|----------------------------|-------------------------------|
| GET    | /api/applications          | List all (optional `?status=`) |
| GET    | /api/applications/<id>     | Get one application           |
| POST   | /api/applications          | Create application            |
| PUT    | /api/applications/<id>     | Update application            |
| DELETE | /api/applications/<id>     | Delete application             |
| GET    | /api/stats                 | Counts by status              |

## Deploying to Google Cloud (Cloud Run)

```
# Backend
gcloud builds submit backend --tag gcr.io/YOUR_PROJECT/job-tracker-backend
gcloud run deploy job-tracker-backend --image gcr.io/YOUR_PROJECT/job-tracker-backend \
  --set-env-vars DATABASE_URL=...,SENDGRID_API_KEY=...

# Frontend
gcloud builds submit frontend --tag gcr.io/YOUR_PROJECT/job-tracker-frontend
gcloud run deploy job-tracker-frontend --image gcr.io/YOUR_PROJECT/job-tracker-frontend
```

For CI/CD, connect this repo to Cloud Build triggers so pushes to `main` auto-build
and deploy both services.

## Notes
- SendGrid is optional for local testing — if `SENDGRID_API_KEY` isn't set, the app
  logs the email instead of sending it, so the app still runs end-to-end without an account.
- Deadline reminders run on a background scheduler that checks daily for applications
  with deadlines 3, 1, or 0 days away.
