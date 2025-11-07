import {ChevronDownIcon, ChevronRightIcon} from 'lucide-react';
import {useState} from 'react';
import {cn} from '@sqlrooms/ui';

type ReasoningBoxProps = {
  children: React.ReactNode;
  title?: string;
};

/**
 * Component that renders a collapsible box for grouping consecutive tool parts.
 * Starts collapsed (content hidden). Clicking the title expands to show full content.
 *
 * @component
 * @param props - Component props
 * @param props.children - The tool parts to render inside the box
 * @param props.title - Custom title to display (default: "Thought")
 * @returns A React component displaying a collapsible reasoning box
 */
export const ReasoningBox: React.FC<ReasoningBoxProps> = ({children, title = 'Thought'}) => {
  // Start collapsed (content hidden)
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="border-muted rounded-md border">
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
        <span className="truncate flex-1">{title}</span>
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

