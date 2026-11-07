# Project Architecture

Sriborisud Laundry · one Next.js repository, three sub-applications.

> Written in English because it is almost entirely file paths and import rules.
> User-facing docs and code comments stay in Thai.

---

## 1 · What this document decides

| Question | Answer | Section |
|---|---|---|
| One repo or three? | **One** | §4 |
| How do three apps live in one `app/` folder? | **Route groups with separate root layouts** | §5 |
| Where does business logic go? | **`src/modules/<feature>/`** — never in `app/` | §6 |
| What may import what? | **Four rules, enforced by lint** | §7 |
| Server Components or Client? | **Server by default, except the scan app** | §8 |
| How do I trace code back to the report? | **Grep-able `// PP13 // UC10 // BR4` comments** | §10 |

---

## 2 · Three structures considered

### A · Type-based (the structure in the Towards Dev article)

```
components/   lib/   actions/   hooks/   styles/
```

Everything grouped by *what kind of file it is*.

**Good:** zero decisions to make, every Next.js tutorial uses it, easy to start.

**Why it fails here:** this project has three applications sharing one domain. With type-based folders, adding one feature — say "send a reminder for uncollected items" — touches `actions/`, `lib/`, `hooks/`, and `components/`, four folders with nothing connecting them. At 42 features and ~19 tables, `lib/` becomes a 40-file drawer nobody can navigate. The article itself warns about "poor folder structure" while recommending the structure that produces it at scale.

Its *principles* are sound and this project adopts most of them (§8). Its *folder layout* is not.

### B · Feature-first (bulletproof-react style)

```
features/<name>/{api,components,hooks,types,utils}/
```

Everything for one feature in one folder. Shared code is promoted out only when genuinely generic.

**Good:** adding a feature means creating one folder. Deleting a feature means deleting one folder. Matches how work actually arrives.

**Weak point for us:** it has no opinion on *where the database line is*. In a project whose entire premise is an append-only event log, "which file is allowed to touch Prisma" is the single most important rule, and this pattern does not answer it.

### C · Feature-Sliced Design

```
app → pages → widgets → features → entities → shared
```

Six layers with strict one-directional imports.

**Good:** the strongest guarantees. Genuinely prevents architectural rot.

**Why not here:** FSD is widely recommended for 30+ pages and 6+ developers. This is 16 screens and one developer with ~150 build hours. The `widgets` and `entities` split would cost real time and buy almost nothing at this size. Choosing it would be resume-driven, not problem-driven.

### Verdict

| | Type-based | Feature-first | FSD | **Chosen** |
|---|---|---|---|---|
| 3 apps, different users | ✗ | ~ | ✓ | ✓ |
| Clear database boundary | ✗ | ✗ | ~ | ✓ |
| Solo dev, 150h | ✓ | ✓ | ✗ | ✓ |
| Delete a feature cleanly | ✗ | ✓ | ✓ | ✓ |
| Learnable in one sitting | ✓ | ✓ | ✗ | ✓ |

**Decision: feature-first for the domain, route groups for delivery, plus one explicit database boundary.** Feature-first's folder model, FSD's import discipline reduced to four rules, and the type-based article's Server Component principles.

---

## 3 · The structure

```
sriborisud-laundry/
├── docs/                          ← IS report material
│   ├── ARCHITECTURE.md            ← this file
│   ├── BASELINE.md                ← pre-system measurement (not started)
│   ├── STATE-MACHINE.md           ← 6 stages + business rules
│   ├── ERD.md
│   └── TRACEABILITY.md            ← PP → UC → feature → file
│
├── design/                        ← design system, reviewed in Figma
│   ├── design-system.html
│   ├── screens.html
│   ├── screen-flow.html
│   └── contrast-check.py
│
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts                    ← stages, clothes types, prices, wage rates
│
├── public/
│   ├── sw.js                      ← hand-written, deliberately not next-pwa
│   └── icon-{192,512}.png
│
└── src/
    ├── app/                       ← ROUTING ONLY · no business logic, ever
    │   ├── (customer)/            ← D1 · root layout 1
    │   ├── (front-office)/        ← D2 · root layout 2
    │   ├── (floor)/               ← D3 · root layout 3
    │   ├── api/                   ← only what cannot be a Server Action
    │   ├── manifest.ts
    │   └── globals.css            ← design tokens · single source of truth
    │
    ├── modules/                   ← THE DOMAIN · all business logic
    │   ├── tracking/              ← the state machine · the core
    │   ├── intake/
    │   ├── billing/
    │   ├── pickup/
    │   ├── payroll/
    │   ├── notification/
    │   └── config/
    │
    ├── components/
    │   ├── ui/                    ← knows nothing about laundry
    │   └── domain/                ← knows about stages and garments
    │
    └── lib/                       ← no domain, no React
```

Four top-level folders inside `src/`. If you cannot decide where something goes, §9 has a lookup table.

---

## 4 · Why one repository

Three apps could be three repos or a monorepo. Neither is right here.

**Three repos** would mean three copies of the state machine. The moment they drift — one app allows a transition another forbids — the data is corrupt and unrecoverable, because the event log is append-only. The whole value of the project is that all three apps agree on what stage a garment is in.

**A monorepo** (Turborepo, pnpm workspaces) solves code sharing properly but costs a shared-package build step, workspace config, and a more complicated Vercel deployment. For one developer deploying one product, that is overhead with no payoff.

**One repo, one Vercel project, three route groups.** One `schema.prisma`, one `transitions.ts`, one design token file. Three root layouts give each app its own chrome, auth, and fonts without duplicating anything.

The one documented cost: navigating between route groups with different root layouts triggers a **full page reload**. Here that is fine — a customer never opens the front office, and a presser never opens the customer app. The three audiences are disjoint, so the boundary that causes the reload is the same boundary that makes the apps separate.

---

## 5 · `app/` — routing only

Each route group has its own `layout.tsx` acting as a **root layout** (`<html>` and `<body>` live there, not in a shared parent). There is deliberately **no `src/app/layout.tsx`**.

```
src/app/
├── (customer)/                      D1 · ลูกค้า · LINE LIFF
│   ├── layout.tsx                   LIFF init · large type · no auth
│   ├── page.tsx                     C-02  ผ้าของฉัน              UC02
│   ├── link/page.tsx                C-01  ผูกบัญชี               UC01
│   ├── bill/[billNo]/page.tsx       C-03  รายละเอียดบิล          UC02
│   ├── pay/[billNo]/page.tsx        C-04  ชำระเงิน               UC03
│   └── _components/                 screen-specific only
│
├── (front-office)/                  D2 · หน้าร้าน · owner
│   ├── layout.tsx                   auth required · dense · sidebar
│   ├── page.tsx                     F-01  ภาพรวมร้าน             UC08
│   ├── intake/page.tsx              F-02  รับผ้าเข้า             UC04
│   ├── intake/[billNo]/labels/      F-03  พิมพ์ป้าย              UC04
│   ├── handover/page.tsx            F-04  ส่งมอบผ้า              UC05
│   ├── uncollected/page.tsx         F-05  ตามของค้างรับ          UC06
│   ├── payroll/page.tsx             F-06  คิดค่าแรง              UC07
│   ├── pieces/[pieceId]/edit/       F-07  แก้ไขรายการ            UC09
│   └── _components/
│
├── (floor)/                         D3 · แอปสแกน · staff
│   ├── layout.tsx                   PWA · 56px targets · offline shell
│   ├── scan/page.tsx                S-01  สแกน                   UC10
│   ├── scan/[code]/page.tsx         S-02  ยืนยันงาน              UC10 UC11
│   ├── queue/page.tsx               S-03  คิวงานของฉัน           UC12
│   ├── report/[pieceId]/page.tsx    S-04  แจ้งปัญหา              UC13
│   ├── offline/page.tsx             S-05  ออฟไลน์                UC10
│   └── _components/
│
├── api/
│   ├── line/webhook/route.ts        LINE must POST to a real endpoint
│   └── cron/uncollected/route.ts    Vercel Cron must GET a real endpoint
│
├── manifest.ts
└── globals.css
```

### Rules for `app/`

1. **A `page.tsx` is allowed to do three things**: read route params, call a module, render components. Nothing else.
2. **No Prisma import anywhere under `app/`.** If a page needs data, the module gives it.
3. **`_components/` is for components used by exactly one screen.** The underscore keeps the folder out of routing — an official Next.js convention. The moment a second screen needs it, it moves to `src/components/`.
4. **`api/` is a last resort.** Server Actions handle all internal mutations. A route handler exists only when an external system must call a URL — currently just the LINE webhook and the Vercel cron job.
5. **Screen IDs (`C-02`, `F-04`, `S-01`) stay in a comment at the top of each page**, matching `design/screens.html`. This is what lets the report say which screen implements which use case without guessing.

### Why `pieces/[pieceId]` and not `bills/[billNo]/pieces/...`

Partial pickup means a piece is the unit the system tracks, not a bill. A piece has its own identity, its own stage, and its own history. The URL reflects that. A bill is a grouping, and appears in the URL only where the customer thinks in bills (the customer app).

---

## 6 · `modules/` — the domain

Every module has the same five files. Learn once, applies everywhere.

```
src/modules/tracking/
├── index.ts            PUBLIC SURFACE — other modules import only this
├── schema.ts           zod schemas · shared by client and server
├── repository.ts        ← THE ONLY FILE IN THE MODULE ALLOWED TO IMPORT db
├── service.ts          business logic · pure where possible · unit tested
├── actions.ts          "use server" · thin wrapper
└── service.test.ts     tests service.ts only
```

### What each file is for

| File | Responsibility | Imports `db`? | Tested? |
|---|---|---|---|
| `schema.ts` | Shape and validation of inputs | no | via service |
| `repository.ts` | Prisma queries. No decisions, no rules | **yes — only here** | no |
| `service.ts` | All business rules and decisions | no | **yes** |
| `actions.ts` | validate → call service → `revalidatePath` | no | no |
| `index.ts` | Re-exports the public functions and types | no | — |

`actions.ts` should never be longer than a few lines per action:

```ts
"use server";

export async function recordWork(input: unknown) {
  const data = recordWorkSchema.parse(input);   // schema.ts
  const result = await trackingService.recordWork(data);  // service.ts
  revalidatePath("/queue");
  return result;
}
```

If logic creeps into `actions.ts`, it becomes untestable — Server Actions are awkward to unit test, services are trivial to.

### The seven modules

| Module | Owns | Use cases | Notes |
|---|---|---|---|
| `tracking` | Stages, transitions, the event log | UC10 UC11 UC12 | **The core.** Build first |
| `intake` | Customers, bills, pieces, labels | UC04 | Blocked on **B2** |
| `billing` | Prices, totals, PromptPay, payments | UC03 | Price from config, never hardcoded |
| `pickup` | Handover, partial pickup, uncollected | UC05 UC06 | Blocked on **B5** |
| `payroll` | Work counts, wage rates, pay periods | UC07 | Blocked on **B1 B3** |
| `notification` | LINE messages, templates, delivery log | UC01 | Every send is logged |
| `config` | Stages, clothes types, prices, rates, templates | — | Read-mostly. See §6.2 |

Modules that do not exist yet do not get empty folders. Create a module when you write its first function.

### 6.1 · `tracking/transitions.ts` — the one file that matters most

```ts
// BR1  สถานะมาจาก status_event ล่าสุดเสมอ ไม่มีคอลัมน์สถานะที่แก้ได้
// BR2  การแก้ไขคือการเพิ่ม event ใหม่ ไม่ใช่การลบหรือทับของเดิม
// BR3  ผ้าหนึ่งชิ้นข้ามสเตจไม่ได้ ยกเว้นเส้นที่ระบุไว้ข้างล่าง

export const STAGES = [
  "RECEIVED", "WASHING", "DRYING", "PRESSING", "READY", "PICKED_UP",
] as const;

export const ALLOWED: Record<Stage, Stage[]> = {
  RECEIVED:  ["WASHING"],
  WASHING:   ["DRYING"],
  DRYING:    ["PRESSING", "WASHING"],   // BR4 ซักซ้ำได้ถ้ายังไม่สะอาด
  PRESSING:  ["READY", "WASHING"],      // BR4 rework loop จาก BPMN W3
  READY:     ["PICKED_UP"],
  PICKED_UP: [],
};
```

**Every stage rule in the system lives in this one file.** No stage logic in a page, a component, a repository, or an action. When the examiner asks "where are your business rules", the answer is a file path.

This file is also the single highest-value unit test target in the project — it is pure, it has no dependencies, and getting it wrong corrupts data permanently.

### 6.2 · Configuration is data, not code

Stages, clothes types, prices, wage rates, notification templates and app settings live in **database tables**, seeded from `prisma/seed.ts`.

Rate tables carry `effective_from` and `effective_to`. Without those columns, recomputing an old pay period silently applies today's rates — a bug that is invisible and produces wrong wages.

The shop owner must be able to add a clothes type without a deployment. Any price or rate written as a TypeScript literal is a bug.

The one exception is `STAGES` and `ALLOWED` above. Those are code because adding a stage changes the state machine, which changes the UI and the business rules — it is a code change by nature, not configuration.

---

## 7 · Import rules — four of them

```
app/         →  modules · components · lib
modules/     →  lib · other modules' index.ts only
components/  →  lib   ← NEVER modules
lib/         →  nothing of ours
```

Written as rules:

1. **UI never touches Prisma.** `db` is imported only in `repository.ts` files.
2. **`components/` has no business logic.** A component receives props and renders. It never calls a service or an action. This is what makes the design system reusable across all three apps.
3. **Modules talk through `index.ts`.** Never `import { x } from "@/modules/billing/service"`. Only `from "@/modules/billing"`. This keeps a module's internals free to change.
4. **One zod schema per input, used on both sides.** The client validates with it for instant feedback, the server validates with the same schema because the client cannot be trusted.

### Enforcing rule 1 and 2 automatically

Add to `eslint.config.mjs`:

```js
{
  files: ["src/components/**", "src/app/**"],
  rules: {
    "no-restricted-imports": ["error", {
      patterns: [
        { group: ["**/lib/db", "@prisma/client"],
          message: "UI must not touch the database. Call a module instead." },
      ],
    }],
  },
},
{
  files: ["src/components/**"],
  rules: {
    "no-restricted-imports": ["error", {
      patterns: [
        { group: ["@/modules/*"],
          message: "Components take props. They do not call modules." },
      ],
    }],
  },
},
```

A rule that is not enforced is a rule that will be broken at 1am in week 14. Two lint rules cost ten minutes and hold for the whole project.

---

## 8 · Server and Client Components

The article's advice — Server Components by default, Client only for forms, interaction and state — is correct and this project follows it, **with one deliberate inversion**.

| App | Default | Why |
|---|---|---|
| D1 Customer | **Server** | Read-only status display. Minimal JS matters on a phone over mobile data |
| D2 Front Office | **Server** | Tables and dashboards. Server Actions for every mutation |
| D3 Scan | **Client** | The camera, the offline queue and IndexedDB are all browser APIs |

The scan app is the inversion. `navigator.mediaDevices`, `BarcodeDetector` and IndexedDB cannot run on the server, and the whole point of the offline queue is that it works when the server is unreachable. So `(floor)/scan` is `"use client"` by design, and the server work is pushed into Server Actions the client calls when it has connectivity.

Two things to keep correct:

- **`"use client"` goes on the smallest component that needs it**, not at the top of a page. A page that is `"use client"` pulls its whole subtree into the bundle.
- **The scan preview container must always have real dimensions.** `display: none` makes the scanner measure a zero-size box and render black. Use `visibility: hidden`. This cost debugging time once already; it is written into the design system as a rule.

---

## 9 · Where does this go?

| I need to add… | Put it in |
|---|---|
| A new screen | `app/(group)/<route>/page.tsx` |
| A component used by one screen | `app/(group)/_components/` |
| A button, input, card, banner | `components/ui/` |
| A stage pill, garment row, scan target | `components/domain/` |
| A business rule | `modules/<feature>/service.ts` |
| A stage transition rule | `modules/tracking/transitions.ts` — **only here** |
| A database query | `modules/<feature>/repository.ts` |
| A form submission | `modules/<feature>/actions.ts` |
| Input validation | `modules/<feature>/schema.ts` |
| A price, rate, clothes type, template | **a database table**, seeded in `prisma/seed.ts` |
| A date or money formatter | `lib/format.ts` |
| An external API client | `lib/<service>.ts` |
| Something an outside system must call | `app/api/<name>/route.ts` |
| A diagram or report section | `docs/` |

If something seems to fit two places, it belongs in the lower one — `lib` over `modules`, `modules` over `app`.

---

## 10 · Traceability

The IS report needs to connect 29 pain points → 13 use cases → features → code. Rather than maintaining a separate spreadsheet that goes stale, the links live in the code as comments:

```ts
// UC10  บันทึกงานที่สเตจ
// PP8 PP9  ค่าแรงคิดจากการจดจำนวนด้วยมือ ตรวจสอบย้อนหลังไม่ได้
// BR1  สถานะมาจาก event ล่าสุด
export async function recordWork(...) {}
```

Then:

```bash
rg "PP13" src/        # which code addresses this pain point
rg "UC05" src/        # which files implement this use case
rg "// BR" src/       # every business rule in the codebase
```

`docs/TRACEABILITY.md` holds the table; the comments keep it honest. A pain point with no grep hit is a pain point not yet addressed — which is exactly the gap the report needs to be truthful about.

---

## 11 · Anti-patterns

Each of these has already caused a problem in this project or is a known trap in this stack.

| Don't | Because |
|---|---|
| A `status` column you can `UPDATE` | Destroys the history that wages and the audit trail depend on. Status is derived from the last event |
| Stage names or prices as string literals in a component | Config is data. A price change must not need a deployment |
| A top-level `actions/` folder | Actions belong to the module whose rules they invoke. Split them out and the logic separates from its rules |
| `lib/` as a drawer for anything | `lib/` is for code with no domain knowledge and no React. Domain logic goes in a module, even a small one |
| `"use client"` at the top of a page | Pulls the entire subtree into the client bundle |
| Hiding the scan preview with `display: none` | The scanner measures a zero-size box and renders black |
| Importing Prisma in a Server Component "just this once" | The exception becomes the pattern. The lint rule exists to stop it |
| Deep-importing `modules/x/service` | Locks in another module's internals. Import `modules/x` |
| Business logic in `actions.ts` | Server Actions are hard to unit test. Services are easy |
| Creating empty module folders for planned features | Dead structure reads as finished work. Create the folder with its first function |
| `next-pwa` | Deliberately avoided. What this project needs from PWA is ~50 lines of hand-written `sw.js` and one `manifest.ts`; a dependency that breaks on Next.js upgrades is not worth it |

### Two traps specific to this deployment

**Prisma on Vercel serverless.** Every invocation can open a new connection and exhaust Postgres. Required: the Supabase connection pooler, `?pgbouncer=true` on the URL, and a single Prisma client instance in `lib/db.ts` cached on `globalThis` in development.

**iOS Safari has no `BarcodeDetector`.** `lib/barcode-scanner.ts` is an adapter: use the native API where it exists, fall back to `html5-qrcode`. The scan app imports the adapter, never either library directly — so replacing the fallback later touches one file.

---

## 12 · Migration from the current POC layout

The repo currently has POC pages under `src/app/poc/*` with no modules and no database. The order that avoids rework:

1. **Keep `src/app/poc/` untouched** until every POC has answered its question. It is evidence for the report, not product code.
2. **`prisma/schema.prisma` + `seed.ts`** — the ERD first, since everything depends on table shapes.
3. **`modules/tracking/`** — `transitions.ts` and its tests before any screen. This is the walking skeleton.
4. **`modules/config/`** — so nothing downstream is tempted to hardcode a price.
5. **`app/(floor)/scan`** — the first real screen, because the scan is the riskiest interaction and S-01 already proved the technology works.
6. **`app/(front-office)/intake`** — nothing can be scanned until labels exist.
7. Then `(customer)`, then the remaining front-office screens in the §5 order.
8. **Delete `src/app/poc/` and the legacy token aliases in `globals.css`** once MVP 1 is running.

`globals.css` currently keeps `--color-ink`, `--color-muted`, `--color-line` and `--color-brand` as aliases so the 50 existing POC references keep working. That block is marked for deletion in step 8.

---

## 13 · Open questions that affect structure

| Question | Affects | Status |
|---|---|---|
| Front-office device — tablet, phone or desktop? | `(front-office)/layout.tsx` width and nav pattern | **Unanswered.** Designed at 860px provisionally |
| B1 B3 — wage rates | `modules/payroll` | Blocked |
| B2 — clothes types and prices | `modules/intake`, `modules/config` seed | Blocked |
| B5 — partial pickup rules | `modules/pickup` | Blocked |
| N1 N2 N3 — cancellations, damage, bill edits | `modules/tracking` correction events | Blocked |
| LINE OA free message quota | Whether `notification` needs batching or a fallback channel | **Verify against official pricing before citing any figure** |

Four of seven modules are blocked on one shop visit. That visit is the highest-value work available right now — higher than any further architecture.
