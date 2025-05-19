/**
 * {@include ../README.md}
 * @packageDocumentation
 */

export {DiscussionList} from './DiscussionList';
export {
  DiscussionSchema,
  CommentSchema,
  createDiscussionSlice,
  useStoreWithDiscussion,
  type DiscussionSliceState,
  type ProjectStateWithDiscussion,
} from './DiscussionSlice';

export {DiscussionItem} from './components/DiscussionItem';
export {CommentItem} from './components/CommentItem';
export {DeleteConfirmDialog} from './components/DeleteConfirmDialog';
