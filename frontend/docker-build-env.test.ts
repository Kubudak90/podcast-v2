import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const frontendRoot = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.join(frontendRoot, 'docker-build-env.sh');

function runGuard(apiUrl: string | undefined): { status: number | null; stderr: string } {
  const env = { ...process.env };
  if (apiUrl === undefined) {
    delete env.VITE_API_URL;
  } else {
    env.VITE_API_URL = apiUrl;
  }
  const result = spawnSync('sh', [scriptPath], { env, encoding: 'utf8' });
  return { status: result.status, stderr: result.stderr ?? '' };
}

describe('frontend image API URL', () => {
  const dockerfile = readFileSync(path.join(frontendRoot, 'Dockerfile'), 'utf8');

  it('runs the guard before the production bundle is built', () => {
    const guardAt = dockerfile.indexOf('sh ./docker-build-env.sh');
    const buildAt = dockerfile.indexOf('npm run build');
    expect(guardAt).toBeGreaterThan(-1);
    expect(buildAt).toBeGreaterThan(guardAt);
  });

  it('rejects an empty API URL', () => {
    for (const value of [undefined, '', '   ', '\n\t']) {
      const result = runGuard(value);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('VITE_API_URL');
      expect(result.stderr).toContain('localhost');
    }
  });

  it('allows an explicit API URL, including a local one', () => {
    expect(runGuard('https://podchat.example.com').status).toBe(0);
    expect(runGuard('http://localhost:3001/api').status).toBe(0);
  });
});
