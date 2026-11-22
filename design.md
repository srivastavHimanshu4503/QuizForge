# QuizForge — Design System & UI Specification (`design.md`)

> **Stack:** React 19 + Tailwind CSS (`apps/frontend`), Fastify v5 (`apps/backend`), SQLite + Drizzle ORM, Multi-LLM Providers (Groq, NVIDIA NIM, Google Gemini).  
> **Visual Reference:** Uploaded Cyberverdict template (`Login.png`, `Dashboard.png`, `Recent Quiz.png`) — bright off-white canvas, pure white soft-shadow cards, vibrant royal blue `#1935CA` primary accent, clean pill navigation, and high-contrast developer code blocks.

---

## 1. Visual Design Tokens

Add these tokens to `apps/frontend/src/index.css` (and map in Tailwind theme config):

```css
:root {
  /* Surfaces */
  --bg-canvas: #F8F9FC;           /* Bright cool-warm off-white */
  --bg-surface: #FFFFFF;          /* Elevated card & sidebar surface */
  --bg-surface-muted: #F1F5F9;    /* Subtle badge / hover surface */
  --bg-code: #0F172A;             /* High-contrast code snippet container */

  /* Brand Accent (Royal Blue from Template) */
  --brand-primary: #1935CA;
  --brand-primary-hover: #142BA3;
  --brand-primary-light: #2546F0;
  --brand-primary-tint: #EEF2FF;
  --brand-cyan-accent: #38BDF8;   /* Editorial quote mark & highlight */

  /* Typography */
  --text-primary: #1E293B;
  --text-heading-brand: #1935CA;
  --text-secondary: #475569;
  --text-muted: #696F79;
  --text-inverse: #FFFFFF;

  /* Semantic & Grading Rubric Colors */
  --score-high: #10B981;          /* Emerald: Accuracy / Identified concepts */
  --score-high-bg: #ECFDF5;
  --score-mid: #F59E0B;           /* Amber: Partial mastery */
  --score-mid-bg: #FFFBEB;
  --score-low: #EF4444;           /* Rose: Missed concepts / errors */
  --score-low-bg: #FEF2F2;
  --provider-groq: #F97316;
  --provider-nvidia: #76B900;
  --provider-gemini: #2563EB;

  /* Elevation & Geometry (Soft-Shadow, Borderless Card Aesthetic) */
  --shadow-card: 0 10px 30px rgba(25, 53, 202, 0.05);
  --shadow-input: 0 4px 16px rgba(15, 23, 42, 0.05);
  --shadow-button: 0 8px 20px rgba(25, 53, 202, 0.22);
  --radius-card: 20px;
  --radius-control: 12px;
  --radius-pill: 9999px;
}
```

### Typography
- **UI Sans:** `Poppins` or `Plus Jakarta Sans` (clean geometric feel matching the uploaded template).
- **Code Monospace:** `JetBrains Mono` or `Fira Code` (for GitHub code snippets and line numbers).
- **Hierarchy:**
  - Page / Section Brand Titles (`Dashboard`, `Featured Assessments`, `Recent Quizzes`, `Login to your Account`): `20px–26px`, `font-bold`, `#1935CA`.
  - Card Titles: `16px–18px`, `font-semibold`, `#1E293B`.
  - Body Copy: `14px`, `leading-relaxed`, `#475569`.
  - Metadata / Pills / Breadcrumbs: `12px–13px`, `font-medium`, `#696F79`.

---

## 2. Application Shell & Layout Grid

### Authenticated Shell (`AppLayout`)
- **Desktop (`>= 1024px`):**
  - **Left Sidebar (`w-[240px] shrink-0 bg-white h-screen sticky top-0 flex flex-col justify-between p-5`):**
    - **Brand Header:** Circular `#1935CA` QuizForge emblem + bold `#1935CA` `QuizForge` wordmark.
    - **Navigation Links:**
      - Active item: Solid `#1935CA` rounded pill (`rounded-xl py-3 px-4 text-white font-semibold shadow-[var(--shadow-button)]`).
      - Inactive items (`Dashboard`, `GitHub Code Review`, `MCQ Quizzes`, `Quiz History`): Clean `#696F79` text with subtle icon hover to `#1935CA`.
    - **Bottom Quick-Launch Card (adapted from template's blue Support card):** Vibrant gradient card (`bg-gradient-to-br from-[#1935CA] to-[#2546F0] rounded-2xl p-5 text-white`) titled **`Code Review AI`** with short subtitle (`Analyze any public GitHub repo`) and crisp white **`Start`** button that opens `CodeQuizModal`.
    - **Footer:** `Log Out` button with icon pinned at bottom.
  - **Top Utility Bar (`h-20 px-8 flex items-center justify-between`):**
    - Wide borderless soft-shadow search input (`bg-white rounded-xl shadow-[var(--shadow-input)] px-4 py-3`, placeholder `Search quizzes, repos, or topics...`).
    - Right controls: `#1935CA` **`Start Quiz`** primary button (`rounded-xl px-6 py-3 text-white font-semibold`) + user avatar & display name.
  - **Main Canvas (`bg-[#F8F9FC] flex-1 min-w-0 px-8 pb-10`):** Holds center content (and optional right rail on Dashboard).

---

## 3. Screen-by-Screen Blueprints

### 1. Login / Register (`LoginPage`)
Matches `Login.png` 50/50 split-screen:
- **Left Half (`hidden lg:flex`):** Royal blue `#1935CA` translucent overlay over blurred editorial background; cyan opening quote icon (`#38BDF8`), concise white engineering/learning quote, attribution, and minimalist white L-corner bracket accent.
- **Right Half (`bg-white`):** Top-left `QuizForge` logo; centered auth stack (`max-w-[400px]`): `#1935CA` H1 `Login to your Account`, blue subtitle, soft-shadow borderless white inputs (`Email address*`, `Enter password*` with `Show` toggle), `Remember my password` checkbox, full-width `#1935CA` `Login` button, `or` divider, secondary soft-shadow button, and `#1935CA` `Forgot Password?` link.

### 2. Dashboard (`DashboardPage.tsx`)
Matches `Dashboard.png` 3-column desktop layout (`Left Sidebar` + `Center Main` + `Right Rail w-[290px]`):
- **Center — Profile & Progress Hero Card (`bg-white rounded-[20px] p-6 shadow-[var(--shadow-card)]`):**
  - Rounded square user avatar + bold `#1935CA` username + subtitle (e.g., `Code Review Mastery • Lv 12`) + royal blue horizontal progress bar.
  - 3 stat tiles with soft-shadow white square icon boxes (`#1935CA` icons): **Quizzes Passed**, **Avg Rubric Score / Fastest Time**, **Questions Graded**.
- **Center — In-Progress Code Review Recovery Banner (Conditional):**
  - Soft `#EEF2FF` rounded-2xl banner directly below hero stats when an active `code_attempts` session exists: repo name (`owner/repo`), answered count (`3/5 evaluated`), and `#1935CA` **`Resume Review →`** button.
- **Center — 3-Card Assessment Grid (`Featured Modes`, matching template's 3-card row):**
  - 3 rounded (`20px`) rich visual/gradient cards with top-left white pill badge and frosted glass bottom title bar:
    1. **GitHub Code Review** (badge: `Multi-LLM AI`) — opens `CodeQuizModal`.
    2. **Topic MCQ Quiz** (badge: `Timed MCQ`) — launches MCQ generator.
    3. **Quiz History** (badge: `Review & Retake`) — routes to `/history`.
- **Right Rail (`bg-white rounded-[20px] p-5 shadow-[var(--shadow-card)]`):**
  - **Active LLM Providers** (replaces "Other Users Online"): Compact status grid from `GET /api/llm/providers` showing Groq (Llama 3.3 70B), NVIDIA NIM, and Gemini 2.5 Flash availability indicators.
  - **Mastery Badges** (replaces "Achievements"): 3 crisp badge icons (`Deep Reviewer`, `Zero Misses`, `Streak`).
  - **Recent Activity & Retakes** (replaces "Reminders"): Compact list with `#1935CA` circular icon badges linking directly to recent results or retakes.

### 3. GitHub Code Review Setup Modal (`CodeQuizModal.tsx`)
- Centered elevated white modal (`rounded-[24px] p-7 shadow-2xl max-w-xl w-full`).
- Royal blue header (`New GitHub Code Review`) + close button.
- **GitHub Repository URL** input with clickable preset repo chips below.
- **LLM Provider Selector** dropdown/cards dynamically populated from `GET /api/llm/providers` (showing provider badge + model name).
- **Question Count Slider** (`3–10 questions`) with royal blue thumb & live count pill.
- Optional collapsible **Advanced Focus** (`Subfolder path`, `Focus area`).
- Full-width `#1935CA` **`Generate Code Review`** button with multi-step progress feedback while `POST /api/code-quizzes/generate` runs.

### 4. Code Quiz Player (`CodeQuizPlayerPage.tsx`)
Adapts `Recent Quiz.png` (clean white card framing a dark high-contrast media/code block + right-hand context panel):
- **Top Bar:** Breadcrumb (`Dashboard / GitHub Code Reviews / owner/repo`), horizontal **Question Matrix Palette** (numbered pills: `#1935CA` current, emerald evaluated, gray unanswered), and `Submit Review` button.
- **Main 2-Column Workspace (`grid-cols-1 lg:grid-cols-12 gap-6`):**
  - **Left (`lg:col-span-7`):** White rounded-2xl card containing the **Code Snippet Viewer** (`bg-[#0F172A] text-slate-100 rounded-xl overflow-hidden`): top file-path bar (`apps/backend/src/services/github.service.ts • Lines 42–88`) + difficulty pill, followed by `JetBrains Mono` code with crisp gutter line numbers.
  - **Right (`lg:col-span-5`):** White rounded-2xl card with the adversarial question, expandable answer textarea (`bg-[#F8F9FC] rounded-xl`), `#1935CA` **`Evaluate with LLM`** button, and inline **Instant Grading Critique** card displaying `Score (0–10)` + 3 color-coded rubric bars (**Accuracy 0–4**, **Depth 0–3**, **Completeness 0–3**) + constructive LLM feedback.
- **Engineering Guardrail:** Keep `attemptRef` and stable `useCallback` deps (`[attemptId, storageKey]`) so `fetchAttempt` never re-triggers in a loop against Fastify's 120 req/min rate limiter.

### 5. Code Quiz Results (`CodeQuizResultsPage.tsx`)
- **Top Header:** Breadcrumb + **`Retake Code Review`** (`POST /api/code-quizzes/:quizId/restart` — zero LLM calls) + **`All Quizzes`** secondary button.
- **Hero Summary Card:** Total score ring/fraction, mastery badge, repository + LLM provider metadata, and aggregate **Accuracy / Depth / Completeness** progress bars.
- **Per-Question Breakdown Cards:** Expandable/stacked white cards showing file snippet reference, user's answer, `X/10` score pill, rubric bars, **Identified Concepts** (`#ECFDF5` / `#10B981` pills), **Missed Concepts** (`#FEF2F2` / `#EF4444` pills), and LLM critique.

### 6. Unified Quiz History (`HistoryPage.tsx`)
- White elevated container (`rounded-[20px] shadow-[var(--shadow-card)] p-6`).
- **3 Filter Tabs** synced with `?type=all|code|mcq`: `All Quizzes`, `GitHub Code Reviews`, `MCQ Quizzes` (active tab uses `#1935CA` pill or bold blue underline).
- Clean scannable rows showing mode badge (`Code Review` vs `MCQ`), repo/topic title, LLM provider pill, score percentage bar, completed timestamp, **`Review`** link (`/code-quiz/:attemptId/results`), and **`Retake`** button (`POST /api/code-quizzes/:quizId/restart` → `/code-quiz/:newAttemptId`).

---

## 4. Mobile & Tablet Responsive Rules (`< 1024px`)

- **Navigation:** Collapse the fixed white left sidebar into a sticky `56px` white top bar (`QuizForge` logo + hamburger button) opening a smooth slide-over drawer with `Dashboard`, `GitHub Code Review`, `MCQ Quizzes`, `Quiz History`, the blue `Code Review AI` card, and `Log Out`.
- **Dashboard:** Stack Center Main above the Right Rail; 3-card assessment grid becomes `1` column on mobile (`< 640px`) and `2` columns on tablet (`640px–1023px`); 3 stat tiles wrap cleanly.
- **Code Quiz Player:** Stack Code Snippet Viewer above Question/Textarea card; allow horizontal scrolling inside the dark code block (`overflow-x-auto`) while keeping zero page-level horizontal overflow; Question Matrix Palette becomes a horizontal scroll strip.
- **History & Results:** Convert wide history rows into stacked white cards with `Review` and `Retake` buttons aligned along the bottom row (`44×44px` minimum tap targets).
