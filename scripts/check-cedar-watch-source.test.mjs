import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { parse } from 'yaml';
import { requiredSourceMarkers, reviewedSourceCommit, verifyCedarWatchSource } from './check-cedar-watch-source.mjs';

test('checks required markers only in their owning source and test files', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cedar-source-'));
  try {
    for (const [filename, markers] of Object.entries(requiredSourceMarkers)) {
      const target = path.join(root, filename);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, markers.join('\n'));
    }
    await assert.doesNotReject(verifyCedarWatchSource(root));

    const ownerFile = path.join(root, 'src/iframeBridge.ts');
    const missingMarker = requiredSourceMarkers['src/iframeBridge.ts'][0];
    await writeFile(ownerFile, requiredSourceMarkers['src/iframeBridge.ts'].slice(1).join('\n'));
    await writeFile(path.join(root, 'src/unrelated.ts'), missingMarker);
    await assert.rejects(verifyCedarWatchSource(root), /src\/iframeBridge\.ts/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('CLI works when its script and study paths contain spaces', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cedar guard cli-'));
  const cli = path.join(root, 'checker folder/check source.mjs');
  const study = path.join(root, 'study source tree');
  try {
    await mkdir(path.dirname(cli), { recursive: true });
    await mkdir(study, { recursive: true });
    await copyFile(new URL('./check-cedar-watch-source.mjs', import.meta.url), cli);
    for (const [filename, markers] of Object.entries(requiredSourceMarkers)) {
      const target = path.join(study, filename);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, markers.join('\n'));
    }

    const runGuard = () => spawnSync(process.execPath, [cli, study], { encoding: 'utf8' });
    const valid = runGuard();
    assert.equal(valid.status, 0, valid.stderr);

    const ownerFile = path.join(study, 'src/iframeBridge.ts');
    await writeFile(ownerFile, requiredSourceMarkers['src/iframeBridge.ts'].slice(1).join('\n'));
    const invalid = runGuard();
    assert.notEqual(invalid.status, 0);
    assert.match(invalid.stderr, /src\/iframeBridge\.ts/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('default and both workflow source pins equal the reviewed revision', async () => {
  const root = path.resolve(import.meta.dirname, '..');
  const script = await readFile(path.join(root, 'scripts/build-cedar-watch.sh'), 'utf8');
  const workflows = [
    await readFile(path.join(root, '.github/workflows/deploy_website.yaml'), 'utf8'),
    await readFile(path.join(root, '.github/workflows/deploy_synthetic_preview.yaml'), 'utf8'),
  ];
  assert.match(script, new RegExp(`reviewed_source_commit="${reviewedSourceCommit}"`));
  assert.match(script, /source_commit="\$\{CEDAR_WATCH_SOURCE_COMMIT:-\$reviewed_source_commit\}"/);
  for (const workflow of workflows) {
    const document = parse(workflow);
    const assignments = Object.values(document.jobs)
      .flatMap((job) => job.steps ?? [])
      .map((step) => step.env?.CEDAR_WATCH_SOURCE_COMMIT)
      .filter((value) => value !== undefined);
    assert.deepEqual(assignments, [reviewedSourceCommit]);
  }
});

test('build rejects an unreviewed source override before fetching', () => {
  const root = path.resolve(import.meta.dirname, '..');
  const result = spawnSync('sh', ['scripts/build-cedar-watch.sh'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, CEDAR_WATCH_SOURCE_COMMIT: '1111111111111111111111111111111111111111' },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /explicitly reviewed source revision/);
  assert.doesNotMatch(result.stdout, /Cloning into/);
});
