import fse from 'fs-extra';
import path from 'node:path';
import { log } from './logger.js';

/**
 * Expand ~ to $HOME in paths
 */
export function expandHome(p: string): string {
  if (p.startsWith('~/') || p === '~') {
    return path.join(process.env.HOME ?? '', p.slice(1));
  }
  return p;
}

/**
 * Ensure a directory exists
 */
export async function ensureDir(dir: string): Promise<void> {
  await fse.ensureDir(expandHome(dir));
}

/**
 * Read a file, return null if not found
 */
export async function readFileSafe(filePath: string): Promise<string | null> {
  try {
    return await fse.readFile(expandHome(filePath), 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Write a file, creating parent dirs as needed
 */
export async function writeFile(filePath: string, content: string): Promise<void> {
  const expanded = expandHome(filePath);
  await fse.ensureDir(path.dirname(expanded));
  await fse.writeFile(expanded, content, 'utf-8');
}

/**
 * Read JSON file, return null if not found
 */
export async function readJson<T = unknown>(filePath: string): Promise<T | null> {
  const content = await readFileSafe(filePath);
  if (content === null) return null;
  try {
    return JSON.parse(content) as T;
  } catch {
    log.warn(`Failed to parse JSON: ${filePath}`);
    return null;
  }
}

/**
 * Write JSON file
 */
export async function writeJson(filePath: string, data: unknown): Promise<void> {
  await writeFile(filePath, JSON.stringify(data, null, 2) + '\n');
}

/**
 * Copy a directory recursively
 */
export async function copyDir(src: string, dest: string): Promise<void> {
  await fse.copy(expandHome(src), expandHome(dest), { overwrite: true });
}

/**
 * Copy a file
 */
export async function copyFile(src: string, dest: string): Promise<void> {
  const destExpanded = expandHome(dest);
  await fse.ensureDir(path.dirname(destExpanded));
  await fse.copy(expandHome(src), destExpanded, { overwrite: true });
}

/**
 * List directories in a path (non-recursive, only directories)
 */
export async function listDirs(dirPath: string): Promise<string[]> {
  const expanded = expandHome(dirPath);
  if (!await fse.pathExists(expanded)) return [];
  const entries = await fse.readdir(expanded, { withFileTypes: true });
  return entries.filter(e => e.isDirectory()).map(e => e.name);
}

/**
 * List files in a path (non-recursive, only files)
 */
export async function listFiles(dirPath: string): Promise<string[]> {
  const expanded = expandHome(dirPath);
  if (!await fse.pathExists(expanded)) return [];
  const entries = await fse.readdir(expanded, { withFileTypes: true });
  return entries.filter(e => e.isFile()).map(e => e.name);
}

/**
 * Check if a path exists
 */
export async function pathExists(p: string): Promise<boolean> {
  return fse.pathExists(expandHome(p));
}

/**
 * Remove a file or directory
 */
export async function remove(p: string): Promise<void> {
  await fse.remove(expandHome(p));
}
