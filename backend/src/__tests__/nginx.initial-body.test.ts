import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const conf = readFileSync(resolve(__dirname, '../../../nginx/nginx.initial.conf'), 'utf8');

interface LocationBlock {
  header: string;
  body: string;
}

function locationBlocks(source: string): LocationBlock[] {
  const blocks: LocationBlock[] = [];
  const re = /location\s+([^{]+)\{/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source))) {
    const start = match.index + match[0].length;
    let depth = 1;
    let i = start;
    while (i < source.length && depth > 0) {
      if (source[i] === '{') depth += 1;
      else if (source[i] === '}') depth -= 1;
      i += 1;
    }
    blocks.push({
      header: match[1].trim(),
      body: source.slice(start, i - 1),
    });
  }
  return blocks;
}

function directive(body: string, name: string): string | undefined {
  const match = body.match(new RegExp(`^\\s*${name}\\s+([^;]+);`, 'm'));
  return match?.[1].trim();
}

/** nginx size units: k/m/g are 1024-based. */
function parseSize(value: string): number {
  const match = /^(\d+(?:\.\d+)?)([kmg])?$/i.exec(value.trim());
  if (!match) throw new Error(`Unparsed nginx size: ${value}`);
  const amount = Number(match[1]);
  const unit = (match[2] || '').toLowerCase();
  const factor = unit === 'k' ? 1024 : unit === 'm' ? 1024 * 1024 : unit === 'g' ? 1024 * 1024 * 1024 : 1;
  return amount * factor;
}

describe('HTTP nginx (pre-certificate) body limits', () => {
  const blocks = locationBlocks(conf);
  const byHeader = (header: string) => blocks.find((block) => block.header === header);

  it('lets a 200MB podcast upload through and keeps other API calls at 1MB', () => {
    const upload = byHeader('= /api/recordings/upload');
    const api = byHeader('/api/');
    expect(upload).toBeDefined();
    expect(api).toBeDefined();

    const uploadLimit = parseSize(directive(upload!.body, 'client_max_body_size')!);
    const apiLimit = parseSize(directive(api!.body, 'client_max_body_size')!);
    const audioMax = 200 * 1024 * 1024;

    expect(uploadLimit).toBeGreaterThanOrEqual(audioMax);
    expect(uploadLimit).toBeLessThanOrEqual(audioMax + 20 * 1024 * 1024);
    expect(apiLimit).toBe(1024 * 1024);
    expect(directive(upload!.body, 'proxy_pass')).toBe('http://backend');
    expect(directive(upload!.body, 'proxy_request_buffering')).toBe('off');
    expect(directive(upload!.body, 'proxy_read_timeout')).toBe('300s');
  });

  it('lets a 5MB cover image through on the cover path only', () => {
    const cover = byHeader('~ ^/api/recordings/[^/]+/cover$');
    expect(cover).toBeDefined();
    const coverLimit = parseSize(directive(cover!.body, 'client_max_body_size')!);
    expect(coverLimit).toBeGreaterThanOrEqual(5 * 1024 * 1024);
    expect(coverLimit).toBeLessThanOrEqual(8 * 1024 * 1024);
    expect(directive(cover!.body, 'proxy_pass')).toBe('http://backend');
  });

  it('does not raise the body limit for the frontend or the server default', () => {
    const frontend = byHeader('/');
    expect(frontend).toBeDefined();
    expect(directive(frontend!.body, 'client_max_body_size')).toBeUndefined();
    expect(conf).toMatch(/client_max_body_size\s+1m;/);
    expect(conf).not.toMatch(/limit_req/);
  });
});
