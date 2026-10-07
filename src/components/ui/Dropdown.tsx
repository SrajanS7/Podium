import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

export interface DropdownOption<T> { value: T; label: string }

/**
 * A select-style dropdown whose list always opens BELOW the button (a native <select>
 * on macOS opens on top of itself). Keyboard: Enter / Space / ↓ open, ↑ ↓ Home End move,
 * Enter selects, Escape closes, typing a letter jumps to the next match.
 */
export function Dropdown<T extends string | number>({ label, value, options, onChange, minWidth = 200 }: {
  label: string; value: T; options: DropdownOption<T>[]; onChange: (v: T) => void; minWidth?: number;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const typed = useRef({ text: '', at: 0 }); // type-ahead buffer: "ke" finds Kenya, not the next "e…" 
  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value));

  // close when clicking outside
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // keep the active option in view and focus the list when it opens
  useEffect(() => {
    if (!open) return;
    list.current?.focus();
    list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const openList = () => { setActive(selectedIndex); setOpen(true); };
  const choose = (i: number) => { onChange(options[i].value); setOpen(false); button.current?.focus(); };

  const onButtonKey = (e: KeyboardEvent) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); openList(); }
  };
  const onListKey = (e: KeyboardEvent) => {
    const last = options.length - 1;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(last, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(last); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(active); }
    else if (e.key === 'Escape' || e.key === 'Tab') { setOpen(false); if (e.key === 'Escape') button.current?.focus(); }
    else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
      // letters typed within 0.8 s build one search ("ke" -> Kenya); a single repeated letter cycles through matches
      const now = Date.now();
      const text = now - typed.current.at < 800 ? typed.current.text + e.key.toLowerCase() : e.key.toLowerCase();
      typed.current = { text, at: now };
      const starts = (i: number) => options[i].label.toLowerCase().startsWith(text);
      const from = text.length === 1 ? active + 1 : active;
      const order = [...options.keys()].map((k) => (from + k) % options.length);
      const hit = order.find(starts);
      if (hit !== undefined) setActive(hit);
    }
  };

  return (
    <div className="field dropdown" ref={root}>
      <span id={`${id}-label`}>{label}</span>
      <button ref={button} type="button" className="dropdown-button" style={{ minWidth }}
        aria-haspopup="listbox" aria-expanded={open} aria-labelledby={`${id}-label ${id}-value`}
        onClick={() => (open ? setOpen(false) : openList())} onKeyDown={onButtonKey}>
        <span id={`${id}-value`}>{options[selectedIndex]?.label ?? ''}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"
          style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform .15s' }}><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <ul ref={list} className="dropdown-list" role="listbox" tabIndex={-1} aria-labelledby={`${id}-label`}
          aria-activedescendant={`${id}-opt-${active}`} onKeyDown={onListKey}>
          {options.map((o, i) => (
            <li key={String(o.value)} id={`${id}-opt-${i}`} data-index={i} role="option" aria-selected={i === selectedIndex}
              className={i === active ? 'is-active' : undefined}
              onMouseEnter={() => setActive(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(i)}>
              {o.label}
              {i === selectedIndex && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
