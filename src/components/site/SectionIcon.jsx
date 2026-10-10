export default function SectionIcon({ id, logos, className, children }) {
  const logo = logos[id];
  if (logo?.mode === 'custom' && logo.url) {
    const imageClassName = className ? `${className} section-custom-icon` : 'section-custom-icon';
    return <img className={imageClassName} src={logo.url} alt="" loading="lazy" />;
  }

  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      {children}
    </svg>
  );
}
