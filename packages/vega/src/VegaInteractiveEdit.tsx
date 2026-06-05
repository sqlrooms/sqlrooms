import {
  Button,
  cn,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@sqlrooms/ui';
import {GripVertical, Trash2, Type} from 'lucide-react';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {VisualizationSpec} from 'vega-embed';
import {useVegaChartContext} from './VegaChartContext';

type EditMode = 'title' | 'drag' | 'delete' | null;

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
        active={activeMode === 'title'}
        onToggle={() => toggleMode('title')}
      />
      <DragLabelsMode
        embed={embed}
        spec={spec}
        specRef={specRef}
        onSpecChange={onSpecChange}
        active={activeMode === 'drag'}
        onToggle={() => toggleMode('drag')}
      />
      <DeleteLabelsMode
        embed={embed}
        spec={spec}
        specRef={specRef}
        onSpecChange={onSpecChange}
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

/**
 * Find the nearest <text> element from a click target.
 * Vega often wraps text content in <tspan>, so clicking may target that.
 */
function getTextElement(el: Element | null): SVGTextElement | null {
  if (!el) return null;
  if (el.tagName === 'text') return el as SVGTextElement;
  if (el.tagName === 'tspan')
    return el.closest('text') as SVGTextElement | null;
  return null;
}

function isTitleText(el: Element | null): el is SVGTextElement {
  const textEl = getTextElement(el);
  if (!textEl) return false;
  const group = textEl.closest('[class*="role-title"]');
  return !!group;
}

type TitlePart = 'title' | 'subtitle';

function getTitlePart(textEl: SVGTextElement): TitlePart {
  // Vega renders the title group as:
  //   <g class="... role-title">
  //     <g class="... role-title-text">    <text>title</text> </g>
  //     <g class="... role-title-subtitle"><text>subtitle</text></g>
  //   </g>
  // The subtitle group's class contains "role-title" too, so we must
  // check for the subtitle-specific class first.
  if (textEl.closest('[class*="role-title-subtitle"]')) return 'subtitle';
  return 'title';
}

function isDataLabel(el: Element | null): el is SVGTextElement {
  const textEl = getTextElement(el);
  if (!textEl) return false;
  const group = textEl.closest('g[class*="mark-text"]');
  if (!group) return false;
  const cls = group.getAttribute('class') ?? '';
  if (
    cls.includes('role-title') ||
    cls.includes('role-axis') ||
    cls.includes('role-legend')
  ) {
    return false;
  }
  return true;
}

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
    const padding = 4;
    const contains =
      event.clientX >= rect.left - padding &&
      event.clientX <= rect.right + padding &&
      event.clientY >= rect.top - padding &&
      event.clientY <= rect.bottom + padding;

    if (!contains) continue;

    const area = Math.max(rect.width, 1) * Math.max(rect.height, 1);
    if (!best || area < best.area) {
      best = {el: candidate as SVGTextElement, area};
    }
  }

  return best?.el ?? null;
}

type EmbedRef = {view: any} | null;

// ─── Edit Title Mode ────────────────────────────────────────────────────────

interface ModeProps {
  embed: EmbedRef;
  spec: VisualizationSpec;
  specRef: React.RefObject<VisualizationSpec>;
  onSpecChange: (newSpec: VisualizationSpec) => void;
  active: boolean;
  onToggle: () => void;
}

const EditTitleMode: React.FC<ModeProps> = ({
  embed,
  specRef,
  onSpecChange,
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

    // Use cursor style on all title texts via CSS class
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
    if (!inputValue.trim()) {
      setEditing(false);
      return;
    }

    const currentSpec = specRef.current as Record<string, unknown>;
    let newSpec: VisualizationSpec;

    if (editingPart === 'subtitle') {
      // Editing the subtitle
      if (typeof currentSpec.title === 'object' && currentSpec.title !== null) {
        newSpec = {
          ...currentSpec,
          title: {
            ...(currentSpec.title as Record<string, unknown>),
            subtitle: inputValue,
          },
        } as VisualizationSpec;
      } else {
        // Title was a string; promote to object to add subtitle
        newSpec = {
          ...currentSpec,
          title: {
            text:
              typeof currentSpec.title === 'string' ? currentSpec.title : '',
            subtitle: inputValue,
          },
        } as VisualizationSpec;
      }
    } else {
      // Editing the title
      if (typeof currentSpec.title === 'string') {
        newSpec = {...currentSpec, title: inputValue} as VisualizationSpec;
      } else if (
        typeof currentSpec.title === 'object' &&
        currentSpec.title !== null
      ) {
        newSpec = {
          ...currentSpec,
          title: {
            ...(currentSpec.title as Record<string, unknown>),
            text: inputValue,
          },
        } as VisualizationSpec;
      } else {
        newSpec = {...currentSpec, title: inputValue} as VisualizationSpec;
      }
    }

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

      {/* Inject cursor style for title text when mode is active */}
      {active && (
        <style>{`
          .vega-edit-title-mode g[class*="role-title"] text {
            cursor: text !important;
          }
        `}</style>
      )}
    </>
  );
};

// ─── Drag Labels Mode ───────────────────────────────────────────────────────

type LabelOffset = {dx: number; dy: number};

const DragLabelsMode: React.FC<ModeProps> = ({
  embed,
  spec,
  specRef,
  onSpecChange,
  active,
  onToggle,
}) => {
  const draggingRef = useRef<{
    element: SVGTextElement;
    startX: number;
    startY: number;
    origTransformX: number;
    origTransformY: number;
    ariaKey: string;
    layerIndex: number | null;
  } | null>(null);

  // Per-label offset map keyed by aria-label (unique per datum).
  // Source of truth for SVG-level rendering; persisted to spec.usermeta on commit.
  const offsetsRef = useRef<Map<string, LabelOffset>>(new Map());

  // Sync offsetsRef from spec.usermeta whenever the spec changes,
  // so persisted offsets (across remounts/reloads) are applied.
  useEffect(() => {
    if (!spec) return;
    const fromSpec = extractOffsetsFromSpec(spec);
    for (const [k, v] of fromSpec) {
      offsetsRef.current.set(k, v);
    }
  }, [spec]);

  // Re-apply stored offsets after Vega re-renders the SVG.
  // Always active (regardless of mode) so offsets survive spec changes.
  // Vega may re-render the SVG asynchronously due to spec changes, dimension
  // changes, or signal updates. We use multiple strategies to ensure offsets
  // are re-applied reliably:
  //   1. MutationObserver (childList + subtree) catches SVG replacement.
  //   2. view.runAfter() hook re-applies after every Vega dataflow run.
  //   3. Synchronous re-apply on mount.
  useEffect(() => {
    if (!embed) return;
    const container = getChartContainer(embed);
    if (!container) return;

    let cancelled = false;

    const reapply = () => {
      if (cancelled) return;
      if (offsetsRef.current.size > 0) {
        applyStoredOffsets(container, offsetsRef.current);
      }
    };

    reapply();

    const observer = new MutationObserver(() => {
      reapply();
      requestAnimationFrame(reapply);
    });
    observer.observe(container, {childList: true, subtree: true});

    const view = embed.view as
      | {
          runAfter?: (
            cb: (view: unknown) => void,
            enqueue?: boolean,
            priority?: number,
          ) => void;
          addEventListener?: (
            type: string,
            handler: (...args: unknown[]) => void,
          ) => void;
          removeEventListener?: (
            type: string,
            handler: (...args: unknown[]) => void,
          ) => void;
        }
      | undefined;

    const afterRender = () => {
      reapply();
      requestAnimationFrame(reapply);
    };

    if (typeof view?.addEventListener === 'function') {
      view.addEventListener('resize', afterRender);
    }

    const queueRunAfter = () => {
      if (cancelled) return;
      if (typeof view?.runAfter === 'function') {
        // enqueue=true: defer to the next dataflow propagation, so we re-apply
        // offsets after Vega completes its next render cycle.
        view.runAfter(() => {
          afterRender();
          queueRunAfter();
        }, true);
      }
    };
    queueRunAfter();

    return () => {
      cancelled = true;
      observer.disconnect();
      if (typeof view?.removeEventListener === 'function') {
        view.removeEventListener('resize', afterRender);
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
        ariaKey,
        layerIndex: getLayerIndexForText(textEl),
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
        ariaKey,
        layerIndex,
      } = draggingRef.current;
      element.style.cursor = '';

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      if (Math.abs(deltaX) < 2 && Math.abs(deltaY) < 2) {
        const existing = offsetsRef.current.get(ariaKey);
        if (existing) {
          element.setAttribute(
            'transform',
            `translate(${existing.dx}, ${existing.dy})`,
          );
        } else {
          element.removeAttribute('transform');
        }
      } else {
        const finalDx = origTransformX + deltaX;
        const finalDy = origTransformY + deltaY;
        offsetsRef.current.set(ariaKey, {dx: finalDx, dy: finalDy});
        element.setAttribute('transform', `translate(${finalDx}, ${finalDy})`);

        if (ariaKey) {
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
        }

        // Persist the offset to the Vega-Lite spec via usermeta
        const datumFields = parseAriaLabelFields(ariaKey);
        const newSpec = applyLabelOffsetToSpec(
          specRef.current!,
          datumFields,
          {dx: finalDx, dy: finalDy},
          layerIndex,
          ariaKey,
        );
        onSpecChange(newSpec);

        // Vega will re-render the SVG asynchronously (after the spec change
        // propagates and the editor's debounced parse runs). Re-apply the
        // stored offsets across several animation frames to cover the window
        // during which the SVG is replaced. The MutationObserver and
        // view.runAfter hook also handle this, but this provides extra safety.
        const reapplyAfterRender = () => {
          if (offsetsRef.current.size > 0) {
            applyStoredOffsets(container, offsetsRef.current);
          }
        };
        for (const delay of [0, 50, 150, 350, 600]) {
          window.setTimeout(reapplyAfterRender, delay);
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
          .vega-drag-labels-mode g[class*="mark-text"]:not([class*="role-title"]):not([class*="role-axis"]):not([class*="role-legend"]) text {
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

      // Immediately hide for responsive UX
      textEl.style.display = 'none';

      // Update spec
      removeLabelFromSpec(
        specRef.current!,
        onSpecChange,
        labelText,
        datumFields,
        layerIndex,
      );
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
          .vega-delete-labels-mode g[class*="mark-text"]:not([class*="role-title"]):not([class*="role-axis"]):not([class*="role-legend"]) text {
            cursor: pointer !important;
          }
          .vega-delete-labels-mode g[class*="mark-text"]:not([class*="role-title"]):not([class*="role-axis"]):not([class*="role-legend"]) text:hover {
            opacity: 0.4;
            text-decoration: line-through;
          }
        `}</style>
      )}
    </>
  );
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function getTranslateValues(el: SVGElement): {tx: number; ty: number} {
  const transform = el.getAttribute('transform');
  if (!transform) return {tx: 0, ty: 0};
  const match = transform.match(/translate\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/);
  if (!match) return {tx: 0, ty: 0};
  return {tx: parseFloat(match[1]!), ty: parseFloat(match[2]!)};
}

function removeLabelFromSpec(
  spec: VisualizationSpec,
  onSpecChange: (newSpec: VisualizationSpec) => void,
  labelText: string,
  datumFields: AriaDatumField[],
  preferredLayerIndex: number | null,
) {
  const s = spec as Record<string, unknown>;

  if ('layer' in s && Array.isArray(s.layer)) {
    const textLayerIndices = findMatchingTextLayerIndices(
      s.layer,
      preferredLayerIndex,
    );
    if (textLayerIndices.length > 0) {
      const newLayers = [...s.layer];
      for (const textLayerIdx of textLayerIndices) {
        const textLayer = {
          ...(newLayers[textLayerIdx] as Record<string, unknown>),
        };
        const existingTransform = Array.isArray(textLayer.transform)
          ? [...textLayer.transform]
          : [];
        const textField = getTextEncodingField(textLayer);
        existingTransform.push({
          filter: buildDeleteFilter(datumFields, labelText, textField),
        });
        textLayer.transform = existingTransform;
        newLayers[textLayerIdx] = textLayer;
      }
      onSpecChange({...s, layer: newLayers} as VisualizationSpec);
      return;
    }
  }

  // Single-layer text mark chart
  if (
    s.mark === 'text' ||
    (typeof s.mark === 'object' &&
      (s.mark as Record<string, unknown>).type === 'text')
  ) {
    const encoding = s.encoding as Record<string, unknown> | undefined;
    const textField = (encoding?.text as Record<string, unknown>)?.field as
      | string
      | undefined;

    const existingTransform = Array.isArray(s.transform)
      ? [...(s.transform as unknown[])]
      : [];

    if (textField) {
      existingTransform.push({
        filter: buildDeleteFilter(datumFields, labelText, textField),
      });
    } else if (datumFields.length > 0) {
      existingTransform.push({
        filter: buildDeleteFilter(datumFields, labelText),
      });
    }
    onSpecChange({...s, transform: existingTransform} as VisualizationSpec);
  }
}

type AriaDatumField = {
  field: string;
  value: string;
};

function getLayerIndexForText(textEl: SVGTextElement): number | null {
  const layerGroup = textEl.closest('g[class*="layer_"]');
  const className = layerGroup?.getAttribute('class') ?? '';
  const match = className.match(/\blayer_(\d+)_marks\b/);
  return match ? Number(match[1]) : null;
}

function isTextLayer(layer: unknown): layer is Record<string, unknown> {
  if (typeof layer !== 'object' || layer === null) return false;
  const l = layer as Record<string, unknown>;
  return (
    l.mark === 'text' ||
    (typeof l.mark === 'object' &&
      l.mark !== null &&
      (l.mark as Record<string, unknown>).type === 'text')
  );
}

function findMatchingTextLayerIndices(
  layers: unknown[],
  preferredLayerIndex: number | null,
): number[] {
  if (
    preferredLayerIndex !== null &&
    preferredLayerIndex >= 0 &&
    preferredLayerIndex < layers.length &&
    isTextLayer(layers[preferredLayerIndex])
  ) {
    const signature = getTextLayerSignature(
      layers[preferredLayerIndex] as Record<string, unknown>,
    );
    return layers
      .map((layer, index) => ({layer, index}))
      .filter(
        ({layer}) =>
          isTextLayer(layer) &&
          getTextLayerSignature(layer as Record<string, unknown>) === signature,
      )
      .map(({index}) => index);
  }

  const firstTextLayerIndex = layers.findIndex(isTextLayer);
  return firstTextLayerIndex >= 0 ? [firstTextLayerIndex] : [];
}

function getTextLayerSignature(layer: Record<string, unknown>): string {
  return getTextEncodingField(layer) ?? '__static_text__';
}

function getTextEncodingField(layer: Record<string, unknown>): string | null {
  const textEncoding = (layer.encoding as Record<string, unknown> | undefined)
    ?.text as Record<string, unknown> | undefined;
  return typeof textEncoding?.field === 'string' ? textEncoding.field : null;
}

function applyStoredOffsets(
  container: HTMLElement,
  offsets: Map<string, LabelOffset>,
) {
  if (offsets.size === 0) return;
  const allText = container.querySelectorAll('svg text[aria-label]');
  for (const el of allText) {
    const key = el.getAttribute('aria-label') ?? '';
    const offset = offsets.get(key);
    if (offset) {
      (el as SVGTextElement).setAttribute(
        'transform',
        `translate(${offset.dx}, ${offset.dy})`,
      );
    }
  }
}

function parseAriaLabelFields(ariaLabel: string): AriaDatumField[] {
  const seen = new Set<string>();
  return ariaLabel
    .split(';')
    .map((part) => {
      const separatorIndex = part.indexOf(':');
      if (separatorIndex < 0) return null;
      const field = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();
      if (!field || !value) return null;
      const key = field.toLowerCase();
      if (seen.has(key)) return null;
      seen.add(key);
      return {field, value};
    })
    .filter((field): field is AriaDatumField => field !== null);
}

function buildDeleteFilter(
  datumFields: AriaDatumField[],
  labelText: string,
  textField?: string | null,
): string {
  if (datumFields.length > 0) {
    const comparisons = datumFields.map(({field, value}) =>
      buildFieldComparison(field, value),
    );
    return `!(${comparisons.join(' && ')})`;
  }

  if (textField) {
    return `!(${buildFieldComparison(textField, labelText)})`;
  }

  return 'true';
}

function buildFieldComparison(field: string, value: string): string {
  const normalizedValue = normalizeDatumValue(value);
  const escapedField = escapeExpr(field);
  const stringComparison = `toString(datum['${escapedField}']) == '${escapeExpr(
    normalizedValue,
  )}'`;

  if (/^-?\d+(\.\d+)?$/.test(normalizedValue)) {
    return `(datum['${escapedField}'] == ${normalizedValue} || ${stringComparison})`;
  }

  return stringComparison;
}

function normalizeDatumValue(value: string): string {
  return value.replace(/\u2212/g, '-');
}

function escapeExpr(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// ─── Label Offset Persistence Helpers ────────────────────────────────────────

const LABEL_OFFSETS_KEY = '__labelOffsets';

type LabelOffsetEntry = {
  ariaKey: string;
  dx: number;
  dy: number;
};

/**
 * Persist a per-label offset into the spec's top-level `usermeta` field.
 * `usermeta` is free-form metadata that Vega-Lite preserves verbatim. We use
 * SVG-level transforms (re-applied via MutationObserver) to actually render
 * the offsets, since Vega-Lite has no native per-datum pixel offset channel.
 */
function applyLabelOffsetToSpec(
  spec: VisualizationSpec,
  _datumFields: AriaDatumField[],
  offset: LabelOffset,
  _preferredLayerIndex: number | null,
  ariaKey: string,
): VisualizationSpec {
  const s = spec as Record<string, unknown>;
  const usermeta = {
    ...((s.usermeta as Record<string, unknown> | undefined) ?? {}),
  };
  const existing: LabelOffsetEntry[] = Array.isArray(
    usermeta[LABEL_OFFSETS_KEY],
  )
    ? [...(usermeta[LABEL_OFFSETS_KEY] as LabelOffsetEntry[])]
    : [];

  const idx = existing.findIndex((e) => e.ariaKey === ariaKey);
  const entry: LabelOffsetEntry = {ariaKey, dx: offset.dx, dy: offset.dy};
  if (idx >= 0) {
    existing[idx] = entry;
  } else {
    existing.push(entry);
  }

  usermeta[LABEL_OFFSETS_KEY] = existing;
  return {...s, usermeta} as VisualizationSpec;
}

/**
 * Extract persisted label offsets from the spec's `usermeta`.
 */
function extractOffsetsFromSpec(
  spec: VisualizationSpec,
): Map<string, LabelOffset> {
  const result = new Map<string, LabelOffset>();
  const s = spec as Record<string, unknown>;
  const usermeta = s.usermeta as Record<string, unknown> | undefined;
  if (!usermeta) return result;

  const entries = usermeta[LABEL_OFFSETS_KEY] as LabelOffsetEntry[] | undefined;
  if (!Array.isArray(entries)) return result;

  for (const entry of entries) {
    result.set(entry.ariaKey, {dx: entry.dx, dy: entry.dy});
  }
  return result;
}
