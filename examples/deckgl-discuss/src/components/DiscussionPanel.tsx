import {CommentItem, DiscussionItem, DiscussionList} from '@sqlrooms/discuss';
import {useSql} from '@sqlrooms/duckdb';
import {ProjectBuilderPanel} from '@sqlrooms/project-builder';
import {formatTimeRelative} from '@sqlrooms/utils';
import {PlaneIcon} from 'lucide-react';
import {useMemo} from 'react';
import {ProjectPanelTypes, useProjectStore} from '../store';

/**
 * The DiscussionPanel component displays a list of discussions
 * with highlighting functionality.
 */
const DiscussionPanel = () => {
  const discussions = useProjectStore(
    (state) => state.config.discuss.discussions,
  );

  const table = useProjectStore((s) => s.db.findTableByName('airports'));
  const {data} = useSql<{name: string; abbrev: string}>({
    query: `SELECT name, abbrev FROM airports`,
    enabled: Boolean(table),
  });
  const airportNamesByCode = useMemo(
    () =>
      new Map<string, string>(
        data?.toArray().map((row) => [row.abbrev, row.name]),
      ),
    [data],
  );

  return (
    <ProjectBuilderPanel type={ProjectPanelTypes.enum['discuss']}>
      {discussions.length === 0 ? (
        <div className="py-10 text-center text-gray-400">
          <p>No comments yet. Click on an airport to add one.</p>
        </div>
      ) : null}
      <div className="h-full py-2">
        <DiscussionList
          className="flex flex-col gap-4"
          // renderDiscussion={(props) => (
          //   <DiscussionItem
          //     {...props}
          //   />
          // )}
          renderComment={(props) => {
            const {comment, discussion} = props;
            const {anchorId} = discussion;
            const isRootComment = comment.id === discussion.rootComment.id;
            return (
              <CommentItem {...props}>
                <div className="flex flex-col gap-1">
                  {anchorId && isRootComment ? (
                    <div className="text-md flex items-center gap-2 font-medium">
                      <PlaneIcon size="20px" />
                      {airportNamesByCode?.get(anchorId)} ({anchorId})
                    </div>
                  ) : null}
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
      </div>
    </ProjectBuilderPanel>
  );
};

export default DiscussionPanel;
