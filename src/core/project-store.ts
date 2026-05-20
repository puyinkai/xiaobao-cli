/**
 * Active project store, file-backed.
 *
 * CLI-specific layout (mirrors token-store):
 *
 *   PRIMARY  ~/.xiaobao/active-project.json           (writes here, mode 0600)
 *   FALLBACK ~/.openclaw/state/wangxiaobao/active-project.json (read-only legacy)
 *
 * To switch projects, run `xiaobao-cli project use ...`. The active project
 * is a single global selection per host (not per-workspace) — every command
 * that needs tenant/project context reads from here.
 */

import { chmod, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PRIMARY_DIR = join(homedir(), '.xiaobao');
const PRIMARY_FILE = join(PRIMARY_DIR, 'active-project.json');
const LEGACY_FILE = join(homedir(), '.openclaw', 'state', 'wangxiaobao', 'active-project.json');

export const PROJECT_FILE = PRIMARY_FILE;

export interface ActiveProject {
  tenantId: string;
  tenantName: string;
  projectId: string;
  projectName: string;
  /** ISO 8601 timestamp of the last switch. */
  updatedAt: string;
}

export async function loadActiveProject(): Promise<ActiveProject | null> {
  for (const f of [PRIMARY_FILE, LEGACY_FILE]) {
    if (!existsSync(f)) continue;
    try {
      const raw = await readFile(f, 'utf-8');
      return JSON.parse(raw) as ActiveProject;
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw e;
    }
  }
  return null;
}

export async function saveActiveProject(
  p: Omit<ActiveProject, 'updatedAt'>,
): Promise<ActiveProject> {
  const record: ActiveProject = { ...p, updatedAt: new Date().toISOString() };
  await mkdir(PRIMARY_DIR, { recursive: true, mode: 0o700 });
  await writeFile(PRIMARY_FILE, JSON.stringify(record, null, 2), { mode: 0o600 });
  try {
    await chmod(PRIMARY_FILE, 0o600);
  } catch {
    /* ignore */
  }
  return record;
}

/** Only clears the primary file; legacy openclaw path is left intact. */
export async function clearActiveProject(): Promise<void> {
  try {
    await unlink(PRIMARY_FILE);
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
  }
}

export class NoActiveProjectError extends Error {
  code = 'NO_ACTIVE_PROJECT' as const;
  hint =
    '先用 `xiaobao-cli project list [--keyword <kw>]` 查看可选项目，' +
    '再用 `xiaobao-cli project use --tenant-id ... --tenant-name ... ' +
    '--project-id ... --project-name ...` 激活。';
  constructor() {
    super('当前未设置激活项目');
    this.name = 'NoActiveProjectError';
  }
}

export async function requireActiveProject(): Promise<ActiveProject> {
  const p = await loadActiveProject();
  if (!p) throw new NoActiveProjectError();
  return p;
}
