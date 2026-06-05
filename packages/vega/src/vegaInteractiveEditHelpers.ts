import {VisualizationSpec} from 'vega-embed';

// ─── Shared selectors / constants ────────────────────────────────────────────

/**
 * Roles whose `<text>` elements are chrome (titles, axes, legends), not
 * data labels. Used both for DOM hit-testing and for the injected CSS.
 */
export const NON_DATA_LABEL_ROLES = [
  'role-title',
  'role-axis',
  'role-legend',
] as const;

/**
 * CSS selector matching data-label text marks (text marks that are not part
 * of chart chrome). Kept in one place so the hit-test predicate and the
 * injected cursor styles can never drift apart.
 */
export const DATA_LABEL_TEXT_SELECTOR = `g[class*="mark-text"]${NON_DATA_LABEL_ROLES.map(
  (role) => `:not([class*="${role}"])`,
).join('')} text`;

// ─── DOM helpers (pure given a DOM node) ──────────────────────────────────────

/**
 * Find the nearest `<text>` element from a click target.
 * Vega often wraps text content in `<tspan>`, so clicking may target that.
 */
export function getTextElement(el: Element | null): SVGTextElement | null {
  if (!el) return null;
  if (el.tagName === 'text') return el as SVGTextElement;
  if (el.tagName === 'tspan')
    return el.closest('text') as SVGTextElement | null;
  return null;
}

export function isTitleText(el: Element | null): el is SVGTextElement {
  const textEl = getTextElement(el);
  if (!textEl) return false;
  return !!textEl.closest('[class*="role-title"]');
}

export type TitlePart = 'title' | 'subtitle';

export function getTitlePart(textEl: SVGTextElement): TitlePart {
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

export function isDataLabel(el: Element | null): el is SVGTextElement {
  const textEl = getTextElement(el);
  if (!textEl) return false;
  const group = textEl.closest('g[class*="mark-text"]');
  if (!group) return false;
  const cls = group.getAttribute('class') ?? '';
  return !NON_DATA_LABEL_ROLES.some((role) => cls.includes(role));
}

export function getTranslateValues(el: SVGElement): {tx: number; ty: number} {
  const transform = el.getAttribute('transform');
  if (!transform) return {tx: 0, ty: 0};
  const match = transform.match(/translate\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/);
  if (!match) return {tx: 0, ty: 0};
  return {tx: parseFloat(match[1]!), ty: parseFloat(match[2]!)};
}

export function getLayerIndexForText(textEl: SVGTextElement): number | null {
  const layerGroup = textEl.closest('g[class*="layer_"]');
  const className = layerGroup?.getAttribute('class') ?? '';
  const match = className.match(/\blayer_(\d+)_marks\b/);
  return match ? Number(match[1]) : null;
}

// ─── Aria-label parsing ───────────────────────────────────────────────────────

export type AriaDatumField = {
  field: string;
  value: string;
};

/**
 * Parse Vega's `aria-label` (e.g. `"category: A; value: 12"`) into structured
 * field/value pairs. Note that aria labels are display strings: values are
 * already locale/number formatted, so downstream comparisons must be tolerant.
 */
export function parseAriaLabelFields(ariaLabel: string): AriaDatumField[] {
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

// ─── Delete-filter expression builders ────────────────────────────────────────

export function normalizeDatumValue(value: string): string {
  // Vega renders negative numbers with the Unicode minus sign (U+2212);
  // normalize to ASCII so numeric comparisons line up with the raw datum.
  return value.replace(/\u2212/g, '-');
}

export function escapeExpr(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export function buildFieldComparison(field: string, value: string): string {
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

/**
 * Build a Vega-Lite `filter` expression that excludes the datum represented by
 * the clicked label. Prefers structured aria fields; falls back to matching the
 * visible text against the text-encoding field.
 *
 * Returns `null` when there is nothing reliable to match on, so callers can
 * avoid pushing a no-op (or worse, an everything-matching) filter.
 */
export function buildDeleteFilter(
  datumFields: AriaDatumField[],
  labelText: string,
  textField?: string | null,
): string | null {
  if (datumFields.length > 0) {
    const comparisons = datumFields.map(({field, value}) =>
      buildFieldComparison(field, value),
    );
    return `!(${comparisons.join(' && ')})`;
  }

  if (textField && labelText) {
    return `!(${buildFieldComparison(textField, labelText)})`;
  }

  return null;
}

// ─── Spec inspection helpers ──────────────────────────────────────────────────

export function isTextLayer(layer: unknown): layer is Record<string, unknown> {
  if (typeof layer !== 'object' || layer === null) return false;
  const l = layer as Record<string, unknown>;
  return (
    l.mark === 'text' ||
    (typeof l.mark === 'object' &&
      l.mark !== null &&
      (l.mark as Record<string, unknown>).type === 'text')
  );
}

export function getTextEncodingField(
  layer: Record<string, unknown>,
): string | null {
  const textEncoding = (layer.encoding as Record<string, unknown> | undefined)
    ?.text as Record<string, unknown> | undefined;
  return typeof textEncoding?.field === 'string' ? textEncoding.field : null;
}

export function getTextLayerSignature(layer: Record<string, unknown>): string {
  return getTextEncodingField(layer) ?? '__static_text__';
}

/**
 * Resolve which text-layer indices a delete should target. When a preferred
 * layer (derived from the clicked element) is a text layer, all sibling text
 * layers sharing the same text-encoding signature are returned so faceted /
 * repeated layers stay consistent. Otherwise falls back to the first text
 * layer.
 */
export function findMatchingTextLayerIndices(
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

// ─── Title spec mutation ──────────────────────────────────────────────────────

/**
 * Return a new spec with the title (or subtitle) text updated. Passing an
 * empty string clears that part. Promotes a string title to an object form
 * when a subtitle needs to be added.
 */
export function applyTitleToSpec(
  spec: VisualizationSpec,
  part: TitlePart,
  value: string,
): VisualizationSpec {
  const currentSpec = spec as Record<string, unknown>;
  const title = currentSpec.title;
  const titleIsObject = typeof title === 'object' && title !== null;

  if (part === 'subtitle') {
    if (titleIsObject) {
      return {
        ...currentSpec,
        title: {
          ...(title as Record<string, unknown>),
          subtitle: value,
        },
      } as VisualizationSpec;
    }
    return {
      ...currentSpec,
      title: {
        text: typeof title === 'string' ? title : '',
        subtitle: value,
      },
    } as VisualizationSpec;
  }

  if (titleIsObject) {
    return {
      ...currentSpec,
      title: {
        ...(title as Record<string, unknown>),
        text: value,
      },
    } as VisualizationSpec;
  }
  return {...currentSpec, title: value} as VisualizationSpec;
}

// ─── Delete spec mutation ─────────────────────────────────────────────────────

/**
 * Return a new spec with a filter transform appended that removes the datum
 * represented by the clicked label. Returns the original spec unchanged when
 * no reliable filter can be constructed.
 */
export function removeLabelFromSpec(
  spec: VisualizationSpec,
  labelText: string,
  datumFields: AriaDatumField[],
  preferredLayerIndex: number | null,
): VisualizationSpec {
  const s = spec as Record<string, unknown>;

  if (Array.isArray(s.layer)) {
    const textLayerIndices = findMatchingTextLayerIndices(
      s.layer,
      preferredLayerIndex,
    );
    if (textLayerIndices.length === 0) return spec;

    const newLayers = [...s.layer];
    let changed = false;
    for (const textLayerIdx of textLayerIndices) {
      const textLayer = {
        ...(newLayers[textLayerIdx] as Record<string, unknown>),
      };
      const textField = getTextEncodingField(textLayer);
      const filter = buildDeleteFilter(datumFields, labelText, textField);
      if (!filter) continue;
      const existingTransform = Array.isArray(textLayer.transform)
        ? [...textLayer.transform]
        : [];
      existingTransform.push({filter});
      textLayer.transform = existingTransform;
      newLayers[textLayerIdx] = textLayer;
      changed = true;
    }
    return changed ? ({...s, layer: newLayers} as VisualizationSpec) : spec;
  }

  // Single-layer text mark chart
  if (isTextLayer(s)) {
    const textField = getTextEncodingField(s);
    const filter = buildDeleteFilter(datumFields, labelText, textField);
    if (!filter) return spec;
    const existingTransform = Array.isArray(s.transform)
      ? [...(s.transform as unknown[])]
      : [];
    existingTransform.push({filter});
    return {...s, transform: existingTransform} as VisualizationSpec;
  }

  return spec;
}

// ─── Label offset persistence ─────────────────────────────────────────────────

export type LabelOffset = {dx: number; dy: number};

export const LABEL_OFFSETS_KEY = '__labelOffsets';

export type LabelOffsetEntry = {
  ariaKey: string;
  dx: number;
  dy: number;
};

/**
 * Persist a per-label offset into the spec's top-level `usermeta` field.
 *
 * IMPORTANT: `usermeta` is free-form metadata that Vega-Lite preserves
 * verbatim but does not use for rendering. The offsets are rendered by
 * re-applying SVG-level `transform`s (see `applyStoredOffsets`), because
 * Vega-Lite has no native per-datum pixel-offset channel. This means the
 * stored offsets are only honored when {@link VegaInteractiveEdit} (or
 * equivalent re-apply logic) is mounted; exporting the *view* captures the
 * live transforms, but rendering the raw spec elsewhere will NOT show them.
 */
export function applyLabelOffsetToSpec(
  spec: VisualizationSpec,
  offset: LabelOffset,
  ariaKey: string,
): VisualizationSpec {
  if (!ariaKey) return spec;
  const s = spec as Record<string, unknown>;
  const usermeta = {
    ...((s.usermeta as Record<string, unknown> | undefined) ?? {}),
  };
  const existing: LabelOffsetEntry[] = Array.isArray(usermeta[LABEL_OFFSETS_KEY])
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
export function extractOffsetsFromSpec(
  spec: VisualizationSpec,
): Map<string, LabelOffset> {
  const result = new Map<string, LabelOffset>();
  const s = spec as Record<string, unknown>;
  const usermeta = s.usermeta as Record<string, unknown> | undefined;
  if (!usermeta) return result;

  const entries = usermeta[LABEL_OFFSETS_KEY] as LabelOffsetEntry[] | undefined;
  if (!Array.isArray(entries)) return result;

  for (const entry of entries) {
    if (entry && typeof entry.ariaKey === 'string') {
      result.set(entry.ariaKey, {dx: entry.dx, dy: entry.dy});
    }
  }
  return result;
}
