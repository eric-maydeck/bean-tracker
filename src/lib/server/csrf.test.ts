import { describe, expect, it } from 'vitest';
import { bodyTooLarge, crossSiteBlocked } from './csrf';

const req = (path: string, headers: Record<string, string> = {}, method = 'POST', body?: BodyInit | null) => {
  const url = new URL('http://localhost:5173' + path);
  return { request: new Request(url, { method, headers, body }), url };
};
const post = (path: string, headers: Record<string, string> = {}, method = 'POST') => {
  const { request, url } = req(path, headers, method);
  return crossSiteBlocked(request, url);
};
const json = 'application/json';

describe('crossSiteBlocked', () => {
  it('blocks any mutating request, JSON included, with no or foreign Origin', () => {
    expect(post('/stats', { 'content-type': 'multipart/form-data; boundary=xyz' })).toBe(true);
    expect(post('/stats', { 'content-type': 'Text/Plain' }, 'DELETE')).toBe(true);
    expect(post('/api/gear', { 'content-type': json })).toBe(true);
    expect(post('/api/gear', { 'content-type': json, origin: 'http://evil.test' }, 'PUT')).toBe(true);
    expect(post('/api/gear', {}, 'PATCH')).toBe(true);
  });
  it('allows matching Origin and safe methods', () => {
    expect(post('/api/gear', { 'content-type': json, origin: 'http://localhost:5173' })).toBe(false);
    expect(post('/stats', {}, 'GET')).toBe(false);
  });
  it('exempts exactly the upload path', () => {
    expect(post('/api/shots/upload')).toBe(false);
    expect(post('/api/shots/upload', { origin: 'http://evil.test' })).toBe(false);
    expect(post('/api/shots/upload/x')).toBe(true);
    expect(post('/api/shots/uploadx')).toBe(true);
  });
});

describe('bodyTooLarge', () => {
  const big = { 'content-length': String(64 * 1024 + 1) };
  const check = (path: string, headers: Record<string, string>, admin = false, body: BodyInit | null = 'x') => {
    const { request, url } = req(path, headers, 'POST', body);
    return bodyTooLarge(request, url, admin);
  };
  it('rejects a non-admin body over 64KB, or with no content-length', () => {
    expect(check('/s', big)).toBe(true);
    expect(check('/s', { 'content-length': String(64 * 1024) })).toBe(false);
    expect(check('/s', {})).toBe(true);
    expect(check('/s', { 'content-length': 'abc' })).toBe(true);
  });
  it('lets admins, the upload path and bodiless requests through', () => {
    expect(check('/coffees', big, true)).toBe(false);
    expect(check('/api/shots/upload', big)).toBe(false);
    expect(check('/s', {}, false, null)).toBe(false);
  });
});
