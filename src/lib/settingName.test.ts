import { expect, it } from 'vitest';
import { plainText, setting, settingRuns } from './settingName';

it('setting marks a name; plainText drops the marks; settingRuns splits for rendering', () => {
  const s = `${setting('Always all brews')}: this record is about dial-in.`;
  expect(plainText(s)).toBe('Always all brews: this record is about dial-in.');
  expect(settingRuns(s)).toEqual([['Always all brews', true], [': this record is about dial-in.', false]]);
  expect(settingRuns('no names')).toEqual([['no names', false]]);
  expect(settingRuns(`9 scored ${setting('once dialed')}`)).toEqual([['9 scored ', false], ['once dialed', true]]);
});
