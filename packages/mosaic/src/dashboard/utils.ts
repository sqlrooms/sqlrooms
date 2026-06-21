import type {Spec} from '@uwdata/mosaic-spec';

export function toRenderableMosaicSpec(vgplot: unknown): Spec | undefined {
  try {
    if (!vgplot || typeof vgplot !== 'object' || Array.isArray(vgplot)) {
      return undefined;
    }

    const vgplotRecord = vgplot as Spec;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const {$schema, ...mosaicSpec} = vgplotRecord;

    return mosaicSpec;
  } catch (error) {
    console.error('[toRenderableMosaicSpec] Failed to parse spec:', error);
    return undefined;
  }
}
