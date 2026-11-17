/** Marca NESS: duas folhas (NFS-e e NF-e) ligadas pelo traço âmbar que forma o "N". Herda a cor do texto. */
export function Logo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <rect x="6" y="4" width="30" height="42" rx="5" fill="none" stroke="currentColor" strokeWidth="3.5" />
      <rect x="28" y="18" width="30" height="42" rx="5" fill="none" stroke="currentColor" strokeWidth="3.5" />
      <path d="M16 38V14L48 50V26" fill="none" stroke="#E8A33D" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
