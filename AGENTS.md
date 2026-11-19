# AGENTS.md · instructions for coding agents

Sriborisud Dry Cleaning (ศรีบริสุทธิ์ ซักแห้ง) — piece-level garment tracking for a small dry-cleaning shop.
One Next.js 15 app (App Router) on Vercel, PostgreSQL on Supabase via Prisma 6, customers use LINE LIFF.

## Read first

1. `docs/spec/SYSTEM-SPEC.md` — **the design source of truth**: decisions, features F01–F22, every table and column, every Server Action, routes, pages, permissions, settings, open questions. Thai text.
2. `docs/spec/spec.json` — the same content, machine-readable.
3. `docs/spec/system-design.html` — the same content as a browsable page, with rough wireframes.
4. `README.md` (commands, env, structure) and `docs/CODE-WALKTHROUGH.md` (how existing code works).

If the spec and older docs disagree (`docs/ERD-TARGET.md`, `docs/ARCHITECTURE.md` module list, `design/screens.html`, B1–B5/N1–N4 codes), **the spec wins**.

## Setup and checks

```bash
./scripts/dev.sh            # Postgres in Docker on port 5433 + migrate + seed + dev server
npm run typecheck && npm run lint && npm test && npm run build   # must pass before every commit
npm run db:migrate -- --name <name>   # after editing prisma/schema.prisma
npm run db:erd              # regenerate docs/ERD.md (CI fails if it drifts)
```

## Rules

- **Layering is enforced by eslint**: `src/app` → `src/modules/<feature>` (via its `index.ts` only) → `src/lib`. UI never imports `@/lib/db` or `@prisma/client`.
- Module files: `schema.ts` (zod) · `repository.ts` (Prisma only) · `service.ts` (business rules, unit-tested) · `actions.ts` (`"use server"`, no business rules) · `index.ts` (export actions and types only — never anything that pulls `node:crypto` into client bundles).
- Every Server Action: auth guard first line → zod parse of `raw: unknown` → service → `revalidatePath`. Return `Result<T>` as in `src/modules/customer/service.ts`.
- Money is integer satang (`src/lib/money.ts`). Phones go through `src/lib/phone.ts`. LINE identity only from `src/lib/line-id-token.ts`.
- **Never invent shop numbers** (prices, wage rates, turnaround days, daily capacity, drying times). Use `null`, a `Setting` row, or show "—". Open questions are listed in spec §13.
- StatusEvent is append-only. Change piece status and `Piece.status`/`currentSlotId` in one `db.$transaction`.
- Store dates in UTC; compute "days" in Asia/Bangkok.
- UI text in Thai. Use design tokens from `src/app/globals.css`.
- Commit `prisma/migrations/`. Never commit real secrets. Work on `feature/<name>`, PR into `develop`.

## Order of work

Follow spec §3 phases. Phase 1 (owner login F01, remove `/dev/qr` from production, real catalog F06) **must land before any real customer data** — the current app has no authentication.

## Definition of done (per feature)

Schema + migration + ERD regenerated · service tests cover every rule listed under the feature · actions guarded and validated · pages listed under the feature exist · all checks pass · update the feature's status in `SYSTEM-SPEC.md` and `spec.json`.

## When blocked

If a feature needs an answer from the shop, build it with the value configurable or null, add a `// TODO(Qxx)` referencing the spec question code, and continue. Do not guess.
