import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../../..');

function read(name: string): string {
  return readFileSync(resolve(root, name), 'utf8');
}

describe('local LiveKit compose', () => {
  it('advertises only the UDP ports docker publishes', () => {
    const livekit = read('livekit.yaml');
    const compose = read('docker-compose.yml');

    expect(livekit).toMatch(/port_range_start:\s*50000/);
    expect(livekit).toMatch(/port_range_end:\s*50100/);
    expect(livekit).not.toMatch(/port_range_end:\s*60000/);
    expect(compose).toContain('50000-50100:50000-50100/udp');
  });

  it('takes the recording bucket from the environment', () => {
    const livekit = read('livekit.yaml');
    const egress = read('egress.yaml');
    const compose = read('docker-compose.yml');

    for (const file of [livekit, egress]) {
      expect(file).toContain('${S3_ENDPOINT}');
      expect(file).toContain('${S3_BUCKET}');
      expect(file).not.toContain('cloudflarestorage.com');
    }

    expect(compose).toContain('S3_ENDPOINT=${S3_ENDPOINT}');
    expect(compose).toContain('S3_BUCKET=${S3_BUCKET}');
  });

  it('checks postgres with the configured user', () => {
    const compose = read('docker-compose.yml');
    expect(compose).toContain('pg_isready -U ${POSTGRES_USER:-podchat}');
    expect(compose).not.toContain('pg_isready -U podchat"');
  });
});
