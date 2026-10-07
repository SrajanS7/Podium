import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function KpiCard({ label, value, unit, note, icon }: { label: string; value: ReactNode; unit?: string; note?: string; icon?: ReactNode }) {
  return (
    <div className="card" style={{ gap: 6 }}>
      <span className="kpi-label kpi-head">{icon && <span className="kpi-icon">{icon}</span>}{label}</span>
      <span className="kpi-value">{value}{unit && <span className="kpi-unit"> {unit}</span>}</span>
      {note && <span className="muted small">{note}</span>}
    </div>
  );
}

export function InsightBanner({ children, linkTo, linkText }: { children: ReactNode; linkTo?: string; linkText?: string }) {
  return (
    <section className="card insight" aria-label="Key insight">
      <div className="stack" style={{ gap: 4 }}>
        <span className="insight-kicker">Key insight</span>
        <p className="insight-text">{children}</p>
      </div>
      {linkTo && <Link className="btn" to={linkTo}>{linkText}</Link>}
    </section>
  );
}

export function InsightCard({ to, tag, tagClass = '', value, text, linkText }: { to: string; tag: string; tagClass?: string; value: string; text: string; linkText: string }) {
  return (
    <Link to={to} className="card link-card">
      <span className={`tag ${tagClass}`}>{tag}</span>
      <span className="big-number">{value}</span>
      <span>{text}</span>
      <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{linkText}</span>
    </Link>
  );
}

export function PageHeader({ title, subtitle, badge, children }: { title: string; subtitle: string; badge?: string; children?: ReactNode }) {
  return (
    <div className="page-header">
      <div className="stack" style={{ gap: 4 }}>
        <h1 className="page-title">{title}{badge && <span className="title-badge">{badge}</span>}</h1>
        <p className="muted">{subtitle}</p>
      </div>
      {children && <div className="row" style={{ alignItems: 'flex-end', gap: 12 }}>{children}</div>}
    </div>
  );
}
