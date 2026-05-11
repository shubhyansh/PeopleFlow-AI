# 🌊 FlowDesk

> *The task management tool built by a dev who looked at his Jira board, sighed audibly, and thought:*
> *"What if the requirements gathered themselves?"*

[![Built with Electron](https://img.shields.io/badge/Electron-28-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Groq](https://img.shields.io/badge/Groq-Llama%203.3%2070B-F55036)](https://console.groq.com/)
[![Cross-platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows-2de2d4)](#-installation)
[![License](https://img.shields.io/badge/License-See%20LICENSE-blue)](LICENSE)

---

## 🎯 What is this?

FlowDesk is a desktop task-management app where an **AI conducts the requirements interview** instead of a project manager. Admins type a 2-sentence description, the AI generates a checklist tailored to the task, walks through it, asks one pointed clarifier ("you said 'lightweight' — what bundle-size?"), and ships a clean brief to the developer.

Every task becomes an **event-driven flowchart**: accept, blocker, resolve, parallel, complete — each lifecycle event is a node, dimmed history stacks behind the current state, and deadlines auto-extend when work was paused. Leads get scoped admin powers on their projects. Admins get an org-wide canvas grouped by person, project, client, or full hierarchy.

> *In other words: the spec your PM would have written if they'd had a checklist, three espressos, and a fear of disappointing the dev team.*

---

## 😏 Why does this exist?

A confession from the dev who built this:

> *I have spent years receiving Jira tickets that read:*
> *— "make the dashboard better"*
> *— "fix the login (mobile)"*
> *— "users want it faster"*
>
> *Each one was a small act of violence against my afternoon.*
>
> *FlowDesk is what happens when you decide that the problem isn't really "the dashboard," it's that nobody asked **what does better mean** before someone clicked Assign. So I made an AI do the asking. Now the briefs come in pre-interrogated, the vague verbs are dead, and the developer (me, mostly) gets to skip straight to the part where I write code.*

This repo is, in spirit, a love letter to:

- ✨ **The product manager** who said *"can you just make it pop"* and then went to a meeting about other meetings.
- ✨ **The senior engineer** who replied to a vague ticket with *"sure, give me 2-12 weeks."*
- ✨ **The designer** who delivered a Figma file titled `final_FINAL_v3_USE_THIS_ONE.fig`.
- ✨ **Future you**, who will open this app, type three sentences, and watch a properly-scoped task brief come out the other side.

FlowDesk doesn't replace your PM. It just makes the bar for *"thing that arrives in your inbox titled 'TASK'"* so high that the PMs left standing become *very* good at their jobs. Survival of the unambiguous.

---

## ✨ Features (the actually-useful kind)

### 🤖 AI Requirements Interview
- Type a **2-sentence description** of the task. AI generates a kind-aware checklist (bugs get "repro steps", frontend gets "edge cases", backend gets "API contracts", and so on).
- **Edit the checklist** before filling — drop sections that don't apply, reorder, or add custom ones.
- **Bulk fill in one screen** or **download the `.req.md`** to fill in your favorite editor and re-upload.
- One concise clarifier per field. *"You said 'fast' — what's the p95 target?"* No essays.
- Tighter probes than your tech lead would write at 4pm on a Friday.

### 📊 Event-Driven Flowchart
- Every lifecycle event (created → accepted → blocker → resolved → completed) is a node.
- Older boxes fade; the current state glows. **Blocked / on-hold / requirements-addition pulse** so urgency is visible at a glance.
- Tasks queue sequentially per assignee; mark two as parallel and watch them share a row.
- Deadlines **auto-extend** when work was paused for a blocker — because docking somebody for time they didn't have is rude.

### 🏗️ Four Views of the Org
- **By person** — one column per teammate, their task chain below.
- **By project** — projects laid out side-by-side, with each lead's domain branched separately from admin-direct assignments.
- **By client** — sliced by external relationship.
- **Full hierarchy** — `Client → Project → Lead-task | Admin-direct → Assignee → Tasks`. Connecting lines through every level. Pan, zoom, collapse.

### 👑 Lead Role (Scoped Admin)
- Designate any teammate as project lead when assigning a leadership task. They magically gain admin powers — *but only within their project*.
- Leads can assign sub-tasks via the same AI interview, restricted to project members. Admin-direct tasks remain visibly admin-owned (purple `admin` pill on the event box).
- Project settings panel: add/remove members, transfer leadership.

### 📎 Attachments + Diagrams
- Image uploads land in a **separate diagrams step** with thumbnail previews — distinct from generic file/note attachments.
- Notes (links, snippets) can be inlined with captions.
- Anything image-shaped renders as a click-to-zoom thumbnail in the task drawer.

### 🛠️ Tech Stack Capture
- Pick from a curated chip palette (React, Postgres, Docker, Groq, …) or add custom.
- Renders as pills next to the task title so the developer sees what they're up against before opening the brief.

### 📄 Portable Briefs (.req.md)
- Every brief can be **downloaded as Markdown** with frontmatter (title, type, project, client, assignee, tech stack) + section bodies.
- **Re-import** a `.req.md` to spin up a new task pre-filled, or share specs across teams without leaving the editor.

### 🌑 Built to be looked at
Dark navy + electric teal + warm amber. Framer Motion easing on every transition. Glass morphism on every card. A flowchart that doesn't look like an org chart from 2009.

---

## 🛠 Tech Stack

| Layer | Tech |
|---|---|
| Desktop shell | Electron 28 (cross-platform; Windows & macOS) |
| Renderer | React 18 + TypeScript (strict) + Vite |
| Styling | Tailwind CSS + Framer Motion |
| Flowchart | React Flow |
| Backend | Supabase (Postgres + Storage + Auth-via-app-layer) |
| AI | Groq SDK · default `llama-3.3-70b-versatile` (configurable) |
| Auth | App-level username/password + bcryptjs · admin is hardcoded |

The Groq key lives in the Electron main process and is **never** sent to the renderer. The Supabase anon key ships with the binary because — surprise — that's what anon keys are for.

---

## 🚀 Quick start

### Prerequisites
- Node 20+
- A Supabase project (free tier)
- A Groq API key (free tier)
- ~5 minutes and a willingness to follow instructions

### 1. Stand up Supabase
1. Sign up at [supabase.com](https://supabase.com) (GitHub login works).
2. Create a new project. Wait for provisioning.
3. Open **SQL Editor → New query** and run each file in [`supabase/migrations/`](supabase/migrations/) in order:
   - `0001_init.sql` — schema
   - `0002_password_optional_and_role.sql` — first-login password self-set
   - `0003_drop_assigner_fk.sql` — admin lives outside `users`
   - `0004_attachments_bucket.sql` — Storage bucket + policies
   - `0005_tech_stack.sql` — `tech_stack` column + schema reload
4. Optional: run [`supabase/seed/reset_and_seed.sql`](supabase/seed/reset_and_seed.sql) to load a fully-populated dummy dataset.
5. **Settings → API**: copy `Project URL` + `anon public key`.

### 2. Grab a Groq key
Go to [console.groq.com/keys](https://console.groq.com/keys), create one, paste it later.

### 3. Wire up `.env`
```bash
cp .env.example .env
# then fill in:
#   VITE_SUPABASE_URL
#   VITE_SUPABASE_ANON_KEY
#   GROQ_API_KEY
#   GROQ_MODEL   (optional — defaults to llama-3.3-70b-versatile)
```

### 4. Install + run
```bash
npm install
npm run dev
```

### 5. Sign in
- **Admin:** `admin` / `Admin@123`
- **Employee:** anything the admin adds, with a password you pick on first login.

> *FlowDesk is shipped to your teammates as a single installer with all keys baked in. The Supabase anon key is designed to be public; RLS will lock down access in a future phase. Don't ship this to your worst enemy and then leave RLS off.*

---

## 📦 Distributing to your team
```bash
npm run dist        # current platform
npm run dist:win    # Windows .exe installer
```
Output lands in `release/`. Hand the installer to teammates; the keys travel with it. Teammates sign in with their assigned username and pick their own password the first time.

---

## 🧪 Verification (skim before you blame the AI)

After `npm run dev`:

1. Sign in as `admin` / `Admin@123`.
2. **Employees** → add Alice. Sign out, sign in as `alice` with any password → that becomes hers.
3. **Assign task** on Alice's row → walk the AI flow. Bonus points for writing the vaguest possible description and watching the AI roast it.
4. Sign in as Alice → see the task in her flowchart. Accept it. Flag a blocker. Watch the box pulse red. Resolve it. Watch the deadline extend.
5. **Admin → Org view → Full hierarchy** → see the whole forest: client → project → lead/admin-direct branches → assignees → task chains, every level connected by teal hierarchy edges.
6. **Download .req.md** on the summary card → open it in your editor of choice → make changes → upload it back via **Import .req.md**.

---

## 🗺 Architecture (the 30-second tour)

```
electron/                  Main process. Holds the Groq key; exposes IPC.
shared/ipc-contract.ts     Single source of truth for IPC types.
supabase/                  SQL migrations + dummy seed.
src/
├── auth/                  flowdeskAuth + RequireRole + AuthContext
├── lib/
│   ├── taskInterview.ts   Probe prompts, brief composition, .req.md compose/parse
│   ├── specOutline.ts     AI outline generator + kind-specific defaults
│   ├── taskLifecycle.ts   accept / complete / parallel / blocker / hold / requirements
│   ├── eventChain.ts      Task → per-event boxes
│   ├── flowchartLayout.ts Per-task event chain layout
│   ├── leveledFlowchartLayout.ts   Generic n-level grouped layout
│   ├── projectAwareFlowchartLayout.ts   Project ⇒ [lead-task | admin-direct] ⇒ assignee
│   ├── errors.ts          Supabase-error normalizer
│   └── files.ts           Download / upload helpers
├── components/
│   ├── chat/              ChatWindow, MessageBubble, InlineChoice, MultiChoice,
│   │                      SpecOutlineEditor, BulkSectionsForm, TechStackPicker,
│   │                      AttachmentsStep, DiagramsStep, SummaryCard, InlineCreate
│   ├── flowchart/         EventNode, GroupHeaderNode, TaskDrawer, TaskActionLayer,
│   │                      useTaskActions, AcceptModal, CompleteModal, ParallelPicker,
│   │                      ResolveBlockerModal, AckRequirementsModal, NoteModal,
│   │                      ProjectFlowchartView, TaskFlowchartView, Toolbar,
│   │                      statusStyles
│   └── projects/          ProjectSettings (roster + lead transfer)
├── routes/
│   ├── Login.tsx, AdminDashboard.tsx
│   ├── admin/             Employees, AllTasks, NewTask, EmployeeFlowchart,
│   │                      Org, Projects
│   └── employee/          Flowchart, ProjectLeadView
└── ui/components/         Layout, Modal, Table, Spinner, Icon, IconExtras
```

---

## 🧠 The Roadmap

| ✓ | Phase |
|---|---|
| ✅ | Scaffold, auth, Supabase storage |
| ✅ | Employee management |
| ✅ | Chat-driven task creation + Groq integration |
| ✅ | React Flow employee flowchart + node states |
| ✅ | Smarter probes, attachments, admin tasks list, lifecycle engine |
| ✅ | Event-driven box layout, paused-time, blocker attachments |
| ✅ | Org-wide flowchart with grouping toggles |
| ✅ | Lead role + leadership task creation flow |
| ✅ | Project membership + lead transfer + Projects admin page |
| ✅ | Person-aware project view (lead-domain vs admin-direct branches) |
| ✅ | Person separation in every view + cross-level hierarchy edges |
| ✅ | Pulse animations for urgent statuses |
| ✅ | `.req.md` import/export + bulk-fill checklist + AI clarifier |
| 🟡 | RLS hardening for non-trusted-team deployments |
| 🟡 | Real-time notifications when teammates flag blockers |
| 🟡 | Sub-leadership (leads delegating leadership of sub-teams) |
| 🟡 | True dual-pane lead view |

---

## 🤝 Contributing

Pull requests welcome from devs, designers, and (yes, fine) project managers. Especially project managers — your detailed bug reports are how this thing got built.

1. Fork, branch, build something
2. Open a PR with a description that would survive its own FlowDesk interview
3. Get reviewed
4. Don't include `.env` (we'll know)

---

## 🪪 License

See [LICENSE](LICENSE).

---

## 🙏 Acknowledgements

To every PM who ever wrote *"this should be intuitive"* in a ticket — without you, the will to build this would not exist. To every dev who replied with *"intuitive to whom?"* — same.

This project is built with [React](https://react.dev/), [Supabase](https://supabase.com/), [Groq](https://groq.com/), [React Flow](https://reactflow.dev/), [Framer Motion](https://www.framer.com/motion/), and a healthy disrespect for vague requirements.

---

<div align="center">

**Built by [@shubhyansh](https://github.com/shubhyansh).**
*If this saves you one sprint, star the repo. If it saves you two, tell a friend.*

</div>
