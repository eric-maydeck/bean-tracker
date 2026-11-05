// Tests were written in America/Denver; a test of another zone sets it itself. createDb pins the process
// to the DB's zone (UTC when empty), so each test starts back on America/Denver.
import { beforeEach } from 'vitest';
import { setBrewingZone } from './src/lib/localDate';

setBrewingZone('America/Denver');
beforeEach(() => setBrewingZone('America/Denver'));
