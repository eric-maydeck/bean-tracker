// src/lib/server/fixtures/beanconqueror/fixture.ts
// Invented sample data for tests; not a real export (10 beans, 68 brews split over both files like the
// real 500-per-file split, all mills and waters).
import { readFileSync } from 'node:fs';
import JSZip from 'jszip';
import type { BeanConquerorJsonFiles } from '../../beanConquerorJson';

export const fixtureText = (name: string): string => readFileSync(new URL(name, import.meta.url), 'utf8');

// A fresh copy on every call, so a test may mutate it.
export function fixtureFiles(): BeanConquerorJsonFiles {
  return {
    main: JSON.parse(fixtureText('Beanconqueror.json')),
    brewFiles: [JSON.parse(fixtureText('Beanconqueror_Brews_1.json'))]
  };
}

export function zipOf(files: Record<string, string | Uint8Array>): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) zip.file(name, content);
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

// The regular export's layout: both files at the zip's root.
export function fixtureZip(): Promise<Uint8Array> {
  return zipOf(Object.fromEntries(
    ['Beanconqueror.json', 'Beanconqueror_Brews_1.json'].map((n) => [n, fixtureText(n)])
  ));
}
