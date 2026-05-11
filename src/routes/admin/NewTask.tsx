import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChatWindow } from '../../components/chat/ChatWindow';
import { ChatInput } from '../../components/chat/ChatInput';
import { InlineChoice, type ChoiceOption } from '../../components/chat/InlineChoice';
import { InlineCreate } from '../../components/chat/InlineCreate';
import { MultiChoice } from '../../components/chat/MultiChoice';
import { SpecOutlineEditor } from '../../components/chat/SpecOutlineEditor';
import { BulkSectionsForm } from '../../components/chat/BulkSectionsForm';
import { TechStackPicker } from '../../components/chat/TechStackPicker';
import { DiagramsStep } from '../../components/chat/DiagramsStep';
import { AttachmentsStep } from '../../components/chat/AttachmentsStep';
import { SummaryCard } from '../../components/chat/SummaryCard';
import type { ChatMessage } from '../../components/chat/types';
import { useAuth } from '../../auth/AuthContext';
import {
  INITIAL_BRIEF,
  TASK_KIND_OPTIONS,
  composeBrief,
  composeChecklistTemplate,
  parseReqMd,
  probeForClarity,
  type InterviewBrief,
  type InterviewStep,
  type ParsedReqMd,
} from '../../lib/taskInterview';
import { downloadText, readTextFile, safeFilename } from '../../lib/files';
import {
  defaultOutline,
  generateOutline,
  type SpecOutline,
} from '../../lib/specOutline';
import { newId } from '../../lib/id';
import { toErrorMessage } from '../../lib/errors';
import { addClient, listClients } from '../../services/supabase/clients';
import {
  addProject,
  listProjects,
  setProjectLeadAndMembers,
} from '../../services/supabase/projects';
import { listUsers } from '../../services/supabase/users';
import { nextSequenceIndex, saveTask } from '../../services/supabase/tasks';
import type { Client, Project, Task, TaskAttachment, TaskType, User } from '../../domain/types';
import { ChevronLeftIcon, CloseIcon } from '../../ui/components/Icon';
import { PaperclipIcon } from '../../ui/components/IconExtras';
import { Spinner } from '../../ui/components/Spinner';

export default function NewTask() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const pathParams = useParams<{ id?: string }>();
  const { flowdeskUser } = useAuth();
  const initialAssigneeId = params.get('assigneeId');
  const initialProjectId = params.get('projectId') ?? pathParams.id ?? null;
  const leadMode = Boolean(initialProjectId);

  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [bootError, setBootError] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);

  const [assigneeId, setAssigneeId] = useState<string | null>(initialAssigneeId);
  const [step, setStep] = useState<InterviewStep>('pick-type');
  const [brief, setBriefState] = useState<InterviewBrief>(INITIAL_BRIEF);
  const briefRef = useRef<InterviewBrief>(INITIAL_BRIEF);
  const setBrief = useCallback(
    (updater: InterviewBrief | ((prev: InterviewBrief) => InterviewBrief)) => {
      setBriefState((cur) => {
        const next =
          typeof updater === 'function'
            ? (updater as (p: InterviewBrief) => InterviewBrief)(cur)
            : updater;
        briefRef.current = next;
        return next;
      });
    },
    [],
  );

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const assignee = useMemo(
    () => (assigneeId ? users.find((u) => u.id === assigneeId) ?? null : null),
    [assigneeId, users],
  );

  // ---------- Boot ----------
  useEffect(() => {
    (async () => {
      try {
        const [u, p, c] = await Promise.all([listUsers(), listProjects(), listClients()]);
        setUsers(u);
        setProjects(p);
        setClients(c);

        if (leadMode && initialProjectId) {
          const proj = p.find((x) => x.id === initialProjectId);
          if (proj) {
            const client = proj.clientId ? c.find((x) => x.id === proj.clientId) : null;
            setBrief((b) => ({
              ...b,
              type: 'development',
              projectId: proj.id,
              projectName: proj.name,
              clientId: client?.id ?? null,
              clientName: client?.name ?? '',
            }));
          }
        }
      } catch (e) {
        setBootError(toErrorMessage(e));
      } finally {
        setBooting(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Chat helpers ----------
  const pushAssistant = useCallback((content: string, embed?: ChatMessage['embed']) => {
    setMessages((m) => [
      ...m,
      { id: newId('msg'), role: 'assistant', content, ...(embed ? { embed } : {}) },
    ]);
  }, []);

  const pushUser = useCallback((content: string) => {
    setMessages((m) => [...m, { id: newId('msg'), role: 'user', content }]);
  }, []);

  const currentEmbedKeyRef = useRef<string | null>(null);
  const setCurrentEmbed = useCallback((embed: ChatMessage['embed'] | null) => {
    setMessages((m) => {
      const id = currentEmbedKeyRef.current;
      if (!id) return m;
      return m.map((msg) =>
        msg.id === id ? { ...msg, ...(embed === null ? { embed: undefined } : { embed }) } : msg,
      );
    });
  }, []);

  const askAssistant = useCallback((content: string, embed?: ChatMessage['embed']) => {
    const id = newId('msg');
    currentEmbedKeyRef.current = id;
    setMessages((m) => [
      ...m,
      { id, role: 'assistant', content, ...(embed ? { embed } : {}) },
    ]);
  }, []);

  const assigneeOptions = useMemo(() => {
    if (leadMode && initialProjectId) {
      const proj = projects.find((p) => p.id === initialProjectId);
      const allowed = new Set(proj?.memberIds ?? []);
      if (proj?.leadId) allowed.add(proj.leadId);
      return users.filter((u) => allowed.has(u.id));
    }
    return users;
  }, [leadMode, initialProjectId, projects, users]);

  // ---------- Kick off ----------
  useEffect(() => {
    if (booting) return;

    if (leadMode) {
      if (!assigneeId) {
        if (messages.length === 0) {
          const proj = projects.find((p) => p.id === initialProjectId);
          askAssistant(
            `New task in "${proj?.name ?? '—'}". Who on the team is it for?`,
            <InlineChoice
              options={assigneeOptions.map((u) => ({
                value: u.id,
                label: u.name,
                hint: `@${u.username}`,
              }))}
              onSelect={(id) => {
                const u = assigneeOptions.find((x) => x.id === id);
                setAssigneeId(id);
                setCurrentEmbed(null);
                pushUser(u?.name ?? id);
                askDevKind();
              }}
              layout="grid"
            />,
          );
        }
        return;
      }
      if (messages.length === 0 && assignee) {
        askAssistant(`Setting up a task for ${assignee.name}.`);
        askDevKind();
      }
      return;
    }

    // Admin mode
    if (!assigneeId) {
      if (messages.length === 0) {
        askAssistant(
          `Hi! Let's set up a new task. Who is this for?`,
          <InlineChoice
            options={users.map((u) => ({ value: u.id, label: u.name, hint: `@${u.username}` }))}
            onSelect={(id) => {
              const u = users.find((x) => x.id === id);
              setAssigneeId(id);
              setCurrentEmbed(null);
              pushUser(u?.name ?? id);
              askType(u?.name ?? id);
            }}
            layout="grid"
          />,
        );
      }
      return;
    }
    if (messages.length === 0 && assignee) {
      askType(assignee.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booting, assigneeId, assignee, users.length, leadMode, projects.length]);

  // ---------- Type / Project / Client / Leadership ----------

  function askType(forName: string) {
    setStep('pick-type');
    askAssistant(
      `Setting up a task for ${forName}. What type of task is this?`,
      <InlineChoice<TaskType>
        options={[
          { value: 'development', label: 'Development', hint: 'Build, fix, or ship something' },
          { value: 'leadership', label: 'Leadership', hint: 'Manage a project or team scope' },
        ]}
        onSelect={onPickType}
      />,
    );
  }

  function onPickType(type: TaskType) {
    setBrief((b) => ({ ...b, type }));
    setCurrentEmbed(null);
    pushUser(type === 'development' ? 'Development' : 'Leadership');
    askProject();
  }

  function askProject() {
    setStep('pick-project');
    const opts: ChoiceOption<string>[] = [
      ...projects.map((p) => ({ value: p.id, label: p.name })),
      { value: '__new__', label: '+ Create new project', hint: 'Add inline' },
    ];
    askAssistant(
      'Which project does this belong to?',
      <InlineChoice options={opts} onSelect={onPickProject} layout="grid" />,
    );
  }

  function onPickProject(id: string) {
    if (id === '__new__') {
      setCurrentEmbed(
        <InlineCreate
          label="New project name"
          placeholder="e.g. Mobile App v2"
          onCreate={async (name) => {
            const project: Project = {
              id: newId('prj'),
              name,
              clientId: '',
              memberIds: [],
              createdAt: new Date().toISOString(),
            };
            await addProject(project);
            setProjects((ps) => [...ps, project]);
            setBrief((b) => ({ ...b, projectId: project.id, projectName: project.name }));
            setCurrentEmbed(null);
            pushUser(`+ Created project "${project.name}"`);
            askClient();
          }}
          onCancel={() => askProject()}
        />,
      );
      return;
    }
    const p = projects.find((x) => x.id === id);
    if (!p) return;
    setBrief((b) => ({ ...b, projectId: p.id, projectName: p.name }));
    setCurrentEmbed(null);
    pushUser(p.name);
    askClient();
  }

  function askClient() {
    setStep('pick-client');
    const opts: ChoiceOption<string>[] = [
      ...clients.map((c) => ({ value: c.id, label: c.name })),
      { value: '__new__', label: '+ Add new client', hint: 'Add inline' },
      { value: '__skip__', label: 'No client', hint: 'Internal task' },
    ];
    askAssistant(
      'Which client is this for?',
      <InlineChoice options={opts} onSelect={onPickClient} layout="grid" />,
    );
  }

  function afterClient() {
    if (briefRef.current.type === 'leadership') askLead();
    else askDevKind();
  }

  function onPickClient(id: string) {
    if (id === '__skip__') {
      setBrief((b) => ({ ...b, clientId: null, clientName: '' }));
      setCurrentEmbed(null);
      pushUser('No client');
      afterClient();
      return;
    }
    if (id === '__new__') {
      setCurrentEmbed(
        <InlineCreate
          label="New client name"
          placeholder="e.g. Acme Corp"
          onCreate={async (name) => {
            const client: Client = { id: newId('cli'), name };
            await addClient(client);
            setClients((cs) => [...cs, client]);
            setBrief((b) => ({ ...b, clientId: client.id, clientName: client.name }));
            setCurrentEmbed(null);
            pushUser(`+ Created client "${client.name}"`);
            afterClient();
          }}
          onCancel={() => askClient()}
        />,
      );
      return;
    }
    const c = clients.find((x) => x.id === id);
    if (!c) return;
    setBrief((b) => ({ ...b, clientId: c.id, clientName: c.name }));
    setCurrentEmbed(null);
    pushUser(c.name);
    afterClient();
  }

  // Leadership branch
  function askLead() {
    setStep('pick-lead');
    const opts: ChoiceOption<string>[] = users.map((u) => ({
      value: u.id,
      label: u.name,
      hint: u.designation || `@${u.username}`,
    }));
    askAssistant(
      'Who will lead this project? They get admin-level powers on the project (assign tasks to teammates, resolve blockers, add requirements).',
      <InlineChoice
        options={opts}
        onSelect={(leadId) => {
          const lead = users.find((x) => x.id === leadId);
          setBrief((b) => ({ ...b, leadId }));
          setAssigneeId(leadId);
          setCurrentEmbed(null);
          pushUser(`Lead: ${lead?.name ?? leadId}`);
          askTeam(leadId);
        }}
        layout="grid"
      />,
    );
  }

  function askTeam(leadId: string) {
    setStep('pick-team');
    const opts = users.map((u) => ({
      value: u.id,
      label: u.name,
      hint: u.designation || `@${u.username}`,
      locked: u.id === leadId,
    }));
    askAssistant(
      'Pick the rest of the team. The lead is included automatically.',
      <MultiChoice
        options={opts}
        initialSelected={[leadId]}
        minSelected={1}
        confirmLabel="Confirm team"
        onConfirm={(memberIds) => {
          setBrief((b) => ({ ...b, memberIds }));
          setCurrentEmbed(null);
          const others = memberIds.filter((id) => id !== leadId);
          if (others.length === 0) {
            pushUser('Team: just the lead.');
          } else {
            const names = others.map((id) => users.find((u) => u.id === id)?.name ?? id).join(', ');
            pushUser(`Team: ${names} (+ lead).`);
          }
          askDevKind();
        }}
      />,
    );
  }

  // ---------- Dev kind (BEFORE title now, so outline can use it) ----------

  function askDevKind() {
    if (briefRef.current.type !== 'development') {
      askTitle();
      return;
    }
    setStep('pick-dev-kind');
    askAssistant(
      'What kind of task is this?',
      <InlineChoice
        options={TASK_KIND_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        onSelect={(kind) => {
          setBrief((b) => ({ ...b, devKind: kind }));
          setCurrentEmbed(null);
          pushUser(TASK_KIND_OPTIONS.find((o) => o.value === kind)?.label ?? kind);
          askTitle();
        }}
        layout="grid"
      />,
    );
  }

  // ---------- Title → Short description → Outline ----------

  function askTitle() {
    setStep('ask-title');
    askAssistant('Give the task a short, clear title.');
  }

  function onTitle(text: string) {
    setBrief((b) => ({ ...b, title: text }));
    pushUser(text);
    askShortDescription();
  }

  function askShortDescription() {
    setStep('ask-short-description');
    askAssistant(
      `In 2-3 sentences: what is this task and why does it matter? Don't worry about details — I'll generate a checklist of sections to fill from there.`,
    );
  }

  async function onShortDescription(text: string) {
    setBrief((b) => ({ ...b, shortDescription: text }));
    pushUser(text);
    await runOutlineGeneration(text);
  }

  async function runOutlineGeneration(shortDescription: string) {
    setStep('generating-outline');
    setThinking(true);
    const thinkingId = newId('msg');
    setMessages((m) => [
      ...m,
      { id: thinkingId, role: 'assistant', content: '', pending: true },
    ]);

    const cur = briefRef.current;
    let outline: SpecOutline;
    try {
      outline = await generateOutline({
        title: cur.title,
        shortDescription,
        type: cur.type ?? 'development',
        devKind: cur.devKind,
      });
    } catch {
      outline = defaultOutline(cur.type ?? 'development', cur.devKind);
    }

    setMessages((m) => m.filter((x) => x.id !== thinkingId));
    setThinking(false);

    setBrief((b) => ({ ...b, outline }));
    showOutlineEditor(outline);
  }

  function downloadChecklistTemplate(outline: SpecOutline) {
    const briefForExport: InterviewBrief = {
      ...briefRef.current,
      outline,
    };
    const md = composeChecklistTemplate(briefForExport, {
      ...(assignee?.name ? { assigneeName: assignee.name } : {}),
    });
    const fname = `${safeFilename(briefRef.current.title || 'task')}.checklist.req.md`;
    downloadText(md, fname);
  }

  function showOutlineEditor(outline: SpecOutline) {
    setStep('review-outline');
    askAssistant(
      `Here's a checklist tailored to this task. Edit / drop / add sections, then fill them all on the next screen — or download the checklist to fill offline and upload it back.`,
      <SpecOutlineEditor
        initial={outline}
        onConfirm={(confirmed) => {
          setBrief((b) => ({ ...b, outline: confirmed, sections: {} }));
          setCurrentEmbed(null);
          pushUser(
            `Outline locked: ${confirmed.sections.map((s) => s.title).join(' · ')}`,
          );
          showBulkSections();
        }}
        onDownloadTemplate={(outlineNow) => {
          downloadChecklistTemplate(outlineNow);
        }}
        onUploadFilled={(file) => handleImportReqMd(file)}
      />,
    );
  }

  // ---------- Bulk sections form ----------

  function showBulkSections() {
    setStep('fill-sections-bulk');
    askAssistant(`Fill out the checklist below — answer inline, or take it offline.`);
  }

  async function onBulkSectionsSubmit(sections: Record<string, string>) {
    setBrief((b) => ({ ...b, sections }));
    setCurrentEmbed(null);
    const filled = Object.values(sections).filter((v) => v.trim().length > 0).length;
    pushUser(
      filled > 0
        ? `Filled ${filled} section${filled === 1 ? '' : 's'}.`
        : 'Left sections empty for now.',
    );
    await runBulkClarifier();
  }

  /**
   * After bulk submit, runs ONE concise AI probe across the filled sections.
   * If anything's genuinely unclear, the AI asks a single short question; the
   * admin's answer is added as a Note on the brief. Otherwise we move straight
   * to tech stack.
   */
  async function runBulkClarifier() {
    const cur = briefRef.current;
    // Build a synthetic "description" that summarises the filled checklist for the probe.
    const summary = cur.outline
      ? cur.outline.sections
          .map((s) => {
            const body = cur.sections[s.key]?.trim();
            return body ? `${s.title}: ${body}` : null;
          })
          .filter((x): x is string => Boolean(x))
          .join('\n')
      : cur.shortDescription;

    if (!summary.trim()) {
      askTechStack();
      return;
    }

    setStep('probe-after-bulk');
    setThinking(true);
    const thinkingId = newId('msg');
    setMessages((m) => [
      ...m,
      { id: thinkingId, role: 'assistant', content: '', pending: true },
    ]);
    try {
      const fakeBrief: InterviewBrief = { ...cur, description: summary };
      const result = await probeForClarity({
        field: 'description',
        brief: fakeBrief,
        history: [],
      });
      setMessages((m) => m.filter((x) => x.id !== thinkingId));
      if (!result) {
        askTechStack();
        return;
      }
      const probeQ = result.unclearPhrase
        ? `You said "${result.unclearPhrase}" — ${result.followUp}`
        : result.followUp;
      askAssistant(probeQ);
      // Wait for admin's reply via onBulkProbeReply
    } catch (e) {
      setMessages((m) => m.filter((x) => x.id !== thinkingId));
      askAssistant(`(Skipping clarifier: ${toErrorMessage(e)})`);
      askTechStack();
    } finally {
      setThinking(false);
    }
  }

  function onBulkProbeReply(text: string) {
    pushUser(text);
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
    const phraseMatch = lastAssistant?.content.match(/You said "([^"]+)"/);
    const phrase = phraseMatch?.[1] ?? 'clarification';
    setBrief((b) => ({
      ...b,
      notes: [...b.notes, { phrase, answer: text }],
    }));
    askTechStack();
  }

  function onBulkDownload(sections: Record<string, string>) {
    // Stage the current values into the brief so the export reflects them.
    const briefForExport: InterviewBrief = { ...briefRef.current, sections };
    const md = composeChecklistTemplate(briefForExport, {
      ...(assignee?.name ? { assigneeName: assignee.name } : {}),
    });
    const fname = `${safeFilename(briefRef.current.title || 'task')}.checklist.req.md`;
    downloadText(md, fname);
  }

  // ---------- Tech stack ----------

  function askTechStack() {
    setStep('pick-tech-stack');
    askAssistant(
      `Pick the tech stack for this task. Helps the assignee see what tools are involved at a glance.`,
      <TechStackPicker
        initial={briefRef.current.techStack}
        onConfirm={(picks) => {
          setBrief((b) => ({ ...b, techStack: picks }));
          setCurrentEmbed(null);
          if (picks.length > 0) pushUser(`Tech stack: ${picks.join(', ')}`);
          else pushUser('No tech stack specified.');
          askExpectedOutput();
        }}
      />,
    );
  }

  // ---------- Expected output ----------

  function askExpectedOutput() {
    setStep('ask-expected-output');
    askAssistant(
      'Describe the exact expected output — what does the final deliverable look like?',
    );
  }

  async function onExpectedOutput(text: string) {
    const updated = { ...briefRef.current, expectedOutput: text };
    setBrief(updated);
    pushUser(text);
    await runOutputProbe(updated, false);
  }

  async function runOutputProbe(updatedBrief: InterviewBrief, alreadyProbed: boolean) {
    if (alreadyProbed) {
      askDiagrams();
      return;
    }
    setStep('probe-output');
    setThinking(true);
    const thinkingId = newId('msg');
    setMessages((m) => [
      ...m,
      { id: thinkingId, role: 'assistant', content: '', pending: true },
    ]);

    try {
      const result = await probeForClarity({
        field: 'expected_output',
        brief: updatedBrief,
        history: [],
      });
      setMessages((m) => m.filter((x) => x.id !== thinkingId));
      if (!result) {
        askDiagrams();
        return;
      }
      const probeQ = result.unclearPhrase
        ? `You said "${result.unclearPhrase}" — ${result.followUp}`
        : result.followUp;
      askAssistant(probeQ);
    } catch (e) {
      setMessages((m) => m.filter((x) => x.id !== thinkingId));
      askAssistant(`(Skipping clarifier: ${toErrorMessage(e)})`);
      askDiagrams();
    } finally {
      setThinking(false);
    }
  }

  function onOutputProbeReply(text: string) {
    pushUser(text);
    const cur = briefRef.current;
    setBrief((b) => ({
      ...b,
      expectedOutput: `${cur.expectedOutput}\n\n_${text}_`,
    }));
    askDiagrams();
  }

  // ---------- Diagrams + attachments + summary ----------

  function askDiagrams() {
    setStep('diagrams');
    askAssistant(
      `Optional: drop in diagrams or mockups (architecture sketches, UI mockups, screenshots).`,
    );
  }

  function askAttachments() {
    setStep('attachments');
    askAssistant(
      `Anything else to attach? Files (specs, datasets) or notes (links, snippets, constraints) — optional.`,
    );
  }

  function showSummary() {
    setStep('summary');
    askAssistant(`Here's the brief I have. Edit anything that's off and confirm to assign.`);
  }

  /**
   * Imports a previously-downloaded .req.md, matching frontmatter metadata
   * (project, client, assignee) to existing records by name. Skips straight
   * to the summary step with everything pre-filled. Admin can still edit
   * before assigning.
   */
  async function handleImportReqMd(file: File) {
    setImportError(null);
    try {
      const md = await readTextFile(file);
      const parsed: ParsedReqMd = parseReqMd(md);

      // Match metadata to existing records (by name, case-insensitive)
      const matchedAssignee = parsed.assigneeName
        ? users.find(
            (u) => u.name.toLowerCase() === parsed.assigneeName!.toLowerCase(),
          )
        : null;
      const matchedProject = parsed.projectName
        ? projects.find((p) => p.name.toLowerCase() === parsed.projectName!.toLowerCase())
        : null;
      const matchedClient = parsed.clientName
        ? clients.find((c) => c.name.toLowerCase() === parsed.clientName!.toLowerCase())
        : null;

      // Lead-mode locks the project — if the imported project differs, refuse.
      if (leadMode && initialProjectId && matchedProject?.id !== initialProjectId) {
        setImportError(
          `This .req.md is for a different project. Lead-mode is locked to "${
            projects.find((p) => p.id === initialProjectId)?.name ?? '—'
          }".`,
        );
        return;
      }

      // Need an assignee — either matched from the file or already set in state.
      const finalAssigneeId = matchedAssignee?.id ?? assigneeId;
      if (!finalAssigneeId) {
        setImportError(
          parsed.assigneeName
            ? `Couldn't find an employee named "${parsed.assigneeName}". Pick the assignee first, then import again.`
            : 'No assignee in the .req.md. Pick the assignee first, then import again.',
        );
        return;
      }

      const newBrief: InterviewBrief = {
        ...INITIAL_BRIEF,
        type: parsed.type ?? 'development',
        ...(parsed.devKind ? { devKind: parsed.devKind } : {}),
        ...(matchedProject
          ? { projectId: matchedProject.id, projectName: matchedProject.name }
          : parsed.projectName
          ? { projectName: parsed.projectName }
          : {}),
        ...(matchedClient
          ? { clientId: matchedClient.id, clientName: matchedClient.name }
          : parsed.clientName
          ? { clientName: parsed.clientName }
          : {}),
        title: parsed.title ?? '',
        shortDescription: parsed.shortDescription,
        outline: parsed.outline.sections.length > 0 ? parsed.outline : null,
        sections: parsed.sections,
        notes: parsed.notes,
        techStack: parsed.techStack,
        expectedOutput: parsed.expectedOutput,
      };
      setBrief(newBrief);

      setAssigneeId(finalAssigneeId);

      // Drop any existing chat history and jump to summary
      setMessages([]);
      pushAssistant(
        `Imported "${parsed.title ?? file.name}". Review the brief below and tweak anything before assigning.`,
      );

      const missing: string[] = [];
      if (parsed.assigneeName && !matchedAssignee)
        missing.push(`assignee "${parsed.assigneeName}" not found — pick one in the summary`);
      if (parsed.projectName && !matchedProject)
        missing.push(`project "${parsed.projectName}" not found`);
      if (parsed.clientName && !matchedClient)
        missing.push(`client "${parsed.clientName}" not found`);
      if (missing.length > 0) {
        pushAssistant(`(Heads up: ${missing.join('; ')}.)`);
      }

      showSummary();
    } catch (e) {
      setImportError(toErrorMessage(e));
    }
  }

  async function confirmAndSave(finalBrief: InterviewBrief) {
    if (!assigneeId || !flowdeskUser) return;
    setStep('saving');
    setSaveError(null);
    try {
      if (
        finalBrief.type === 'leadership' &&
        finalBrief.projectId &&
        finalBrief.leadId
      ) {
        await setProjectLeadAndMembers(
          finalBrief.projectId,
          finalBrief.leadId,
          finalBrief.memberIds,
        );
      }

      const sequenceIndex = await nextSequenceIndex(assigneeId);
      const briefMarkdown = composeBrief(finalBrief);
      const task: Task = {
        id: newId('tsk'),
        title: finalBrief.title.trim(),
        type: finalBrief.type ?? 'development',
        ...(finalBrief.devKind ? { devKind: finalBrief.devKind } : {}),
        ...(finalBrief.projectId ? { projectId: finalBrief.projectId } : {}),
        ...(finalBrief.clientId ? { clientId: finalBrief.clientId } : {}),
        assigneeId,
        assignerId: flowdeskUser.id,
        status: 'pending',
        brief: briefMarkdown,
        expectedOutput: finalBrief.expectedOutput.trim(),
        attachments,
        techStack: finalBrief.techStack,
        createdAt: new Date().toISOString(),
        parallelWith: [],
        sequenceIndex,
        timeline: [],
      };
      await saveTask(task);
      setStep('done');
      pushAssistant(
        `Task "${task.title}" assigned to ${assignee?.name}. They'll see it on their flowchart.`,
      );
      const dest =
        leadMode && initialProjectId
          ? flowdeskUser.role === 'employee'
            ? `/employee/projects/${initialProjectId}`
            : `/admin/tasks`
          : '/admin/employees';
      setTimeout(() => navigate(dest), 900);
    } catch (e) {
      setSaveError(toErrorMessage(e));
      setStep('summary');
    }
  }

  // ---------- Input area ----------

  function inputArea() {
    if (booting) return null;
    if (bootError) return null;

    if (step === 'fill-sections-bulk' && brief.outline) {
      return (
        <BulkSectionsForm
          outline={brief.outline}
          initial={brief.sections}
          onSubmit={onBulkSectionsSubmit}
          onDownload={onBulkDownload}
          onUpload={(file) => handleImportReqMd(file)}
        />
      );
    }

    if (step === 'attachments') {
      return (
        <AttachmentsStep
          attachments={attachments}
          onChange={setAttachments}
          onContinue={() => {
            const nonImage = attachments.filter(
              (a) => a.kind !== 'file' || !a.mimeType?.startsWith('image/'),
            );
            if (nonImage.length > 0) {
              pushUser(
                `Attached ${nonImage.length} file${nonImage.length === 1 ? '' : 's'}/note${nonImage.length === 1 ? '' : 's'}.`,
              );
            } else {
              pushUser('No additional attachments.');
            }
            showSummary();
          }}
        />
      );
    }

    if (step === 'diagrams') {
      return (
        <DiagramsStep
          attachments={attachments}
          onChange={setAttachments}
          onContinue={() => {
            const diagrams = attachments.filter(
              (a) => a.kind === 'file' && a.mimeType?.startsWith('image/'),
            );
            if (diagrams.length > 0) {
              pushUser(`Added ${diagrams.length} diagram${diagrams.length === 1 ? '' : 's'}.`);
            } else {
              pushUser('No diagrams.');
            }
            askAttachments();
          }}
        />
      );
    }

    if (step === 'summary' || step === 'saving') {
      return (
        <SummaryCard
          brief={brief}
          assigneeName={assignee?.name ?? '—'}
          attachments={attachments}
          saving={step === 'saving'}
          error={saveError}
          onCancel={() => navigate(-1)}
          onConfirm={(b) => void confirmAndSave(b)}
        />
      );
    }

    const textInputSteps: InterviewStep[] = [
      'ask-title',
      'ask-short-description',
      'ask-expected-output',
      'probe-output',
      'probe-after-bulk',
    ];
    if (!textInputSteps.includes(step)) return null;

    const placeholder =
      step === 'ask-title'
        ? 'A clear, short title…'
        : step === 'ask-short-description'
        ? '2-3 sentences on what + why…'
        : step === 'ask-expected-output'
        ? 'What the final deliverable looks like…'
        : 'Quick clarifier…';

    return (
      <ChatInput
        placeholder={placeholder}
        busy={thinking}
        onSend={(text) => {
          if (step === 'ask-title') return onTitle(text);
          if (step === 'ask-short-description') return void onShortDescription(text);
          if (step === 'ask-expected-output') return void onExpectedOutput(text);
          if (step === 'probe-output') return onOutputProbeReply(text);
          if (step === 'probe-after-bulk') return onBulkProbeReply(text);
        }}
      />
    );
  }

  // ---------- Render ----------

  return (
    <div className="fixed inset-0 z-40 bg-navy-950 flex flex-col">
      <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between gap-4">
        <button
          type="button"
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 shrink-0"
          onClick={() => navigate(-1)}
        >
          <ChevronLeftIcon size={16} />
          Back
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-1.5 h-1.5 rounded-full bg-teal shadow-teal-glow shrink-0" />
          <span className="font-mono text-xs text-teal uppercase tracking-wider">New Task</span>
          {assignee && (
            <>
              <span className="text-slate-600">·</span>
              <span className="text-sm text-slate-300 truncate">{assignee.name}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-white/10 bg-navy-900/60 text-slate-300 hover:border-teal/40 hover:bg-teal/5 hover:text-white transition-colors"
            title="Import a previously-saved .req.md to skip the questions"
          >
            <PaperclipIcon size={13} />
            Import .req.md
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".md,text/markdown,text/plain"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void handleImportReqMd(f);
            }}
          />
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg text-slate-400 hover:bg-white/5 hover:text-slate-200"
            aria-label="Close"
          >
            <CloseIcon size={18} />
          </button>
        </div>
      </div>
      {importError && (
        <div className="px-6 py-2 border-b border-amber-500/20 bg-amber-500/10 text-amber-300 text-xs">
          {importError}
        </div>
      )}

      {booting && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2 text-slate-400">
            <Spinner /> Loading…
          </div>
        </div>
      )}

      {bootError && (
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-md glass-card p-6 text-amber-300 text-sm">{bootError}</div>
        </div>
      )}

      {!booting && !bootError && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="flex-1 min-h-0"
        >
          <ChatWindow messages={messages} inputArea={inputArea()} />
        </motion.div>
      )}
    </div>
  );
}
