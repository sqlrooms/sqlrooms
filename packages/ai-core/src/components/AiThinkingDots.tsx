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
      @keyframes dot-fade {
        0%, 100% { opacity: 0.25; }
        50% { opacity: 1; }
      }
      .dot { opacity: 0.25; animation: dot-fade 1.4s ease-in-out infinite; }
      .dot:nth-child(2) { animation-delay: 0.2s; }
      .dot:nth-child(3) { animation-delay: 0.4s; }
    `}</style>
  </div>
);
