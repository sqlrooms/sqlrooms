import {
  Button,
  cn,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@sqlrooms/ui';
import {GripVertical, Trash2, Type} from 'lucide-react';
import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import {createPortal} from 'react-dom';
import type {Result} from 'vega-embed';
import {VisualizationSpec} from 'vega-embed';
import {useVegaChartContext} from './VegaChartContext';
import {
  applyLabelOffsetToSpec,
  applyTitleToSpec,
  DATA_LABEL_TEXT_SELECTOR,
  extractOffsetsFromSpec,
  getLayerIndexForText,
  getTitlePart,
  getTranslateValues,
  isDataLabel,
  isTitleText,
  type LabelOffset,
  parseAriaLabelFields,
  removeLabelFromSpec,
  type TitlePart,
} from './vegaInteractiveEditHelpers';

type EditMode = 'title' | 'drag' | 'delete' | null;

/** The Vega `View` exposed by vega-embed's `Result`. */
type VegaView = Result['view'];

/**
 * Minimal structural view of the embed object we rely on. We narrow the
 * optional `addEventListener`/`removeEventListener` hooks because they are not
 * part of every Vega build's published typings.
 */
type EmbedRef = {
  view: VegaView & {
    addEventListener?: (
      type: string,
      handler: (...args: unknown[]) => void,
    ) => void;
    removeEventListener?: (
      type: string,
      handler: (...args: unknown[]) => void,
    ) => void;
  };
} | null;

export interface VegaInteractiveEditProps {
  /**
   * The current Vega-Lite spec. Required to read/modify the chart structure.
   */
  spec: VisualizationSpec;
  /**
   * Callback when the spec is modified by user interaction.
   */
  onSpecChange: (newSpec: VisualizationSpec) => void;
  /**
   * Additional CSS classes for the toolbar container
   */
  className?: string;
}

/**
 * Toolbar component that enables WYSIWYG editing of Vega-Lite charts.
 *
 * Provides three editing modes:
 * - **Edit Title**: Double-click the chart title to edit it inline
 * - **Drag Labels**: Drag data labels (text marks) to reposition them
 * - **Delete Labels**: Click individual data labels to remove them
 *
 * Must be used within a VegaLiteArrowChart (needs VegaChartContext).
 *
 * Note on label drags: Vega-Lite has no per-datum pixel-offset channel, so drag
 * offsets are stored in `spec.usermeta.__labelOffsets` and rendered by
 * re-applying SVG `transform`s while this component is mounted. They are NOT
 * portable: rendering the raw spec without this component (or equivalent
 * re-apply logic) will not show the offsets. Exporting the live view does
 * capture them, since it serializes the current SVG.
 *
 * @example
 * ```tsx
 * <VegaLiteArrowChart spec={spec} arrowTable={data}>
 *   <VegaLiteArrowChart.Actions>
 *     <VegaInteractiveEdit
 *       spec={spec}
 *       onSpecChange={(newSpec) => setSpec(newSpec)}
 *     />
 *   </VegaLiteArrowChart.Actions>
 * </VegaLiteArrowChart>
 * ```
 */
export const VegaInteractiveEdit: React.FC<VegaInteractiveEditProps> = ({
  spec,
  onSpecChange,
  className,
}) => {
  const {embed} = useVegaChartContext();
  const [activeMode, setActiveMode] = useState<EditMode>(null);
  const specRef = useRef(spec);
  useEffect(() => {
    specRef.current = spec;
  }, [spec]);

  // Per-instance scope so injected styles and mode classes never bleed across
  // multiple charts mounted on the same page.
  const reactId = useId();
  const scopeClass = useMemo(
    () => `vega-edit-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`,
    [reactId],
  );

  // Apply the scope class to this chart's container so the injected,
  // scope-prefixed CSS can target only this chart.
  useEffect(() => {
    const container = getChartContainer(embed);
    if (!container) return;
    container.classList.add(scopeClass);
    return () => {
      container.classList.remove(scopeClass);
    };
  }, [embed, scopeClass]);

  const toggleMode = useCallback((mode: EditMode) => {
    setActiveMode((prev) => (prev === mode ? null : mode));
  }, []);

  return (
    <div className={cn('flex items-center gap-0.5', className)}>
      <EditTitleMode
        embed={embed}
        spec={spec}
        specRef={specRef}
        onSpecChange={onSpecChange}
        scopeClass={scopeClass}
        active={activeMode === 'title'}
        onToggle={() => toggleMode('title')}
      />
      <DragLabelsMode
        embed={embed}
        spec={spec}
        specRef={specRef}
        onSpecChange={onSpecChange}
        scopeClass={scopeClass}
        active={activeMode === 'drag'}
        onToggle={() => toggleMode('drag')}
      />
      <DeleteLabelsMode
        embed={embed}
        spec={spec}
        specRef={specRef}
        onSpecChange={onSpecChange}
        scopeClass={scopeClass}
        active={activeMode === 'delete'}
        onToggle={() => toggleMode('delete')}
      />
    </div>
  );
};

// ─── Shared Utilities ───────────────────────────────────────────────────────

function getChartContainer(embed: EmbedRef): HTMLElement | null {
  return embed?.view?.container() ?? null;
}

const HIT_TEST_PADDING_PX = 4;

function getTextAtPoint(
  container: HTMLElement,
  event: MouseEvent,
  predicate: (el: Element | null) => el is SVGTextElement,
): SVGTextElement | null {
  const candidates = Array.from(container.querySelectorAll('svg text'));
  let best: {el: SVGTextElement; area: number} | null = null;

  for (const candidate of candidates) {
    if (!predicate(candidate)) continue;
    const style = window.getComputedStyle(candidate);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    if (
      candidate.getAttribute('fill-opacity') === '0' ||
      style.fillOpacity === '0'
    ) {
      continue;
    }

    const rect = candidate.getBoundingClientRect();
    const contains =
      event.clientX >= rect.left - HIT_TEST_PADDING_PX &&
      event.clientX <= rect.right + HIT_TEST_PADDING_PX &&
      event.clientY >= rect.top - HIT_TEST_PADDING_PX &&
      event.clientY <= rect.bottom + HIT_TEST_PADDING_PX;

    if (!contains) continue;

    const area = Math.max(rect.width, 1) * Math.max(rect.height, 1);
    if (!best || area < best.area) {
      best = {el: candidate as SVGTextElement, area};
    }
  }

  return best?.el ?? null;
}

// ─── Edit Title Mode ────────────────────────────────────────────────────────

interface ModeProps {
  embed: EmbedRef;
  spec: VisualizationSpec;
  specRef: React.RefObject<VisualizationSpec>;
  onSpecChange: (newSpec: VisualizationSpec) => void;
  /** Per-instance class applied to this chart's container for style scoping. */
  scopeClass: string;
  active: boolean;
  onToggle: () => void;
}

const EditTitleMode: React.FC<ModeProps> = ({
  embed,
  specRef,
  onSpecChange,
  scopeClass,
  active,
  onToggle,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [editingPart, setEditingPart] = useState<TitlePart>('title');
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
    null,
  );
  const [inputPosition, setInputPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  useEffect(() => {
    if (!active || !embed) return;

    const container = getChartContainer(embed);
    if (!container) return;

    // Find the nearest positioned ancestor for proper absolute positioning
    const positionedParent = container.closest(
      '.relative',
    ) as HTMLElement | null;

    const handleDblClick = (e: MouseEvent) => {
      const target = e.target as Element;
      const textEl = isTitleText(target)
        ? target
        : getTextAtPoint(container, e, isTitleText);
      if (!textEl) return;

      e.preventDefault();
      e.stopPropagation();

      const rect = textEl.getBoundingClientRect();
      const parentEl = positionedParent ?? container;
      const parentRect = parentEl.getBoundingClientRect();

      setPortalContainer(parentEl);
      setInputValue(textEl.textContent ?? '');
      setEditingPart(getTitlePart(textEl));
      setInputPosition({
        top: rect.top - parentRect.top,
        left: rect.left - parentRect.left,
        width: Math.max(rect.width + 40, 200),
      });
      setEditing(true);
    };

    // Use cursor style on all title texts via CSS class (scoped per instance)
    container.classList.add('vega-edit-title-mode');
    container.addEventListener('dblclick', handleDblClick);

    return () => {
      container.classList.remove('vega-edit-title-mode');
      container.removeEventListener('dblclick', handleDblClick);
      setPortalContainer(null);
    };
  }, [active, embed]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commitTitle = useCallback(() => {
    // Commit the trimmed value. An empty value clears the title/subtitle,
    // which is a valid edit (the user explicitly emptied the field).
    const value = inputValue.trim();
    const newSpec = applyTitleToSpec(specRef.current!, editingPart, value);
    onSpecChange(newSpec);
    setEditing(false);
  }, [inputValue, editingPart, specRef, onSpecChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        commitTitle();
      } else if (e.key === 'Escape') {
        setEditing(false);
      }
    },
    [commitTitle],
  );

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={active ? 'secondary' : 'ghost'}
            size="xs"
            onClick={onToggle}
            aria-label="Edit title"
          >
            <Type className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">Double-click title to edit</p>
        </TooltipContent>
      </Tooltip>

      {editing &&
        inputPosition &&
        portalContainer &&
        createPortal(
          <div
            className="absolute z-50"
            style={{
              top: inputPosition.top - 2,
              left: inputPosition.left - 4,
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={commitTitle}
              className="border-primary bg-background text-foreground rounded border px-1 py-0.5 text-sm font-bold shadow-md outline-none"
              style={{width: inputPosition.width}}
            />
          </div>,
          portalContainer,
        )}

      {/* Inject cursor style for title text when mode is active (scoped) */}
      {active && (
        <style>{`
          .${scopeClass}.vega-edit-title-mode g[class*="role-title"] text {
            cursor: text !important;
          }
        `}</style>
      )}
    </>
  );
};

// ─── Drag Labels Mode ───────────────────────────────────────────────────────

const DRAG_THRESHOLD_PX = 2;

const DragLabelsMode: React.FC<ModeProps> = ({
  embed,
  spec,
  specRef,
  onSpecChange,
  scopeClass,
  active,
  onToggle,
}) => {
  const draggingRef = useRef<{
    element: SVGTextElement;
    startX: number;
    startY: number;
    origTransformX: number;
    origTransformY: number;
    /**
     * The element's original `transform` attribute at mousedown (or `null` if
     * it had none). Used to restore Vega's own placement transform when a drag
     * turns out to be a click and there is no persisted offset to fall back to.
     */
    origTransformAttr: string | null;
    ariaKey: string;
  } | null>(null);

  // Per-label offset map keyed by aria-label (unique per datum).
  // Source of truth for SVG-level rendering; persisted to spec.usermeta on commit.
  const offsetsRef = useRef<Map<string, LabelOffset>>(new Map());

  // Sync offsetsRef from spec.usermeta whenever the spec changes,
  // so persisted offsets (across remounts/reloads) are applied. The spec is the
  // source of truth, so rebuild the map rather than merging: this drops offsets
  // for labels that were removed from spec.usermeta, otherwise stale transforms
  // would keep getting re-applied to future matching labels.
  useEffect(() => {
    if (!spec) return;
    offsetsRef.current = extractOffsetsFromSpec(spec);
  }, [spec]);

  // Re-apply stored offsets after Vega re-renders the SVG.
  //
  // Offsets are rendered as SVG `transform`s (Vega-Lite has no per-datum pixel
  // offset channel), so they must be re-applied whenever Vega touches the
  // text marks. Vega's SVG renderer diffs in place: on a re-render it usually
  // *reuses* the existing `<text>` nodes and overwrites their `transform`
  // attribute with its own computed value — which silently wipes our offset.
  // A `childList`-only observer never sees that (no node is added/removed), so
  // it must also watch `attributes` (the `transform` we care about lives there).
  //
  // Re-entrancy: our own `applyStoredOffsets` sets `transform`, which would
  // re-trigger the attribute observer. The `applying` guard suppresses that.
  // A trailing `requestAnimationFrame` covers Vega renders that settle after
  // the synchronous mutation batch (async dataflow / dimension changes).
  useEffect(() => {
    if (!embed) return;
    const container = getChartContainer(embed);
    if (!container) return;

    let cancelled = false;
    let applying = false;
    let rafId = 0;

    const reapply = () => {
      if (cancelled || applying) return;
      // Don't fight an in-progress drag: handleMouseMove owns the transform
      // until mouseup commits it.
      if (draggingRef.current) return;
      if (offsetsRef.current.size === 0) return;
      applying = true;
      try {
        applyStoredOffsets(container, offsetsRef.current);
      } finally {
        applying = false;
      }
    };

    const scheduleReapply = () => {
      reapply();
      // Vega may finish (re)rendering after the current mutation batch; re-run
      // on the next frame so late attribute writes don't leave us reset.
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        reapply();
      });
    };

    scheduleReapply();

    const observer = new MutationObserver(() => {
      // Ignore mutations caused by our own transform writes.
      if (applying) return;
      scheduleReapply();
    });
    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['transform'],
    });

    const view = embed.view;
    const onResize = () => scheduleReapply();
    if (typeof view?.addEventListener === 'function') {
      view.addEventListener('resize', onResize);
    }

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      observer.disconnect();
      if (typeof view?.removeEventListener === 'function') {
        view.removeEventListener('resize', onResize);
      }
    };
  }, [embed]);

  useEffect(() => {
    if (!active || !embed) return;

    const container = getChartContainer(embed);
    if (!container) return;

    container.classList.add('vega-drag-labels-mode');

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Element;
      const textEl = isDataLabel(target)
        ? target
        : getTextAtPoint(container, e, isDataLabel);
      if (!textEl) return;

      e.preventDefault();
      e.stopPropagation();

      const ariaKey = textEl.getAttribute('aria-label') ?? '';
      const existing = offsetsRef.current.get(ariaKey);
      const {tx, ty} = getTranslateValues(textEl);

      draggingRef.current = {
        element: textEl,
        startX: e.clientX,
        startY: e.clientY,
        origTransformX: existing?.dx ?? tx,
        origTransformY: existing?.dy ?? ty,
        origTransformAttr: textEl.getAttribute('transform'),
        ariaKey,
      };

      textEl.style.cursor = 'grabbing';
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      e.preventDefault();

      const {element, startX, startY, origTransformX, origTransformY} =
        draggingRef.current;
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      const newX = origTransformX + deltaX;
      const newY = origTransformY + deltaY;
      element.setAttribute('transform', `translate(${newX}, ${newY})`);
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!draggingRef.current) return;

      const {
        element,
        startX,
        startY,
        origTransformX,
        origTransformY,
        origTransformAttr,
        ariaKey,
      } = draggingRef.current;
      element.style.cursor = '';

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      if (
        Math.abs(deltaX) < DRAG_THRESHOLD_PX &&
        Math.abs(deltaY) < DRAG_THRESHOLD_PX
      ) {
        // Treated as a click, not a drag: restore the prior transform.
        const existing = offsetsRef.current.get(ariaKey);
        if (existing) {
          element.setAttribute(
            'transform',
            `translate(${existing.dx}, ${existing.dy})`,
          );
        } else if (origTransformAttr !== null) {
          // Restore Vega's original placement transform; don't strip it, or the
          // label can visibly jump.
          element.setAttribute('transform', origTransformAttr);
        } else {
          element.removeAttribute('transform');
        }
      } else {
        const finalDx = origTransformX + deltaX;
        const finalDy = origTransformY + deltaY;
        element.setAttribute('transform', `translate(${finalDx}, ${finalDy})`);

        // aria-label is our datum key. Without it we cannot persist or
        // re-apply reliably, so we leave the move as a transient visual change.
        if (ariaKey) {
          offsetsRef.current.set(ariaKey, {dx: finalDx, dy: finalDy});

          const siblings = container.querySelectorAll(
            `text[aria-label="${CSS.escape(ariaKey)}"]`,
          );
          for (const sibling of siblings) {
            if (sibling !== element) {
              (sibling as SVGTextElement).setAttribute(
                'transform',
                `translate(${finalDx}, ${finalDy})`,
              );
            }
          }

          // Persist the offset to the Vega-Lite spec via usermeta. The
          // MutationObserver re-applies the SVG transform after Vega
          // re-renders from the new spec.
          const newSpec = applyLabelOffsetToSpec(
            specRef.current!,
            {dx: finalDx, dy: finalDy},
            ariaKey,
          );
          onSpecChange(newSpec);
        }
      }

      draggingRef.current = null;
    };

    container.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      container.classList.remove('vega-drag-labels-mode');
      container.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      draggingRef.current = null;
    };
  }, [active, embed, specRef, onSpecChange]);

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={active ? 'secondary' : 'ghost'}
            size="xs"
            onClick={onToggle}
            aria-label="Drag labels"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">Drag labels to reposition</p>
        </TooltipContent>
      </Tooltip>

      {active && (
        <style>{`
          .${scopeClass}.vega-drag-labels-mode ${DATA_LABEL_TEXT_SELECTOR} {
            cursor: grab !important;
          }
        `}</style>
      )}
    </>
  );
};

// ─── Delete Labels Mode ─────────────────────────────────────────────────────

const DeleteLabelsMode: React.FC<ModeProps> = ({
  embed,
  specRef,
  onSpecChange,
  scopeClass,
  active,
  onToggle,
}) => {
  useEffect(() => {
    if (!active || !embed) return;

    const container = getChartContainer(embed);
    if (!container) return;

    container.classList.add('vega-delete-labels-mode');

    const handleClick = (e: MouseEvent) => {
      const target = e.target as Element;
      const textEl = isDataLabel(target)
        ? target
        : getTextAtPoint(container, e, isDataLabel);
      if (!textEl) return;

      e.preventDefault();
      e.stopPropagation();

      const labelText = textEl.textContent ?? '';
      const datumFields = parseAriaLabelFields(
        textEl.getAttribute('aria-label') ?? '',
      );
      const layerIndex = getLayerIndexForText(textEl);

      const newSpec = removeLabelFromSpec(
        specRef.current!,
        labelText,
        datumFields,
        layerIndex,
      );

      // Only hide and propagate when we produced a spec that actually filters
      // the datum; otherwise leave the label visible to avoid a silent no-op.
      if (newSpec !== specRef.current) {
        textEl.style.display = 'none';
        onSpecChange(newSpec);
      }
    };

    container.addEventListener('click', handleClick);

    return () => {
      container.classList.remove('vega-delete-labels-mode');
      container.removeEventListener('click', handleClick);
    };
  }, [active, embed, specRef, onSpecChange]);

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={active ? 'destructive' : 'ghost'}
            size="xs"
            onClick={onToggle}
            aria-label="Delete labels"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">Click labels to delete</p>
        </TooltipContent>
      </Tooltip>

      {active && (
        <style>{`
          .${scopeClass}.vega-delete-labels-mode ${DATA_LABEL_TEXT_SELECTOR} {
            cursor: pointer !important;
          }
          .${scopeClass}.vega-delete-labels-mode ${DATA_LABEL_TEXT_SELECTOR}:hover {
            opacity: 0.4;
            text-decoration: line-through;
          }
        `}</style>
      )}
    </>
  );
};

// ─── DOM helpers local to this component ──────────────────────────────────────

/**
 * Re-apply persisted offsets to the currently-rendered SVG text marks. Keyed by
 * `aria-label`; idempotent. Lives here (not in the pure helpers module) because
 * it reads and mutates the live DOM.
 *
 * Returns `true` if it actually changed any attribute. Callers rely on this to
 * avoid a feedback loop: an attribute MutationObserver re-fires on our own
 * writes, so we must be a no-op once the transforms already match.
 */
function applyStoredOffsets(
  container: HTMLElement,
  offsets: Map<string, LabelOffset>,
): boolean {
  if (offsets.size === 0) return false;
  let changed = false;
  const allText = container.querySelectorAll('svg text[aria-label]');
  for (const el of allText) {
    const key = el.getAttribute('aria-label') ?? '';
    if (!key) continue;
    const offset = offsets.get(key);
    if (!offset) continue;
    const desired = `translate(${offset.dx}, ${offset.dy})`;
    if (el.getAttribute('transform') !== desired) {
      el.setAttribute('transform', desired);
      changed = true;
    }
  }
  return changed;
}
