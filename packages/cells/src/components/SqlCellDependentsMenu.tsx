import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@sqlrooms/ui';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {CellsSliceConfig} from '../types';

export type SqlCellDependentsMenuProps = {
  cellId: string;
  currentSheetId: string | undefined;
  cellsData: CellsSliceConfig['data'];
  sheets: CellsSliceConfig['sheets'];
  getDownstream: (sheetId: string, cellId: string) => string[];
};

export const SqlCellDependentsMenu: React.FC<SqlCellDependentsMenuProps> = ({
  cellId,
  currentSheetId,
  cellsData,
  sheets,
  getDownstream,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenuTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const downstreamCellIds = useMemo(() => {
    if (!currentSheetId) return [];
    return getDownstream(currentSheetId, cellId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSheetId, getDownstream, cellId, cellsData, sheets]);

  const downstreamCells = useMemo(
    () =>
      downstreamCellIds.map((downstreamCellId) => {
        const downstreamCell = cellsData[downstreamCellId];
        return {
          id: downstreamCellId,
          label: downstreamCell?.data?.title?.trim() || 'Untitled',
        };
      }),
    [cellsData, downstreamCellIds],
  );

  const scrollToCell = useCallback((targetCellId: string) => {
    const selectorTargets = [
      `[data-cell-container-id="${targetCellId}"]`,
      `#cell-${targetCellId}`,
    ];
    const el =
      selectorTargets
        .map((selector) => document.querySelector<HTMLElement>(selector))
        .find(Boolean) ?? null;
    if (el) {
      el.scrollIntoView({behavior: 'smooth', block: 'center'});
    }
  }, []);

  const clearCloseTimer = useCallback(() => {
    if (closeMenuTimerRef.current) {
      clearTimeout(closeMenuTimerRef.current);
      closeMenuTimerRef.current = null;
    }
  }, []);

  const openMenu = useCallback(() => {
    clearCloseTimer();
    setMenuOpen(true);
  }, [clearCloseTimer]);

  const scheduleCloseMenu = useCallback(() => {
    clearCloseTimer();
    closeMenuTimerRef.current = setTimeout(() => {
      setMenuOpen(false);
      closeMenuTimerRef.current = null;
    }, 120);
  }, [clearCloseTimer]);

  useEffect(() => {
    return () => {
      clearCloseTimer();
    };
  }, [clearCloseTimer]);

  if (downstreamCells.length === 0) {
    return null;
  }

  return (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          className="h-5"
          size="xs"
          variant="secondary"
          aria-label={`${downstreamCells.length} dependent cells`}
          onMouseEnter={openMenu}
          onMouseLeave={scheduleCloseMenu}
        >
          {downstreamCells.length}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        onCloseAutoFocus={(e) => e.preventDefault()}
        onMouseEnter={openMenu}
        onMouseLeave={scheduleCloseMenu}
      >
        <DropdownMenuLabel className="text-xs">Referenced in</DropdownMenuLabel>
        {downstreamCells.map((dependentCell) => (
          <DropdownMenuItem
            key={dependentCell.id}
            className="cursor-pointer text-xs"
            onSelect={(e) => {
              e.preventDefault();
              scrollToCell(dependentCell.id);
            }}
          >
            {dependentCell.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
