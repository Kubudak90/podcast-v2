import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const workflowPath = join(repoRoot, '.github/workflows/ci.yml');

function jobBlock(yaml: string, id: string): string {
  const start = yaml.search(new RegExp(`^[ ]{2}${id}:\\s*$`, 'm'));
  expect(start, `job ${id}`).toBeGreaterThan(-1);
  const lines = yaml.slice(start).split('\n').slice(1);
  const body: string[] = [];
  for (const line of lines) {
    if (/^[ ]{2}[a-z0-9-]+:\s*$/.test(line)) break;
    body.push(line);
  }
  return body.join('\n');
}

function xcodeCheckScript(yaml: string): string {
  const block = jobBlock(yaml, 'ios-project');
  const runAt = block.indexOf('run: |');
  expect(runAt).toBeGreaterThan(-1);
  const lines = block.slice(runAt + 'run: |'.length).split('\n');
  const script: string[] = [];
  for (const line of lines) {
    if (line.startsWith('          ')) script.push(line.slice(10));
    else if (script.length > 0) break;
  }
  return script.join('\n');
}

function runCheck(script: string, cwd: string): string {
  const output = join(mkdtempSync(join(tmpdir(), 'podchat-gha-')), 'github-output.txt');
  writeFileSync(output, '');
  execFileSync('bash', ['-lc', script], {
    cwd,
    env: { ...process.env, GITHUB_OUTPUT: output },
  });
  return readFileSync(output, 'utf8');
}

describe('CI iOS job', () => {
  const yaml = readFileSync(workflowPath, 'utf8');
  const script = xcodeCheckScript(yaml);

  it('builds only when the Xcode project is in this checkout', () => {
    const ios = jobBlock(yaml, 'ios');
    expect(ios).toContain('needs: ios-project');
    expect(ios).toContain("if: needs.ios-project.outputs.present == 'true'");
    expect(ios).toContain('xcodebuild test');
    expect(ios).toContain('working-directory: PodChat');
    expect(ios).toContain('-scheme PodChat');
    expect(jobBlock(yaml, 'ios-project')).toContain('runs-on: ubuntu-latest');
  });

  it('reports the project missing in this repo', () => {
    expect(runCheck(script, repoRoot)).toContain('present=false');
  });

  it('reports the project present when the pbxproj exists', () => {
    const dir = mkdtempSync(join(tmpdir(), 'podchat-ios-'));
    mkdirSync(join(dir, 'PodChat/PodChat.xcodeproj'), { recursive: true });
    writeFileSync(join(dir, 'PodChat/PodChat.xcodeproj/project.pbxproj'), '// test');
    expect(runCheck(script, dir)).toContain('present=true');
  });
});
