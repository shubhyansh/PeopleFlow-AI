import { INITIAL_BRIEF, type InterviewBrief, type ParsedReqMd } from './taskInterview';
import type { Client, Project, User } from '../domain/types';

export interface ResolveImportInput {
  /** Output of `parseReqMd` for the uploaded file. */
  parsed: ParsedReqMd;
  users: User[];
  projects: Project[];
  clients: Client[];
  /** Assignee already picked in the chat, if any. */
  currentAssigneeId: string | null;
  /** Lead mode pins the task to one project; `null` in admin mode. */
  lockedProjectId: string | null;
}

export type ResolveImportResult =
  | {
      ok: true;
      brief: InterviewBrief;
      assigneeId: string;
      /** Non-fatal mismatches worth surfacing in the chat. */
      warnings: string[];
    }
  | { ok: false; error: string };

function byName<T extends { name: string }>(items: T[], name: string | undefined): T | null {
  if (!name) return null;
  const needle = name.trim().toLowerCase();
  if (!needle) return null;
  return items.find((item) => item.name.trim().toLowerCase() === needle) ?? null;
}

/**
 * Turns a parsed `.req.md` into a ready-to-review interview brief by matching
 * its frontmatter (project / client / assignee) against existing records by
 * name, case-insensitively.
 *
 * Pure — no React, no network, no Supabase. The caller decides what to do with
 * the result: `ok: false` renders the error banner, `ok: true` seeds the
 * summary step and prints `warnings` as a heads-up line.
 *
 * Lead mode: a file that names a *different* project is refused, because the
 * lead may only assign inside their own project. A file that names no project
 * at all inherits the locked project instead of being refused — a brief with
 * no project line is portable, not foreign.
 *
 * Client resolution: a project has exactly one client, so whenever a project
 * resolves its client is authoritative. A `client:` line naming somebody else
 * is reported as a warning and discarded rather than applied.
 */
export function resolveImportedBrief(input: ResolveImportInput): ResolveImportResult {
  const { parsed, users, projects, clients, currentAssigneeId, lockedProjectId } = input;

  const matchedAssignee = byName(users, parsed.assigneeName);
  const matchedProject = byName(projects, parsed.projectName);
  const matchedClient = byName(clients, parsed.clientName);

  const lockedProject = lockedProjectId
    ? projects.find((p) => p.id === lockedProjectId) ?? null
    : null;

  if (lockedProjectId && matchedProject && matchedProject.id !== lockedProjectId) {
    return {
      ok: false,
      error:
        `This .req.md is for a different project. Lead-mode is locked to ` +
        `"${lockedProject?.name ?? '—'}".`,
    };
  }
  if (lockedProjectId && !matchedProject && parsed.projectName) {
    return {
      ok: false,
      error:
        `This .req.md names project "${parsed.projectName}", which doesn't exist here. ` +
        `Lead-mode is locked to "${lockedProject?.name ?? '—'}".`,
    };
  }

  const assigneeId = matchedAssignee?.id ?? currentAssigneeId;
  if (!assigneeId) {
    return {
      ok: false,
      error: parsed.assigneeName
        ? `Couldn't find an employee named "${parsed.assigneeName}". Pick the assignee first, then import again.`
        : 'No assignee in the .req.md. Pick the assignee first, then import again.',
    };
  }

  // Lead mode with a project-less file: inherit the locked project (and its client).
  const effectiveProject = matchedProject ?? lockedProject;
  const inheritedClient = effectiveProject?.clientId
    ? clients.find((c) => c.id === effectiveProject.clientId) ?? null
    : null;

  // A project has exactly one client, so a `client:` line naming a different
  // existing client is a contradiction rather than an override: taking it at
  // face value produces a brief that says Atlas belongs to Acme Robotics while
  // pointing at Northwind's project. The project wins, and the discarded name
  // is surfaced as a warning so the mismatch stays visible instead of being
  // silently dropped.
  const clientContradictsProject =
    matchedClient !== null && inheritedClient !== null && matchedClient.id !== inheritedClient.id;
  const effectiveClient = clientContradictsProject
    ? inheritedClient
    : (matchedClient ?? inheritedClient);

  const brief: InterviewBrief = {
    ...INITIAL_BRIEF,
    type: parsed.type ?? 'development',
    ...(parsed.devKind ? { devKind: parsed.devKind } : {}),
    ...(effectiveProject
      ? { projectId: effectiveProject.id, projectName: effectiveProject.name }
      : parsed.projectName
        ? { projectName: parsed.projectName }
        : {}),
    ...(effectiveClient
      ? { clientId: effectiveClient.id, clientName: effectiveClient.name }
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

  const warnings: string[] = [];
  if (parsed.assigneeName && !matchedAssignee) {
    warnings.push(`assignee "${parsed.assigneeName}" not found — pick one in the summary`);
  }
  if (parsed.projectName && !matchedProject) {
    warnings.push(`project "${parsed.projectName}" not found`);
  }
  if (parsed.clientName && !matchedClient) {
    warnings.push(`client "${parsed.clientName}" not found`);
  } else if (clientContradictsProject && matchedClient && inheritedClient && effectiveProject) {
    warnings.push(
      `client "${matchedClient.name}" ignored — ${effectiveProject.name} belongs to ` +
        `"${inheritedClient.name}"`,
    );
  }

  return { ok: true, brief, assigneeId, warnings };
}
