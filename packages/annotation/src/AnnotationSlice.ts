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
export const CommentBaseSchema = z.object({
  id: z.string().cuid2(),
  userId: z.string(),
  text: z.string(),
  timestamp: z.date(),
});
export type CommentBaseSchema = z.infer<typeof CommentBaseSchema>;

// Comment type extends base with parentId
export const CommentSchema = CommentBaseSchema.extend({
  parentId: z.string().optional(),
});
export type CommentSchema = z.infer<typeof CommentSchema>;

// Annotation extends base with targetId and contains comments
export const AnnotationSchema = CommentBaseSchema.extend({
  targetId: z.string().optional(),
  comments: z.array(CommentSchema),
});
export type AnnotationSchema = z.infer<typeof AnnotationSchema>;

// UI state for annotations
export type ReplyTo = {
  annotationId: string;
  commentId?: string;
};

export type EditingItem = {
  annotationId: string;
  commentId?: string;
};

export type DeleteItem = {
  annotationId: string;
  commentId?: string;
  itemType: string;
};

export type AnnotationSliceState = {
  annotation: {
    userId: string;
    getUserName: (userId: string) => string;
    annotations: AnnotationSchema[];

    // UI-connected actions - preferred API for most use cases
    /**
     * Submit content based on current UI state (add annotation, reply to annotation/comment, or edit).
     * This automatically handles state management and is the preferred way to submit content.
     */
    submitEdit: (text: string) => void;

    // UI state management
    /**
     * Current annotation or comment being replied to.
     * Used by the form to determine context when submitting.
     */
    replyToItem: ReplyTo | undefined;
    /**
     * Sets the annotation or comment being replied to.
     * Will clear editing state if set.
     */
    setReplyToItem: (replyToItem: ReplyTo | undefined) => void;

    /**
     * Current annotation or comment being edited.
     * Used by the form to determine context when submitting.
     */
    editingItem: EditingItem | undefined;
    /**
     * Sets the annotation or comment being edited.
     * Will clear replyTo state if set.
     */
    setEditingItem: (editingItem: EditingItem | undefined) => void;

    /**
     * Item currently targeted for deletion.
     * Used by the delete confirmation dialog.
     */
    itemToDelete: DeleteItem | undefined;
    /**
     * Sets the annotation or comment to be deleted.
     * Should be used before showing the confirmation dialog.
     */
    setItemToDelete: (item: DeleteItem | undefined) => void;

    // Delete confirmation handler
    /**
     * Handles the confirmation of a delete operation.
     * Should be called after the user confirms deletion in the UI.
     */
    handleDeleteConfirm: () => void;

    // Helpers
    /**
     * Helper function to get the name of the user being replied to.
     * Used by the form to display context about the reply.
     */
    getReplyingToName: () => string;

    // Direct CRUD operations - use these only for custom integrations
    // that don't use the built-in UI state management
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

      // Direct CRUD operations - These are exposed for advanced use cases
      // For normal usage with UI integration, prefer submitEdit

      /**
       * Directly adds a new annotation without managing UI state.
       * For UI-integrated usage, prefer submitEdit.
       */
      addAnnotation: (text, targetId) => {
        const newAnnotation: AnnotationSchema = {
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

      /**
       * Directly removes an annotation without managing UI state.
       * For UI-integrated usage, prefer setting itemToDelete and using handleDeleteConfirm.
       */
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

      /**
       * Directly edits an annotation without managing UI state.
       * For UI-integrated usage, prefer submitEdit.
       */
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

      /**
       * Directly adds a comment without managing UI state.
       * For UI-integrated usage, prefer submitEdit.
       */
      addComment: (annotationId, text, parentId) => {
        const newComment: CommentSchema = {
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

      /**
       * Directly edits a comment without managing UI state.
       * For UI-integrated usage, prefer submitEdit.
       */
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

      /**
       * Directly removes a comment without managing UI state.
       * For UI-integrated usage, prefer setting itemToDelete and using handleDeleteConfirm.
       */
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

      // UI state management
      /**
       * Current annotation or comment being replied to.
       * Used by the form to determine context when submitting.
       */
      replyToItem: undefined,
      /**
       * Sets the annotation or comment being replied to.
       * Will clear editing state if set.
       */
      setReplyToItem: (replyToItem) => {
        set((state) =>
          produce(state, (draft) => {
            draft.annotation.replyToItem = replyToItem;
            if (replyToItem) {
              draft.annotation.editingItem = undefined;
            }
          }),
        );
      },

      /**
       * Current annotation or comment being edited.
       * Used by the form to determine context when submitting.
       */
      editingItem: undefined,
      /**
       * Sets the annotation or comment being edited.
       * Will clear replyTo state if set.
       */
      setEditingItem: (editingItem) => {
        set((state) =>
          produce(state, (draft) => {
            draft.annotation.editingItem = editingItem;
            if (editingItem) {
              draft.annotation.replyToItem = undefined;
            }
          }),
        );
      },

      /**
       * Item currently targeted for deletion.
       * Used by the delete confirmation dialog.
       */
      itemToDelete: undefined,
      /**
       * Sets the annotation or comment to be deleted.
       * Should be used before showing the confirmation dialog.
       */
      setItemToDelete: (item) => {
        set((state) =>
          produce(state, (draft) => {
            draft.annotation.itemToDelete = item;
          }),
        );
      },

      /**
       * Main form submission handler that processes content based on UI state.
       * This is the preferred method to submit annotation/comment content.
       *
       * Will automatically:
       * - Add a new annotation if no context is set
       * - Add a comment as a reply if replyToItem is set
       * - Edit an annotation or comment if editing is set
       * - Clear UI state after submission
       */
      submitEdit: (text) => {
        const state = get();
        const {
          editingItem,
          replyToItem,
          addAnnotation,
          editAnnotation,
          editComment,
          addComment,
        } = state.annotation;

        if (editingItem) {
          if (editingItem.commentId) {
            editComment(editingItem.annotationId, editingItem.commentId, text);
          } else {
            editAnnotation(editingItem.annotationId, text);
          }
          state.annotation.setEditingItem(undefined);
        } else if (replyToItem) {
          if (replyToItem.commentId) {
            addComment(replyToItem.annotationId, text, replyToItem.commentId);
          } else {
            addComment(replyToItem.annotationId, text);
          }
          state.annotation.setReplyToItem(undefined);
        } else {
          addAnnotation(text);
        }
      },

      /**
       * Handles the confirmation of a delete operation.
       * Should be called after the user confirms deletion in the UI.
       *
       * Will:
       * - Delete the annotation or comment specified in itemToDelete
       * - Clear the itemToDelete state
       */
      handleDeleteConfirm: () => {
        const state = get();
        const {itemToDelete, removeComment, removeAnnotation} =
          state.annotation;

        if (itemToDelete) {
          if (itemToDelete.commentId) {
            removeComment(itemToDelete.annotationId, itemToDelete.commentId);
          } else {
            removeAnnotation(itemToDelete.annotationId);
          }
          state.annotation.setItemToDelete(undefined);
        }
      },

      // Helper function to get the name of the user being replied to
      getReplyingToName: () => {
        const state = get();
        const {replyToItem, annotations, getUserName} = state.annotation;

        if (!replyToItem) return '';

        if (replyToItem.commentId) {
          const annotation = annotations.find(
            (a) => a.id === replyToItem.annotationId,
          );
          if (annotation) {
            const comment = annotation.comments.find(
              (c) => c.id === replyToItem.commentId,
            );
            if (comment) return getUserName(comment.userId);
          }
        } else {
          const annotation = annotations.find(
            (a) => a.id === replyToItem.annotationId,
          );
          if (annotation) return getUserName(annotation.userId);
        }

        return 'unknown';
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
