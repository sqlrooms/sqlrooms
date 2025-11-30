import {cn} from '@sqlrooms/ui';

/**
 * Animated thinking indicator with ellipsis dots
 *
 * @param {className} className - The className for the component
 * @returns {React.FC} The AiThinkingDots component
 **/
export const AiThinkingDots: React.FC<{className?: string}> = ({className}) => (
  <div className={cn('flex items-center gap-1', className)}>
    <span className="dot inline-block h-1 w-1 rounded-full bg-current" />
    <span className="dot inline-block h-1 w-1 rounded-full bg-current" />
    <span className="dot inline-block h-1 w-1 rounded-full bg-current" />
    <style>{`
      @keyframes dot-bounce {
        0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
        30% { opacity: 0.8; transform: translateY(-8px); }
      }
      .dot { opacity: 0.3; animation: dot-bounce 2s ease-in-out infinite; }
      .dot:nth-child(2) { animation-delay: 0.20s; }
      .dot:nth-child(3) { animation-delay: 0.30s; }
    `}</style>
  </div>
);
