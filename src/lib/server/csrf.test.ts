import { describe, expect, it } from 'vitest';
import { crossSiteFormBlocked } from './csrf';

const post = (path: string, headers: Record<string, string> = {}, method = 'POST') => {
  const url = new URL('http://localhost:5173' + path);
  return crossSiteFormBlocked(new Request(url, { method, headers }), url);
};
const mp = 'multipart/form-data; boundary=xyz';

describe('crossSiteFormBlocked', () => {
  it('blocks form posts with no or foreign Origin', () => {
    expect(post('/stats', { 'content-type': mp })).toBe(true);
    expect(post('/stats', { 'content-type': mp, origin: 'http://evil.test' })).toBe(true);
    expect(post('/stats', { 'content-type': 'Text/Plain' }, 'DELETE')).toBe(true);
  });
  it('allows matching Origin, non-form types and GET', () => {
    expect(post('/stats', { 'content-type': mp, origin: 'http://localhost:5173' })).toBe(false);
    expect(post('/api/gear', { 'content-type': 'application/json' })).toBe(false);
    expect(post('/stats', { 'content-type': mp }, 'GET')).toBe(false);
  });
  it('exempts exactly the upload path', () => {
    expect(post('/api/shots/upload', { 'content-type': mp })).toBe(false);
    expect(post('/api/shots/upload', { 'content-type': mp, origin: 'http://evil.test' })).toBe(false);
    expect(post('/api/shots/upload/x', { 'content-type': mp })).toBe(true);
    expect(post('/api/shots/uploadx', { 'content-type': mp })).toBe(true);
  });
});
