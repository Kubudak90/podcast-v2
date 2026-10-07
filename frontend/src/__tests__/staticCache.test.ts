import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const conf = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../nginx.conf'),
  'utf8'
);

function locationBlock(header: string): string {
  const start = conf.indexOf(header);
  expect(start).toBeGreaterThanOrEqual(0);
  const open = conf.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < conf.length; i += 1) {
    if (conf[i] === '{') depth += 1;
    if (conf[i] === '}') depth -= 1;
    if (depth === 0) return conf.slice(start, i + 1);
  }
  throw new Error(`Unclosed location block: ${header}`);
}

describe('frontend nginx cache policy', () => {
  it('does not mark every javascript file immutable for a year', () => {
    expect(conf).not.toMatch(/location\s+~\*?[^\n]*\\\.js/);
    expect(conf).not.toMatch(/expires\s+1y/);
  });

  it('keeps hashed build assets cached and sniff-safe', () => {
    const assets = locationBlock('location /assets/');
    expect(assets).toMatch(/max-age=31536000/);
    expect(assets).toMatch(/immutable/);
    expect(assets).not.toMatch(/immutable"\s+always/);
    expect(assets).toMatch(/X-Content-Type-Options\s+"nosniff"/);
    expect(assets).toMatch(/try_files\s+\$uri\s+=404/);
  });

  it('revalidates the service worker', () => {
    const sw = locationBlock('location = /sw.js');
    expect(sw).toMatch(/Cache-Control\s+"no-cache"/);
    expect(sw).not.toMatch(/immutable/);
    expect(sw).toMatch(/X-Content-Type-Options\s+"nosniff"/);
    expect(sw).toMatch(/try_files\s+\$uri\s+=404/);
  });

  it('revalidates the app shell', () => {
    const root = locationBlock('location / {');
    expect(root).toMatch(/Cache-Control\s+"no-cache"/);
    expect(root).not.toMatch(/immutable/);
    expect(root).toMatch(/try_files\s+\$uri\s+\$uri\/\s+\/index\.html/);
    expect(root).toMatch(/X-Content-Type-Options\s+"nosniff"/);
  });
});
