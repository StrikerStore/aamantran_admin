import './Badge.css';
import { capitalize, STATUS_CLASS, statusLabel } from '../../lib/utils';

export function Badge({ status }) {
  const label = statusLabel(status);
  const cls   = STATUS_CLASS[label] || 'badge-draft';
  return <span className={`badge ${cls}`}>{capitalize(label)}</span>;
}
