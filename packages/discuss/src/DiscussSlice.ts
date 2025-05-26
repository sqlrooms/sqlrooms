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
  timestamp: z.coerce.date(),
});
export type CommentBase = z.infer<typeof CommentBase>;

// Comment type extends base with parentId
export const Comment = CommentBase.extend({
  parentId: z.string().optional(),
});
export type Comment = z.infer<typeof Comment>;

// Discussion is a container with a rootComment and collection of reply comments
export const Discussion = z.object({
  id: z.string().cuid2(),
  anchorId: z.string().optional(),
  rootComment: Comment,
  comments: z.array(Comment),
});
export type Discussion = z.infer<typeof Discussion>;

export const DiscussSliceConfig = z.object({
  discuss: z.object({
    discussions: z.array(Discussion),
  }),
});
export type DiscussSliceConfig = z.infer<typeof DiscussSliceConfig>;

export function createDefaultDiscussConfig(): DiscussSliceConfig {
  return {
    discuss: {
      discussions: [],
    },
  };
}

// UI state for discussions
export type ReplyToItem = {
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

export type DiscussSliceState = {
  discuss: {
    userId: string;

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
    replyToItem: ReplyToItem | undefined;
    /**
     * Sets the discussion or comment being replied to.
     * Will clear editing state if set.
     */
    setReplyToItem: (replyToItem: ReplyToItem | undefined) => void;

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

    /**
     * Currently highlighted discussion.
     * Used to visually highlight a discussion in the UI.
     */
    highlightedDiscussionId: string | undefined;
    /**
     * Sets the highlighted discussion.
     */
    setHighlightedDiscussionId: (discussionId: string | undefined) => void;

    // Delete confirmation handler
    /**
     * Handles the confirmation of a delete operation.
     * Should be called after the user confirms deletion in the UI.
     */
    handleDeleteConfirm: () => void;

    // Helpers
    /**
     * Helper function to get the user ID of the entity being replied to.
     * Returns '' if no reply context is set, or the user ID if a valid reply context exists.
     */
    getReplyToUserId: () => string;

    /**
     * Helper function to get the text of the item being edited.
     * Returns '' if no editing context is set, or the text content if a valid editing context exists.
     */
    getEditingItemText: () => string;

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
  ProjectBuilderState<BaseProjectConfig> & DiscussSliceState;

export function createDiscussSlice<
  PC extends BaseProjectConfig & DiscussSliceConfig,
>({userId}: {userId: string}): StateCreator<DiscussSliceState> {
  return createSlice<PC, DiscussSliceState>((set, get) => ({
    discuss: {
      userId,

      // Direct CRUD operations - These are exposed for advanced use cases
      // For normal usage with UI integration, prefer submitEdit

      /**
       * Directly adds a new discussion without managing UI state.
       * For UI-integrated usage, prefer submitEdit.
       */
      addDiscussion: (text, anchorId) => {
        const id = createId();
        const rootComment: Comment = {
          id: createId(),
          userId,
          text,
          timestamp: new Date(),
        };

        const newDiscussion: Discussion = {
          id,
          anchorId,
          rootComment,
          comments: [],
        };

        set((state) =>
          produce(state, (draft) => {
            draft.config.discuss.discussions.push(newDiscussion);
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
            const index = draft.config.discuss.discussions.findIndex(
              (a) => a.id === id,
            );
            if (index !== -1) {
              draft.config.discuss.discussions.splice(index, 1);
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
            const discussion = draft.config.discuss.discussions.find(
              (a) => a.id === id,
            );
            if (discussion) {
              discussion.rootComment.text = text;
            }
          }),
        );
      },

      /**
       * Directly adds a comment without managing UI state.
       * For UI-integrated usage, prefer submitEdit.
       */
      addComment: (discussionId, text, parentId) => {
        const newComment: Comment = {
          id: createId(),
          userId,
          text,
          timestamp: new Date(),
          parentId,
        };

        set((state) =>
          produce(state, (draft) => {
            const discussion = draft.config.discuss.discussions.find(
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
            const discussion = draft.config.discuss.discussions.find(
              (a) => a.id === discussionId,
            );
            if (discussion) {
              if (discussion.rootComment.id === commentId) {
                discussion.rootComment.text = text;
              } else {
                const comment = discussion.comments.find(
                  (c) => c.id === commentId,
                );
                if (comment) {
                  comment.text = text;
                }
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
            const discussion = draft.config.discuss.discussions.find(
              (a) => a.id === discussionId,
            );
            if (discussion) {
              // Cannot remove the root comment
              if (discussion.rootComment.id !== commentId) {
                const index = discussion.comments.findIndex(
                  (c) => c.id === commentId,
                );
                if (index !== -1) {
                  discussion.comments.splice(index, 1);
                }
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
            draft.discuss.replyToItem = replyToItem;
            if (replyToItem) {
              draft.discuss.editingItem = undefined;
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
            draft.discuss.editingItem = editingItem;
            if (editingItem) {
              draft.discuss.replyToItem = undefined;
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
            draft.discuss.itemToDelete = item;
          }),
        );
      },

      /**
       * Currently highlighted discussion.
       * Used to visually highlight a discussion in the UI.
       */
      highlightedDiscussionId: undefined,
      /**
       * Sets the highlighted discussion.
       */
      setHighlightedDiscussionId: (discussionId) => {
        set((state) =>
          produce(state, (draft) => {
            draft.discuss.highlightedDiscussionId = discussionId;
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
        } = state.discuss;

        if (editingItem) {
          if (editingItem.commentId) {
            editComment(editingItem.discussionId, editingItem.commentId, text);
          } else {
            editDiscussion(editingItem.discussionId, text);
          }
          state.discuss.setEditingItem(undefined);
        } else if (replyToItem) {
          if (replyToItem.commentId) {
            addComment(replyToItem.discussionId, text, replyToItem.commentId);
          } else {
            addComment(replyToItem.discussionId, text);
          }
          state.discuss.setReplyToItem(undefined);
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
        const {itemToDelete, removeComment, removeDiscussion} = state.discuss;

        if (itemToDelete) {
          if (itemToDelete.commentId) {
            removeComment(itemToDelete.discussionId, itemToDelete.commentId);
          } else {
            removeDiscussion(itemToDelete.discussionId);
          }
          state.discuss.setItemToDelete(undefined);
        }
      },

      /**
       * Helper function to get the user ID of the entity being replied to.
       * Returns '' if no reply context is set, or the user ID if a valid reply context exists.
       */
      getReplyToUserId: () => {
        const state = get();
        const {replyToItem} = state.discuss;
        const {discussions} = state.config.discuss;

        if (!replyToItem) return '';

        const discussion = discussions.find(
          (a) => a.id === replyToItem.discussionId,
        );

        if (discussion) {
          if (replyToItem.commentId) {
            if (discussion.rootComment.id === replyToItem.commentId) {
              return discussion.rootComment.userId;
            }
            const comment = discussion.comments.find(
              (c) => c.id === replyToItem.commentId,
            );
            if (comment) return comment.userId;
          } else {
            return discussion.rootComment.userId;
          }
        }

        return '';
      },

      /**
       * Helper function to get the text of the item being edited.
       * Returns '' if no editing context is set, or the text content if a valid editing context exists.
       */
      getEditingItemText: () => {
        const state = get();
        const {editingItem} = state.discuss;
        const {discussions} = state.config.discuss;

        if (!editingItem) return '';

        // Look for the discussion
        const discussion = discussions.find(
          (a) => a.id === editingItem.discussionId,
        );
        if (!discussion) return '';

        // If editing a comment, find the comment
        if (editingItem.commentId) {
          const comment = discussion.comments.find(
            (c) => c.id === editingItem.commentId,
          );
          return comment ? comment.text : '';
        }

        // If editing the discussion itself
        return discussion.rootComment.text;
      },
    },
  }));
}

type ProjectConfigWithDiscuss = BaseProjectConfig & DiscussSliceConfig;
type ProjectStateWithDiscuss = ProjectBuilderState<ProjectConfigWithDiscuss> &
  DiscussSliceState;

export function useStoreWithDiscussion<T>(
  selector: (state: ProjectStateWithDiscuss) => T,
): T {
  return useBaseProjectBuilderStore<
    BaseProjectConfig & DiscussSliceConfig,
    ProjectStateWithDiscuss,
    T
  >((state) => selector(state as ProjectStateWithDiscuss));
}
