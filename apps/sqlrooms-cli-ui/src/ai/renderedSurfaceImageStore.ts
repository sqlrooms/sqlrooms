import {createStore} from 'zustand/vanilla';
import {genRandomStr} from '@sqlrooms/utils';

const MAX_CACHED_IMAGES = 6;

/** Pixels shared by the model output and the capture preview, never persisted. */
export type CapturedRenderedElement = {
  base64: string;
  width: number;
  height: number;
};

/** Creates a bounded, instance-scoped cache of immutable image captures. */
export function createRenderedSurfaceImageStore() {
  return createStore<{
    images: ReadonlyMap<string, CapturedRenderedElement>;
    add: (image: CapturedRenderedElement) => string;
  }>((set) => ({
    images: new Map(),
    add: (image) => {
      const captureId = `capture-${Date.now()}-${genRandomStr(16)}`;
      set((state) => {
        const images = new Map(state.images);
        images.set(captureId, image);
        while (images.size > MAX_CACHED_IMAGES) {
          images.delete(images.keys().next().value!);
        }
        return {images};
      });
      return captureId;
    },
  }));
}

/** Runtime image cache shared by a toolset and its result renderers. */
export type RenderedSurfaceImageStore = ReturnType<
  typeof createRenderedSurfaceImageStore
>;
