/** A row of toggle buttons (one selected). aria-pressed tells screen readers which is active. */
export function SegmentedControl<T extends string>({ label, options, value, onChange }: {
  label: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <div className="field">
      <span id={`seg-${label}`}>{label}</span>
      <div className="segmented" role="group" aria-labelledby={`seg-${label}`}>
        {options.map((o) => (
          <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>{o.label}</button>
        ))}
      </div>
    </div>
  );
}
