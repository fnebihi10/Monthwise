export function Arrow({ direction = 'right' }: { direction?: 'right' | 'left' }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
      style={{ transform: direction === 'left' ? 'rotate(180deg)' : undefined }}
    >
      <path d="M4 12h15m-6-6 6 6-6 6" />
    </svg>
  );
}
