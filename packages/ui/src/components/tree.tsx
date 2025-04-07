'use client';

import {Collapsible, CollapsibleContent} from '@radix-ui/react-collapsible';
import React, {useEffect, useState} from 'react';

import {CollapsibleTrigger} from './collapsible';
import {cn} from '../lib/utils';
import {ChevronRightIcon} from 'lucide-react';

export type TreeNodeData<T> = {
  key: string;
  object: T;
  children?: TreeNodeData<T>[];
  isOpen?: boolean;
};

type TreeProps<T> = {
  className?: string;
  treeData: TreeNodeData<T>;
  renderNode: TreeNodeProps<T>['renderNode'];
};

/**
 * Component that renders a generic tree.
 * @param treeData - The tree data.
 * @param renderNode - A function that renders a tree node.
 */
export function Tree<T>(props: TreeProps<T>): React.ReactElement {
  const {className, treeData, renderNode} = props;
  return (
    <div className={cn('flex flex-col', className)}>
      <TreeNode<T> treeData={treeData} renderNode={renderNode} />
    </div>
  );
}

type TreeNodeProps<T> = {
  treeData: TreeNodeData<T>;
  renderNode: (node: TreeNodeData<T>, isOpen: boolean) => React.ReactNode;
};

/**
 * Component that renders a tree node.
 */
function TreeNode<T>(props: TreeNodeProps<T>): React.ReactElement | null {
  const {treeData, renderNode} = props;
  const {children} = treeData;
  const [isOpen, setIsOpen] = useState(Boolean(treeData.isOpen));
  useEffect(() => {
    setIsOpen(Boolean(treeData.isOpen));
  }, [treeData.isOpen]);
  if (!children) {
    return <>{renderNode(treeData, isOpen)}</>;
  }
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="w-full" asChild>
        <div className="flex w-full cursor-pointer items-center space-x-1">
          <ChevronRightIcon
            className={cn('flex-shrink-0 text-gray-500', {
              'rotate-90 transform': isOpen,
            })}
            size="18px"
          />
          {renderNode(treeData, isOpen)}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-4">
        {isOpen
          ? children.map((child) => (
              <TreeNode<T>
                key={child.key}
                treeData={child}
                renderNode={renderNode}
              />
            ))
          : null}
      </CollapsibleContent>
    </Collapsible>
  );
}
