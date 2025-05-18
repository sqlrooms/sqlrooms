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

// Base type with common fields
export const CommentBase = z.object({
  id: z.string().cuid2(),
  userId: z.string(),
  text: z.string(),
  timestamp: z.date(),
});
export type CommentBase = z.infer<typeof CommentBase>;

// Comment type extends base with parentId
export const Comment = CommentBase.extend({
  parentId: z.string().optional(),
});
export type Comment = z.infer<typeof Comment>;

// Annotation extends base with targetId and contains comments
export const Annotation = CommentBase.extend({
  targetId: z.string().optional(),
  comments: z.array(Comment),
});
export type Annotation = z.infer<typeof Annotation>;

export type AnnotationSliceState = {
  annotation: {
    userId: string;
    getUserName: (userId: string) => string;
    annotations: Annotation[];
    addAnnotation: (text: string, targetId?: string) => void;
    editAnnotation: (id: string, text: string) => void;
    removeAnnotation: (id: string) => void;
    addComment: (annotationId: string, text: string, parentId?: string) => void;
    editComment: (
      annotationId: string,
      commentId: string,
      text: string,
    ) => void;
    removeComment: (annotationId: string, commentId: string) => void;
  };
};

export type ProjectStateWithAnnotation =
  ProjectBuilderState<BaseProjectConfig> & AnnotationSliceState;

export function createAnnotationSlice({
  userId,
  getUserName,
}: {
  userId: string;
  getUserName: (userId: string) => string;
}): StateCreator<AnnotationSliceState> {
  return createSlice<BaseProjectConfig, AnnotationSliceState>((set, get) => ({
    annotation: {
      userId,
      getUserName,
      annotations: [],

      addAnnotation: (text, targetId) => {
        const newAnnotation: Annotation = {
          id: createId(),
          userId,
          targetId,
          text,
          timestamp: new Date(),
          comments: [],
        };

        set((state) =>
          produce(state, (draft) => {
            draft.annotation.annotations.push(newAnnotation);
          }),
        );
      },

      removeAnnotation: (id) => {
        set((state) =>
          produce(state, (draft) => {
            const index = draft.annotation.annotations.findIndex(
              (a) => a.id === id,
            );
            if (index !== -1) {
              draft.annotation.annotations.splice(index, 1);
            }
          }),
        );
      },

      editAnnotation: (id, text) => {
        set((state) =>
          produce(state, (draft) => {
            const annotation = draft.annotation.annotations.find(
              (a) => a.id === id,
            );
            if (annotation) {
              annotation.text = text;
            }
          }),
        );
      },

      addComment: (annotationId, text, parentId) => {
        const newComment: Comment = {
          id: createId(),
          userId,
          text,
          timestamp: new Date(),
          parentId,
        };

        set((state) =>
          produce(state, (draft) => {
            const annotation = draft.annotation.annotations.find(
              (a) => a.id === annotationId,
            );
            if (annotation) {
              annotation.comments.push(newComment);
            }
          }),
        );
      },

      editComment: (annotationId, commentId, text) => {
        set((state) =>
          produce(state, (draft) => {
            const annotation = draft.annotation.annotations.find(
              (a) => a.id === annotationId,
            );
            if (annotation) {
              const comment = annotation.comments.find(
                (c) => c.id === commentId,
              );
              if (comment) {
                comment.text = text;
              }
            }
          }),
        );
      },

      removeComment: (annotationId, commentId) => {
        set((state) =>
          produce(state, (draft) => {
            const annotation = draft.annotation.annotations.find(
              (a) => a.id === annotationId,
            );
            if (annotation) {
              const index = annotation.comments.findIndex(
                (c) => c.id === commentId,
              );
              if (index !== -1) {
                annotation.comments.splice(index, 1);
              }
            }
          }),
        );
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
