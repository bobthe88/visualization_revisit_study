import { access, copyFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';

export async function preparePagesStudyEntry(distDirectory = 'dist') {
  const rootEntry = join(distDirectory, 'index.html');
  const studyDirectory = join(distDirectory, 'cedar-watch-pilot');
  const studyEntry = join(studyDirectory, 'index.html');

  await access(rootEntry, constants.R_OK);
  await access(studyDirectory, constants.R_OK);
  await copyFile(rootEntry, studyEntry);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await preparePagesStudyEntry();
}
