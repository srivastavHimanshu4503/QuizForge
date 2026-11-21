# QuizForge — AI-Powered Quiz Generation & Knowledge Assessment Platform

[![CI Pipeline](https://github.com/your-username/quiz-forge/actions/workflows/ci.yml/badge.svg)](https://github.com/your-username/quiz-forge/actions)
[![Tests](https://img.shields.io/badge/Tests-131%2F131%20Passing-brightgreen)](https://github.com/your-username/quiz-forge)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**QuizForge** is a production-grade, AI-powered quiz generation, learning management, and knowledge assessment platform. It transforms disparate knowledge sources—**PDF documents**, **live web URLs**, **images/infographics**, and **GitHub repositories**—into pedagogical assessments with server-side anti-cheat scoring, human-in-the-loop review studios, classroom assignment workflows, and zero-AI cost retakes.

---

## 1. System Architecture

```text
quiz-forge/
├── packages/
│   └── shared/           # Zod schemas, data contracts & inferred TypeScript types
└── apps/
    ├── backend/          # Fastify v5 + Drizzle ORM + SQLite (WAL mode) + Multi-LLM Layer
    └── frontend/         # React 19 + Vite 6 + Tailwind CSS + Lucide Icons
```

| Layer | Technology | Key Capabilities |
| :--- | :--- | :--- |
| **Monorepo** | **pnpm Workspaces** | Strict type sharing, zero duplicated dependencies, isolated builds. |
| **Backend API** | **Fastify v5 (TypeScript)** | High-throughput async routes, OWASP security headers (`@fastify/helmet`), rate limiting, multi-part handling. |
| **Frontend Client** | **React 19 + Vite 6** | Modern dark-mode interface, optimistic autosaves, responsive single-question quiz player, instant HMR. |
| **Database & ORM** | **SQLite + Drizzle ORM** | High-concurrency **Write-Ahead Logging (WAL)** mode, foreign-key enforcement, automated migration pipeline. |
| **AI Providers** | **Universal LLM Registry** | Interchangeable provider architecture supporting **Google Gemini** (2.5 Flash + Vision), **Groq** (Llama 3.3 70B), **NVIDIA NIM**, and **Deterministic Mock**. |
| **Security Layer** | **OWASP Hardening** | Magic byte file validation (`%PDF-`, PNG, JPEG, WebP), SSRF DNS pre-resolution & private IP blocking, server-side answer sanitization. |
| **Containerization** | **Docker & Docker Compose** | Multi-stage Dockerfiles, Nginx alpine reverse proxy, SQLite persistent volume mounts. |
| **Testing** | **Vitest 3** | Comprehensive suite spanning 15 test files with **131 automated unit, integration, and E2E tests**. |

---

## 2. Core Feature Capabilities

### 📄 1. PDF-to-Quiz Ingestion
- Upload PDF documents up to 15MB.
- **Security:** Validates `%PDF-` file header magic bytes before parsing; rejects spoofed binary payloads.
- **Asynchronous Chunking:** Splits dense texts into overlapping pedagogical chunks, tracks real-time generation progress (`extracting` → `chunking` → `generating` → `persisting`), and streams progress to the client via a dedicated job polling engine.

### 🌐 2. URL-to-Quiz with SSRF Defense
- Input any publicly accessible web page URL to generate custom quizzes.
- **SSRF Defense Architecture:**
  - Whitelists only `http:` and `https:` schemes.
  - Performs DNS pre-resolution before issuing network requests.
  - Blacklists loopback addresses (`127.0.0.0/8`), RFC1918 private subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), cloud instance metadata endpoints (`169.254.169.254`), and IPv6 private ranges (`::1`, `fe80::/10`, `fc00::/7`).
  - Implements safe manual redirect following (up to 3 hops), re-validating the SSRF firewall on every hop.
  - Strips HTML boilerplate (navbars, scripts, ads) via Cheerio before feeding grounded content to the LLM.

### 🖼️ 3. Image-to-Quiz with Vision Processing
- Ingest photos, lecture notes, textbook diagrams, and infographics up to 10MB.
- **Security:** Verifies file magic bytes for PNG (`\x89PNG`), JPEG (`\xFF\xD8\xFF`), and WebP (`RIFF...WEBP`).
- **Multimodal AI:** Utilizes Gemini's native vision pipeline with anti-hallucination visual grounding prompts.

### 💻 4. GitHub Code Review Quizzes
- Ingest public GitHub repositories with tiered file prioritization (ignoring vendor assets, node_modules, lockfiles).
- Generates adversarial code-comprehension questions targeting logic edge cases, concurrency hazards, and architectural invariants.
- Evaluates open-ended user explanations using semantic LLM rubrics (0–10 score with qualitative critique).

### 🎓 5. Role-Based Access Control (RBAC) & Classroom Engine
- Roles: `student`, `teacher`, and `admin`.
- **Classrooms:** Teachers create classrooms with auto-generated 6-character enrollment codes. Students join and view enrolled courses.
- **Assignments:** Teachers assign quizzes with optional deadlines. Real-time status badges display `Pending`, `Submitted`, or `Past Due`.
- **Isolated Retakes:** Unique multi-student indexing allows each enrolled student to maintain independent attempts and scores for the same quiz.

### 🛠️ 6. Human-in-the-Loop Quiz Review Studio & Publishing
- **Quiz Review Studio (`/studio/:quizId`):** Creators can review AI-generated questions, edit prompts, update the 4 multiple-choice options, designate the correct choice, refine explanations, reorder questions, and add or delete items.
- **Lifecycle Management:** Toggle between `draft` and `published` states.
- **Public Share Links (`/quiz/shared/:shareCode`):** Shareable link for quick assessments.
- **Zero-Leak Guarantee:** Public review and active attempt endpoints strip `correctChoiceId` and `explanation` to prevent inspect-element answer leaking.

### 🔄 7. Zero-AI Cost Shuffled Retakes
- Users can retake any past quiz or code-review assessment at any time.
- Fresh attempts shuffle questions and choices server-side, requiring **zero** additional LLM tokens or API calls.

---

## 3. API Reference

### Authentication (`/api/auth`)
- `POST /api/auth/register` — Register a new account (`student` or `teacher`).
- `POST /api/auth/login` — Authenticate and receive `HttpOnly`, `SameSite=Strict` cookie.
- `POST /api/auth/logout` — Revoke session cookie.
- `GET /api/auth/me` — Retrieve active user session and role.

### Multi-Source Quiz Generation (`/api/quizzes`)
- `POST /api/quizzes/generate` — Generate quiz from freeform topic and difficulty.
- `POST /api/quizzes/generate/pdf` — Multipart upload for PDF document processing.
- `POST /api/quizzes/generate/url` — Ingest web page with SSRF protection.
- `POST /api/quizzes/generate/image` — Ingest image with multimodal vision parsing.
- `GET /api/jobs/:jobId` — Poll status of asynchronous generation pipelines.

### Quiz Studio & Sharing (`/api/quizzes`)
- `GET /api/quizzes/:quizId/studio` — Fetch full quiz structure, questions, and answers for editing.
- `PUT /api/quizzes/:quizId/studio` — Save modifications to questions, choices, and explanations.
- `POST /api/quizzes/:quizId/publish` — Publish quiz and generate public share code.
- `POST /api/quizzes/:quizId/unpublish` — Revert quiz to draft mode and revoke public link.
- `GET /api/quizzes/share/:shareCode` — Public landing page data (sanitized, zero answer leaks).
- `POST /api/quizzes/share/:shareCode/start` — Start attempt session from share link.

### Quiz Execution & Scoring (`/api/attempts`)
- `GET /api/attempts/:attemptId` — Fetch sanitized active question set.
- `PATCH /api/attempts/:attemptId/answers` — Autosave choice selection.
- `POST /api/attempts/:attemptId/submit` — Finalize attempt and compute score.
- `GET /api/attempts/:attemptId/results` — Fetch detailed evaluation report and explanations.

### Classrooms & Assignments (`/api/classrooms`)
- `POST /api/classrooms` — Create classroom (Teacher only).
- `GET /api/classrooms` — List enrolled classrooms.
- `POST /api/classrooms/join` — Join classroom using 6-character code (Student).
- `POST /api/classrooms/:classroomId/assignments` — Assign quiz to class.
- `GET /api/classrooms/student/assignments` — List student assignments with due dates.

### System & Health (`/api/health`)
- `GET /api/health` — Probes SQLite database query (`SELECT 1`), reports server uptime and WAL status.

---

## 4. Quick Start & Local Development

### Prerequisites
- **Node.js 22+**
- **pnpm 9+** (`npm install -g pnpm`)

### Setup Instructions
```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env
# Set your GEMINI_API_KEY and JWT_SECRET

# 3. Apply database migrations
pnpm db:migrate

# 4. Start full-stack development servers
pnpm dev
```

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:4000`

### Running Automated Tests
```bash
# Run all 131 tests across all packages
pnpm test

# Run TypeScript typechecks
pnpm typecheck

# Build all packages for production
pnpm build
```

---

## 5. Docker Deployment

Deploy QuizForge using Docker Compose:

```bash
docker compose up -d --build
```

Access the application at `http://localhost`. See the [Production Deployment Guide](docs/deployment-guide.md) for volume configuration, backup strategies, and reverse proxy settings.

---

## 6. License

This project is licensed under the MIT License.
