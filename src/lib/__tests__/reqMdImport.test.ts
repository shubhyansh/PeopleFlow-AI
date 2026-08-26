import { describe, expect, it } from 'vitest';
import { resolveImportedBrief, type ResolveImportInput } from '../reqMdImport';
import { CLIENTS, PROJECTS, USERS, parsedFixture } from './fixtures';

function resolve(overrides: Partial<ResolveImportInput> = {}) {
  return resolveImportedBrief({
    parsed: parsedFixture(),
    users: USERS,
    projects: PROJECTS,
    clients: CLIENTS,
    currentAssigneeId: null,
    lockedProjectId: null,
    ...overrides,
  });
}

describe('resolveImportedBrief — admin mode', () => {
  it('matches project, client and assignee by name', () => {
    const result = resolve();

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.assigneeId).toBe('u-asha');
    expect(result.brief.projectId).toBe('p-atlas');
    expect(result.brief.clientId).toBe('c-north');
    expect(result.warnings).toEqual([]);
  });

  it('matches names case- and whitespace-insensitively', () => {
    const result = resolve({
      parsed: parsedFixture({
        projectName: '  aTLaS ',
        clientName: 'northwind',
        assigneeName: 'ASHA NAIR  ',
      }),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.brief.projectId).toBe('p-atlas');
    expect(result.brief.clientId).toBe('c-north');
    expect(result.assigneeId).toBe('u-asha');
  });

  it('carries the brief body across unchanged', () => {
    const result = resolve();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.brief.title).toBe('Rate-limit the export endpoint');
    expect(result.brief.devKind).toBe('backend');
    expect(result.brief.techStack).toEqual(['TypeScript', 'Postgres']);
    expect(result.brief.sections).toEqual({ scope: 'Token bucket in front of `/api/export`.' });
    expect(result.brief.notes).toHaveLength(1);
  });

  it('defaults a type-less file to development', () => {
    const result = resolve({ parsed: parsedFixture({ type: undefined }) });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.brief.type).toBe('development');
  });

  it('leaves project and client untouched when the file names neither', () => {
    const result = resolve({
      parsed: parsedFixture({ projectName: undefined, clientName: undefined }),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.brief.projectId).toBeNull();
    expect(result.brief.projectName).toBe('');
    expect(result.brief.clientId).toBeNull();
    expect(result.brief.clientName).toBe('');
    expect(result.warnings).toEqual([]);
  });

  it('substitutes an empty title when the file has no title line', () => {
    const result = resolve({ parsed: parsedFixture({ title: undefined }) });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.brief.title).toBe('');
  });

  it('nulls an empty outline so the summary step does not render an empty shell', () => {
    const result = resolve({ parsed: parsedFixture({ outline: { sections: [] } }) });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.brief.outline).toBeNull();
  });

  it('keeps an unknown project as a plain name and warns instead of refusing', () => {
    const result = resolve({ parsed: parsedFixture({ projectName: 'Cassiopeia' }) });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.brief.projectId).toBeNull();
    expect(result.brief.projectName).toBe('Cassiopeia');
    expect(result.warnings).toContain('project "Cassiopeia" not found');
  });

  // A project has exactly one client, so when the file names a client nobody
  // recognises the matched project's own client is the better answer. The name
  // from the file is still reported as a warning so the mismatch is visible.
  it('falls back to the client of the matched project when the named client is unknown', () => {
    const result = resolve({ parsed: parsedFixture({ clientName: 'Umbrella Corp' }) });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.brief.clientId).toBe('c-north');
    expect(result.brief.clientName).toBe('Northwind');
    expect(result.warnings).toContain('client "Umbrella Corp" not found');
  });

  it('keeps an unknown client as a plain name when there is no project to inherit from', () => {
    const result = resolve({
      parsed: parsedFixture({ projectName: undefined, clientName: 'Umbrella Corp' }),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.brief.clientId).toBeNull();
    expect(result.brief.clientName).toBe('Umbrella Corp');
    expect(result.warnings).toContain('client "Umbrella Corp" not found');
  });

  // Documents current behaviour, which is arguably wrong: a named client that
  // exists overrides the project's own client, so the brief can end up saying
  // Atlas belongs to Acme Robotics. Tracked as a follow-up rather than changed
  // here, because the fix is a behaviour change and this is a test pass.
  it('lets an existing named client override the client of the matched project', () => {
    const result = resolve({ parsed: parsedFixture({ clientName: 'Acme Robotics' }) });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.brief.projectId).toBe('p-atlas');
    expect(result.brief.clientId).toBe('c-acme');
    expect(result.warnings).toEqual([]);
  });
});

describe('resolveImportedBrief — assignee resolution', () => {
  it('falls back to the assignee already picked in the chat, with a warning', () => {
    const result = resolve({
      parsed: parsedFixture({ assigneeName: 'Nobody Here' }),
      currentAssigneeId: 'u-rohit',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.assigneeId).toBe('u-rohit');
    expect(result.warnings).toContain(
      'assignee "Nobody Here" not found — pick one in the summary',
    );
  });

  it('refuses a file with an unknown assignee and no fallback', () => {
    const result = resolve({ parsed: parsedFixture({ assigneeName: 'Nobody Here' }) });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('Nobody Here');
  });

  it('refuses a file with no assignee line and no fallback', () => {
    const result = resolve({ parsed: parsedFixture({ assigneeName: undefined }) });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(
      'No assignee in the .req.md. Pick the assignee first, then import again.',
    );
  });
});

describe('resolveImportedBrief — lead mode', () => {
  // Regression: a brief with no `project:` line is portable, not foreign. The
  // previous check compared `matchedProject?.id !== lockedProjectId`, so a null
  // match made `undefined !== 'p-atlas'` true and the file was refused.
  it('inherits the locked project when the file names no project', () => {
    const result = resolve({
      parsed: parsedFixture({ projectName: undefined, clientName: undefined }),
      lockedProjectId: 'p-atlas',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.brief.projectId).toBe('p-atlas');
    expect(result.brief.projectName).toBe('Atlas');
    expect(result.warnings).toEqual([]);
  });

  it('inherits the client of the locked project too', () => {
    const result = resolve({
      parsed: parsedFixture({ projectName: undefined, clientName: undefined }),
      lockedProjectId: 'p-atlas',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.brief.clientId).toBe('c-north');
    expect(result.brief.clientName).toBe('Northwind');
  });

  it('accepts a file that names the locked project explicitly', () => {
    const result = resolve({ lockedProjectId: 'p-atlas' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.brief.projectId).toBe('p-atlas');
  });

  it('refuses a file belonging to another existing project', () => {
    const result = resolve({
      parsed: parsedFixture({ projectName: 'Borealis' }),
      lockedProjectId: 'p-atlas',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('different project');
    expect(result.error).toContain('Atlas');
  });

  it('refuses a file naming a project that does not exist here, and says so', () => {
    const result = resolve({
      parsed: parsedFixture({ projectName: 'Cassiopeia' }),
      lockedProjectId: 'p-atlas',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('Cassiopeia');
    expect(result.error).toContain("doesn't exist here");
  });

  it('prefers an explicitly named client over the inherited one', () => {
    const result = resolve({
      parsed: parsedFixture({ projectName: undefined, clientName: 'Acme Robotics' }),
      lockedProjectId: 'p-atlas',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.brief.projectId).toBe('p-atlas');
    expect(result.brief.clientId).toBe('c-acme');
  });
});
