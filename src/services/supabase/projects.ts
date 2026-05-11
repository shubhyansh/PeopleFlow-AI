import { supabase } from './client';
import { asError } from '../../lib/errors';
import type { Project } from '../../domain/types';
import type { ProjectRow } from './schema';

function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    clientId: row.client_id ?? '',
    ...(row.lead_id ? { leadId: row.lead_id } : {}),
    memberIds: row.member_ids,
    createdAt: row.created_at,
  };
}

export async function listProjects(): Promise<Project[]> {
  const { data, error } = await supabase()
    .from('projects')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw asError(error);
  return ((data ?? []) as ProjectRow[]).map(rowToProject);
}

export async function addProject(project: Project): Promise<void> {
  const { error } = await supabase()
    .from('projects')
    .insert({
      id: project.id,
      name: project.name,
      client_id: project.clientId || null,
      lead_id: project.leadId ?? null,
      member_ids: project.memberIds,
    });
  if (error) throw asError(error);
}

export async function getProject(id: string): Promise<Project | null> {
  const { data, error } = await supabase()
    .from('projects')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw asError(error);
  return data ? rowToProject(data as ProjectRow) : null;
}

/** Projects where the given user is the assigned lead. */
export async function listLeadProjects(userId: string): Promise<Project[]> {
  const { data, error } = await supabase()
    .from('projects')
    .select('*')
    .eq('lead_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw asError(error);
  return ((data ?? []) as ProjectRow[]).map(rowToProject);
}

/** Used by the leadership task creation flow to wire up project ↔ team. */
export async function setProjectLeadAndMembers(
  projectId: string,
  leadId: string,
  memberIds: string[],
): Promise<void> {
  const { error } = await supabase()
    .from('projects')
    .update({
      lead_id: leadId,
      member_ids: Array.from(new Set([leadId, ...memberIds])), // lead is always in the team
    })
    .eq('id', projectId);
  if (error) throw asError(error);
}

/** Add a user to a project's member list (idempotent). */
export async function addProjectMember(projectId: string, userId: string): Promise<void> {
  const project = await getProject(projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);
  if (project.memberIds.includes(userId)) return;
  await updateProject(projectId, { memberIds: [...project.memberIds, userId] });
}

/** Remove a user from a project's team. Refuses to remove the current lead. */
export async function removeProjectMember(projectId: string, userId: string): Promise<void> {
  const project = await getProject(projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);
  if (project.leadId === userId) {
    throw new Error('Cannot remove the lead. Transfer leadership first, then remove.');
  }
  await updateProject(projectId, {
    memberIds: project.memberIds.filter((id) => id !== userId),
  });
}

/** Transfer leadership to another team member (must already be in memberIds). */
export async function setProjectLead(projectId: string, newLeadId: string): Promise<void> {
  const project = await getProject(projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);
  const memberIds = project.memberIds.includes(newLeadId)
    ? project.memberIds
    : [...project.memberIds, newLeadId];
  await updateProject(projectId, { leadId: newLeadId, memberIds });
}

export async function updateProject(id: string, patch: Partial<Project>): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.clientId !== undefined) update.client_id = patch.clientId || null;
  if (patch.leadId !== undefined) update.lead_id = patch.leadId ?? null;
  if (patch.memberIds !== undefined) update.member_ids = patch.memberIds;

  const { error } = await supabase().from('projects').update(update).eq('id', id);
  if (error) throw asError(error);
}
