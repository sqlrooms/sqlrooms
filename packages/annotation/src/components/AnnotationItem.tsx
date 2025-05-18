import {Button, cn} from '@sqlrooms/ui';
import {forwardRef} from 'react';
import {formatTimeRelative} from '@sqlrooms/utils';
import type {AnnotationSchema} from '../AnnotationSlice';

export type AnnotationItemProps = {
  annotation: AnnotationSchema;
  userId: string;
  getUserName: (userId: string) => string;
  onReply: (annotationId: string) => void;
  onEdit: (annotationId: string, text: string) => void;
  onDelete: (annotationId: string) => void;
  className?: string;
};

export const AnnotationItem = forwardRef<HTMLDivElement, AnnotationItemProps>(
  (
    {annotation, userId, getUserName, onReply, onEdit, onDelete, className},
    ref,
  ) => {
    return (
      <div ref={ref} className={cn('flex flex-col gap-2', className)}>
        <div className="text-muted-foreground text-xs">
          {getUserName(annotation.userId)} -{' '}
          {formatTimeRelative(annotation.timestamp)}
        </div>
        <div className="whitespace-pre-wrap">{annotation.text}</div>
        <div className="mt-1 flex justify-end gap-1 text-xs">
          <Button
            variant="ghost"
            size="xs"
            onClick={() => onReply(annotation.id)}
          >
            Reply
          </Button>
          {annotation.userId === userId && (
            <>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => onEdit(annotation.id, annotation.text)}
              >
                Edit
              </Button>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => onDelete(annotation.id)}
              >
                Delete
              </Button>
            </>
          )}
        </div>
      </div>
    );
  },
);
AnnotationItem.displayName = 'AnnotationItem';
