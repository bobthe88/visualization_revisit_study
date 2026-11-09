import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const reviewedSourceCommit = '898f8af4ddc54a09e4a5b8d9a7766b78600b6e7c';

export const requiredSourceMarkers = {
  'src/iframeBridge.ts': [
    'export function isAllowedParentOrigin(',
    'trustedParentOrigins: readonly string[] = []',
    'parsedOrigin === referrerOrigin',
    'allowHttpLoopback && parsed.protocol === \'http:\'',
  ],
  'src/visualizationContract.ts': [
    'export function createVisualizationHandshake(',
    '@REVISIT_COMMS/VIEW_READY',
    '@REVISIT_COMMS/VIEW_NOT_READY',
    'viewNotReady()',
  ],
  'src/VisualizationApp.tsx': ['chartReadyGeneration'],
  'vite.config.ts': ["path.resolve(directory, 'visualization.html')"],
  'tests/iframe-bridge.test.ts': [
    'allows HTTP only for exact loopback origins under explicit development opt-in',
  ],
  'tests/visualization-app.test.tsx': ['VisualizationApp readiness lifecycle'],
};

export async function verifyCedarWatchSource(root) {
  const missing = [];
  for (const [filename, markers] of Object.entries(requiredSourceMarkers)) {
    const source = await readFile(path.join(root, filename), 'utf8').catch(() => '');
    for (const marker of markers) {
      if (!source.includes(marker)) missing.push(`${filename}: ${marker}`);
    }
  }
  if (missing.length) {
    throw new Error(`Pinned Cedar Watch source is missing required source/test markers: ${missing.join('; ')}`);
  }
}

const invokedScript = process.argv[1] ? await realpath(process.argv[1]) : null;
const moduleScript = await realpath(fileURLToPath(import.meta.url));
if (invokedScript && invokedScript === moduleScript) {
  if (!process.argv[2]) throw new Error('Usage: node check-cedar-watch-source.mjs <study-directory>');
  await verifyCedarWatchSource(process.argv[2]);
}
