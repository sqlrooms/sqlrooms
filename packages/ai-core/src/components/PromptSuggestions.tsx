import {
  cn,
  Spinner,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@sqlrooms/ui';
import {Lightbulb, X} from 'lucide-react';
import {Children, type FC, type PropsWithChildren, type ReactNode} from 'react';
import {Dismiss, Item, Root, VisibilityToggle} from './suggestions';
import {usePromptSuggestions} from './suggestions/ChatSuggestionsContext';

/** Whether `node` would render anything — `null`, `false` and `[]` do not. */
function hasRenderableContent(node: ReactNode): boolean {
  return Children.toArray(node).length > 0;
}

const ROW_CLASSES = cn(
  'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs',
  'text-muted-foreground hover:bg-muted hover:text-foreground transition-colors',
  'disabled:pointer-events-none disabled:opacity-50',
);

type PromptSuggestionsContainerProps = PropsWithChildren<{
  isLoading?: boolean;
  className?: string;
}>;

/**
 * SQLRooms' default prompt-suggestions recipe: a full-width vertical list with
 * a bounded max height and internal scrolling, built from {@link Root},
 * {@link Item}, {@link Dismiss} and {@link usePromptSuggestions}.
 *
 * Replaces the previous horizontal card carousel; see the package README for
 * the breaking changes that carries. The max-height lives here rather than in
 * {@link Root}, so a host embedding the primitives picks its own height
 * policy.
 */
const Container: React.FC<PromptSuggestionsContainerProps> = ({
  isLoading = false,
  className,
  children,
}) => {
  const suggestions = usePromptSuggestions();

  // Emptiness is decided on *renderable* content, not on `children !==
  // undefined`. `null` and `false` are what a host's own conditional renders
  // when it has nothing to show, so they count as no children rather than as
  // an explicit — and then permanently empty — list, which would leave the
  // frame and its dismiss button wrapped around nothing. `Children.toArray`
  // is the test that drops them; `Children.count` counts `false` as one.
  const content = hasRenderableContent(children)
    ? children
    : suggestions.items.map((text) => <RecipeItem key={text} text={text} />);

  if (!isLoading && !hasRenderableContent(content)) {
    return null;
  }

  return (
    <Root className={cn('flex w-full items-start gap-2 py-1', className)}>
      <div className="max-h-40 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
        <div className="flex flex-col gap-0.5 p-1">
          {isLoading
            ? Array.from({length: 3}).map((_, index) => (
                <div
                  key={index}
                  className="bg-muted/50 border-border text-muted-foreground flex h-9 items-center justify-center rounded-md border"
                >
                  <Spinner className="h-3.5 w-3.5" />
                </div>
              ))
            : content}
        </div>
      </div>

      <div className="flex shrink-0 items-center pr-1">
        <Dismiss
          className="text-muted-foreground hover:text-foreground flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
          aria-label="Hide prompt suggestions"
          title="Hide prompt suggestions"
        >
          <X className="h-4 w-4" />
        </Dismiss>
      </div>
    </Root>
  );
};

type PromptSuggestionsItemProps = {
  text: string;
  className?: string;
  icon?: ReactNode;
  /**
   * Replaces the default click-to-send behavior — for a suggestion that should
   * do something other than send into the current chat, such as loading a
   * template from a start screen.
   */
  onClick?: (text: string) => void;
};

/**
 * A single row in the default vertical recipe. Sends immediately on click (via
 * {@link Item}'s `submit`) unless `onClick` overrides that. Text renders in
 * full, ellipsizing by CSS with a native `title` — never cut at a fixed
 * character count.
 */
const RecipeItem: FC<PromptSuggestionsItemProps> = ({
  text,
  className,
  icon,
  onClick,
}) => (
  <Item
    text={text}
    submit
    title={text}
    className={cn(ROW_CLASSES, className)}
    // Host-first merging means preventing default suppresses `Item`'s own
    // submit, so an override replaces sending while keeping the row's
    // readiness-driven disabled state.
    onClick={
      onClick &&
      ((event) => {
        event.preventDefault();
        onClick(text);
      })
    }
  >
    <span className="shrink-0 opacity-60">
      {icon ?? <Lightbulb className="h-3.5 w-3.5" />}
    </span>
    <span className="min-w-0 flex-1 truncate">{text}</span>
  </Item>
);

type PromptSuggestionsVisibilityToggleProps = {
  className?: string;
  icon?: ReactNode;
};

/**
 * Toggle button for showing/hiding prompt suggestions. Can be placed
 * anywhere under `<Chat>`, independent of where the list itself renders.
 */
const PromptSuggestionsVisibilityToggle: FC<
  PromptSuggestionsVisibilityToggleProps
> = ({className, icon}) => {
  const suggestions = usePromptSuggestions();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <VisibilityToggle
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
            suggestions.visible
              ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              : 'text-muted-foreground hover:text-foreground',
            className,
          )}
          aria-label={
            suggestions.visible
              ? 'Hide prompt suggestions'
              : 'Show prompt suggestions'
          }
        >
          {icon ?? <Lightbulb className="h-4 w-4" />}
        </VisibilityToggle>
      </TooltipTrigger>
      <TooltipContent>
        <p>
          {suggestions.visible
            ? 'Hide prompt suggestions'
            : 'Show prompt suggestions'}
        </p>
      </TooltipContent>
    </Tooltip>
  );
};

/**
 * Composable PromptSuggestions component with Container, Item, and
 * VisibilityToggle subcomponents.
 *
 * @example
 * ```tsx
 * <PromptSuggestions isLoading={false} />
 *
 * <PromptSuggestions>
 *   <PromptSuggestions.Item text="What are the top selling products?" />
 *   <PromptSuggestions.Item text="Show me the revenue trends" />
 * </PromptSuggestions>
 *
 * <PromptSuggestions.VisibilityToggle />
 * ```
 */
export const PromptSuggestions = Object.assign(Container, {
  /** @deprecated Render `<PromptSuggestions>` directly. */
  Container,
  Item: RecipeItem,
  VisibilityToggle: PromptSuggestionsVisibilityToggle,
});
