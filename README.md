# Podium – Olympic Insights (React + TypeScript)

A web app for exploring Olympic medal performance 2000–2012: who wins, **why** some nations
win far more than others, which athletes stand out, and a data manager for adding and
correcting the data. Built for a non-technical user (e.g. a performance analyst at a
National Olympic Committee).

## Run it

```bash
npm install
npm run dev            # http://localhost:5173
```

| Script | What it does |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Type-check + production build into `dist/` (works from any folder: `base: './'`) |
| `npm run preview` | Serve the production build on http://localhost:4173 |
| `npm test` | Unit tests (Vitest): counting rule, metrics, model, validation (golden values) |
| `npm run test:e2e` | End-to-end + accessibility tests (Playwright + axe) against the build |
| `npm run convert-data` | Re-create `public/data/dataset.json` from `data/Olympic_Games_Dataset.xlsx` |

First time running e2e tests: `npx playwright install chromium`.

## Screens

The sidebar is ordered by what matters most for the brief: the core insights, then the data manager
(add / edit data), then optional extras.

| Group | Screen | Question it answers | Counting |
|---|---|---|---|
| | Overview | What does the medal landscape look like? | Team sports counted once |
| Insights | Countries | How does a nation perform, in which sports, where does it rank? | Team sports counted once |
| Insights | Drivers of success | Why do nations perform as they do, and who breaks the pattern? Correlation matrix, expected-medals model, exceptions, literacy beyond wealth, home advantage | Team sports counted once |
| Insights | Athletes | Who are the most decorated athletes, at what age do medallists peak? | Athlete level |
| Manage | Data manager | Add / edit / delete records, edit nations, change counting rules, review data quality, import / export Excel | Both |
| Additional insights | Geography myths | Does a long coastline mean more water-sport medals? Do crowded nations or nations losing people fall behind? | Team sports counted once |
| Additional insights | Sport strategy | Which sports give the most medals per funded athlete (swimming 2.08 per medallist vs football 0.07)? Same chart as the notebook; peak age by sport stays on Athletes | Team sports counted once ÷ distinct medallists |
| Additional insights | Literacy model | What if the model also knew literacy? Population + wealth + literacy scatter, 77% → 85% explained, whose expected medals change most (India 158 → 6) | Team sports counted once |

## Key decisions

**1. Medal counting: team sports counted once** (`src/domain/counting.ts`). The source has one row per
*athlete* medal, so a football gold appears ~18 times. Sports where every event is a team
event are collapsed to one medal per nation × Games × sport × colour; other sports count
"Number of Medals won". Football becomes exactly 24 medals (2 events × 3 × 4 Games).
Each sport's rule can be switched in the Data manager. Known limits: relays and crews in
mixed sports still count per athlete (~1.6× official totals), and men's and women's team
medals of the same colour merge (no gender column). Rankings stay reliable
(rank correlation 0.97 with the official Beijing 2008 table).

**2. Drivers of success = a correlation matrix + a simple, explainable model.** The matrix
(`correlationMatrix` in `src/domain/metrics.ts`, drawn by `src/components/charts/CorrelationMatrix.tsx`) shows the
Spearman rank correlation of every pair among medals and seven national factors. Ranks, because medals are very
skewed (868 vs mostly 0). Economy size moves with medals most (+0.75), population density not at all (−0.02).
Then the model (`expectedMedalsModel` in
`src/domain/metrics.ts`): a Poisson regression (the standard model for counts) predicts each
nation's medals from population and GDP per person. It explains ~77% of the deviance (a pseudo-R² for count models, not an ordinary R²); the
gap between actual and expected identifies the exceptions (Jamaica, Cuba, Kenya above;
India, Pakistan, the Philippines below). Fitted in the browser (`src/domain/stats.ts`, IRLS,
~40 lines), so it re-fits live when filters or data change. Coefficients match Python's
statsmodels (tested).

**3. No backend.** 9,107 rows fit easily in the browser. Data is loaded from a JSON file
generated from the Excel workbook; edits are kept in IndexedDB as a working copy behind a
`DataRepository` interface (`src/data/repository.ts`), so a real API can replace it by
writing one class. The original Excel file is never modified.

**Safe import.** Importing replaces the whole data set, so the file is checked first: all six sheets, every column the
import reads (`REQUIRED_COLUMNS`), then every row with the same rules as the "Add medal record" form plus "does this ID
exist" checks (`validateImport`). Any problem stops the import and lists the Excel rows to fix; nothing is changed.

**4. Pure logic, thin UI.** All numbers come from pure functions in `src/domain/`, tested
against golden values from an independent Python analysis. Pages only call them through
`useMemo`. State is one small Zustand store with undo (`src/store/useDataStore.ts`).

**5. Accessibility.** Semantic HTML, keyboard support, visible focus, 44 px targets, colour
never the only cue, every chart has a summary and a "Show as table" view. Automated axe
scan of all screens in the e2e suite (WCAG 2.1 A/AA).

**6. Geography uses every column of the Country Data sheet** (`groupStats` and friends in
`src/domain/metrics.ts`). The workbook's `Coastline` is coast length ÷ area × 100, not a length, so the import converts it
to kilometres (`coastlineKm` = ratio × area ÷ 100; Albania 1.26 × 28,748 ÷ 100 = 362 km) and the export converts it back.
Population density is derived from population ÷ area (people per km²), so it stays right after edits. Bands are compared with **actual ÷ expected**: the group's medals divided by the sum of the model's expected medals for its
nations, so 1.0× everywhere means the factor adds nothing beyond population and wealth. Working copies saved by the previous version are back-filled with the new fields on load.

Findings (all Games): water-sport medals per 10M people are about level with or without a coast (Landlocked 3.2 ·
under 1,000 km 3.0 · 1,000–5,000 km 3.0 · over 5,000 km 3.6), landlocked nations hold 9.1% of
medals but only about 3% in sailing, swimming and rowing (and 1% in gymnastics), while winning 32% in canoeing, so they
specialise rather than lack the sea; density shows no steady pattern (1.46× · 0.86× · 1.19× · 0.52×); nations gaining people win
7× more per person but only 1.23× vs 0.93× after wealth.
All are golden-value tests in `metrics.test.ts`.

## Project structure

```
scripts/convert-excel.ts      Excel -> public/data/dataset.json (build time)
src/
  domain/                     types, counting rule, metrics, statistics, validation (pure TS + tests)
  data/                       repository (IndexedDB), Excel import/export
  store/                      Zustand store: dataset, filters, undo history
  components/ui, charts/      cards, filters, chart frame, medal bars, icons
  pages/                      one file per screen; data-manager/ holds its tabs and forms
  styles/                     tokens.css (design tokens), global.css, colors.ts (chart colours)
e2e/                          Playwright smoke + accessibility tests
```



## Tech

React 19 · TypeScript (strict) · Vite · React Router (hash routing) · Zustand · Recharts ·
Zod · SheetJS (xlsx) · idb-keyval · Vitest · Playwright · axe-core.

**7. Sport strategy mirrors the notebook** (`sportReturns` in `src/domain/metrics.ts`). Return per athlete =
medals (team sports once per team) ÷ distinct medallists in the sport, all Games. Golden values from the notebook are
tested (swimming 2.08, ice hockey 0.04, football 24 medals for 352 medallists). The old Regions screen was removed;
`#/regions` now redirects here.

**8. Counting rules are a two-option choice per sport** (Data manager › Sports & counting rules): *Once per team* or
*Per athlete*, as a radio group, so the highlighted option always names the rule in use (a single checkbox labelled
with the current state read as the opposite action).
