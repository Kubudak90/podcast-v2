import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function productionStage(dockerfile: string): string {
  const marker = 'FROM node:22-alpine AS production';
  const start = dockerfile.indexOf(marker);
  expect(start).toBeGreaterThan(-1);
  return dockerfile.slice(start);
}

describe('backend image recordings volume', () => {
  const dockerfile = readFileSync(path.join(backendRoot, 'Dockerfile'), 'utf8');
  const entrypoint = readFileSync(path.join(backendRoot, 'docker-entrypoint.sh'), 'utf8');
  const production = productionStage(dockerfile);

  it('starts as root so it can chown the volume, then drops to nodejs', () => {
    expect(production).toContain('apk add --no-cache su-exec');
    expect(production).toContain('adduser -S nodejs -u 1001 -G nodejs');
    expect(production).toContain('COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh');
    expect(production).toContain('ENTRYPOINT ["docker-entrypoint.sh"]');
    expect(production).not.toMatch(/^USER /m);
  });

  it('gives /recordings to nodejs without taking existing files', () => {
    expect(entrypoint).toContain('mkdir -p /recordings');
    expect(entrypoint).toContain('chown nodejs:nodejs /recordings');
    expect(entrypoint).not.toContain('chown -R');
    expect(entrypoint).toContain('exec su-exec nodejs "$@"');
    expect(entrypoint).toContain('if [ "$(id -u)" = "0" ]; then');
  });

  it('probes /health with node', () => {
    expect(production).not.toContain('wget');
    expect(production).toContain("fetch('http://127.0.0.1:3001/health')");
  });
});
