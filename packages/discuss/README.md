A simple discussion system for SQLRooms applications. Can be used for commenting and annotation with support for threaded conversations, real-time updates, and anchor-based discussions.

## Overview

The `@sqlrooms/discuss` module provides a complete discussion system with the following key features:

- **Threaded conversations**: Support for replies to discussions and comments
- **Anchor-based discussions**: Link discussions to specific data points or UI elements
- **Real-time state management**: Built on Zustand for reactive updates
- **Customizable rendering**: Flexible component system for custom UI implementations
- **Delete confirmation**: Built-in confirmation dialogs for safe content removal
- **Highlighting**: Visual highlighting of specific discussions

## Main Components

### Core Components

#### `DiscussionList`

The main container component that renders all discussions with built-in forms for adding, editing, and replying to content.

```tsx
import {DiscussionList} from '@sqlrooms/discuss';

<DiscussionList
  className="flex flex-col gap-4"
  renderComment={(props) => <CustomCommentRenderer {...props} />}
  renderDiscussion={(props) => <CustomDiscussionRenderer {...props} />}
/>;
```

#### `CommentItem`

Individual comment renderer with built-in edit/delete actions.

```tsx
import {CommentItem} from '@sqlrooms/discuss';

<CommentItem comment={comment} discussion={discussion}>
  <div className="flex flex-col gap-1">
    <div className="text-muted-foreground text-xs">
      {comment.userId} - {formatTimeRelative(comment.timestamp)}
    </div>
    <div className="whitespace-pre-wrap text-sm">{comment.text}</div>
  </div>
</CommentItem>;
```

#### `DiscussionItem`

Container for a complete discussion thread including root comment and replies.

```tsx
import {DiscussionItem} from '@sqlrooms/discuss';

<DiscussionItem
  discussion={discussion}
  renderComment={customCommentRenderer}
  className="rounded border p-4"
/>;
```

### Store Integration

#### Store Setup with `createDiscussSlice`

To use the discussion system, you need to integrate it with your room store using `createDiscussSlice`:

```tsx
import {
  createDefaultDiscussConfig,
  createDiscussSlice,
  DiscussSliceConfig,
  DiscussSliceState,
} from '@sqlrooms/discuss';
import {
  BaseRoomConfig,
  createRoomShellSlice,
  createRoomStore,
  RoomShellSliceState,
} from '@sqlrooms/room-shell';
import {z} from 'zod';

// 1. Extend your app config with DiscussSliceConfig
export const RoomConfig = BaseRoomConfig.merge(DiscussSliceConfig);
export type RoomConfig = z.infer<typeof RoomConfig>;

// 2. Extend your app state with DiscussSliceState
export type RoomState = RoomShellSliceState<RoomConfig> & DiscussSliceState;

// 3. Create the store with discuss slice
export const {roomStore, useRoomStore} = createRoomStore<RoomConfig, RoomState>(
  (set, get, store) => ({
    // Add the discuss slice with a user ID
    ...createDiscussSlice({userId: 'current-user-id'})(set, get, store),

    // Add your room shell slice
    ...createRoomShellSlice<RoomConfig>({
      connector: yourDatabaseConnector,
      config: {
        // Include default discuss config
        ...createDefaultDiscussConfig(),
        // Your other config...
        layout: {
          /* your layout */
        },
        dataSources: [
          /* your data sources */
        ],
      },
      room: {
        // Your room configuration
      },
    })(set, get, store),
  }),
);
```

#### Using the Store Hook

Access discussion state and actions using the provided hook:

```tsx
import {useStoreWithDiscussion} from '@sqlrooms/discuss';

function MyComponent() {
  // Get discussions
  const discussions = useStoreWithDiscussion(
    (state) => state.config.discuss.discussions,
  );

  // Get actions
  const addDiscussion = useStoreWithDiscussion(
    (state) => state.discuss.addDiscussion,
  );
  const setReplyToItem = useStoreWithDiscussion(
    (state) => state.discuss.setReplyToItem,
  );

  // Add a new discussion
  const handleAddDiscussion = (text: string, anchorId?: string) => {
    addDiscussion(text, anchorId);
  };

  // Start replying to a discussion
  const handleReply = (discussionId: string) => {
    setReplyToItem({discussionId});
  };
}
```

## Usage Examples

### Basic Discussion Panel

```tsx
import {DiscussionList, CommentItem} from '@sqlrooms/discuss';
import {useStoreWithDiscussion} from '@sqlrooms/discuss';
import {formatTimeRelative} from '@sqlrooms/utils';

const DiscussionPanel = () => {
  const discussions = useStoreWithDiscussion(
    (state) => state.config.discuss.discussions,
  );

  return (
    <div className="h-full">
      {discussions.length === 0 ? (
        <div className="py-10 text-center text-gray-400">
          <p>No comments yet. Start a discussion!</p>
        </div>
      ) : (
        <DiscussionList
          className="flex flex-col gap-4"
          renderComment={(props) => {
            const {comment, discussion} = props;
            const {anchorId} = discussion;
            const isRootComment = comment.id === discussion.rootComment.id;

            return (
              <CommentItem {...props}>
                <div className="flex flex-col gap-1">
                  {anchorId && isRootComment && (
                    <div className="text-md flex items-center gap-2 font-medium">
                      📍 Linked to: {anchorId}
                    </div>
                  )}
                  <div className="text-muted-foreground text-xs">
                    {comment.userId} - {formatTimeRelative(comment.timestamp)}
                  </div>
                  <div className="whitespace-pre-wrap text-sm">
                    {comment.text}
                  </div>
                </div>
              </CommentItem>
            );
          }}
        />
      )}
    </div>
  );
};
```

### Anchor-Based Discussions

Link discussions to specific data points or UI elements:

```tsx
import {useStoreWithDiscussion} from '@sqlrooms/discuss';

function DataVisualization() {
  const addDiscussion = useStoreWithDiscussion(
    (state) => state.discuss.addDiscussion,
  );
  const setHighlightedDiscussionId = useStoreWithDiscussion(
    (state) => state.discuss.setHighlightedDiscussionId,
  );

  // Handle clicking on a data point
  const handleDataPointClick = (dataId: string) => {
    // Add a discussion linked to this data point
    addDiscussion('What do you think about this data point?', dataId);
  };

  // Highlight related discussion when hovering over data
  const handleDataPointHover = (dataId: string) => {
    const discussions =
      useStoreWithDiscussion.getState().config.discuss.discussions;
    const relatedDiscussion = discussions.find((d) => d.anchorId === dataId);
    if (relatedDiscussion) {
      setHighlightedDiscussionId(relatedDiscussion.id);
    }
  };

  return (
    <div>
      {/* Your data visualization with clickable elements */}
      <div
        onClick={() => handleDataPointClick('airport-LAX')}
        onMouseEnter={() => handleDataPointHover('airport-LAX')}
        className="cursor-pointer hover:bg-blue-100"
      >
        LAX Airport
      </div>
    </div>
  );
}
```

### Custom Comment Rendering

```tsx
import {DiscussionList, CommentItem} from '@sqlrooms/discuss';
import {Avatar, Badge} from '@sqlrooms/ui';

const CustomDiscussionPanel = () => {
  return (
    <DiscussionList
      renderComment={(props) => {
        const {comment, discussion} = props;

        return (
          <CommentItem {...props}>
            <div className="flex gap-3">
              <Avatar className="h-8 w-8">
                {comment.userId.charAt(0).toUpperCase()}
              </Avatar>
              <div className="flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <span className="font-medium">{comment.userId}</span>
                  <Badge variant="secondary" className="text-xs">
                    {formatTimeRelative(comment.timestamp)}
                  </Badge>
                </div>
                <div className="text-sm leading-relaxed">{comment.text}</div>
              </div>
            </div>
          </CommentItem>
        );
      }}
    />
  );
};
```

### Programmatic Discussion Management

```tsx
import {useStoreWithDiscussion} from '@sqlrooms/discuss';

function DiscussionManager() {
  const {
    addDiscussion,
    removeDiscussion,
    addComment,
    setReplyToItem,
    setEditingItem,
    submitEdit,
  } = useStoreWithDiscussion((state) => state.discuss);

  // Add a new discussion
  const createDiscussion = () => {
    addDiscussion('New discussion topic', 'optional-anchor-id');
  };

  // Reply to a discussion
  const replyToDiscussion = (discussionId: string) => {
    setReplyToItem({discussionId});
    // User can now type in the form and call submitEdit
  };

  // Edit a comment
  const editComment = (discussionId: string, commentId: string) => {
    setEditingItem({discussionId, commentId});
    // User can now edit in the form and call submitEdit
  };

  // Direct comment addition (bypassing UI state)
  const addDirectComment = (discussionId: string, text: string) => {
    addComment(discussionId, text);
  };

  return (
    <div className="flex gap-2">
      <button onClick={createDiscussion}>New Discussion</button>
      <button onClick={() => replyToDiscussion('discussion-id')}>Reply</button>
      <button onClick={() => editComment('discussion-id', 'comment-id')}>
        Edit
      </button>
    </div>
  );
}
```

## API Reference

### Types

- `Comment`: Individual comment with id, userId, text, timestamp, and optional parentId
- `Discussion`: Container with id, optional anchorId, rootComment, and array of reply comments
- `DiscussSliceConfig`: Configuration type for the discuss slice
- `DiscussSliceState`: State type including all discussion actions and UI state

### Key Functions

- `createDiscussSlice({ userId })`: Creates the discussion slice for your store
- `createDefaultDiscussConfig()`: Returns default configuration for discussions
- `useStoreWithDiscussion(selector)`: Hook to access discussion state and actions

### Main Actions

- `submitEdit(text)`: Submit based on current UI state (add/reply/edit)
- `addDiscussion(text, anchorId?)`: Add new discussion
- `addComment(discussionId, text, parentId?)`: Add reply to discussion
- `setReplyToItem(item)`: Set reply context for UI
- `setEditingItem(item)`: Set editing context for UI
- `setHighlightedDiscussionId(id)`: Highlight specific discussion

This module integrates seamlessly with the SQLRooms ecosystem and provides a complete foundation for building collaborative discussion features in your applications.
