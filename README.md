# QuizForge — AI-Powered Quiz & Assessment Platform

**QuizForge** is an enterprise-grade, multi-source knowledge assessment platform powered by an interchangeable multi-LLM engine (Groq, NVIDIA NIM, Google Gemini). It enables authenticated users to generate quizzes across topics, perform adversarial code-review assessments on public GitHub repositories, attempt quizzes through an interactive single-question interface with real-time autosaving, examine pedagogical explanations, and retake quizzes in a freshly shuffled order with zero AI API costs.

---

## 1. System Architecture & Tech Stack

```text
quiz-forge/
├── packages/
│   └── shared/           # Zod schemas, data contracts & inferred TypeScript types
└── apps/
    ├── backend/          # Node.js 22 + Fastify + Drizzle ORM + SQLite (WAL mode)
    └── frontend/         # React 19 + Vite + Tailwind CSS + Lucide Icons
```

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Workspace** | **pnpm Workspaces** | Strict package isolation, disk-efficient dependency deduplication. |
| **Backend API** | **Fastify 5 (TypeScript)** | High-throughput HTTP API with encapsulation plugins and schema validation. |
| **Frontend SPA** | **React 19 + Vite 6** | Ultra-responsive client-side SPA with instant Hot Module Replacement (HMR). |
| **Styling** | **Tailwind CSS 3** | Modern dark-mode interface with accessible components. |
| **Database & ORM** | **SQLite (better-sqlite3) + Drizzle ORM** | High-performance WAL mode with foreign-key enforcement and migration pipeline. |
| **AI Integration** | **Multi-Provider Engine** | Groq (Llama 3.3 70B), NVIDIA NIM, Google Gemini (2.5 Flash), and deterministic mock fallback. |
| **Authentication** | **JWT via `jose` + `bcryptjs`** | Stateless sessions stored in `HttpOnly`, `SameSite=Strict`, `Secure` cookies. |
| **Testing** | **Vitest 3** | Fast automated unit, integration, security, and end-to-end test suites (77+ tests). |

---

## 2. Core Capabilities

1. **Multi-Source Assessments:**
   - **Topic MCQ:** Conceptual and factual multiple-choice assessments generated from user prompts and difficulty levels.
   - **GitHub Code Review:** Adversarial code comprehension assessments analyzing public repositories with tiered file priority and comment intent detection.
2. **Universal Multi-LLM Provider Engine:**
   - Interchangeable provider registry supporting **Groq**, **NVIDIA NIM**, **Google Gemini**, and local **Mock**.
   - Automatic fallback and structured Zod output validation.
3. **Interactive Player & Anti-Cheat:**
   - Displays questions with interactive palette, progress indicators, and optimistic autosave.
   - Correct answers and pedagogical explanations are strictly withheld server-side until final submission.
4. **Scoring & Qualitative Evaluation:**
   - Server-side scoring for MCQs; 0–10 rubric-based semantic evaluation with feedback for open-ended code review answers.
5. **Zero-AI Retakes:**
   - Quizzes can be restarted with shuffled question orders preserving original questions without additional AI API costs.
6. **Unified Quiz History:**
   - Single unified timeline across all assessment types (MCQ and Code Review) with filterable views.

## 3. Database Schema

A normalized relational schema managed with Drizzle ORM and SQLite (WAL mode):

- **`users`:** `id` (UUID PK), `email` (unique), `password_hash`, `display_name`, timestamps.
- **`quizzes`:** `id` (UUID PK), `user_id` (FK), `topic`, `difficulty`, `question_count`, `ai_model`, `created_at`.
- **`questions`:** `id` (UUID PK), `quiz_id` (FK), `question_order` (1..N), `question_text`, `correct_choice_id`, `explanation`, `created_at`. Unique constraint on `(quiz_id, question_order)`.
- **`choices`:** `id` (UUID PK), `question_id` (FK), `choice_id` ('A'|'B'|'C'|'D'), `option_text`. Unique constraint on `(question_id, choice_id)`.
- **`quiz_attempts`:** `id` (UUID PK), `quiz_id` (FK), `user_id` (FK), `attempt_number` (INT), `status` ('in_progress' | 'completed'), `shuffled_order` (JSON array of question IDs), `score`, `total_questions`, `correct_count`, `incorrect_count`, `unanswered_count`, `accuracy_percentage`, `started_at`, `completed_at`.
- **`attempt_answers`:** `id` (UUID PK), `attempt_id` (FK), `question_id` (FK), `selected_choice_id` ('A'|'B'|'C'|'D' | null), `is_correct` (boolean), `answered_at`. Unique on `(attempt_id, question_id)`.

---

## 4. API Endpoints

### Authentication
- `POST /api/auth/register` — Create account, set HTTP-Only session cookie.
- `POST /api/auth/login` — Authenticate credentials, set session cookie.
- `POST /api/auth/logout` — Invalidate session cookie.
- `GET /api/auth/me` — Return authenticated user profile.

### Quizzes & Lifecycle
- `POST /api/quizzes/generate` — Generate quiz via Gemini, persist in DB, initialize Attempt #1 with shuffled order.
- `GET /api/quizzes/:quizId` — Get quiz metadata.
- `POST /api/quizzes/:quizId/restart` — Create new attempt reusing existing questions with freshly shuffled order (zero AI calls).

### Attempts & Scoring
- `GET /api/attempts/:attemptId` — Return sanitized active attempt (answers and explanations hidden).
- `PATCH /api/attempts/:attemptId/answers` — Autosave selected choice in real-time.
- `POST /api/attempts/:attemptId/submit` — Finalize attempt, calculate score server-side, and return review with explanations.
- `GET /api/attempts/:attemptId/results` — Fetch complete review for completed attempt.

### History
- `GET /api/history?page=1&limit=10` — Paginated history of user's past completed attempts.

### System
- `GET /api/health` — Health check returning server uptime, environment, and SQLite WAL database status.

---

## 5. Local Setup & Getting Started

### Prerequisites
- Node.js 22+ (LTS)
- pnpm 11+ (`npm install -g pnpm`)

### Installation & Environment Setup
1. Clone the repository and install dependencies:
   ```bash
   pnpm install
   ```

2. Configure environment variables:
   Copy `.env.example` to `.env` (or configure in `apps/backend/.env`):
   ```ini
   PORT=4000
   HOST=0.0.0.0
   NODE_ENV=development
   DATABASE_URL=quizforge.db
   JWT_SECRET=quizforge-dev-secret-key-32-chars-minimum-secure-jwt
   CORS_ORIGIN=http://localhost:5173
   GEMINI_API_KEY=your_gemini_api_key_here
   GEMINI_MODEL=gemini-2.5-flash
   ```
   *(Note: If `GEMINI_API_KEY` is not provided, the server automatically defaults to the high-fidelity mock generator for offline development and testing.)*

3. Run database migrations:
   ```bash
   pnpm db:migrate
   ```

4. Start both backend and frontend servers in development mode:
   ```bash
   pnpm dev
   ```
   - **Frontend App:** http://localhost:5173
   - **Backend API:** http://localhost:4000
   - **Health Check:** http://localhost:4000/api/health

---

## 6. Testing & Quality Assurance

Run the comprehensive automated test suite (77+ automated tests across 10 test suites covering database integrity, WAL mode, foreign keys, authentication, AI schemas, quiz engine, anti-tampering, security headers, GitHub code ingestion, multi-LLM providers, and the complete quiz lifecycle):

```bash
# Run all automated tests
pnpm test

# Run strict TypeScript typechecks across all packages
pnpm typecheck

# Build all packages for production
pnpm build
```

---

## 7. Security Architecture

1. **Zero Secret Leakage:** The `GEMINI_API_KEY` resides exclusively in server memory. Vite is configured to never bundle server environment variables.
2. **Cheat Prevention:** Correct choices and explanations are omitted from the active attempt payload and are only accessible once the attempt is in `completed` status.
3. **Stateless HTTP-Only Sessions:** JWTs are delivered exclusively via `HttpOnly`, `SameSite=Strict`, `Secure` cookies, eliminating XSS and CSRF token theft.
4. **Multi-Tenancy Isolation:** Every database query enforces ownership matching `request.user.id`. Cross-user tampering is blocked.
5. **Security Headers & Rate Limiting:** Protected with OWASP-recommended headers via `@fastify/helmet` and abuse rate limiting via `@fastify/rate-limit`.
