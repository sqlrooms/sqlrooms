import type {Texture} from '@luma.gl/core';
import type {ShaderModule} from '@luma.gl/shadertools';

/**
 * Props for the {@link MaskFilter} shader module.
 */
export type MaskFilterProps = {
  /** r8unorm mask texture; texels >= 128 count as inside the mask. */
  maskTexture: Texture;
  /** Affine offset mapping the tile's local uv into the mask texture. */
  maskUvOffset?: [number, number];
  /** Affine scale mapping the tile's local uv into the mask texture. */
  maskUvScale?: [number, number];
  /** Set to false to bypass the mask entirely. */
  maskEnabled?: boolean;
  /** Keep pixels outside the mask instead of inside. */
  invert?: boolean;
};

type MaskFilterUniforms = {
  maskUvOffset: [number, number];
  maskUvScale: [number, number];
  maskEnabled: number;
  invert: number;
};

type MaskFilterBindings = Pick<MaskFilterProps, 'maskTexture'>;

const MODULE_NAME = 'maskFilter';

/**
 * Per-pixel spatial analogue of deck.gl's DataFilterExtension for raster
 * tiles: where the extension bakes `getFilterValue` into a per-object vertex
 * attribute, a texture-rendered tile has no data objects, so the filter
 * value arrives as a mask texture sampled per fragment instead. Fragments
 * whose mask texel is unset are discarded in the same `DECKGL_FILTER_COLOR`
 * hook the extension injects into.
 *
 * The module is app-agnostic: the mask can come from a SQL selection, a
 * rasterized polygon, or any other source.
 */
export const MaskFilter = {
  name: MODULE_NAME,
  fs: `\
uniform ${MODULE_NAME}Uniforms {
  vec2 maskUvOffset;
  vec2 maskUvScale;
  float maskEnabled;
  float invert;
} ${MODULE_NAME};
`,
  inject: {
    'fs:#decl': `
uniform sampler2D maskTexture;
`,
    'fs:DECKGL_FILTER_COLOR': /* glsl */ `
      if (${MODULE_NAME}.maskEnabled > 0.5) {
        vec2 maskUv = ${MODULE_NAME}.maskUvOffset + geometry.uv * ${MODULE_NAME}.maskUvScale;
        bool inside = texture(maskTexture, maskUv).r >= 0.5;
        if (inside == (${MODULE_NAME}.invert > 0.5)) {
          discard;
        }
      }
    `,
  },
  uniformTypes: {
    maskUvOffset: 'vec2<f32>',
    maskUvScale: 'vec2<f32>',
    maskEnabled: 'f32',
    invert: 'f32',
  },
  getUniforms: (props: Partial<MaskFilterProps>) => ({
    maskTexture: props.maskTexture,
    maskUvOffset: props.maskUvOffset ?? [0, 0],
    maskUvScale: props.maskUvScale ?? [1, 1],
    maskEnabled: props.maskEnabled === false ? 0 : 1,
    invert: props.invert ? 1 : 0,
  }),
} as const satisfies ShaderModule<
  MaskFilterProps,
  MaskFilterUniforms,
  MaskFilterBindings
>;
