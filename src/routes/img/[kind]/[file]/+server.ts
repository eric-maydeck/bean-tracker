// Our local image copies.
// Public like /s: every viewer needs the images. Does no work beyond one file
// read (no DB, no fetch, no sharp); names are content hashes, so responses are
// immutable and CDNs/browsers cache them for a year.
import { error } from '@sveltejs/kit';
import { readFile } from 'node:fs/promises';
import { COPY_KINDS, COPY_FILE_RE, copyPath, imagesRoot } from '$lib/server/imageCopies';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
  const kind = COPY_KINDS.find((k) => k === params.kind);
  if (!kind || !COPY_FILE_RE.test(params.file)) error(404, 'Not found');
  let body: Buffer;
  try {
    body = await readFile(copyPath(imagesRoot(), kind, params.file));
  } catch {
    error(404, 'Not found');
  }
  return new Response(new Uint8Array(body), {
    headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=31536000, immutable' }
  });
};
