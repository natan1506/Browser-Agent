interface ActionButtonProps {
  label: string;
  icon?: string;
  onClick: () => void;
  isReady: boolean;
  isPending?: boolean;
}

export function ActionButton({
  label,
  icon,
  onClick,
  isReady,
  isPending = false,
}: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={!isReady || isPending}
      className={[
        'relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium',
        'border transition-all duration-200 whitespace-nowrap flex-shrink-0',
        isReady && !isPending
          ? 'bg-[#0f0f1a] border-[#10b981]/40 text-[#10b981] hover:bg-[#10b981]/10 hover:border-[#10b981]/70'
          : 'bg-[#0f0f1a] border-[#1e1e35] text-[#94a3b8] cursor-not-allowed opacity-50',
      ].join(' ')}
    >
      {/* Pulse dot when ready */}
      {isReady && !isPending && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10b981] opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#10b981]" />
        </span>
      )}

      {isPending && (
        <span className="h-1.5 w-1.5 rounded-full bg-[#94a3b8] animate-pulse" />
      )}

      {icon && <span>{icon}</span>}
      {label}
    </button>
  );
}
