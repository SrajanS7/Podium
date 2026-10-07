/** Chart colours for SVG (Recharts sets SVG attributes, which cannot read CSS variables).
 *  Keep in sync with tokens.css. */
export const C = {
  primary: '#1d5bb8',
  summer: '#c2410c',
  winter: '#1d5bb8',
  over: '#1d5bb8',
  under: '#c2410c',
  neutral: '#9aa1ab',
  grid: '#e7e9ed',
  axis: '#59606b',
  text: '#15191f',
  highlight: '#f2c14e',
  gold: '#a57c12',
  silver: '#8a9199',
  bronze: '#8e5427',
} as const;

export const seasonColor = (s: 'Summer' | 'Winter') => (s === 'Summer' ? C.summer : C.winter);
export const axisTick = { fill: C.axis, fontSize: 12 };
