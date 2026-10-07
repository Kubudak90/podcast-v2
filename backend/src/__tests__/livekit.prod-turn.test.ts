import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

function field(yaml: string, key: string): string | undefined {
  const match = yaml.match(new RegExp(`^\\s*${key}:\\s*(\\S+)\\s*$`, 'm'));
  return match?.[1];
}

describe('production LiveKit TURN', () => {
  const yaml = read('livekit.prod.yaml');
  const compose = read('docker-compose.prod.yml');
  const firewall = read('setup-vps.sh');

  it('keeps TLS TURN off while there is no domain or certificate', () => {
    expect(field(yaml, 'enabled')).toBe('true');
    expect(field(yaml, 'tls_port')).toBe('0');
    expect(yaml).not.toMatch(/^\s*domain:\s*\S+/m);
    expect(yaml).not.toMatch(/cert_file:|key_file:/);
  });

  it('publishes TURN/UDP and a relay range that does not overlap RTC', () => {
    expect(field(yaml, 'udp_port')).toBe('3478');
    expect(field(yaml, 'port_range_end')).toBe('50100');
    expect(field(yaml, 'relay_range_start')).toBe('50101');
    expect(field(yaml, 'relay_range_end')).toBe('50200');

    const relayStart = Number(field(yaml, 'relay_range_start'));
    const rtcEnd = Number(field(yaml, 'port_range_end'));
    expect(relayStart).toBeGreaterThan(rtcEnd);

    expect(compose).toContain('"3478:3478/udp"');
    expect(compose).toContain('"50101-50200:50101-50200/udp"');
    expect(compose).toContain('"50000-50100:50000-50100/udp"');
  });

  it('opens the same ports on the VPS firewall', () => {
    expect(firewall).toContain('ufw allow 3478/udp');
    expect(firewall).toContain('ufw allow 50101:50200/udp');
    expect(firewall).toContain('ufw allow 50000:50100/udp');
  });
});
