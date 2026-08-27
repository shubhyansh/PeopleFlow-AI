/**
 * The demo swap is only worth anything if the *shipping* service modules run
 * unchanged against it. These tests point `services/supabase/client` at the
 * demo store -- exactly what the Vite plugin does for the published build --
 * and then exercise the real service and auth functions.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/supabase/client', () => import('../supabaseClient'));

const { listUsers, getUserByUsername, addUser, updateUser, deleteUser } = await import(
  '../../services/supabase/users'
);
const { listProjects, getProject, listLeadProjects, addProjectMember, removeProjectMember, setProjectLead } =
  await import('../../services/supabase/projects');
const { listClients } = await import('../../services/supabase/clients');
const { listAllTasks, listTasksByAssignee, listTasksByProject, loadTask, saveTask, updateTask, nextSequenceIndex } =
  await import('../../services/supabase/tasks');
const { signIn, InvalidCredentialsError } = await import('../../auth/flowdeskAuth');
const { demoDb } = await import('../supabaseClient');
const seedModule = await import('../seed');

/** The store is module-level, so restore anything a test mutates. */
let snapshot: Record<string, unknown[]>;

beforeEach(() => {
  const db = demoDb();
  if (!snapshot) {
    snapshot = {
      users: db.rows('users'),
      clients: db.rows('clients'),
      projects: db.rows('projects'),
      tasks: db.rows('tasks'),
    };
  }
});

describe('seed integrity', () => {
  it('every task points at a real assignee', () => {
    const ids = new Set(seedModule.users.map((u) => u.id as string));
    ids.add('admin');
    for (const task of seedModule.tasks) {
      expect(ids.has(task.assignee_id as string), `${task.id} assignee`).toBe(true);
      expect(ids.has(task.assigner_id as string), `${task.id} assigner`).toBe(true);
    }
  });

  it('every task points at a real project and client', () => {
    const projectIds = new Set(seedModule.projects.map((p) => p.id as string));
    const clientIds = new Set(seedModule.clients.map((c) => c.id as string));
    for (const task of seedModule.tasks) {
      if (task.project_id) expect(projectIds.has(task.project_id as string)).toBe(true);
      if (task.client_id) expect(clientIds.has(task.client_id as string)).toBe(true);
    }
  });

  it('parallel_with only references tasks that exist', () => {
    const taskIds = new Set(seedModule.tasks.map((t) => t.id as string));
    for (const task of seedModule.tasks) {
      for (const other of task.parallel_with as string[]) {
        expect(taskIds.has(other), `${task.id} -> ${other}`).toBe(true);
      }
    }
  });

  it('project members and leads are real users', () => {
    const ids = new Set(seedModule.users.map((u) => u.id as string));
    for (const project of seedModule.projects) {
      for (const member of project.member_ids as string[]) expect(ids.has(member)).toBe(true);
      if (project.lead_id) expect(ids.has(project.lead_id as string)).toBe(true);
    }
  });

  it('a lead is always a member of the project they lead', () => {
    for (const project of seedModule.projects) {
      if (!project.lead_id) continue;
      expect((project.member_ids as string[])).toContain(project.lead_id as string);
    }
  });

  it('covers every task status the flowchart styles', () => {
    const statuses = new Set(seedModule.tasks.map((t) => t.status));
    for (const status of ['pending', 'active', 'parallel', 'blocked', 'requirements-addition', 'on-hold', 'completed']) {
      expect(statuses.has(status), status).toBe(true);
    }
  });

  it('usernames are unique', () => {
    const names = seedModule.users.map((u) => u.username);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('service modules against the demo store', () => {
  it('listUsers maps rows into the domain shape', async () => {
    const users = await listUsers();
    expect(users.length).toBe(seedModule.users.length);
    const priya = users.find((u) => u.username === 'priya');
    expect(priya?.name).toBe('Priya Raman');
    expect(priya?.designation).toBe('Engineering Lead');
    expect(priya?.passwordHash).toBeNull();
  });

  it('getUserByUsername is case-insensitive, as ilike is on Postgres', async () => {
    expect((await getUserByUsername('PRIYA'))?.id).toBe('u-priya');
    expect((await getUserByUsername('  mei  '))?.id).toBe('u-mei');
    expect(await getUserByUsername('nobody')).toBeNull();
  });

  it('listClients and listProjects come back in creation order', async () => {
    expect((await listClients()).map((c) => c.id)).toEqual([
      'c-northwind',
      'c-vantage',
      'c-internal',
    ]);
    expect((await listProjects()).map((p) => p.id)).toEqual([
      'p-checkout',
      'p-portal',
      'p-platform',
    ]);
  });

  it('a project with no lead maps to an absent leadId', async () => {
    const platform = await getProject('p-platform');
    expect(platform?.leadId).toBeUndefined();
    expect(platform?.memberIds).toEqual(['u-tom', 'u-arjun']);
  });

  it('listLeadProjects finds the projects a user leads', async () => {
    expect((await listLeadProjects('u-priya')).map((p) => p.id)).toEqual(['p-checkout']);
    expect(await listLeadProjects('u-mei')).toEqual([]);
  });

  it('listAllTasks is newest first', async () => {
    const tasks = await listAllTasks();
    const times = tasks.map((t) => new Date(t.createdAt).getTime());
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });

  it('listTasksByAssignee is ordered by the queue position', async () => {
    const mei = await listTasksByAssignee('u-mei');
    expect(mei.map((t) => t.sequenceIndex)).toEqual([0, 1]);
    expect(mei[0].title).toBe('Guest checkout without an account');
  });

  it('listTasksByProject returns only that project', async () => {
    const portal = await listTasksByProject('p-portal');
    expect(portal.length).toBeGreaterThan(0);
    expect(portal.every((t) => t.projectId === 'p-portal')).toBe(true);
  });

  it('loadTask maps the timeline and optional columns', async () => {
    const task = await loadTask('t-records-view');
    expect(task?.status).toBe('completed');
    expect(task?.completedAt).toBeTruthy();
    expect(task?.timeline.at(-1)?.kind).toBe('completed');
    expect(task?.techStack).toEqual(['React', 'TypeScript']);
  });

  it('a blocked task keeps its blocker note', async () => {
    const task = await loadTask('t-payment-service');
    expect(task?.status).toBe('blocked');
    expect(task?.timeline.some((e) => e.kind === 'blocker')).toBe(true);
  });

  it('nextSequenceIndex continues the assignee queue', async () => {
    expect(await nextSequenceIndex('u-mei')).toBe(2);
    expect(await nextSequenceIndex('u-nobody')).toBe(0);
  });

  it('saveTask then loadTask round-trips a new task', async () => {
    const now = new Date().toISOString();
    await saveTask({
      id: 't-roundtrip',
      title: 'Round trip',
      type: 'development',
      devKind: 'docs',
      projectId: 'p-platform',
      clientId: 'c-internal',
      assigneeId: 'u-tom',
      assignerId: 'admin',
      status: 'pending',
      brief: '## Scope\nWrite it down.',
      expectedOutput: 'A page.',
      attachments: [],
      techStack: ['Markdown'],
      createdAt: now,
      parallelWith: [],
      sequenceIndex: 9,
      timeline: [],
    });
    const loaded = await loadTask('t-roundtrip');
    expect(loaded?.title).toBe('Round trip');
    expect(loaded?.devKind).toBe('docs');

    await updateTask('t-roundtrip', { status: 'active', techStack: ['Markdown', 'MDX'] });
    const updated = await loadTask('t-roundtrip');
    expect(updated?.status).toBe('active');
    expect(updated?.techStack).toEqual(['Markdown', 'MDX']);
    expect(updated?.title).toBe('Round trip'); // patch does not clobber
  });

  it('project membership can be added, and the lead cannot be removed', async () => {
    await addProjectMember('p-platform', 'u-sofia');
    expect((await getProject('p-platform'))?.memberIds).toContain('u-sofia');

    await addProjectMember('p-platform', 'u-sofia'); // idempotent
    expect(
      (await getProject('p-platform'))?.memberIds.filter((m) => m === 'u-sofia'),
    ).toHaveLength(1);

    await setProjectLead('p-platform', 'u-tom');
    await expect(removeProjectMember('p-platform', 'u-tom')).rejects.toThrow(/Transfer leadership/);

    await removeProjectMember('p-platform', 'u-sofia');
    expect((await getProject('p-platform'))?.memberIds).not.toContain('u-sofia');
  });

  it('user CRUD works end to end', async () => {
    await addUser({
      id: 'u-temp',
      username: 'temp',
      passwordHash: null,
      name: 'Temp Person',
      role: 'employee',
      designation: 'Contractor',
      description: '',
      createdAt: new Date().toISOString(),
    });
    expect((await getUserByUsername('temp'))?.name).toBe('Temp Person');
    await updateUser('u-temp', { designation: 'Consultant' });
    expect((await getUserByUsername('temp'))?.designation).toBe('Consultant');
    await deleteUser('u-temp');
    expect(await getUserByUsername('temp')).toBeNull();
  });
});

describe('sign-in against the demo store', () => {
  it('accepts the hardcoded administrator', async () => {
    const result = await signIn('admin', 'Admin@123');
    expect(result.kind).toBe('signed-in');
    expect(result.user.role).toBe('admin');
  });

  it('rejects a wrong admin password', async () => {
    await expect(signIn('admin', 'nope')).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('rejects an unknown username', async () => {
    await expect(signIn('ghost', 'whatever')).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('sets the password on a teammate first login, then verifies it', async () => {
    const first = await signIn('sofia', 'demo-password');
    expect(first.kind).toBe('password-set');
    expect(first.user.name).toBe('Sofia Almeida');

    const second = await signIn('sofia', 'demo-password');
    expect(second.kind).toBe('signed-in');

    await expect(signIn('sofia', 'wrong-password')).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );
  }, 20_000);

  it('refuses a short password on first login', async () => {
    await expect(signIn('tom', 'abc')).rejects.toThrow(/at least 6/);
  });
});
