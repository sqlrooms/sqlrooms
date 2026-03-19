import React from 'react';

export interface DiagnosticTooltipProps {
  message: string;
  code?: string | number | null;
}

export function DiagnosticTooltip({message, code}: DiagnosticTooltipProps) {
  return (
    <div className="text-foreground px-2">
      <span>{message}</span>
      {code && (
        <span className="text-muted-foreground opacity-70"> ({code})</span>
      )}
    </div>
  );
}
