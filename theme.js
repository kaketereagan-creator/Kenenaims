// ─── KFMS Design System ───────────────────────────────────────────────────────
// Premium Agri-SaaS · High contrast · Outdoor daylight readable

export const T = {
  // Backgrounds
  white:       '#FFFFFF',
  bgLight:     '#F8F9FA',
  bgCard:      '#FFFFFF',
  bgMuted:     '#F1F5F2',

  // Primary Brand
  emerald:     '#1B4332',
  emeraldMid:  '#2D6A4F',
  emeraldLight:'#40916C',
  emeraldPale: '#D8F3DC',
  emeraldFaint:'#F0FAF3',

  // Semantic Colors
  teal:        '#2D6A4F',   // profits / positive
  amber:       '#FFB703',   // pending / warnings
  amberLight:  '#FFF3CD',
  amberDark:   '#B88B00',
  coral:       '#E63946',   // loss / mortality / danger
  coralLight:  '#FDECEA',
  coralDark:   '#B02A33',
  blue:        '#2196F3',
  blueLight:   '#E3F2FD',

  // Text
  textPrimary:   '#0D1F17',
  textSecondary: '#4A6358',
  textMuted:     '#8FA89A',
  textWhite:     '#FFFFFF',

  // Borders
  border:      '#E2EDE7',
  borderFocus: '#2D6A4F',

  // Shadows
  shadowSm:    '0 1px 4px rgba(27,67,50,0.08)',
  shadowMd:    '0 4px 16px rgba(27,67,50,0.12)',
  shadowLg:    '0 8px 32px rgba(27,67,50,0.16)',

  // Radius
  radius:      '12px',
  radiusSm:    '8px',
  radiusLg:    '20px',
  radiusFull:  '999px',

  // Touch targets
  touch:       '48px',

  // Typography
  fontDisplay: "'Sora', 'DM Sans', sans-serif",
  fontBody:    "'DM Sans', 'Segoe UI', sans-serif",
  fontMono:    "'JetBrains Mono', monospace",
};

export const roleColors = {
  super_admin:  { bg: T.emerald,    text: T.white,       label: 'Super Admin' },
  farm_manager: { bg: T.teal,       text: T.white,       label: 'Farm Manager' },
  accountant:   { bg: T.blue,       text: T.white,       label: 'Accountant' },
  storekeeper:  { bg: '#7B5EA7',    text: T.white,       label: 'Storekeeper' },
  worker:       { bg: T.textMuted,  text: T.white,       label: 'Worker' },
};

export const statusColors = {
  active:    { bg: T.emeraldPale, text: T.emeraldMid,  dot: T.emeraldLight },
  suspended: { bg: T.coralLight,  text: T.coralDark,   dot: T.coral },
  pending:   { bg: T.amberLight,  text: T.amberDark,   dot: T.amber },
  approved:  { bg: T.emeraldPale, text: T.teal,        dot: T.teal },
  rejected:  { bg: T.coralLight,  text: T.coral,       dot: T.coral },
};
