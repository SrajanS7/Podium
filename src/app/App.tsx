import { lazy, Suspense, useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useDataStore } from '../store/useDataStore';
import Layout from './Layout';
import OverviewPage from '../pages/OverviewPage';
import CountriesPage from '../pages/CountriesPage';
import DriversPage from '../pages/DriversPage';
import AthletesPage from '../pages/AthletesPage';
import GeographyPage from '../pages/GeographyPage';
import SportStrategyPage from '../pages/SportStrategyPage';
import LiteracyModelPage from '../pages/LiteracyModelPage';
// Data manager pulls in the Excel library: load it only when the screen is opened
const DataManagerPage = lazy(() => import('../pages/DataManagerPage'));

/** HashRouter: works on any static host (and inside a file or artifact) without server rewrites. */
export default function App() {
  const { status, error, init } = useDataStore();
  useEffect(() => { void init(); }, [init]);

  if (status === 'loading') return <p role="status" style={{ padding: 32 }}>Loading Olympic data…</p>;
  if (status === 'error') return <p role="alert" style={{ padding: 32 }}>Sorry, the data could not be loaded: {error}</p>;

  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<OverviewPage />} />
          <Route path="countries" element={<CountriesPage />} />
          <Route path="drivers" element={<DriversPage />} />
          <Route path="geography" element={<GeographyPage />} />
          <Route path="sport-strategy" element={<SportStrategyPage />} />
          <Route path="regions" element={<Navigate to="/sport-strategy" replace />} />
          <Route path="literacy-model" element={<LiteracyModelPage />} />
          <Route path="athletes" element={<AthletesPage />} />
          <Route path="data" element={<Suspense fallback={<p role="status">Loading the data manager…</p>}><DataManagerPage /></Suspense>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
