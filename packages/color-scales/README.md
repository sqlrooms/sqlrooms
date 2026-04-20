Shared color-scale config, validation, legend models, and React legend
components for SQLRooms visualizations.

This package is intentionally generic: it does not know about deck.gl layers,
Arrow tables, or Mosaic/VGPlot. Adapter code for those runtimes lives in the
packages that consume this one.

## Installation

```bash
npm install @sqlrooms/color-scales
```

## What This Package Provides

`@sqlrooms/color-scales` is the shared color-scale core used by SQLRooms
visualization packages:

- schema-first color-scale config with Zod validation
- full D3 chromatic scheme registries exposed as typed unions
- helpers for turning values into RGBA colors
- legend model generation
- a generic React `ColorScaleLegend` component

Use this package when you want a single declarative color-scale model that can
be validated, shared between runtimes, and rendered independently of DeckGL or
Mosaic.

## Relationship to D3 and Mosaic

This package is designed to be compatible with two important upstream ideas:

- [`d3-scale-chromatic`](https://d3js.org/d3-scale-chromatic)
  provides the underlying palette and interpolator vocabulary used by the
  shared SQLRooms config. Scheme names such as `YlOrRd`, `RdBu`, `PuBuGn`, and
  `Tableau10` come from that ecosystem.
- [Mosaic legend examples](https://idl.uw.edu/mosaic/examples/legends.html)
  show the kinds of legend behavior and visualizations SQLRooms wants to stay
  compatible with. `@sqlrooms/mosaic` can adapt the same `ColorScaleConfig`
  into VGPlot/Mosaic legends, while this package stays runtime-neutral.

So the relationship is:

- D3 chromatic supplies the color scheme vocabulary and interpolation building
  blocks
- `@sqlrooms/color-scales` provides a validated, shared config/model layer over
  that vocabulary
- deck and mosaic consume that shared layer in different ways

## Schema-First Config

The main config exports are both Zod schemas and inferred TypeScript types:

```ts
import {ColorScaleConfig, ColorLegendConfig, RGBAColor} from '@sqlrooms/color-scales';

const parsed = ColorScaleConfig.parse({
  field: 'Magnitude',
  type: 'sequential',
  scheme: 'YlOrRd',
  domain: 'auto',
  clamp: true,
});
```

That means the same symbol is usable for:

- runtime validation with `.parse(...)` / `.safeParse(...)`
- TypeScript inference via `z.infer<typeof ColorScaleConfig>`

## Supported Scale Types

`ColorScaleConfig` supports:

- `sequential`
  - continuous sequential/cyclical interpolators
- `diverging`
  - continuous diverging interpolators
- `quantize`
  - equal-width discrete numeric bins
- `quantile`
  - equal-count discrete numeric bins
- `threshold`
  - explicit threshold bins
- `categorical`
  - categorical palettes for string/number/boolean values

### Sequential Example

```ts
const colorScale = ColorScaleConfig.parse({
  field: 'Magnitude',
  type: 'sequential',
  scheme: 'YlOrRd',
  domain: 'auto',
  clamp: true,
});
```

### Diverging Example

```ts
const colorScale = ColorScaleConfig.parse({
  field: 'anomaly',
  type: 'diverging',
  scheme: 'RdBu',
  domain: [-5, 0, 5],
  reverse: true,
});
```

### Quantize Example

```ts
const colorScale = ColorScaleConfig.parse({
  field: 'Magnitude',
  type: 'quantize',
  scheme: 'PuBuGn',
  domain: [0, 8],
  bins: 5,
});
```

### Categorical Example

```ts
const colorScale = ColorScaleConfig.parse({
  field: 'status',
  type: 'categorical',
  scheme: 'Tableau10',
});
```

## Legend Config

Every color scale can optionally include:

```ts
legend: {
  title: 'Magnitude (Mw)',
}
```

If no title is provided, SQLRooms defaults to the scale field name.

`ColorLegendConfig` is intentionally small today. Runtime-specific packages can
add their own placement or wrapper styling without changing the shared config
model.

## Scheme Registries

The package exports typed scheme lists and registries from
[`d3-scale-chromatic`](https://d3js.org/d3-scale-chromatic):

```ts
import {
  continuousSequentialSchemes,
  continuousDivergingSchemes,
  binnedNumericSchemes,
  categoricalSchemes,
} from '@sqlrooms/color-scales';
```

It also exports the registries used internally for interpolation and discrete
palette lookup, such as:

- `continuousSequentialInterpolators`
- `continuousDivergingInterpolators`
- `categoricalSchemeColors`
- `binnedNumericSchemes`

## Mapping Values to Colors

Use `createColorScaleMapper(...)` when you already have a validated
`ColorScaleConfig` plus source values:

```ts
import {createColorScaleMapper} from '@sqlrooms/color-scales';

const mapper = createColorScaleMapper(colorScale, values);
const rgba = mapper(4.7); // [r, g, b, a]
```

Helpers exposed alongside it include:

- `coerceFiniteNumber`
- `normalizeColor`
- `parseColorString`
- `getDiscreteNumericColors`
- `getSequentialDomain`
- `getDivergingDomain`
- `resolveColorLegendTitle`
- `isContinuousColorScale`
- `isSteppedColorScale`
- `isCategoricalColorScale`

## Building and Rendering Legends

To derive a legend model:

```ts
import {buildColorScaleLegend} from '@sqlrooms/color-scales';

const legend = buildColorScaleLegend(colorScale, values);
```

`buildColorScaleLegend(...)` returns a `ResolvedColorLegend`, which is one of:

- `continuous`
- `stepped`
- `categorical`

You can render one or more resolved legends with the generic React component:

```tsx
import {ColorScaleLegend} from '@sqlrooms/color-scales';

<ColorScaleLegend legends={[legend]} />
```

The current legend renderer is intentionally generic and runtime-neutral. It is
meant to work in any React environment, while runtime-specific packages can
choose to render the same config/model through other systems such as
[Mosaic/VGPlot legends](https://idl.uw.edu/mosaic/examples/legends.html).

### Using the Same Config With `MosaicColorLegend`

`@sqlrooms/mosaic` can consume the same `ColorScaleConfig` and render it through
VGPlot/Mosaic legends:

```tsx
import type {ColorScaleConfig} from '@sqlrooms/color-scales';
import {MosaicColorLegend} from '@sqlrooms/mosaic';

const colorScale = {
  field: 'Magnitude',
  type: 'sequential',
  scheme: 'YlOrRd',
  domain: [0, 8],
  reverse: false,
  legend: {
    title: 'Magnitude (Mw)',
  },
} satisfies ColorScaleConfig;

<MosaicColorLegend
  colorScale={colorScale}
  width={220}
  tickFormat=".1f"
/>;
```

This is the intended compatibility model:

- define one shared `ColorScaleConfig`
- use it in deck through `_sqlrooms.colorScale`
- or render it in Mosaic through `MosaicColorLegend`

## How Other SQLRooms Packages Use This

- `@sqlrooms/deck`
  - uses `ColorScaleConfig` under `_sqlrooms.colorScale`
  - compiles color accessors for deck layers
  - derives deck overlay legends from the shared legend model
- `@sqlrooms/mosaic`
  - can map the same `ColorScaleConfig` into VGPlot/Mosaic legends
  - keeps Mosaic-specific interaction and theme behavior outside this package

This separation is intentional: the shared package owns config, validation,
scheme lookup, and legend modeling, while consumers own data extraction and
runtime integration. That lets SQLRooms stay compatible with D3 chromatic
scheme naming and Mosaic legend usage patterns without coupling this package to
either runtime directly.
