/**
 * Bixi palette — carried verbatim from the landing page + app prototype so the
 * brand feels continuous web → store → app. See docs/PRD.md §4.1.
 */
export const colors = {
  // surfaces
  paper: '#f6f2ea', // app chrome background
  sheet: '#ffffff', // white content sheet
  card: '#ffffff',
  tint: '#f4efe5', // secondary surface
  line: '#eee6d7', // hairline
  line2: '#efe9dd',
  rule: '#e3dbcb', // stronger hairline

  // ink
  ink: '#1e1913', // primary text / hard shadows
  body: '#4a4335', // body text
  muted: '#8a8072', // captions / meta

  // accents
  clay: '#c8502e', // primary action
  clayPress: '#a93f22', // primary pressed
  pine: '#1f7a54', // thriving / positive
  pineDark: '#186043',
  amber: '#e0a52a', // drifting / caution / energy
  sky: '#2f97cf', // water
  heart: '#d6452f', // love / pet
  brick: '#a83b2a', // error
  sage: '#dfede4', // soft positive fill

  // Bixi himself
  mint: '#6fe0c6',
  mintDark: '#3fc9aa',

  // helpers
  scrim: 'rgba(30,25,19,0.45)',
  transparent: 'transparent',
} as const;

export type ColorToken = keyof typeof colors;
