import { expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const archiver = require('archiver');
const unzipper = require('unzipper');
const glob = require('glob');

it('preserves recursive archive matching, exclusions and readable ZIP contents', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'monthwise-archive-'));
  try {
    await mkdir(join(directory, 'nested'));
    await writeFile(join(directory, 'root.txt'), 'synthetic root');
    await writeFile(join(directory, 'nested', 'child.txt'), 'synthetic child');
    await writeFile(join(directory, 'nested', 'skip.txt'), 'excluded');
    const options = { cwd: directory, ignore: '**/skip.txt' };
    const expected = ['nested/child.txt', 'root.txt'];
    const normalize = (files: string[]) => files.map((file) => file.replaceAll('\\', '/')).sort();
    expect(normalize(glob.sync('**/*.txt', options))).toEqual(expected);
    expect(normalize(await glob.glob('**/*.txt', options))).toEqual(expected);

    const archive = archiver('zip');
    const chunks: Buffer[] = [];
    const completed = new Promise<Buffer>((resolve, reject) => {
      archive.on('data', (chunk: Buffer) => chunks.push(chunk));
      archive.on('error', reject);
      archive.on('warning', reject);
      archive.on('end', () => resolve(Buffer.concat(chunks)));
    });
    archive.glob('**/*.txt', options);
    await archive.finalize();
    const opened = await unzipper.Open.buffer(await completed);
    expect(opened.files.map((file: { path: string }) => file.path).sort()).toEqual(expected);
    for (const file of opened.files) {
      expect((await file.buffer()).toString()).toBe(
        file.path === 'root.txt' ? 'synthetic root' : 'synthetic child',
      );
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
