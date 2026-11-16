'use client';

import * as React from 'react';
import {Slot} from '@radix-ui/react-slot';
import {cva, type VariantProps} from 'class-variance-authority';
import {PanelLeft} from 'lucide-react';
import {useIsMobile} from '../hooks/use-mobile';
import {cn} from '../lib/utils';
import {Button} from './button';
import {Input} from './input';
import {Separator} from './separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from './sheet';
import {Skeleton} from './skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './tooltip';

const SIDEBAR_COOKIE_NAME = 'sidebar_state';
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const SIDEBAR_WIDTH = '16rem';
const SIDEBAR_WIDTH_MOBILE = '18rem';
const SIDEBAR_WIDTH_ICON = '3rem';
const SIDEBAR_KEYBOARD_SHORTCUT = 'b';
const SIDEBAR_DEFAULT_MIN_WIDTH = 192;
const SIDEBAR_DEFAULT_MAX_WIDTH = 640;
/** Pointer travel before a press on the rail counts as a drag, not a click. */
const SIDEBAR_RAIL_DRAG_THRESHOLD = 3;
/** How far past the minimum width a drag has to go to collapse the sidebar. */
const SIDEBAR_RAIL_COLLAPSE_OVERSHOOT = 32;
/** How far back a drag has to go to reopen a sidebar it collapsed. */
const SIDEBAR_RAIL_REOPEN_DISTANCE = 16;
const SIDEBAR_RAIL_KEYBOARD_STEP = 16;

/**
 * Keeps a sidebar width within `[minWidth, maxWidth]`, rounded to whole
 * pixels. When the range is empty (`maxWidth < minWidth`), `minWidth` wins.
 */
function clampSidebarWidth(width: number, minWidth: number, maxWidth: number) {
  return Math.round(Math.max(minWidth, Math.min(width, maxWidth)));
}

type SidebarResizeContextProps = {
  /** Current width in pixels, already clamped to `[minWidth, maxWidth]`. */
  width: number;
  minWidth: number;
  maxWidth: number;
  /** True while the rail is being dragged. */
  isResizing: boolean;
  /**
   * Sets the width (clamped). Pass `commit: false` for intermediate drag
   * updates; `onWidthChange` is only called for committed widths.
   */
  setWidth: (width: number, options?: {commit?: boolean}) => void;
  setIsResizing: (isResizing: boolean) => void;
};

type SidebarContextProps = {
  state: 'expanded' | 'collapsed';
  open: boolean;
  setOpen: (open: boolean | ((open: boolean) => boolean)) => void;
  openMobile: boolean;
  setOpenMobile: React.Dispatch<React.SetStateAction<boolean>>;
  isMobile: boolean;
  toggleSidebar: () => void;
  /**
   * Width state when the provider was given `defaultWidth`, otherwise
   * `undefined` (the sidebar is not resizable).
   */
  resize: SidebarResizeContextProps | undefined;
};

const SidebarContext = React.createContext<SidebarContextProps | null>(null);

function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider.');
  }

  return context;
}

/**
 * Props for {@link SidebarProvider}.
 *
 * Passing `defaultWidth` makes the sidebar resizable: dragging the
 * {@link SidebarRail} (or pressing the arrow keys while it has focus) changes
 * the width, and dragging well past `minWidth` collapses the sidebar.
 */
type SidebarProviderProps = React.ComponentProps<'div'> & {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * Initial width in pixels. Setting it enables resizing; leave it unset for a
   * fixed width (set via the `--sidebar-width` CSS variable).
   */
  defaultWidth?: number;
  /** Smallest width a resize can reach, in pixels. Defaults to 192. */
  minWidth?: number;
  /**
   * Largest width a resize can reach, in pixels. Defaults to 640. It can change
   * over time (e.g. with the window size): the sidebar is shown clamped to it,
   * but the width the user chose is kept and comes back once there is room.
   */
  maxWidth?: number;
  /**
   * Called with the new width when a resize finishes (pointer released or an
   * arrow-key step), not on every pointer move. Use it to persist the width.
   */
  onWidthChange?: (width: number) => void;
};

function SidebarProvider({
  defaultOpen = true,
  open: openProp,
  onOpenChange: setOpenProp,
  defaultWidth,
  minWidth = SIDEBAR_DEFAULT_MIN_WIDTH,
  maxWidth = SIDEBAR_DEFAULT_MAX_WIDTH,
  onWidthChange,
  className,
  style,
  children,
  ...props
}: SidebarProviderProps) {
  const isMobile = useIsMobile();
  const resizable = defaultWidth !== undefined && !isMobile;
  // The width the user chose; what is shown is this clamped to the current
  // range, so a temporarily smaller `maxWidth` doesn't overwrite it.
  const [preferredWidth, setPreferredWidth] = React.useState(defaultWidth ?? 0);
  const [isResizing, setIsResizing] = React.useState(false);
  const width = clampSidebarWidth(preferredWidth, minWidth, maxWidth);

  const setWidth = React.useCallback(
    (nextWidth: number, {commit = true}: {commit?: boolean} = {}) => {
      const clamped = clampSidebarWidth(nextWidth, minWidth, maxWidth);
      setPreferredWidth(clamped);
      if (commit) {
        onWidthChange?.(clamped);
      }
    },
    [minWidth, maxWidth, onWidthChange],
  );

  const resize = React.useMemo<SidebarResizeContextProps | undefined>(
    () =>
      resizable
        ? {width, minWidth, maxWidth, isResizing, setWidth, setIsResizing}
        : undefined,
    [resizable, width, minWidth, maxWidth, isResizing, setWidth],
  );
  const [openMobile, setOpenMobile] = React.useState(false);

  const [_open, _setOpen] = React.useState(defaultOpen);
  const open = openProp ?? _open;
  const setOpen = React.useCallback(
    (value: boolean | ((value: boolean) => boolean)) => {
      const openState = typeof value === 'function' ? value(open) : value;
      if (setOpenProp) {
        setOpenProp(openState);
      } else {
        _setOpen(openState);
      }

      document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
    },
    [setOpenProp, open],
  );

  const toggleSidebar = React.useCallback(() => {
    return isMobile
      ? setOpenMobile((nextOpen) => !nextOpen)
      : setOpen((nextOpen) => !nextOpen);
  }, [isMobile, setOpen, setOpenMobile]);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault();
        toggleSidebar();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar]);

  const state = open ? 'expanded' : 'collapsed';

  const contextValue = React.useMemo<SidebarContextProps>(
    () => ({
      state,
      open,
      setOpen,
      isMobile,
      openMobile,
      setOpenMobile,
      toggleSidebar,
      resize,
    }),
    [
      state,
      open,
      setOpen,
      isMobile,
      openMobile,
      setOpenMobile,
      toggleSidebar,
      resize,
    ],
  );

  return (
    <SidebarContext.Provider value={contextValue}>
      <div
        data-slot="sidebar-wrapper"
        data-resizing={isResizing || undefined}
        style={
          {
            '--sidebar-width': SIDEBAR_WIDTH,
            '--sidebar-width-icon': SIDEBAR_WIDTH_ICON,
            ...style,
            ...(resizable ? {'--sidebar-width': `${width}px`} : undefined),
          } as React.CSSProperties
        }
        className={cn(
          'group/sidebar-wrapper has-data-[variant=inset]:bg-sidebar flex min-h-svh w-full',
          // Follow the pointer while dragging instead of animating, and don't
          // select text the drag passes over.
          'data-resizing:cursor-ew-resize data-resizing:select-none',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

function Sidebar({
  side = 'left',
  variant = 'sidebar',
  collapsible = 'offcanvas',
  className,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  side?: 'left' | 'right';
  variant?: 'sidebar' | 'floating' | 'inset';
  collapsible?: 'offcanvas' | 'icon' | 'none';
}) {
  const {isMobile, state, openMobile, setOpenMobile} = useSidebar();

  if (collapsible === 'none') {
    return (
      <div
        data-slot="sidebar"
        className={cn(
          'bg-sidebar text-sidebar-foreground flex h-full w-(--sidebar-width) flex-col',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  }

  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile}>
        <SheetContent
          data-sidebar="sidebar"
          data-slot="sidebar"
          data-mobile="true"
          className="bg-sidebar text-sidebar-foreground w-(--sidebar-width) p-0 [&>button]:hidden"
          style={
            {
              '--sidebar-width': SIDEBAR_WIDTH_MOBILE,
            } as React.CSSProperties
          }
          side={side}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Sidebar</SheetTitle>
            <SheetDescription>Displays the mobile sidebar.</SheetDescription>
          </SheetHeader>
          <div className="flex h-full w-full flex-col">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div
      className="group peer text-sidebar-foreground hidden md:block"
      data-state={state}
      data-collapsible={state === 'collapsed' ? collapsible : ''}
      data-variant={variant}
      data-side={side}
      data-slot="sidebar"
    >
      <div
        data-slot="sidebar-gap"
        className={cn(
          'relative w-(--sidebar-width) bg-transparent transition-[width] duration-200 ease-linear group-data-resizing/sidebar-wrapper:transition-none',
          'group-data-[collapsible=offcanvas]:w-0',
          'group-data-[side=right]:rotate-180',
          variant === 'floating' || variant === 'inset'
            ? 'group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]'
            : 'group-data-[collapsible=icon]:w-(--sidebar-width-icon)',
        )}
      />
      <div
        data-slot="sidebar-container"
        className={cn(
          'fixed inset-y-0 z-10 hidden h-svh w-(--sidebar-width) transition-[left,right,width] duration-200 ease-linear group-data-resizing/sidebar-wrapper:transition-none md:flex',
          side === 'left'
            ? 'left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]'
            : 'right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]',
          variant === 'floating' || variant === 'inset'
            ? 'p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]'
            : 'group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[side=left]:border-r group-data-[side=right]:border-l',
          className,
        )}
        {...props}
      >
        <div
          data-sidebar="sidebar"
          data-slot="sidebar-inner"
          className="bg-sidebar group-data-[variant=floating]:border-sidebar-border flex h-full w-full flex-col group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:border group-data-[variant=floating]:shadow-sm"
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function SidebarTrigger({
  className,
  onClick,
  ...props
}: React.ComponentProps<typeof Button>) {
  const {toggleSidebar} = useSidebar();

  return (
    <Button
      data-sidebar="trigger"
      data-slot="sidebar-trigger"
      variant="ghost"
      size="icon"
      className={cn('size-7', className)}
      onClick={(event) => {
        onClick?.(event);
        toggleSidebar();
      }}
      {...props}
    >
      <PanelLeft />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  );
}

const SIDEBAR_RAIL_CLASS_NAME = cn(
  'hover:after:bg-sidebar-border absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all ease-linear group-data-[side=left]:-right-4 group-data-[side=right]:left-0 after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] sm:flex',
  'in-data-[side=left]:cursor-w-resize in-data-[side=right]:cursor-e-resize',
  '[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize',
  'hover:group-data-[collapsible=offcanvas]:bg-sidebar group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full',
  '[[data-side=left][data-collapsible=offcanvas]_&]:-right-2',
  '[[data-side=right][data-collapsible=offcanvas]_&]:-left-2',
);

/**
 * The thin strip along the sidebar's inner edge. Clicking it toggles the
 * sidebar.
 *
 * When the {@link SidebarProvider} has `defaultWidth`, the rail is also a
 * focusable separator: dragging it resizes the sidebar, dragging well past the
 * minimum width collapses it, and dragging a collapsed sidebar outward reopens
 * it, all in one gesture. Arrow keys resize it while it has focus, and Enter or
 * Space toggles it.
 */
function SidebarRail({className, ...props}: React.ComponentProps<'button'>) {
  const {resize} = useSidebar();

  if (resize) {
    return (
      <ResizableSidebarRail
        resize={resize}
        className={className}
        {...(props as React.ComponentProps<'div'>)}
      />
    );
  }

  return <ToggleSidebarRail className={className} {...props} />;
}

function ToggleSidebarRail({
  className,
  ...props
}: React.ComponentProps<'button'>) {
  const {toggleSidebar} = useSidebar();

  return (
    <button
      data-sidebar="rail"
      data-slot="sidebar-rail"
      aria-label="Toggle Sidebar"
      tabIndex={-1}
      onClick={toggleSidebar}
      title="Toggle Sidebar"
      className={cn(SIDEBAR_RAIL_CLASS_NAME, className)}
      {...props}
    />
  );
}

type RailDrag = {
  pointerId: number;
  startX: number;
  /** +1 when moving the pointer right widens the sidebar, -1 otherwise. */
  direction: 1 | -1;
  moved: boolean;
  expanded: boolean;
  /** Pointer position and width the current resize segment is measured from. */
  anchorX: number;
  anchorWidth: number;
  /** Pointer position where the drag last collapsed the sidebar. */
  collapsedAtX: number;
  lastWidth: number;
};

function ResizableSidebarRail({
  resize,
  className,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onClick,
  onKeyDown,
  ...props
}: React.ComponentProps<'div'> & {resize: SidebarResizeContextProps}) {
  const {state, setOpen, toggleSidebar} = useSidebar();
  const {width, minWidth, maxWidth, setWidth, setIsResizing} = resize;
  const dragRef = React.useRef<RailDrag | null>(null);
  // Set when a drag ends so the click the browser fires right after it doesn't
  // also toggle the sidebar.
  const suppressClickRef = React.useRef(false);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    onPointerDown?.(event);
    if (event.defaultPrevented || event.button !== 0) {
      return;
    }
    event.preventDefault();
    const side = event.currentTarget
      .closest<HTMLElement>('[data-side]')
      ?.getAttribute('data-side');
    event.currentTarget.setPointerCapture?.(event.pointerId);
    suppressClickRef.current = false;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      direction: side === 'right' ? -1 : 1,
      moved: false,
      expanded: state === 'expanded',
      anchorX: event.clientX,
      anchorWidth: width,
      collapsedAtX: event.clientX,
      lastWidth: width,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    onPointerMove?.(event);
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    const x = event.clientX;
    // Distance moved in the direction that widens the sidebar.
    const outward = (from: number) => (x - from) * drag.direction;

    if (!drag.moved) {
      if (Math.abs(x - drag.startX) < SIDEBAR_RAIL_DRAG_THRESHOLD) {
        return;
      }
      drag.moved = true;
    }

    if (!drag.expanded) {
      // A collapsed sidebar reopens once the pointer moves outward, then the
      // same drag keeps resizing it.
      const reopenDistance =
        drag.collapsedAtX === drag.startX
          ? SIDEBAR_RAIL_DRAG_THRESHOLD
          : SIDEBAR_RAIL_REOPEN_DISTANCE;
      if (outward(drag.collapsedAtX) < reopenDistance) {
        return;
      }
      drag.expanded = true;
      drag.anchorX = x;
      drag.anchorWidth =
        drag.collapsedAtX === drag.startX ? drag.lastWidth : minWidth;
      setOpen(true);
      return;
    }

    const nextWidth = drag.anchorWidth + outward(drag.anchorX);
    if (nextWidth < minWidth - SIDEBAR_RAIL_COLLAPSE_OVERSHOOT) {
      drag.expanded = false;
      drag.collapsedAtX = x;
      // Let the collapse animate rather than snap.
      setIsResizing(false);
      setOpen(false);
      return;
    }
    setIsResizing(true);
    drag.lastWidth = clampSidebarWidth(nextWidth, minWidth, maxWidth);
    setWidth(nextWidth, {commit: false});
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (drag.moved) {
      suppressClickRef.current = true;
      setIsResizing(false);
      setWidth(drag.lastWidth);
    }
  };

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    onClick?.(event);
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (!event.defaultPrevented) {
      toggleSidebar();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleSidebar();
      return;
    }
    if (
      state !== 'expanded' ||
      (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')
    ) {
      return;
    }
    event.preventDefault();
    const side = event.currentTarget
      .closest<HTMLElement>('[data-side]')
      ?.getAttribute('data-side');
    const widens = (event.key === 'ArrowRight') === (side !== 'right');
    setWidth(
      width +
        (widens ? SIDEBAR_RAIL_KEYBOARD_STEP : -SIDEBAR_RAIL_KEYBOARD_STEP),
    );
  };

  return (
    <div
      data-sidebar="rail"
      data-slot="sidebar-rail"
      role="separator"
      tabIndex={0}
      aria-label="Resize Sidebar"
      aria-orientation="vertical"
      aria-valuemin={minWidth}
      aria-valuemax={maxWidth}
      aria-valuenow={width}
      title="Drag to resize, click to toggle the sidebar"
      className={cn(
        SIDEBAR_RAIL_CLASS_NAME,
        'focus-visible:after:bg-sidebar-ring touch-none outline-hidden',
        'group-data-[state=expanded]:cursor-ew-resize',
        className,
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => {
        onPointerUp?.(event);
        endDrag(event);
      }}
      onPointerCancel={(event) => {
        onPointerCancel?.(event);
        endDrag(event);
      }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      {...props}
    />
  );
}

function SidebarInset({className, ...props}: React.ComponentProps<'main'>) {
  return (
    <main
      data-slot="sidebar-inset"
      className={cn(
        'bg-background relative flex w-full flex-1 flex-col',
        'md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow-sm md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-2',
        className,
      )}
      {...props}
    />
  );
}

function SidebarInput({
  className,
  ...props
}: React.ComponentProps<typeof Input>) {
  return (
    <Input
      data-slot="sidebar-input"
      data-sidebar="input"
      className={cn('bg-background h-8 w-full shadow-none', className)}
      {...props}
    />
  );
}

function SidebarHeader({className, ...props}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-header"
      data-sidebar="header"
      className={cn('flex flex-col gap-2 p-2', className)}
      {...props}
    />
  );
}

function SidebarFooter({className, ...props}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-footer"
      data-sidebar="footer"
      className={cn('flex flex-col gap-2 p-2', className)}
      {...props}
    />
  );
}

function SidebarSeparator({
  className,
  ...props
}: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="sidebar-separator"
      data-sidebar="separator"
      className={cn('bg-sidebar-border mx-2 w-auto', className)}
      {...props}
    />
  );
}

function SidebarContent({className, ...props}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-content"
      data-sidebar="content"
      className={cn(
        'flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden',
        className,
      )}
      {...props}
    />
  );
}

function SidebarGroup({className, ...props}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-group"
      data-sidebar="group"
      className={cn('relative flex w-full min-w-0 flex-col p-2', className)}
      {...props}
    />
  );
}

function SidebarGroupLabel({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<'div'> & {asChild?: boolean}) {
  const Comp = asChild ? Slot : 'div';

  return (
    <Comp
      data-slot="sidebar-group-label"
      data-sidebar="group-label"
      className={cn(
        'text-sidebar-foreground/70 ring-sidebar-ring flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium outline-hidden transition-[margin,opacity] duration-200 ease-linear focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0',
        'group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0',
        className,
      )}
      {...props}
    />
  );
}

function SidebarGroupAction({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> & {asChild?: boolean}) {
  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      data-slot="sidebar-group-action"
      data-sidebar="group-action"
      className={cn(
        'text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground absolute top-3.5 right-3 flex aspect-square w-5 items-center justify-center rounded-md p-0 outline-hidden transition-transform focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0',
        'after:absolute after:-inset-2 md:after:hidden',
        'group-data-[collapsible=icon]:hidden',
        className,
      )}
      {...props}
    />
  );
}

function SidebarGroupContent({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-group-content"
      data-sidebar="group-content"
      className={cn('w-full text-sm', className)}
      {...props}
    />
  );
}

function SidebarMenu({className, ...props}: React.ComponentProps<'ul'>) {
  return (
    <ul
      data-slot="sidebar-menu"
      data-sidebar="menu"
      className={cn('flex w-full min-w-0 flex-col gap-1', className)}
      {...props}
    />
  );
}

function SidebarMenuItem({className, ...props}: React.ComponentProps<'li'>) {
  return (
    <li
      data-slot="sidebar-menu-item"
      data-sidebar="menu-item"
      className={cn('group/menu-item relative', className)}
      {...props}
    />
  );
}

const sidebarMenuButtonVariants = cva(
  'peer/menu-button ring-sidebar-ring flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-hidden transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-data-[sidebar=menu-action]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        outline:
          'bg-background shadow-[0_0_0_1px_hsl(var(--sidebar-border))] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-[0_0_0_1px_hsl(var(--sidebar-accent))]',
      },
      size: {
        default: 'h-8 text-sm',
        sm: 'h-7 text-xs',
        lg: 'h-12 text-sm group-data-[collapsible=icon]:p-0!',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

type SidebarMenuButtonProps = React.ComponentProps<'button'> & {
  asChild?: boolean;
  isActive?: boolean;
  tooltip?: string | React.ComponentProps<typeof TooltipContent>;
} & VariantProps<typeof sidebarMenuButtonVariants>;

const SidebarMenuButton = React.forwardRef<
  HTMLButtonElement,
  SidebarMenuButtonProps
>(
  (
    {
      asChild = false,
      isActive = false,
      variant = 'default',
      size = 'default',
      tooltip,
      className,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'button';
    const {isMobile, state} = useSidebar();

    const button = (
      <Comp
        {...props}
        ref={ref}
        data-slot="sidebar-menu-button"
        data-sidebar="menu-button"
        data-size={size}
        data-active={isActive}
        className={cn(sidebarMenuButtonVariants({variant, size}), className)}
      />
    );

    if (!tooltip) {
      return button;
    }

    if (typeof tooltip === 'string') {
      tooltip = {
        children: tooltip,
      };
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent
          side="right"
          align="center"
          hidden={state !== 'collapsed' || isMobile}
          {...tooltip}
        />
      </Tooltip>
    );
  },
);
SidebarMenuButton.displayName = 'SidebarMenuButton';

function SidebarMenuAction({
  className,
  asChild = false,
  showOnHover = false,
  ...props
}: React.ComponentProps<'button'> & {
  asChild?: boolean;
  showOnHover?: boolean;
}) {
  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      data-slot="sidebar-menu-action"
      data-sidebar="menu-action"
      className={cn(
        'text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground peer-hover/menu-button:text-sidebar-accent-foreground absolute top-1.5 right-1 flex aspect-square w-5 items-center justify-center rounded-md p-0 outline-hidden transition-transform focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0',
        'after:absolute after:-inset-2 md:after:hidden',
        'peer-data-[size=sm]/menu-button:top-1',
        'peer-data-[size=default]/menu-button:top-1.5',
        'peer-data-[size=lg]/menu-button:top-2.5',
        'group-data-[collapsible=icon]:hidden',
        showOnHover &&
          'peer-data-[active=true]/menu-button:text-sidebar-accent-foreground group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-[state=open]:opacity-100 md:opacity-0',
        className,
      )}
      {...props}
    />
  );
}

function SidebarMenuBadge({className, ...props}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-menu-badge"
      data-sidebar="menu-badge"
      className={cn(
        'text-sidebar-foreground pointer-events-none absolute right-1 flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-xs font-medium tabular-nums select-none',
        'peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[active=true]/menu-button:text-sidebar-accent-foreground',
        'peer-data-[size=sm]/menu-button:top-1',
        'peer-data-[size=default]/menu-button:top-1.5',
        'peer-data-[size=lg]/menu-button:top-2.5',
        'group-data-[collapsible=icon]:hidden',
        className,
      )}
      {...props}
    />
  );
}

function SidebarMenuSkeleton({
  className,
  showIcon = false,
  ...props
}: React.ComponentProps<'div'> & {
  showIcon?: boolean;
}) {
  const skeletonId = React.useId();
  const width = React.useMemo(() => {
    let hash = 0;
    for (let index = 0; index < skeletonId.length; index += 1) {
      hash = (hash << 5) - hash + skeletonId.charCodeAt(index);
      hash |= 0;
    }
    return `${50 + (Math.abs(hash) % 40)}%`;
  }, [skeletonId]);

  return (
    <div
      data-slot="sidebar-menu-skeleton"
      data-sidebar="menu-skeleton"
      className={cn('flex h-8 items-center gap-2 rounded-md px-2', className)}
      {...props}
    >
      {showIcon && (
        <Skeleton
          className="size-4 rounded-md"
          data-sidebar="menu-skeleton-icon"
        />
      )}
      <Skeleton
        className="h-4 max-w-(--skeleton-width) flex-1"
        data-sidebar="menu-skeleton-text"
        style={
          {
            '--skeleton-width': width,
          } as React.CSSProperties
        }
      />
    </div>
  );
}

function SidebarMenuSub({className, ...props}: React.ComponentProps<'ul'>) {
  return (
    <ul
      data-slot="sidebar-menu-sub"
      data-sidebar="menu-sub"
      className={cn(
        'border-sidebar-border mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l px-2.5 py-0.5',
        'group-data-[collapsible=icon]:hidden',
        className,
      )}
      {...props}
    />
  );
}

function SidebarMenuSubItem({className, ...props}: React.ComponentProps<'li'>) {
  return (
    <li
      data-slot="sidebar-menu-sub-item"
      data-sidebar="menu-sub-item"
      className={cn('group/menu-sub-item relative', className)}
      {...props}
    />
  );
}

function SidebarMenuSubButton({
  asChild = false,
  size = 'md',
  isActive = false,
  className,
  ...props
}: React.ComponentProps<'a'> & {
  asChild?: boolean;
  size?: 'sm' | 'md';
  isActive?: boolean;
}) {
  const Comp = asChild ? Slot : 'a';

  return (
    <Comp
      data-slot="sidebar-menu-sub-button"
      data-sidebar="menu-sub-button"
      data-size={size}
      data-active={isActive}
      className={cn(
        'text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent active:text-sidebar-accent-foreground [&>svg]:text-sidebar-accent-foreground flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 outline-hidden focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0',
        'data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground',
        size === 'sm' && 'text-xs',
        size === 'md' && 'text-sm',
        'group-data-[collapsible=icon]:hidden',
        className,
      )}
      {...props}
    />
  );
}

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  type SidebarProviderProps,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
};
