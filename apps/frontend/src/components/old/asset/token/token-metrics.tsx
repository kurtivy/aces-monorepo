interface TokenMetricsProps {
  children: React.ReactNode;
  className?: string;
}

export default function TokenMetrics({ children, className = '' }: TokenMetricsProps) {
  return (
    <div
      className={`bg-[#231F20] rounded-xl border border-[#D0B284]/20 shadow-lg overflow-hidden ${className}`}
    >
      {children}
    </div>
  );
}
