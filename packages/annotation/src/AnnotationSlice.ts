import {createId} from '@paralleldrive/cuid2';
import {
  createSlice,
  useBaseProjectBuilderStore,
  type ProjectBuilderState,
  type StateCreator,
  BaseProjectConfig,
} from '@sqlrooms/project-builder';
import {produce} from 'immer';
import {z} from 'zod';

export const Annotation = z.object({
  id: z.string().cuid2(),
  userId: z.string(),
  targetId: z.string().optional(),
  text: z.string(),
  timestamp: z.date(),
});
export type Annotation = z.infer<typeof Annotation>;

export const AnnotationThread = z.object({
  annotations: z.array(Annotation),
});
export type AnnotationThread = z.infer<typeof AnnotationThread>;

export type AnnotationSliceState = {
  annotation: {
    userId: string;
    threads: AnnotationThread[];
    addAnnotation: (text: string, targetId?: string) => void;
    editAnnotation: (id: string, text: string) => void;
    removeAnnotation: (id: string) => void;
    replyToAnnotation: (targetId: string, text: string) => void;
  };
};

export type ProjectStateWithAnnotation = ProjectBuilderState<BaseProjectConfig> &
  AnnotationSliceState;

export function createAnnotationSlice({
  userId,
}: {
  userId: string;
}): StateCreator<AnnotationSliceState> {
  return createSlice<BaseProjectConfig, AnnotationSliceState>((set, get) => ({
    annotation: {
      userId,
      threads: [],

      addAnnotation: (text, targetId) => {
        const newAnnotation: Annotation = {
          id: createId(),
          userId,
          targetId,
          text,
          timestamp: new Date(),
        };

        set((state) =>
          produce(state, (draft) => {
            if (targetId) {
              const thread = draft.annotation.threads.find((t) =>
                t.annotations.some((a) => a.id === targetId),
              );
              if (thread) {
                thread.annotations.push(newAnnotation);
                return;
              }
            }
            draft.annotation.threads.push({annotations: [newAnnotation]});
          }),
        );
      },

      removeAnnotation: (id) => {
        set((state) =>
          produce(state, (draft) => {
            for (let i = 0; i < draft.annotation.threads.length; i++) {
              const thread = draft.annotation.threads[i];
              const index = thread.annotations.findIndex((a) => a.id === id);
              if (index !== -1) {
                thread.annotations.splice(index, 1);
                if (thread.annotations.length === 0) {
                  draft.annotation.threads.splice(i, 1);
                }
                break;
              }
            }
          }),
        );
      },

      editAnnotation: (id, text) => {
        set((state) =>
          produce(state, (draft) => {
            for (const thread of draft.annotation.threads) {
              const ann = thread.annotations.find((a) => a.id === id);
              if (ann) {
                ann.text = text;
                break;
              }
            }
          }),
        );
      },

      replyToAnnotation: (targetId, text) => {
        get().annotation.addAnnotation(text, targetId);
      },
    },
  }));
}

export function useStoreWithAnnotation<T>(
  selector: (state: ProjectStateWithAnnotation) => T,
): T {
  return useBaseProjectBuilderStore<
    BaseProjectConfig,
    ProjectStateWithAnnotation,
    T
  >((state) => selector(state as ProjectStateWithAnnotation));
}
