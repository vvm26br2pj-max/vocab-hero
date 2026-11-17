/** Vocab Hero emblem: a hero shield with an open book and a lightning bolt. */
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Vocab Hero logo" style={{ flex: 'none', filter: 'drop-shadow(2px 3px 0 #1b1446)' }}>
      <defs>
        <linearGradient id="lg-shield" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffde59" /><stop offset="1" stopColor="#ff9f1c" /></linearGradient>
        <linearGradient id="lg-inner" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8b5cf6" /><stop offset="1" stopColor="#4c1d95" /></linearGradient>
      </defs>
      <path d="M32 3 L57 11 C57 34 49 50 32 61 C15 50 7 34 7 11 Z" fill="url(#lg-shield)" stroke="#1b1446" strokeWidth="3" strokeLinejoin="round" />
      <path d="M32 9 L51 15 C50 33 44 45 32 54 C20 45 14 33 13 15 Z" fill="url(#lg-inner)" stroke="#1b1446" strokeWidth="1.5" />
      <path d="M17 36 C22 33 28 34 32 37 C36 34 42 33 47 36 L47 45 C42 42 36 43 32 46 C28 43 22 42 17 45 Z" fill="#fff" stroke="#1b1446" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M32 37 L32 46" stroke="#1b1446" strokeWidth="1.5" />
      <path d="M35 13 L24 30 L31 30 L27 41 L41 23 L34 23 L38 13 Z" fill="#ffde59" stroke="#1b1446" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
