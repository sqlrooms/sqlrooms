import {Flex} from '@chakra-ui/react';
import {useBaseProjectStore} from '@sqlrooms/project-builder';
import {SqlQueryDataSource} from '@sqlrooms/project-config';
import {FC} from 'react';
import SqlQueryDataSourcesCard from './SqlQueryDataSourcesCard';
type Props = {
  queryDataSources: SqlQueryDataSource[];
};
const SqlQueryDataSourcesPanel: FC<Props> = (props) => {
  const {queryDataSources} = props;

  const isReadOnly = useBaseProjectStore((state) => state.isReadOnly);
  return (
    <Flex flexDir="column" overflow="auto" flexGrow="1">
      {queryDataSources.map((ds, i) => (
        <SqlQueryDataSourcesCard
          key={i}
          isReadOnly={isReadOnly}
          dataSource={ds}
        />
      ))}
    </Flex>
  );
};

export default SqlQueryDataSourcesPanel;
