import { validateSave, importSave, exportSave, loadSave, writeSave, emptySave, type StorageLike } from '../src/core/save';
import { createProfile } from '../src/core/profile';
import { startPaidTrial } from '../src/core/arena';

function mem(): StorageLike & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; }, removeItem: (k) => { delete data[k]; } };
}

describe('saves', () => {
  it('export → import preserves state, including an interrupted paid trial', () => {
    const s = emptySave(); const p = createProfile('Kai', 6);
    p.points = 120; p.attributes.strength = 12; p.blueprints.push('bp:laser-eyes'); p.owned.push('cape:classic');
    p.awarded['resp:m1:s1'] = 1;
    startPaidTrial(p, { bossId: 'circuit-lynx', tier: 'rookie' });
    p.arena.trial!.snapshot = { playerHp: 55, adrenaline: 17, bossHp: 200, phase: 1, elapsed: 40, playerX: 100, bossX: 600, cooldowns: {} };
    s.profiles[p.id] = p; s.activeProfileId = p.id;
    const r = importSave(exportSave(s));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const q = r.save.profiles[p.id];
    expect(q.points).toBe(110); expect(q.attributes.strength).toBe(12); expect(q.settings.grade).toBe(6);
    expect(q.arena.trial!.snapshot!.adrenaline).toBe(17);
    expect(q.awarded['resp:m1:s1']).toBe(1);
  });
  it('rejects corrupted or foreign files', () => {
    expect(importSave('not json').ok).toBe(false);
    expect(importSave('{"app":"other"}').ok).toBe(false);
    const s = emptySave(); const p = createProfile('A'); p.attributes.speed = 500; s.profiles[p.id] = p;
    expect(importSave(JSON.stringify(s)).ok).toBe(false);
    const s2 = emptySave(); const p2 = createProfile('B'); (p2 as any).points = -5; s2.profiles[p2.id] = p2;
    expect(importSave(JSON.stringify(s2)).ok).toBe(false);
  });
  it('migrates an older version save by filling defaults', () => {
    const old = { app: 'vocab-hero', version: 1, activeProfileId: 'p1', profiles: { p1: { id: 'p1', nickname: 'Old', points: 40, attributes: { speed: 3, strength: 1, health: 1, willpower: 1 }, settings: { grade: 5 } } } };
    const s = validateSave(old);
    expect(s.version).toBe(2);
    const p = s.profiles.p1;
    expect(p.settings.grade).toBe(5); expect(p.settings.combatDifficulty).toBe('standard');
    expect(p.loadout.active).toEqual([null, null]); expect(p.points).toBe(40);
  });
  it('recovers the previous save when the latest is damaged', () => {
    const st = mem();
    const s = emptySave(); const p = createProfile('A'); s.profiles[p.id] = p; s.activeProfileId = p.id;
    writeSave(s, st);
    p.points = 77; writeSave(s, st);
    st.data['vocabhero.save'] = '{broken';
    const r = loadSave(st);
    expect(r.recovered).toBe(true);
    expect(r.save.profiles[p.id].points).toBe(25);
  });
});

describe('retired armor looks', () => {
  it('refunds each owned armor look once and takes it off', async () => {
    const { migrateProfile } = await import('../src/core/save');
    const { createProfile } = await import('../src/core/profile');
    const raw: any = createProfile('Tester', 4);
    raw.points = 10; raw.owned = ['armor:knight', 'armor:circuit', 'cape:classic']; raw.appearance.armor = 'knight';
    const p = migrateProfile(raw);
    expect(p.points).toBe(250);
    expect(p.owned).toEqual(['cape:classic']);
    expect(p.appearance.armor).toBe('none');
    const again = migrateProfile({ ...p, owned: [...p.owned, 'armor:knight'] });
    expect(again.points).toBe(250); // no second refund
  });
});
