import {Button} from '@sqlrooms/ui';
import {X} from 'lucide-react';
import type {FC, PropsWithChildren} from 'react';
import {ConnectorDriversDiagnostics} from './ConnectorDriversDiagnostics';
import {DbConnectionForm} from './DbConnectionForm';
import {DbConnectionsList} from './DbConnectionsList';

interface DbSettingsPanelProps {
  onClose?: () => void;
}

const DbSettingsPanelBase: FC<PropsWithChildren<DbSettingsPanelProps>> = ({
  onClose,
  children,
}) => {
  return (
    <div className="bg-background border-border w-full rounded-lg border shadow-sm">
      <div className="relative flex flex-col gap-6 overflow-y-auto p-6">
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="absolute top-2 right-2 z-10"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
        {children}
      </div>
    </div>
  );
};

export const DbSettingsPanel = Object.assign(DbSettingsPanelBase, {
  ConnectionsList: DbConnectionsList,
  ConnectionForm: DbConnectionForm,
  DriversDiagnostics: ConnectorDriversDiagnostics,
});
