# FlowDesk verification checklist

Run [`supabase/seed/reset_and_seed.sql`](../supabase/seed/reset_and_seed.sql) in your Supabase SQL editor first. That gives you **5 employees × 4 projects × 3 clients × 12 tasks** covering every status, both task types, both assigner roles, attachments, parallel pairs, blockers, on-hold, requirements-addition, and completed tasks.

All employees have `null` passwords — type any password the first time you sign in as them. Suggested: `test` for everyone.

---

## Test cast

| Username | Name | Notable |
|---|---|---|
| **admin** / `Rootstock@123` | Administrator | Hardcoded; full powers everywhere |
| `alice` | Alice Chen | **Lead** of Dashboard v2; has 1 active leadership task + 1 pending dev task |
| `bob` | Bob Martinez | **Lead** of API Migration; queue of 3 tasks (1 active, 2 pending), 1 already completed |
| `carol` | Carol Wong | Has a **blocked** task on Bob's project + an **on-hold** task on Internal Tools |
| `dave` | Dave Patel | **Lead** of Mobile App (pending), plus two **parallel** tasks (CI + Containerize) |
| `eve` | Eve Johnson | Has a **requirements-addition** task on Dashboard v2 + a completed audit task |

---

## 1. Login / first-login flow

- [ ] Type `admin` / `Rootstock@123` → land on Admin Dashboard
- [ ] Sign out → type `alice` / `test` (any password) → small teal "Password set. Welcome…" message → routed to Employee
- [ ] Sign out → log back in as `alice` / `test` (now the real password) → routed to Employee straight away
- [ ] Type `alice` / wrong password → amber "Invalid username or password"
- [ ] Type `nobody` / anything → same amber error

## 2. Admin Dashboard

- [ ] Sidebar shows: Overview · Employees · Tasks · Projects · Org view
- [ ] Stats cards: **5** employees · pending-first-login count drops as you log them in · **active tasks** ≈ 4 (sum of `active` + `parallel`)
- [ ] **Ping Groq bridge** button returns either real Groq output or the stub message
- [ ] **Org view** button in header → routes to /admin/org

## 3. Employees page (admin)

- [ ] Table shows 5 rows, each with Name + @username + designation + Active/Pending status pill + Added date
- [ ] Search "alice" → filters down to Alice
- [ ] Filter pills All / Active / Pending — once you've set passwords for some, "Pending" only shows un-logged-in users
- [ ] **Add employee** button → modal opens; fill name + username + designation + description (no password field; teal info banner explains self-set on first login)
- [ ] Create "test" user → row appears immediately
- [ ] **Edit** pencil icon → modal pre-filled; description-only edit saves
- [ ] **Delete** trash icon → red confirmation modal (warns about cascading tasks). Cancel → safe. Delete → row disappears
- [ ] **View flowchart** list icon → admin-mode flowchart for that employee
- [ ] **Assign task** teal chip → opens chat-driven NewTask in a new full-screen view

## 4. NewTask chat (admin path — Development)

Pick "Assign task" on Alice's row → chat opens at the type chip.

- [ ] Pick **Development** → project chips appear (existing projects + "+ Create new project")
- [ ] Click **+ Create new project** → inline form → submit → chip flow continues with the new project
- [ ] Pick a client (or No client / + Add new client)
- [ ] Type a vague title and description like "make login better" → AI follow-up appears with a specific clarifying question (assuming `GROQ_API_KEY` is set)
- [ ] Answer the clarifier → AI either probes once more or moves on (cap of 3)
- [ ] Pick a task kind chip
- [ ] Type expected output → AI may probe again
- [ ] **Attachments** step: upload a file (lands in `flowdesk-attachments` bucket) AND add a note → both appear in the attachments list with description fields
- [ ] **Continue with attachments** → SummaryCard appears in the input area with all fields editable + the attachments preserved
- [ ] **Assign task** → green confirmation, redirects to /admin/employees
- [ ] In Supabase Table Editor → `tasks` row exists with assigner_id=`admin`, attachments JSON populated, sequence_index = next-in-line

## 5. NewTask chat (admin path — Leadership)

Pick "Assign task" on a fresh employee (or Alice) → chat opens.

- [ ] Pick **Leadership** → no dev-kind step
- [ ] Project + client steps as usual
- [ ] **Pick lead** chip picker shows every employee
- [ ] **Pick team** multi-select with the lead chip pre-locked (visual `lead` tag, can't uncheck) and others toggleable. Submit "Confirm team" with at least one extra teammate
- [ ] Title / description / probes / expected output / probes / attachments / summary
- [ ] After confirm → in Supabase, the project row has its `lead_id` and `member_ids` set; the task itself has `assignee_id = lead`, `type = leadership`

## 6. Personal flowchart (employee `/employee`)

Sign in as **Alice** (`alice` / `test`).

- [ ] Header shows "FlowDesk · Alice Chen" + a **Lead 1** dropdown (you lead Dashboard v2)
- [ ] Toolbar: 2 tasks · Show completed · Project / Status filters
- [ ] One node per task by default — Alice has 2 (active leadership + pending dev). The pending one shows the lock indicator
- [ ] Active leadership node has the teal-glow ring (next-up) + "tap to act"
- [ ] Click the active node → drawer opens (employee mode), showing brief, expected output, **2 attachments** (note bodies visible inline), timing grid (deadline, days-left), parallel-with section empty, timeline with 1 "accepted" entry
- [ ] Footer: Run-in-parallel · Mark-complete · Flag-blocker · Pause · Add-note buttons
- [ ] Close drawer (X or click outside)
- [ ] Click the pending node → "🔒 Locked" footer message, no actions
- [ ] **Show completed** toggle off → no change here (Alice has nothing completed). Toggle on → still no change

Sign out, in as **Eve** (`test`).

- [ ] Eve has a 🟣 **requirements-addition** task on Dashboard v2 (purple ring) + a completed audit task (hidden until toggle)
- [ ] Click the purple node → drawer footer offers **Acknowledge new requirements** + **Add a status note**
- [ ] **Acknowledge** → modal asks for optional extra days + reason note → enter 1 day + "OK got it" → submit
- [ ] Drawer refreshes; status becomes 🟡 active; deadline visibly extended by 1 day; timeline gained a new "status changed" entry with the reason note

## 7. Lifecycle actions

Sign in as **Bob**.

- [ ] Toolbar shows "3 tasks". Active task ("Migrate /users endpoint") is up; 2 pending behind it
- [ ] Click the active task → drawer → **Run in parallel** → picker shows the next pending task ("Document the new gateway") → select it + days = 2 → confirm
- [ ] Both tasks render side-by-side as 🟠 parallel; deadlines computed
- [ ] Click either parallel task → **Mark complete** → green confirmation; node turns ✅
- [ ] **Show completed** toggle on → completed nodes appear

Sign in as **Carol**.

- [ ] One blocked task (🔴) + one on-hold task (⚫). Both have full event chains hidden behind the current event
- [ ] On the blocked task: footer offers **Resolve blocker** → ResolveBlockerModal asks for resolution note + lets you attach files/notes (try both)
- [ ] Submit → status returns to 🟡 active. Deadline visibly **extended** by ≈ how long it was blocked. Drawer's "Days left" shows the new value
- [ ] In the event chain, **expand history**: ↓ Show N earlier → see the chain (created → accepted → comment → blocker → resolved). Latest is full color, history dimmed
- [ ] On the on-hold task: footer offers **Resume** + **Add a status note** → click Resume → status returns to active; deadline extended by the hold duration

Sign in as **Dave**.

- [ ] Two 🟠 parallel tasks side-by-side (CI + Containerize). One mobile leadership pending below
- [ ] Click either parallel task → **Flag blocker** → red modal → describe blocker → submit → status → 🔴 blocked, deadline timer pauses

## 8. Lead view (project-scoped)

As **Alice**, click **Lead 1 → Dashboard v2** in the header dropdown.

- [ ] Lands on `/employee/projects/prj_dashboard`
- [ ] Header: back link · "Project lead · Dashboard v2 — Acme Corp" · **Assign new task** CTA
- [ ] **Project settings** panel above the canvas — collapsed by default. Open it → roster shows Alice (lead pill), Bob, Eve. **+ Add member** chip enabled. **Transfer leadership** is hidden (lead-mode)
- [ ] Add Carol as a member → roster updates. Remove Carol → gone. Try removing Alice (the lead) — refused with "Cannot remove the lead…"
- [ ] Below the panel: project flowchart grouped by teammate (you, Bob, Eve as horizontal columns)
- [ ] Click Eve's requirements-addition task → drawer mode = **observer** (admin-assigned task; Alice didn't assign it). Purple banner: "This task was assigned directly by the admin…"
- [ ] Click any task you don't see (e.g. tsk_001 itself, your leadership task) → also observer (admin assigned it)
- [ ] Click **Assign new task** → NewTask opens with project + client locked, type forced to development, assignee chips show only project members (Alice, Bob, Eve, …)
- [ ] Finish a quick task → land back on the project view; the new task appears in the assignee's column
- [ ] As Alice, click that new task → drawer is **admin** mode (Alice assigned it) → can Resolve blocker / Add new requirements

## 9. Org view (admin)

`/admin/org`. Toggle the four buttons.

- [ ] **By person** → 5 columns (one per employee), each with their tasks below. Empty employees show only a header
- [ ] **By project** → 4 columns (Dashboard v2, API Migration, Internal Tools, Mobile App). Inside each project, one sub-column per teammate. Person separation visible
- [ ] **By client** → 3 columns (Acme, Globex, Initech). Each shows people working on that client (cross-project)
- [ ] **Full hierarchy** → top row of 3 client headers; second row of project headers (positioned under each client); third row of teammate headers (under each project); task chains at the bottom
- [ ] In any mode, click a section header → that subtree collapses
- [ ] Click an event box anywhere → admin drawer opens with full powers
- [ ] **Show completed** off → completed task nodes hidden but headers stay; on → reappear
- [ ] **Status filter** → e.g. "Blocked" → only Carol's blocked task remains
- [ ] **Search** "carol" → only Carol's tasks
- [ ] Tasks with `assigner_id = 'admin'` show the small purple **`admin`** pill on every event box

## 10. Admin-side task management

`/admin/tasks`.

- [ ] Grouped by assignee. Each group: name + task count + "View flowchart" chip
- [ ] Click a task row → drawer opens (admin mode)
- [ ] On Eve's requirements-addition task: drawer footer shows **Add new requirements**. Submit → already-purple stays purple; new entry in timeline
- [ ] On Carol's blocked task: drawer footer shows **Resolve blocker** + Add new requirements (admin can resolve too)

`/admin/projects`.

- [ ] List of 4 project cards, each showing name + client + lead + member count
- [ ] Click expand on Internal Tools → ProjectSettings panel — no lead pill (no lead). **Transfer leadership** is disabled (no candidates yet)
- [ ] Add Carol as a member → roster updates. Now **Transfer leadership** picker shows Carol → pick her → she becomes lead with the lead pill
- [ ] On API Migration: try transferring leadership to Carol → confirms. Bob loses lead pill; Carol gets it
- [ ] On Dashboard v2: try removing Alice (the lead) — refused with the "transfer first" message

## 11. Lead view ↔ project ownership rules

Sign in as **Bob** (lead of API Migration).

- [ ] Header → **Lead** dropdown shows "API Migration"
- [ ] Click into it. Project settings: roster shows Bob (lead) + Carol
- [ ] Click Bob's own active task (Migrate /users — assigned by Bob to himself) → drawer is **admin** mode (Bob assigned it)
- [ ] Click Carol's blocked task (assigned by Bob to Carol) → drawer is **admin** mode (Bob assigned it; he has full powers)
- [ ] Click Bob's leadership task itself (assigned by admin) — **observer** mode with purple banner

## 12. Distribution / packaging

- [ ] `npm run typecheck` — zero errors
- [ ] `npm run build` — three "✓ built" lines (renderer, main, preload)
- [ ] `npm run dist:win` — installer in `release/` folder; install + run; everything still works with the same Supabase data

## 13. Edge / regression

- [ ] Refresh in mid-flow (e.g. on the project view) → flowchart reloads correctly
- [ ] In NewTask chat, click Cancel halfway through → returns to caller without saving
- [ ] Close the chat with X → same
- [ ] Try logging in as a deleted user → InvalidCredentialsError
- [ ] Toggle expand/collapse on multiple tasks at once → independent state per task

---

## Reporting issues

When something doesn't behave, send me:
1. **Which step number above** failed
2. The **exact button / text** you clicked
3. The **error message** (if any) — the red banner now shows the real Supabase / network message
4. A screenshot if visual

Anything you mark ✗ I'll diagnose against the seed data — every state above is reachable from this dataset.
