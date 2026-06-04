import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@sqlrooms/ui';
import type {Editor} from '@tiptap/react';
import {ChevronDownIcon, PilcrowIcon} from 'lucide-react';
import {FC} from 'react';

const HEADING_LEVELS = [1, 2, 3, 4] as const;

type HeadingLevel = (typeof HEADING_LEVELS)[number];

export type HeadingDropdownProps = {
  editor: Editor | null;
  activeHeadingLevel: HeadingLevel | null;
  disabled: boolean;
};

export const HeadingDropdown: FC<HeadingDropdownProps> = ({
  editor,
  activeHeadingLevel,
  disabled,
}) => {
  const label = activeHeadingLevel ? `H${activeHeadingLevel}` : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant={activeHeadingLevel ? 'secondary' : 'ghost'}
          className="h-8 gap-1 px-2"
          disabled={disabled}
          title="Text style"
        >
          {label ? (
            <span className="min-w-5 text-xs font-semibold">{label}</span>
          ) : (
            <PilcrowIcon className="h-4 w-4" />
          )}
          <ChevronDownIcon className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem
          onClick={() => editor?.chain().focus().setParagraph().run()}
        >
          Paragraph
        </DropdownMenuItem>
        {HEADING_LEVELS.map((level) => (
          <DropdownMenuItem
            key={level}
            onClick={() => editor?.chain().focus().toggleHeading({level}).run()}
          >
            <span className="text-muted-foreground mr-2 font-mono text-xs">
              H{level}
            </span>
            Heading {level}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
