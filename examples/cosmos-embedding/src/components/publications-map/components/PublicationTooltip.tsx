import {FC} from 'react';
import {z} from 'zod';
import {publicationSchema} from '../hooks/usePublicationsData';

type Publication = z.infer<typeof publicationSchema>;

interface PublicationTooltipProps {
  publication: Publication;
  fieldColor: string;
}

export const PublicationTooltip: FC<PublicationTooltipProps> = ({
  publication,
  fieldColor,
}) => {
  return (
    <div className="flex flex-col gap-1 text-xs">
      <div className="text-xs font-medium text-gray-900 dark:text-gray-100 mb-1.5">
        {publication.title}
      </div>
      <div className="flex items-center gap-1.5 dark:text-gray-400 text-gray-900">
        <span
          className="px-1.5 py-0.5 rounded text-gray-100"
          style={{backgroundColor: fieldColor}}
        >
          {publication.mainField}
        </span>
      </div>
      <div className="text-gray-400">
        Published: {publication.publishedOn.getFullYear()}
      </div>
      <div className="text-gray-400">
        Citations: {publication.numCitations.toLocaleString()}
      </div>
    </div>
  );
};
