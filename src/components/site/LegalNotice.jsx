import { Link } from 'react-router-dom';
import { legalFacts } from '../../data/legalFacts';

export default function LegalNotice({ variant = 'continuing' }) {
  if (variant === 'contact') {
    return (
      <p className="legal-notice">
        {legalFacts.legalNotice.contact}{' '}
        <Link to={legalFacts.legalRoutes.privacy}>Politique de confidentialité</Link>.
      </p>
    );
  }

  const text = variant === 'signup'
    ? legalFacts.legalNotice.signup
    : variant === 'checkout'
      ? legalFacts.legalNotice.checkout
      : legalFacts.legalNotice.continuing;

  return (
    <p className="legal-notice">
      {text}{' '}
      <Link to={legalFacts.legalRoutes.terms}>Conditions</Link> et la{' '}
      <Link to={legalFacts.legalRoutes.privacy}>Politique de confidentialité</Link>.
    </p>
  );
}
