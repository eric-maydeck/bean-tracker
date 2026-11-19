import { describe, it, expect } from 'vitest';
import { freshToday, parseToday, todayFor, discard, markBrewed, resetDay } from './today';
import { DEFAULT_RULES } from './rules';

describe('pick today state', () => {
	it('freshToday defaults', () => {
		const t = freshToday('2026-11-18');
		expect(t).toMatchObject({ v: 1, date: '2026-11-18', out: [], brewed: [], game: 'wheel', board: null, result: null, d20Pose: null });
	});
	it('parseToday rejects bad shape and wrong v', () => {
		expect(parseToday({ v: 2 })).toBeNull();
		expect(parseToday(null)).toBeNull();
		expect(parseToday({ ...freshToday('2026-11-18'), date: 'nope' })).toBeNull();
		expect(parseToday({ ...freshToday('2026-11-18'), out: [1.5] })).toBeNull();
		expect(parseToday({ ...freshToday('2026-11-18'), game: 'x' })).toBeNull();
	});
	it('parseToday round-trips and nulls malformed sub-fields', () => {
		const t = { ...freshToday('2026-11-18', 'd20'), out: [1], brewed: [2] };
		expect(parseToday(JSON.parse(JSON.stringify(t)))).toEqual(t);
		const p = parseToday({ ...t, board: 'bad', result: { coffeeId: 'x' }, d20Pose: { pos: 1 } });
		expect(p).toMatchObject({ board: null, result: null, d20Pose: null, out: [1] });
	});
	it('todayFor: same date unchanged, a new day resets but keeps the game', () => {
		const old = { ...freshToday('2026-11-17', 'd20'), out: [1], brewed: [2] };
		expect(todayFor(old, '2026-11-17')).toEqual(old);
		const n = todayFor(old, '2026-11-18');
		expect(n).toMatchObject({ date: '2026-11-18', out: [], brewed: [], game: 'd20' });
		expect(todayFor(null, '2026-11-18')).toEqual(freshToday('2026-11-18'));
	});
	it('discard adds once, clears board, keeps result', () => {
		const result = { coffeeId: 3, via: 'normal' as const };
		const t = { ...freshToday('d'), board: [], result };
		const a = discard(discard(t, 3), 3);
		expect(a.out).toEqual([3]);
		expect(a.board).toBeNull();
		expect(a.result).toEqual(result);
	});
	it('markBrewed respects repeats', () => {
		const t = { ...freshToday('d'), board: [] };
		const on = markBrewed(t, 5, { ...DEFAULT_RULES, repeats: true });
		expect(on.brewed).toEqual([5]);
		expect(on.out).toEqual([]);
		expect(on.board).toEqual([]);
		const off = markBrewed(t, 5, { ...DEFAULT_RULES, repeats: false });
		expect(off.brewed).toEqual([5]);
		expect(off.out).toEqual([5]);
		expect(off.board).toBeNull();
	});
	it('resetDay clears out, brewed, board, result; keeps game', () => {
		const t = { ...freshToday('d', 'd20'), out: [1], brewed: [1], board: [], result: { coffeeId: 1, via: 'normal' as const } };
		const r = resetDay(t);
		expect(r).toMatchObject({ out: [], brewed: [], board: null, result: null, game: 'd20' });
	});
});
