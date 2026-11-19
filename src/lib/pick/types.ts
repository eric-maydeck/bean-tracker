export type Category = 'open' | 'backlog' | 'frozen';
export type SortGroup = Category | 'decaf';
export type SortRule = 'urgency-desc' | 'urgency-asc' | 'name' | 'category';
export type Iteration = 'asc' | 'desc' | 'evens' | 'odds' | 'random';
export type Fill = 'wrap' | 'snake' | 'shuffle' | 'cross';
export type Over20 = 'first20' | 'byHand';
export type CritMode = 'spot' | 'specific';
export type Game = 'wheel' | 'd20';

export interface PickRules {
  v: 1;
  categories: Category[];
  includeDecaf: boolean;
  includeFrozenDecaf: boolean; // sub-option of includeDecaf
  sort: SortRule;
  categoryOrder: SortGroup[]; // all four, user order
  over20: Over20;
  excluded: number[]; // coffee ids unchecked by hand
  critSuccessOn: boolean; // gold crit: 20 on the D20, a gold slice on the wheel
  critSuccessMode: CritMode; // spot = the coffee in the last spot; specific = the ids below
  critSuccess: number[]; // coffee ids for 'specific' mode
  critFailOn: boolean; // black crit: 1 on the D20, a black slice
  critFailMode: CritMode; // spot = the coffee in #1
  critFail: number[];
  highestIsCrit: boolean; // spot success with fewer than 20 coffees: the last coffee
  fillEnds: boolean; // normal 1 and 20 take part in the fill
  iteration: Iteration;
  fill: Fill;
  repeats: boolean;
}

export interface PickCoffee {
  id: number; slug: string; name: string; roaster: string;
  image: string | null; fill: string | null; category: Category; decaf: boolean; urgency: number | null;
  origin: string | null; roastLevel: string | null; processing: string | null; // the result card and the out-for-today tip
}

export type Slot = { n: number; kind: 'coffee'; coffeeId: number }
  | { n: number; kind: 'success' | 'fail' }
  | { n: number; kind: 'crossed' };

export interface WheelSlice { kind: 'coffee' | 'success' | 'fail'; coffeeId?: number; a0: number; a1: number }

export interface PickResult { coffeeId: number; via: 'normal' | 'success' | 'fail'; n?: number }

export interface D20Pose { pos: [number, number, number]; quat: [number, number, number, number]; sym: number; lensAngle: number }

export interface PickToday {
  v: 1; date: string; // YYYY-MM-DD local
  out: number[]; brewed: number[];
  game: Game; board: Slot[] | null; result: PickResult | null;
  wheelAngle: number; d20Pose: D20Pose | null;
}
