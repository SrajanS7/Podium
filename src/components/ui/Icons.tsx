/** Inline stroke icons (decorative: always aria-hidden; the text next to them carries meaning). */
const base = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
export const IconOverview = () => <svg {...base}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>;
export const IconGlobe = () => <svg {...base}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>;
export const IconTrend = () => <svg {...base}><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></svg>;
export const IconWave = () => <svg {...base}><path d="M2 9c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2M2 16c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2" /></svg>;
export const IconMap = () => <svg {...base}><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" /><path d="M9 4v14M15 6v14" /></svg>;
export const IconTarget = () => <svg {...base}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /></svg>;
export const IconBook = () => <svg {...base}><path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z" /><path d="M20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z" /></svg>;
export const IconUser = () => <svg {...base}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>;
export const IconDatabase = () => <svg {...base}><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></svg>;
export const IconMedal = () => <svg {...base} width={28} height={28} stroke="#F2C14E"><circle cx="12" cy="14" r="6" /><path d="M8.5 3h7l-2 5.5h-3z" /></svg>;
export const IconPlus = () => <svg {...base} width={18} height={18}><path d="M12 5v14M5 12h14" /></svg>;
export const IconUpload = () => <svg {...base} width={18} height={18}><path d="M12 15V3M7 8l5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" /></svg>;
export const IconDownload = () => <svg {...base} width={18} height={18}><path d="M12 3v12M7 10l5 5 5-5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" /></svg>;
export const IconCheck = () => <svg {...base} width={18} height={18}><path d="M20 6L9 17l-5-5" /></svg>;
export const IconClose = () => <svg {...base}><path d="M6 6l12 12M18 6L6 18" /></svg>;

/* Coloured KPI icons (decorative, aria-hidden). 28 px, drawn on a 32 x 32 grid. */
const kpi = { width: 28, height: 28, viewBox: '0 0 32 32', fill: 'none', 'aria-hidden': true } as const;
/** Gold medal on a ribbon */
export const IconGoldMedal = () => (
  <svg {...kpi}>
    <path d="M9 3h5l3 8h-5z" fill="#1d5bb8" /><path d="M23 3h-5l-3 8h5z" fill="#c2410c" />
    <circle cx="16" cy="20" r="9" fill="#f2c14e" stroke="#a57c12" strokeWidth="2" />
    <path d="M16 15.5l1.4 2.9 3.1.4-2.3 2.2.6 3.1-2.8-1.5-2.8 1.5.6-3.1-2.3-2.2 3.1-.4z" fill="#a57c12" />
  </svg>
);
/** Three-step podium with 1-2-3 */
export const IconPodium = () => (
  <svg {...kpi}>
    <rect x="11.5" y="9" width="9" height="19" rx="1.5" fill="#f2c14e" stroke="#a57c12" strokeWidth="1.5" />
    <rect x="2.5" y="15" width="9" height="13" rx="1.5" fill="#d5d9de" stroke="#8a9199" strokeWidth="1.5" />
    <rect x="20.5" y="19" width="9" height="9" rx="1.5" fill="#e3b58f" stroke="#8e5427" strokeWidth="1.5" />
    <text x="16" y="19.5" textAnchor="middle" fontSize="8" fontWeight="700" fill="#5c4200">1</text>
    <text x="7" y="24" textAnchor="middle" fontSize="7" fontWeight="700" fill="#4a5058">2</text>
    <text x="25" y="26.5" textAnchor="middle" fontSize="6" fontWeight="700" fill="#5e3517">3</text>
  </svg>
);
/** Person wearing a medal */
export const IconMedallist = () => (
  <svg {...kpi}>
    <circle cx="16" cy="8" r="5" fill="#1d5bb8" />
    <path d="M6 29c0-6.5 4.5-11 10-11s10 4.5 10 11z" fill="#1d5bb8" />
    <path d="M12.5 18.5l3.5 5.5 3.5-5.5" stroke="#fff" strokeWidth="1.6" fill="none" />
    <circle cx="16" cy="25" r="3.2" fill="#f2c14e" stroke="#a57c12" strokeWidth="1.4" />
  </svg>
);
/** Runner */
export const IconRunner = () => (
  <svg {...kpi} stroke="#c2410c" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="20" cy="5.5" r="3" fill="#c2410c" stroke="none" />
    <path d="M10 13l5-3 5 2 2 4 4 1" /><path d="M15 10l-2 8 5 4-1 7" /><path d="M13 18l-4 4-5-1" />
  </svg>
);
