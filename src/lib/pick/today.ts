import type { D20Pose, Game, PickResult, PickRules, PickToday, Slot } from './types';

export function freshToday(date: string, game: Game = 'wheel'): PickToday {
	return { v: 1, date, out: [], brewed: [], game, board: null, result: null, wheelAngle: 0, d20Pose: null, panelOpen: false };
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isInts = (x: unknown): x is number[] => Array.isArray(x) && x.every((n) => Number.isInteger(n));
const isNums = (x: unknown, len: number) => Array.isArray(x) && x.length === len && x.every((n) => typeof n === 'number' && Number.isFinite(n));

function validSlot(s: unknown): s is Slot {
	if (!isObj(s) || !Number.isInteger(s.n)) return false;
	if (s.kind === 'coffee') return Number.isInteger(s.coffeeId);
	return s.kind === 'success' || s.kind === 'fail' || s.kind === 'crossed';
}

function validResult(r: unknown): r is PickResult {
	return isObj(r) && Number.isInteger(r.coffeeId) && (r.via === 'normal' || r.via === 'success' || r.via === 'fail')
		&& (r.n === undefined || Number.isInteger(r.n));
}

function validPose(p: unknown): p is D20Pose {
	return isObj(p) && isNums(p.pos, 3) && isNums(p.quat, 4) && Number.isInteger(p.sym) && typeof p.lensAngle === 'number';
}

export function parseToday(raw: unknown): PickToday | null {
	if (!isObj(raw) || raw.v !== 1) return null;
	if (typeof raw.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.date)) return null;
	if (!isInts(raw.out) || !isInts(raw.brewed)) return null;
	if (raw.game !== 'wheel' && raw.game !== 'd20') return null;
	return {
		v: 1,
		date: raw.date,
		out: raw.out,
		brewed: raw.brewed,
		game: raw.game,
		board: Array.isArray(raw.board) && raw.board.every(validSlot) ? raw.board : null,
		result: validResult(raw.result) ? raw.result : null,
		wheelAngle: typeof raw.wheelAngle === 'number' && Number.isFinite(raw.wheelAngle) ? raw.wheelAngle : 0,
		d20Pose: validPose(raw.d20Pose) ? raw.d20Pose : null,
		panelOpen: raw.panelOpen === true
	};
}

export function todayFor(raw: unknown, date: string): PickToday {
	const p = parseToday(raw);
	if (p?.date === date) return p;
	return { ...freshToday(date, p?.game), panelOpen: p?.panelOpen ?? false };
}

const add = (a: number[], id: number) => (a.includes(id) ? a : [...a, id]);

export function discard(t: PickToday, id: number): PickToday {
	return { ...t, out: add(t.out, id), board: null };
}

export function markBrewed(t: PickToday, id: number, rules: PickRules): PickToday {
	const brewed = add(t.brewed, id);
	return rules.repeats ? { ...t, brewed } : { ...t, brewed, out: add(t.out, id), board: null };
}

export function resetDay(t: PickToday): PickToday {
	return { ...t, out: [], brewed: [], board: null, result: null };
}

export function outIds(t: PickToday): Set<number> {
	return new Set(t.out);
}
