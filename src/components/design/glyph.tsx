/** The Cartoonist mark: a sheet with a drawn line and two ruled tick legs. */
export function Glyph({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" fill="none" className={className}>
      <rect x="2.5" y="4.5" width="27" height="20" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <path d="M7 19c4-9 8 4 11-3s5 1 7-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 24.5 10 29M20 24.5l2 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
