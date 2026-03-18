import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sqlrooms/ui';

type PageSizeSelectProps = {
  pageSize: number;
  onPageSizeChange: (pageSize: number) => void;
  pageSizes?: number[];
};

export const PageSizeSelect: React.FC<PageSizeSelectProps> = ({
  pageSize,
  onPageSizeChange,
  pageSizes = [10, 50, 100, 500, 1000],
}) => {
  return (
    <Select
      value={String(pageSize)}
      onValueChange={(value) => onPageSizeChange(Number(value))}
    >
      <SelectTrigger className="hidden h-7 w-[110px] lg:inline-flex">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {pageSizes.map((size) => (
          <SelectItem key={size} value={String(size)}>
            {`${size} rows`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
