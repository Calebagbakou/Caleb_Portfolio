import { Link } from 'react-router-dom';

export default function ShopAlert({ message, action, actionTo, onAction, tone = 'error' }) {
  if (!message) return null;
  return (
    <div className={`shop-alert ${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <span className="shop-alert-icon" aria-hidden="true">{tone === 'success' ? '✓' : '!'}</span>
      <div className="shop-alert-content">
        <strong>{tone === 'error' ? 'On va régler ça' : 'Information'}</strong>
        <span>{message}</span>
        {actionTo && <Link to={actionTo} className="shop-alert-action">{action}</Link>}
        {onAction && <button type="button" className="shop-alert-action" onClick={onAction}>{action}</button>}
      </div>
    </div>
  );
}
