import {
  Button,
  cn,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@sqlrooms/ui';
import {Settings2Icon} from 'lucide-react';
import {type FC} from 'react';

/**
 * Props for MosaicChartSettingsButton.
 *
 * @param className - Optional CSS class name
 * @param isSettingsOpen - Whether settings panel is currently open
 * @param onToggleSettings - Callback to toggle settings panel visibility
 */
export type MosaicChartSettingsButtonProps = {
  className?: string;
  isSettingsOpen?: boolean;
  onToggleSettings: () => void;
};

export const MosaicChartSettingsButton: FC<MosaicChartSettingsButtonProps> = ({
  className,
  isSettingsOpen,
  onToggleSettings,
}) => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn('data-[state=active]:bg-accent h-6 w-6', className)}
            onClick={onToggleSettings}
            data-state={isSettingsOpen ? 'active' : 'inactive'}
          >
            <Settings2Icon className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Chart settings</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
