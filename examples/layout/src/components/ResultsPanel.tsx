import {TableRowsSplitIcon} from 'lucide-react';
import {FC} from 'react';

export const ResultsPanel: FC = () => (
  <div className="flex h-full flex-col gap-3 p-4">
    <div className="flex items-center gap-2 text-sm font-medium">
      <TableRowsSplitIcon className="h-4 w-4" />
      Results
    </div>
    <div className="overflow-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-border border-b">
            <th className="p-2 text-left font-medium">id</th>
            <th className="p-2 text-left font-medium">name</th>
            <th className="p-2 text-left font-medium">value</th>
            <th className="p-2 text-left font-medium">created_at</th>
          </tr>
        </thead>
        <tbody>
          {[
            {id: 1, name: 'Alpha', value: 342.5, date: '2024-01-15'},
            {id: 2, name: 'Beta', value: 128.3, date: '2024-01-14'},
            {id: 3, name: 'Gamma', value: 567.1, date: '2024-01-13'},
            {id: 4, name: 'Delta', value: 201.9, date: '2024-01-12'},
            {id: 5, name: 'Epsilon', value: 445.7, date: '2024-01-11'},
          ].map((row) => (
            <tr key={row.id} className="border-border border-b">
              <td className="p-2">{row.id}</td>
              <td className="p-2">{row.name}</td>
              <td className="p-2">{row.value}</td>
              <td className="p-2">{row.date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);
