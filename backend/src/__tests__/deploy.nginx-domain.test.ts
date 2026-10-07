import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const deploySh = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../deploy.sh');

const HTTPS_FIXTURE = `
server_name podchat.example.com;
ssl_certificate /etc/letsencrypt/live/podchat.example.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/podchat.example.com/privkey.pem;
server_name livekit.podchat.example.com;
ssl_certificate /etc/letsencrypt/live/podchat.example.com/fullchain.pem;
`.trim();

function runBash(script: string, cwd: string, extraEnv: NodeJS.ProcessEnv = {}): string {
  return execFileSync('bash', ['-c', script], {
    cwd,
    env: { ...process.env, ...extraEnv },
    encoding: 'utf8',
  });
}

describe('deploy.sh nginx domain substitution', () => {
  it('replaces the LiveKit host before the site host', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'podchat-nginx-'));
    const conf = path.join(dir, 'nginx.conf');
    writeFileSync(conf, `${HTTPS_FIXTURE}\n`);

    runBash(
      `source "${deploySh}"
       apply_nginx_domains "${conf}"`,
      dir,
      { DOMAIN: 'app.example.com', LIVEKIT_DOMAIN: 'rtc.example.com' }
    );

    const text = readFileSync(conf, 'utf8');
    expect(text).toContain('server_name app.example.com;');
    expect(text).toContain('server_name rtc.example.com;');
    expect(text).toContain('/etc/letsencrypt/live/app.example.com/fullchain.pem');
    expect(text).not.toContain('livekit.app.example.com');
    expect(text).not.toContain('podchat.example.com');
  });

  it('writes an ampersand in the domain as itself', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'podchat-nginx-'));
    const conf = path.join(dir, 'nginx.conf');
    writeFileSync(conf, 'server_name podchat.example.com;\n');

    runBash(
      `source "${deploySh}"
       apply_nginx_domains "${conf}"`,
      dir,
      { DOMAIN: 'ex&ample.com', LIVEKIT_DOMAIN: '' }
    );

    expect(readFileSync(conf, 'utf8')).toBe('server_name ex&ample.com;\n');
  });

  it('restores the HTTPS config when certbot fails', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'podchat-ssl-'));
    const bin = path.join(dir, 'bin');
    mkdirSync(path.join(dir, 'nginx'), { recursive: true });
    mkdirSync(bin, { recursive: true });
    writeFileSync(path.join(dir, 'nginx', 'nginx.conf'), `HTTPS-ORIGINAL\n${HTTPS_FIXTURE}\n`);
    writeFileSync(path.join(dir, 'nginx', 'nginx.initial.conf'), 'INITIAL-ONLY\n');
    const docker = path.join(bin, 'docker');
    writeFileSync(
      docker,
      `#!/bin/sh
if printf '%s' "$*" | grep -q certonly; then
  exit 1
fi
exit 0
`
    );
    chmodSync(docker, 0o755);

    const output = runBash(
      `source "${deploySh}"
       set +e
       get_ssl_cert
       status=$?
       printf 'status=%s\\n' "$status"
       exit 0`,
      dir,
      {
        PATH: `${bin}:${process.env.PATH ?? ''}`,
        DOMAIN: 'app.example.com',
        LIVEKIT_DOMAIN: 'rtc.example.com',
      }
    );

    expect(output).toContain('status=1');
    const conf = readFileSync(path.join(dir, 'nginx', 'nginx.conf'), 'utf8');
    expect(conf).toContain('HTTPS-ORIGINAL');
    expect(conf).toContain('server_name podchat.example.com;');
    expect(conf).not.toContain('INITIAL-ONLY');
  });

  it('asks certbot for both names and reloads the restored HTTPS config', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'podchat-ssl-ok-'));
    const bin = path.join(dir, 'bin');
    mkdirSync(path.join(dir, 'nginx'), { recursive: true });
    mkdirSync(bin, { recursive: true });
    writeFileSync(path.join(dir, 'nginx', 'nginx.conf'), `${HTTPS_FIXTURE}\n`);
    writeFileSync(path.join(dir, 'nginx', 'nginx.initial.conf'), 'INITIAL-ONLY\n');
    const log = path.join(dir, 'docker.log');
    const docker = path.join(bin, 'docker');
    writeFileSync(
      docker,
      `#!/bin/sh
printf '%s\\n' "$*" >> "${log}"
exit 0
`
    );
    chmodSync(docker, 0o755);

    runBash(
      `source "${deploySh}"
       get_ssl_cert`,
      dir,
      {
        PATH: `${bin}:${process.env.PATH ?? ''}`,
        DOMAIN: 'app.example.com',
        LIVEKIT_DOMAIN: 'rtc.example.com',
      }
    );

    const conf = readFileSync(path.join(dir, 'nginx', 'nginx.conf'), 'utf8');
    expect(conf).toContain('server_name rtc.example.com;');
    expect(conf).toContain('/etc/letsencrypt/live/app.example.com/fullchain.pem');
    expect(conf).not.toContain('INITIAL-ONLY');

    const calls = readFileSync(log, 'utf8');
    expect(calls).toContain('certonly');
    expect(calls).toContain('-d app.example.com');
    expect(calls).toContain('-d rtc.example.com');
    expect(calls).toContain('nginx -s reload');
  });
});
