export default function ShopArrow({ direction = 'right' }) {
  return (
    <svg
      className={`shop-arrow${direction === 'left' ? ' shop-arrow-left' : ''}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
