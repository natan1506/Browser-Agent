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
          ? 'bg-surface border-success/40 text-success hover:bg-success/10 hover:border-success/70'
          : 'bg-surface border-border text-text-secondary cursor-not-allowed opacity-50',
      ].join(' ')}
    >
      {/* Pulse dot when ready */}
      {isReady && !isPending && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#10b981]" />
        </span>
      )}

      {isPending && (
        <span className="h-1.5 w-1.5 rounded-full bg-text-secondary/40 animate-pulse" />
      )}

      {icon && <span>{icon}</span>}
      {label}
    </button>
  );
}
