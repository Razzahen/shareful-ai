import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { MANIFEST_FILE } from './constants.ts';
import type { ShareManifest } from './types.ts';

export function readManifest(dir: string): ShareManifest | null {
  const manifestPath = join(dir, MANIFEST_FILE);
  if (!existsSync(manifestPath)) {
    return null;
  }

  try {
    const content = readFileSync(manifestPath, 'utf-8');
    return JSON.parse(content) as ShareManifest;
  } catch {
    return null;
  }
}

export function writeManifest(dir: string, manifest: ShareManifest): void {
  const manifestPath = join(dir, MANIFEST_FILE);
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
}
