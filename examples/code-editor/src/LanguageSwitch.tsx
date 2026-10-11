import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sqlrooms/ui';

export type Language = 'json' | 'duckdb' | 'javascript';

interface LanguageSwitchProps {
  value: Language;
  onChange: (value: Language) => void;
}

export const LanguageSwitch: React.FC<LanguageSwitchProps> = ({
  value,
  onChange,
}) => {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-32">
        <SelectValue placeholder="Select language" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="json">JSON</SelectItem>
        <SelectItem value="duckdb">DuckDB</SelectItem>
        <SelectItem value="javascript">JavaScript</SelectItem>
      </SelectContent>
    </Select>
  );
};
