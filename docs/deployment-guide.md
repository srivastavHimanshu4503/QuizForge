# QuizForge — Production Deployment Guide

This guide details how to build, configure, deploy, and operate **QuizForge** in containerized production environments.

---

## 1. Quick Start with Docker Compose

The fastest way to deploy QuizForge for production testing or self-hosting:

```bash
# 1. Clone repository
git clone https://github.com/your-username/quiz-forge.git
cd quiz-forge

# 2. Configure environment
cp .env.example .env
# Edit .env and supply GEMINI_API_KEY, JWT_SECRET, etc.

# 3. Build and launch services in detached mode
docker compose up -d --build

# 4. View logs
docker compose logs -f
```

The application will be accessible at:
- **Web Interface:** `http://localhost` (or your domain/IP)
- **API Health Check:** `http://localhost/api/health`

---

## 2. Architecture Overview

```text
                     +---------------------------------------+
                     |          Client / Browser             |
                     +---------------------------------------+
                                         │
                                         │ HTTP (Port 80)
                                         ▼
                     +---------------------------------------+
                     |         Nginx Reverse Proxy           |
                     |         (quizforge-frontend)          |
                     +---------------------------------------+
                            │                        │
       Static Assets / SPA  │                        │ /api/*
       (HTML, CSS, JS)      │                        │
                            ▼                        ▼
                 [ /usr/share/nginx/html ]   [ Fastify Backend :4000 ]
                                             (quizforge-backend)
                                                     │
                                                     │ Drizzle ORM
                                                     ▼
                                            [ SQLite WAL DB ]
                                            (/app/data/quizforge.db)
                                            (Persistent Volume)
```

---

## 3. Environment Variables Reference

| Variable | Default | Purpose | Required in Prod |
| :--- | :--- | :--- | :---: |
| `NODE_ENV` | `production` | Environment mode (`production`, `development`, `test`) | Yes |
| `PORT` | `4000` | Fastify backend port | Yes |
| `HOST` | `0.0.0.0` | Binding host address | Yes |
| `DATABASE_URL` | `/app/data/quizforge.db` | Path to persistent SQLite file | Yes |
| `JWT_SECRET` | *(Random 32+ char string)* | Cryptographic key for stateless JWT sessions | **Yes** |
| `CORS_ORIGIN` | `http://localhost` | Allowed origin for browser requests | Yes |
| `GEMINI_API_KEY` | *(None)* | Primary LLM and multimodal vision provider | **Yes** |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Gemini model name | No |
| `GROQ_API_KEY` | *(None)* | High-speed open-weights fallback provider | Optional |
| `GROQ_MODEL` | `llama-3.3-70b-versatile`| Groq model name | No |
| `NVIDIA_API_KEY`| *(None)* | NVIDIA NIM fallback provider | Optional |
| `NVIDIA_MODEL` | `meta/llama-3.3-70b-instruct` | NVIDIA NIM model name | No |
| `GITHUB_TOKEN` | *(None)* | Increases GitHub API rate limit from 60 to 5000/hr | Highly Recommended |

---

## 4. Persistent Storage & Backups

The SQLite database is stored in a named Docker volume (`quizforge-data`) mounted at `/app/data/quizforge.db`.

### Creating a Database Backup
Because SQLite is running in **WAL (Write-Ahead Logging)** mode, back up the database using the safe backup command or by copying both `quizforge.db`, `quizforge.db-wal`, and `quizforge.db-shm`:

```bash
docker compose exec backend node -e "
  const Database = require('better-sqlite3');
  const db = new Database('/app/data/quizforge.db');
  db.backup('/app/data/backup-' + Date.now() + '.db')
    .then(() => console.log('Backup successful!'))
    .catch(console.error);
"
```

---

## 5. Health Monitoring & Observability

QuizForge provides an automated health probe at `GET /api/health`:

```bash
curl -i http://localhost/api/health
```

Sample JSON response:
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2026-11-22T03:50:00.000Z",
    "uptime": 3600.42,
    "environment": "production",
    "database": {
      "status": "healthy",
      "driver": "better-sqlite3",
      "wal": true
    }
  }
}
```

The container healthcheck automatically queries this probe every 15 seconds. If the database locks or encounters corruption, the container is flagged `unhealthy`.

---

## 6. Scaling & Production Best Practices

1. **Reverse Proxy & SSL/TLS:** In front of the Nginx container, deploy Cloudflare, AWS ALB, Caddy, or Traefik to terminate TLS (HTTPS).
2. **File Size Limits:** Nginx client max body size is configured to `20M` to comfortably accommodate 15MB PDF documents and 10MB vision image uploads.
3. **Graceful Shutdown:** The Fastify backend listens for `SIGTERM` and `SIGINT`, cleanly terminating inflight requests and safely closing SQLite WAL journals.
