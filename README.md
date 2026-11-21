# QuizForge — AI-Powered MCQ Quiz Platform

**QuizForge** is an enterprise-grade full-stack multiple-choice quiz platform powered by Google Gemini 2.5 Flash. It enables authenticated users to dynamically generate custom quizzes on any topic, attempt them through an interactive single-question interface with real-time autosaving, examine authoritative answer explanations, and retake quizzes in a freshly shuffled order with zero AI API costs.

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
| **AI Integration** | **Google Gen AI SDK (`@google/genai`)** | Server-side Gemini 2.5 Flash with structured JSON `responseSchema` and retries. |
| **Authentication** | **JWT via `jose` + `bcryptjs`** | Stateless sessions stored in `HttpOnly`, `SameSite=Strict`, `Secure` cookies. |
| **Testing** | **Vitest 3** | Fast automated unit, integration, and end-to-end test suites. |

---

## 2. Core Functional Requirements & Lifecycle

QuizForge strictly implements all 10 core product requirements:

1. **Authentication:** User registration, password hashing (12 salt rounds), login, and session restoration.
2. **AI Generation:** Server-side Gemini 2.5 Flash integration via an adapter pattern (`IAIQuestionGenerator`). The Gemini API key is never exposed to the frontend.
3. **Difficulty Tiers:** Support for `Easy`, `Medium`, `Hard`, and `Mixed` assessment levels with difficulty-tailored system prompts.
4. **Data Contract & Two-Tier Validation:** AI outputs are validated by Gemini structured schemas and verified by Zod runtime domain rules (enforcing exactly 4 unique choices `A`, `B`, `C`, `D`, unique distractors, and no duplicate questions).
5. **Interactive Single-Question Player:** Displays one question at a time with option selection, progress bar, and autosave feedback.
6. **Navigation & Answer Persistence:** Previous and Next buttons with answer preservation across page transitions.
7. **Question Navigation Palette:** Interactive palette visually distinguishing Answered (emerald badge), Unanswered (slate badge), and Current Active (indigo ring) questions with jump-to-question navigation.
8. **Anti-Cheat Security:** Correct choice IDs and explanations remain strictly server-side until the attempt is submitted.
9. **Server-Side Scoring:** Scores and accuracy percentages are calculated on the server. Never trusts client-reported scores.
10. **Three Distinct Lifecycle Operations:**
    - **Restart Quiz:** Reuses existing database questions, creates a new attempt, shuffles presentation order via Fisher-Yates, and resets answers with **zero Gemini API calls**.
    - **Next Quiz:** Generates fresh questions via Google Gemini as a separate quiz entity.
    - **History:** Paginated record of user's past completed attempts with score reviews and retake triggers.

---

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

Run the comprehensive automated test suite (45 automated tests covering database integrity, WAL mode, foreign keys, authentication, AI schemas, quiz engine, anti-tampering, security headers, and the complete 10-step lifecycle):

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
