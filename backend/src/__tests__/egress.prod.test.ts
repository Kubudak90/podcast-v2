import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function activeLines(yaml: string): string[] {
  return yaml
    .split('\n')
    .map((line) => line.replace(/\s+#.*$/, ''))
    .filter((line) => {
      const trimmed = line.trim();
      return trimmed.length > 0 && !trimmed.startsWith('#');
    });
}

describe('production egress config', () => {
  const yaml = readFileSync(resolve(__dirname, '../../../egress.prod.yaml'), 'utf8');
  const lines = activeLines(yaml);

  it('talks to LiveKit over the in-cluster websocket', () => {
    expect(lines).toContain('ws_url: ws://livekit:7880');
  });

  it('lets Chrome open that insecure websocket', () => {
    expect(lines).toContain('insecure: true');
  });
});
