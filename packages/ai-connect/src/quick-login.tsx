import React from 'react';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@sqlrooms/ui';
import {ArrowRight, Check, LogIn} from 'lucide-react';
import {useStoreWithAiSettings} from '@sqlrooms/ai-settings';
import {useStoreWithAiQuickLogin} from './AiQuickLoginSlice';
import {resolveLoginTargetsFromProviders} from './loginTargets';

export function AiQuickLoginDialog() {
  const providers = useStoreWithAiSettings(
    (s) => s.aiSettings.config.providers,
  );
  const {
    dialogOpen,
    selectedTargetId,
    loginTargets,
    close,
    selectTarget,
    startSelectedLogin,
  } = useStoreWithAiQuickLogin((s) => s.aiQuickLogin);

  const visibleTargets = React.useMemo(
    () => resolveLoginTargetsFromProviders(providers, loginTargets),
    [providers, loginTargets],
  );

  return (
    <Dialog open={dialogOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Select provider to login</DialogTitle>
          <DialogDescription>
            Choose a subscription-backed login target for the assistant.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {visibleTargets.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No quick login targets are available.
            </p>
          ) : (
            visibleTargets.map((target) => {
              const provider = providers[target.providerId];
              const isSelected = target.id === selectedTargetId;
              const isLoggedIn = Boolean(provider?.status?.hasCredentials);
              return (
                <button
                  key={target.id}
                  type="button"
                  className="hover:bg-accent/50 focus-visible:ring-ring flex w-full items-center justify-between rounded-md border px-3 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  onMouseEnter={() => selectTarget(target.id)}
                  onFocus={() => selectTarget(target.id)}
                  onClick={() => void startSelectedLogin(target.id)}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="text-muted-foreground w-4 shrink-0">
                      {isSelected ? <ArrowRight className="h-4 w-4" /> : null}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">
                          {target.label}
                        </span>
                        {target.experimental && (
                          <Badge variant="secondary">Experimental</Badge>
                        )}
                      </div>
                      {target.description && (
                        <p className="text-muted-foreground mt-1 text-xs">
                          {target.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {isLoggedIn && (
                    <span className="flex shrink-0 items-center gap-1 text-sm text-green-600">
                      <Check className="h-4 w-4" />
                      logged in
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AiQuickLoginButton(props: {
  targetId?: string;
  variant?: React.ComponentProps<typeof Button>['variant'];
  size?: React.ComponentProps<typeof Button>['size'];
  className?: string;
  children?: React.ReactNode;
}) {
  const open = useStoreWithAiQuickLogin((s) => s.aiQuickLogin.open);

  return (
    <Button
      variant={props.variant || 'secondary'}
      size={props.size || 'sm'}
      className={props.className}
      onClick={() => open(props.targetId)}
    >
      <LogIn className="mr-2 h-4 w-4" />
      {props.children || 'Login'}
    </Button>
  );
}
