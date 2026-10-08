import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

function ignoreLines(relativePath: string): string[] {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}

// Docker matches a pattern with no slash against every path segment, and
// `**` against any number of directories. These are the only forms we use.
function ignored(patterns: string[], filePath: string): boolean {
  const segments = filePath.split('/');
  return patterns.some((pattern) => {
    if (pattern === '**/.env' || pattern === '**/.env.*') {
      const base = pattern.slice(3);
      return segments.slice(0, -1).length > 0 && matchBase(base, segments[segments.length - 1]);
    }
    if (pattern.startsWith('**/')) {
      const name = pattern.slice(3);
      return segments.includes(name);
    }
    if (pattern.includes('*')) {
      return (
        segments.some((segment) => matchBase(pattern, segment)) || matchBase(pattern, filePath)
      );
    }
    return segments.includes(pattern) || filePath === pattern;
  });
}

function matchBase(pattern: string, name: string): boolean {
  const re = new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
  return re.test(name);
}

describe('docker build context', () => {
  it('keeps host node_modules and env files out of the backend image', () => {
    const patterns = ignoreLines('backend/.dockerignore');
    expect(ignored(patterns, 'node_modules/@prisma/client/package.json')).toBe(true);
    expect(ignored(patterns, '.env')).toBe(true);
    expect(ignored(patterns, '.env.local')).toBe(true);
    expect(ignored(patterns, 'prisma/.env')).toBe(true);
    expect(ignored(patterns, 'dist/index.js')).toBe(true);

    expect(ignored(patterns, 'package.json')).toBe(false);
    expect(ignored(patterns, 'package-lock.json')).toBe(false);
    expect(ignored(patterns, 'prisma/schema.prisma')).toBe(false);
    expect(ignored(patterns, 'src/index.ts')).toBe(false);
    expect(ignored(patterns, 'docker-entrypoint.sh')).toBe(false);
  });

  it('keeps host node_modules and env files out of the frontend image', () => {
    const patterns = ignoreLines('frontend/.dockerignore');
    expect(ignored(patterns, 'node_modules/esbuild/package.json')).toBe(true);
    expect(ignored(patterns, '.env')).toBe(true);
    expect(ignored(patterns, '.env.production')).toBe(true);
    expect(ignored(patterns, 'dist/index.html')).toBe(true);

    expect(ignored(patterns, 'package.json')).toBe(false);
    expect(ignored(patterns, 'package-lock.json')).toBe(false);
    expect(ignored(patterns, 'nginx.conf')).toBe(false);
    expect(ignored(patterns, 'src/main.tsx')).toBe(false);
    expect(ignored(patterns, 'public/manifest.json')).toBe(false);
  });

  it('still copies application source after installing Linux dependencies', () => {
    const backend = readFileSync(resolve(repoRoot, 'backend/Dockerfile'), 'utf8');
    const frontend = readFileSync(resolve(repoRoot, 'frontend/Dockerfile'), 'utf8');

    expect(backend.indexOf('RUN npm ci')).toBeGreaterThan(-1);
    expect(backend.indexOf('COPY . .')).toBeGreaterThan(backend.indexOf('RUN npm ci'));
    expect(frontend.indexOf('RUN npm install')).toBeGreaterThan(-1);
    expect(frontend.indexOf('COPY . .')).toBeGreaterThan(frontend.indexOf('RUN npm install'));
  });
});
