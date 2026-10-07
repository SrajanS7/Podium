import { C } from '../../styles/colors';

/** Two-line x-axis tick for Games labels like "Salt Lake City 2002" -> city / year, so labels never overlap. */
export function GamesTick({ x = 0, y = 0, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  const label = payload?.value ?? '';
  const m = label.match(/^(.*) (\d{4})$/);
  const city = m ? m[1].replace('Salt Lake City', 'Salt Lake') : label;
  return (
    <g transform={`translate(${x},${y})`}>
      <text textAnchor="middle" fill={C.axis} fontSize={12} dy={12}>{city}</text>
      <text textAnchor="middle" fill={C.axis} fontSize={12} dy={27}>{m ? m[2] : ''}</text>
    </g>
  );
}
