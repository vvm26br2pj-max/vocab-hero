import { voiceScore, voiceQuality } from '../src/ui/speech';

const V = (name: string, lang = 'en-US') => ({ name, lang, default: false, localService: true, voiceURI: name }) as SpeechSynthesisVoice;

describe('read-aloud voice ranking', () => {
  it('prefers natural, premium and enhanced voices', () => {
    const ranked = [V('Samantha'), V('Microsoft Ava Online (Natural) - English (United States)'), V('Zoe (Premium)'), V('Evan (Enhanced)'), V('Google US English')]
      .sort((a, b) => voiceScore(b) - voiceScore(a)).map((v) => v.name);
    expect(ranked[0]).toMatch(/Natural/);
    expect(ranked.indexOf('Samantha')).toBe(4);
    expect(voiceQuality(V('Zoe (Premium)'))).toBe('natural');
  });
  it('never auto-picks novelty or non-English voices', () => {
    expect(voiceScore(V('Zarvox'))).toBeLessThan(voiceScore(V('Daniel', 'en-GB')));
    expect(voiceScore(V('Bad News'))).toBeLessThanOrEqual(-1000);
    expect(voiceScore(V('Amélie', 'fr-CA'))).toBeLessThan(-1000);
    expect(voiceQuality(V('Eddy (English (United States))'))).toBe('robotic');
  });
});
