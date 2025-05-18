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

// Discussion extends base with anchorId and contains comments
export const DiscussionSchema = CommentBaseSchema.extend({
  anchorId: z.string().optional(),
  comments: z.array(CommentSchema),
});
export type DiscussionSchema = z.infer<typeof DiscussionSchema>;

// UI state for discussions
export type ReplyTo = {
  discussionId: string;
  commentId?: string;
};

export type EditingItem = {
  discussionId: string;
  commentId?: string;
};

export type DeleteItem = {
  discussionId: string;
  commentId?: string;
  itemType: string;
};

export type DiscussionSliceState = {
  discussion: {
    userId: string;
    getUserName: (userId: string) => string;
    discussions: DiscussionSchema[];

    // UI-connected actions - preferred API for most use cases
    /**
     * Submit content based on current UI state (add discussion, reply to discussion/comment, or edit).
     * This automatically handles state management and is the preferred way to submit content.
     */
    submitEdit: (text: string) => void;

    // UI state management
    /**
     * Current discussion or comment being replied to.
     * Used by the form to determine context when submitting.
     */
    replyToItem: ReplyTo | undefined;
    /**
     * Sets the discussion or comment being replied to.
     * Will clear editing state if set.
     */
    setReplyToItem: (replyToItem: ReplyTo | undefined) => void;

    /**
     * Current discussion or comment being edited.
     * Used by the form to determine context when submitting.
     */
    editingItem: EditingItem | undefined;
    /**
     * Sets the discussion or comment being edited.
     * Will clear replyTo state if set.
     */
    setEditingItem: (editingItem: EditingItem | undefined) => void;

    /**
     * Item currently targeted for deletion.
     * Used by the delete confirmation dialog.
     */
    itemToDelete: DeleteItem | undefined;
    /**
     * Sets the discussion or comment to be deleted.
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
    addDiscussion: (text: string, anchorId?: string) => void;
    editDiscussion: (id: string, text: string) => void;
    removeDiscussion: (id: string) => void;
    addComment: (discussionId: string, text: string, parentId?: string) => void;
    editComment: (
      discussionId: string,
      commentId: string,
      text: string,
    ) => void;
    removeComment: (discussionId: string, commentId: string) => void;
  };
};

export type ProjectStateWithDiscussion =
  ProjectBuilderState<BaseProjectConfig> & DiscussionSliceState;

export function createDiscussionSlice({
  userId,
  getUserName,
}: {
  userId: string;
  getUserName: (userId: string) => string;
}): StateCreator<DiscussionSliceState> {
  return createSlice<BaseProjectConfig, DiscussionSliceState>((set, get) => ({
    discussion: {
      userId,
      getUserName,
      discussions: [],

      // Direct CRUD operations - These are exposed for advanced use cases
      // For normal usage with UI integration, prefer submitEdit

      /**
       * Directly adds a new discussion without managing UI state.
       * For UI-integrated usage, prefer submitEdit.
       */
      addDiscussion: (text, anchorId) => {
        const newDiscussion: DiscussionSchema = {
          id: createId(),
          userId,
          anchorId,
          text,
          timestamp: new Date(),
          comments: [],
        };

        set((state) =>
          produce(state, (draft) => {
            draft.discussion.discussions.push(newDiscussion);
          }),
        );
      },

      /**
       * Directly removes an discussion without managing UI state.
       * For UI-integrated usage, prefer setting itemToDelete and using handleDeleteConfirm.
       */
      removeDiscussion: (id) => {
        set((state) =>
          produce(state, (draft) => {
            const index = draft.discussion.discussions.findIndex(
              (a) => a.id === id,
            );
            if (index !== -1) {
              draft.discussion.discussions.splice(index, 1);
            }
          }),
        );
      },

      /**
       * Directly edits an discussion without managing UI state.
       * For UI-integrated usage, prefer submitEdit.
       */
      editDiscussion: (id, text) => {
        set((state) =>
          produce(state, (draft) => {
            const discussion = draft.discussion.discussions.find(
              (a) => a.id === id,
            );
            if (discussion) {
              discussion.text = text;
            }
          }),
        );
      },

      /**
       * Directly adds a comment without managing UI state.
       * For UI-integrated usage, prefer submitEdit.
       */
      addComment: (discussionId, text, parentId) => {
        const newComment: CommentSchema = {
          id: createId(),
          userId,
          text,
          timestamp: new Date(),
          parentId,
        };

        set((state) =>
          produce(state, (draft) => {
            const discussion = draft.discussion.discussions.find(
              (a) => a.id === discussionId,
            );
            if (discussion) {
              discussion.comments.push(newComment);
            }
          }),
        );
      },

      /**
       * Directly edits a comment without managing UI state.
       * For UI-integrated usage, prefer submitEdit.
       */
      editComment: (discussionId, commentId, text) => {
        set((state) =>
          produce(state, (draft) => {
            const discussion = draft.discussion.discussions.find(
              (a) => a.id === discussionId,
            );
            if (discussion) {
              const comment = discussion.comments.find(
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
      removeComment: (discussionId, commentId) => {
        set((state) =>
          produce(state, (draft) => {
            const discussion = draft.discussion.discussions.find(
              (a) => a.id === discussionId,
            );
            if (discussion) {
              const index = discussion.comments.findIndex(
                (c) => c.id === commentId,
              );
              if (index !== -1) {
                discussion.comments.splice(index, 1);
              }
            }
          }),
        );
      },

      // UI state management
      /**
       * Current discussion or comment being replied to.
       * Used by the form to determine context when submitting.
       */
      replyToItem: undefined,
      /**
       * Sets the discussion or comment being replied to.
       * Will clear editing state if set.
       */
      setReplyToItem: (replyToItem) => {
        set((state) =>
          produce(state, (draft) => {
            draft.discussion.replyToItem = replyToItem;
            if (replyToItem) {
              draft.discussion.editingItem = undefined;
            }
          }),
        );
      },

      /**
       * Current discussion or comment being edited.
       * Used by the form to determine context when submitting.
       */
      editingItem: undefined,
      /**
       * Sets the discussion or comment being edited.
       * Will clear replyTo state if set.
       */
      setEditingItem: (editingItem) => {
        set((state) =>
          produce(state, (draft) => {
            draft.discussion.editingItem = editingItem;
            if (editingItem) {
              draft.discussion.replyToItem = undefined;
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
       * Sets the discussion or comment to be deleted.
       * Should be used before showing the confirmation dialog.
       */
      setItemToDelete: (item) => {
        set((state) =>
          produce(state, (draft) => {
            draft.discussion.itemToDelete = item;
          }),
        );
      },

      /**
       * Main form submission handler that processes content based on UI state.
       * This is the preferred method to submit discussion/comment content.
       *
       * Will automatically:
       * - Add a new discussion if no context is set
       * - Add a comment as a reply if replyToItem is set
       * - Edit an discussion or comment if editing is set
       * - Clear UI state after submission
       */
      submitEdit: (text) => {
        const state = get();
        const {
          editingItem,
          replyToItem,
          addDiscussion,
          editDiscussion,
          editComment,
          addComment,
        } = state.discussion;

        if (editingItem) {
          if (editingItem.commentId) {
            editComment(editingItem.discussionId, editingItem.commentId, text);
          } else {
            editDiscussion(editingItem.discussionId, text);
          }
          state.discussion.setEditingItem(undefined);
        } else if (replyToItem) {
          if (replyToItem.commentId) {
            addComment(replyToItem.discussionId, text, replyToItem.commentId);
          } else {
            addComment(replyToItem.discussionId, text);
          }
          state.discussion.setReplyToItem(undefined);
        } else {
          addDiscussion(text);
        }
      },

      /**
       * Handles the confirmation of a delete operation.
       * Should be called after the user confirms deletion in the UI.
       *
       * Will:
       * - Delete the discussion or comment specified in itemToDelete
       * - Clear the itemToDelete state
       */
      handleDeleteConfirm: () => {
        const state = get();
        const {itemToDelete, removeComment, removeDiscussion} =
          state.discussion;

        if (itemToDelete) {
          if (itemToDelete.commentId) {
            removeComment(itemToDelete.discussionId, itemToDelete.commentId);
          } else {
            removeDiscussion(itemToDelete.discussionId);
          }
          state.discussion.setItemToDelete(undefined);
        }
      },

      // Helper function to get the name of the user being replied to
      getReplyingToName: () => {
        const state = get();
        const {replyToItem, discussions, getUserName} = state.discussion;

        if (!replyToItem) return '';

        if (replyToItem.commentId) {
          const discussion = discussions.find(
            (a) => a.id === replyToItem.discussionId,
          );
          if (discussion) {
            const comment = discussion.comments.find(
              (c) => c.id === replyToItem.commentId,
            );
            if (comment) return getUserName(comment.userId);
          }
        } else {
          const discussion = discussions.find(
            (a) => a.id === replyToItem.discussionId,
          );
          if (discussion) return getUserName(discussion.userId);
        }

        return 'unknown';
      },
    },
  }));
}

export function useStoreWithDiscussion<T>(
  selector: (state: ProjectStateWithDiscussion) => T,
): T {
  return useBaseProjectBuilderStore<
    BaseProjectConfig,
    ProjectStateWithDiscussion,
    T
  >((state) => selector(state as ProjectStateWithDiscussion));
}
