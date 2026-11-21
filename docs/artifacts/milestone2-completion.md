# QuizForge — Milestone 2: RBAC & Classroom / Assignment Engine (Completed)

> **Milestone Status:** ✅ **COMPLETE & VERIFIED**  
> **Test Status:** **94/94 Tests Passing** (11 Test Suites, 17 New Tests)  
> **Typecheck:** 0 Errors across all packages (`@quiz-forge/shared`, `@quiz-forge/backend`, `@quiz-forge/frontend`)  
> **Production Build:** Clean builds for all 3 monorepo packages (`shared`, `backend`, `frontend`)

---

## 1. Objectives Delivered

| Task | Scope | Status | Details |
|---|---|---|---|
| **User Role System** | Shared & Backend | ✅ Complete | Added `role: 'student' \| 'teacher' \| 'admin'` to `users` table with `'student'` default. Updated registration, authentication cookies, JWT payloads, and user profiles. |
| **Classrooms & Membership Schemas** | DB & Drizzle | ✅ Complete | Added `classrooms` and `classroom_members` tables with unique join codes (`code`) and unique enrollment indices. Applied Drizzle migration `0002_violet_peter_quill.sql`. |
| **Quiz Assignments Schema** | DB & Drizzle | ✅ Complete | Added `quiz_assignments` table supporting due dates, maximum attempt limits (`maxAttempts`), time limits, and feedback visibility settings. |
| **Multi-Taker Attempt Support** | DB Schema | ✅ Complete | Replaced single-user unique index with `uniqueIndex('attempts_quiz_user_attempt_number_idx')` on `(quiz_id, user_id, attempt_number)` and added `assignment_id` foreign key. |
| **Role-Based Authorization Middleware** | Backend Plugin | ✅ Complete | Implemented `requireRole(['teacher', 'admin'])` decorator guard in Fastify auth plugin returning `403 Forbidden` on unauthorized access. |
| **Classroom & Assignment Service & APIs** | Backend Routes | ✅ Complete | Implemented full API suite: `POST /api/classrooms`, `GET /api/classrooms`, `POST /api/classrooms/join`, `POST /api/classrooms/assignments`, `GET /api/classrooms/assignments/student`, `POST /api/classrooms/assignments/:id/start`, and `GET /api/classrooms/assignments/:id/submissions`. |
| **Frontend Instructor Studio** | `ClassroomsPage.tsx` | ✅ Complete | Built Instructor Studio allowing teachers to create classes, share join codes, inspect enrolled rosters, assign quizzes with parameters, and review student submission gradebooks. |
| **Frontend Student Assigned Tasks** | `StudentAssignmentsPage.tsx` | ✅ Complete | Built student assignment portal with filterable status tabs (All, Pending, Completed, Overdue), attempt counters, due date indicators, and direct player integration. |
| **Navigation & Role UI** | Navbar & Dashboard | ✅ Complete | Added role indicator badges in navigation, dynamic links for Instructor/Student views, and a dedicated Classrooms card on the dashboard. |
| **Automated Test Suite** | `classroom.test.ts` | ✅ Complete | 17 comprehensive tests covering teacher registration, student registration, role guards, code enrollment, duplicate protection, assignment creation, student attempt lifecycle, attempt limit enforcement, and gradebook access. |
| **Artifact Mirroring** | `docs/artifacts/` | ✅ Complete | Mirrored artifact into `docs/artifacts/milestone2-completion.md`. |

---

## 2. Verification Evidence

### 2.1 Test Suite (Vitest)
```text
 ✓ src/test/github-service.test.ts (13 tests) 10ms
 ✓ src/test/llm-providers.test.ts (14 tests) 31ms
 ✓ src/test/ai.test.ts (8 tests) 31ms
 ✓ src/test/db.test.ts (6 tests) 64ms
 ✓ src/test/health.test.ts (1 test) 397ms
 ✓ src/test/code-quiz.test.ts (2 tests) 928ms
 ✓ src/test/quiz-engine.test.ts (8 tests) 1341ms
 ✓ src/test/security.test.ts (7 tests) 1360ms
 ✓ src/test/e2e-lifecycle.test.ts (7 tests) 1434ms
 ✓ src/test/classroom.test.ts (17 tests) 1446ms
 ✓ src/test/auth.test.ts (11 tests) 1704ms

 Test Files  11 passed (11)
      Tests  94 passed (94)
   Duration  5.14s
```

### 2.2 Strict Typecheck
```text
packages/shared typecheck: Done (tsc --noEmit)
apps/backend typecheck: Done (tsc --noEmit)
apps/frontend typecheck: Done (tsc --noEmit)
```

### 2.3 Production Build
```text
dist/index.html                   0.54 kB │ gzip:   0.37 kB
dist/assets/index-B2zIY3aI.css   36.22 kB │ gzip:   6.73 kB
dist/assets/index-DSF82PqG.js   416.94 kB │ gzip: 111.57 kB
✓ built in 3.72s
```

---

## 3. Key Architecture Files Introduced / Updated

- [classrooms.ts](file:///E:/Personal%20projects/Quiz%20Application/apps/backend/src/db/schema/classrooms.ts) — Classroom database schema with join code index.
- [classroom-members.ts](file:///E:/Personal%20projects/Quiz%20Application/apps/backend/src/db/schema/classroom-members.ts) — Student enrollment mapping with unique compound index.
- [quiz-assignments.ts](file:///E:/Personal%20projects/Quiz%20Application/apps/backend/src/db/schema/quiz-assignments.ts) — Assignment configuration schema with due dates and attempt limits.
- [classroom.service.ts](file:///E:/Personal%20projects/Quiz%20Application/apps/backend/src/services/classroom.service.ts) — Complete business logic for classroom cohorts, join code generation, assignments, and submission tracking.
- [classroom.routes.ts](file:///E:/Personal%20projects/Quiz%20Application/apps/backend/src/routes/classroom.routes.ts) — Fastify routes protected by `requireRole` guards.
- [classroom.test.ts](file:///E:/Personal%20projects/Quiz%20Application/apps/backend/src/test/classroom.test.ts) — 17 automated end-to-end RBAC and assignment lifecycle tests.
- [ClassroomsPage.tsx](file:///E:/Personal%20projects/Quiz%20Application/apps/frontend/src/pages/ClassroomsPage.tsx) — Teacher/Student classroom management UI.
- [StudentAssignmentsPage.tsx](file:///E:/Personal%20projects/Quiz%20Application/apps/frontend/src/pages/StudentAssignmentsPage.tsx) — Student assigned tasks view with direct attempt launching.
