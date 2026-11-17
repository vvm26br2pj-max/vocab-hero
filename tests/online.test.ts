import { isValidCode, makeRoomCode, normalizeCode } from '../src/net/online';
import { createProfile } from '../src/core/profile';

describe('online room codes', () => {
  it('makes 5-character codes without look-alike characters', () => {
    for (let i = 0; i < 200; i++) {
      const c = makeRoomCode();
      expect(isValidCode(c)).toBe(true);
      expect(c).not.toMatch(/[01OIL]/);
    }
  });
  it('cleans up typed codes', () => {
    expect(normalizeCode(' ab-cd e ')).toBe('ABCDE');
    expect(normalizeCode('abcdefgh')).toBe('ABCDE');
    expect(isValidCode('ABC')).toBe(false);
  });
  it('online play is off until a parent turns it on', () => {
    expect(createProfile('Kid').settings.onlinePlay).toBe(false);
  });
});
