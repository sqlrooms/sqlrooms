import {ChevronDownIcon, ChevronRightIcon} from 'lucide-react';
import {useState} from 'react';
import {cn} from '@sqlrooms/ui';

type ReasoningBoxProps = {
  children: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
  defaultOpen?: boolean;
};
export const ReasoningBox: React.FC<ReasoningBoxProps> = ({
  children,
  className,
  title,
  defaultOpen = false,
}) => {
  const displayTitle = title ?? 'Thought';
  // Start with defaultOpen state (collapsed by default unless specified)
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className={cn('border-muted rounded-md border', className)}>
      <button
        onClick={handleToggle}
        className={cn(
          'flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-normal',
          'text-gray-500 dark:text-gray-400',
          'hover:bg-muted/80 transition-colors',
          isOpen ? 'rounded-t-md' : 'rounded-md',
        )}
      >
        {isOpen ? (
          <ChevronDownIcon className="h-3 w-3 shrink-0" />
        ) : (
          <ChevronRightIcon className="h-3 w-3 shrink-0" />
        )}
        <span className="flex-1 truncate">{displayTitle}</span>
      </button>
      {isOpen && (
        <div
          className={cn(
            'overflow-y-auto px-3 pb-3',
            'scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent',
            'dark:scrollbar-thumb-gray-600',
          )}
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgb(209 213 219) transparent',
          }}
        >
          <div className="flex flex-col gap-2 pt-2">{children}</div>
        </div>
      )}
    </div>
  );
};
