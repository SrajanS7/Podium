import { NavLink, Outlet } from 'react-router-dom';
import { IconBook, IconDatabase, IconGlobe, IconMap, IconMedal, IconOverview, IconTarget, IconTrend, IconUser, IconWave } from '../components/ui/Icons';
import { useDataStore } from '../store/useDataStore';

const navClass = ({ isActive }: { isActive: boolean }) => `nav-link${isActive ? ' active' : ''}`;

/** App shell: sidebar navigation + the current page. */
export default function Layout() {
  const changeCount = useDataStore((s) => s.changeCount);
  return (
    <div className="app">
      <a href="#main" className="skip-link">Skip to content</a>
      <nav className="sidebar" aria-label="Main">
        <NavLink to="/" className="brand"><IconMedal />Podium</NavLink>
        <NavLink to="/" end className={navClass}><IconOverview />Overview</NavLink>
        <div className="nav-label">Insights</div>
        <NavLink to="/countries" className={navClass}><IconGlobe />Countries</NavLink>
        <NavLink to="/drivers" className={navClass}><IconTrend />Drivers of success</NavLink>
        <NavLink to="/athletes" className={navClass}><IconUser />Athletes</NavLink>
        <div className="nav-label">Manage</div>
        <NavLink to="/data" className={navClass}><IconDatabase />Data manager</NavLink>
        <div className="nav-label">Additional insights</div>
        <NavLink to="/geography" className={navClass}><IconWave />Geography myths</NavLink>
        <NavLink to="/regions" className={navClass}><IconMap />Regions</NavLink>
        <NavLink to="/literacy-model" className={navClass}><IconBook />Literacy model</NavLink>
        <div className="nav-label">Play</div>
        <NavLink to="/find-your-sport" className={navClass}><IconTarget />Find your sport</NavLink>
        <p className="sidebar-note">
          Olympic Games 2000–2012{changeCount > 0 ? ` · ${changeCount} edit${changeCount > 1 ? 's' : ''} this session` : ''}
        </p>
      </nav>
      <main id="main" className="main" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
