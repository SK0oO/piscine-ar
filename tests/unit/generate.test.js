import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');
const ids = readdirSync(resolve(ROOT, 'models/params'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace(/\.json$/, ''));

describe('npm run generate', () => {
  it('écrit <id>.glb, <id>.usdz, <id>.png pour les 3 modèles', () => {
    expect(ids).toHaveLength(3);
    execSync('npm run generate', { cwd: ROOT, stdio: 'pipe' });
    for (const id of ids) {
      for (const ext of ['glb', 'usdz', 'png']) {
        const p = resolve(ROOT, 'models/out', `${id}.${ext}`);
        expect(existsSync(p), p).toBe(true);
        expect(statSync(p).size, p).toBeGreaterThan(0);
      }
      const glb = resolve(ROOT, 'models/out', `${id}.glb`);
      expect(statSync(glb).size).toBeLessThan(4 * 1024 * 1024);
      expect(readFileSync(glb).subarray(0, 4).toString('latin1')).toBe('glTF');
    }
  }, 120_000);
});
