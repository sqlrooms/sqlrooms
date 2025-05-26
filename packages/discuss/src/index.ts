/**
 * {@include ../README.md}
 * @packageDocumentation
 */

export {DiscussionList} from './DiscussionList';
export {
  Comment,
  createDefaultDiscussConfig,
  createDiscussSlice,
  Discussion,
  DiscussSliceConfig,
  useStoreWithDiscussion,
  type DiscussSliceState,
  type ProjectStateWithDiscussion,
} from './DiscussSlice';

export {CommentItem} from './components/CommentItem';
export {DeleteConfirmDialog} from './components/DeleteConfirmDialog';
export {DiscussionItem} from './components/DiscussionItem';
