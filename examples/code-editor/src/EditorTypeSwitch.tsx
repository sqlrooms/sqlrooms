import {Button} from '@sqlrooms/ui';

export type EditorType = 'monaco' | 'codemirror';

interface EditorTypeSwitchProps {
  value: EditorType;
  onChange: (value: EditorType) => void;
}

export const EditorTypeSwitch: React.FC<EditorTypeSwitchProps> = ({
  value,
  onChange,
}) => {
  return (
    <div className="border-border bg-muted flex gap-1 rounded-md border p-1">
      <Button
        onClick={() => onChange('monaco')}
        variant={value === 'monaco' ? 'default' : 'ghost'}
        size="sm"
        className="h-8 px-3"
      >
        Monaco
      </Button>
      <Button
        onClick={() => onChange('codemirror')}
        variant={value === 'codemirror' ? 'default' : 'ghost'}
        size="sm"
        className="h-8 px-3"
      >
        CodeMirror
      </Button>
    </div>
  );
};
