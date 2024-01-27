import {Flex, Select, Text} from '@chakra-ui/react';
import {QueryDataTable} from '@flowmapcity/data-table';
import {
  FlowmapViewStateProvider,
  useFlowmapViewState,
} from '@flowmapcity/flowmap';
import {getFlowsFilterClause} from '@flowmapcity/flowmap/src/views/flowmap/data/layers-data';
import {ProjectBuilderPanelHeader} from '@flowmapcity/project-builder';
import {ProjectPanelTypes} from '@flowmapcity/project-config';
import {FC, useMemo, useState} from 'react';

type Props = {
  // ...
};

const OPTIONS = ['flows', 'locations'];
const DataTablesPanel: FC<Props> = () => {
  const preparedDataSchema = useFlowmapViewState((s) => s.preparedDataSchema);

  const filterClause = useFlowmapViewState((state) =>
    getFlowsFilterClause(state),
  );

  const isDataAvailable = useFlowmapViewState((s) => s.isDataAvailable());
  const [selectedTable, setSelectedTable] = useState(OPTIONS[0]);

  const query = useMemo(() => {
    switch (selectedTable) {
      case 'flows':
        return `FROM 
          ${preparedDataSchema}.flows f 
          LEFT JOIN ${preparedDataSchema}.locations o ON f.origin = o.id
          LEFT JOIN ${preparedDataSchema}.locations d ON f.dest = d.id
        SELECT 
          o.name AS origin_name, d.name AS dest_name,
          f.*,
        WHERE ${filterClause}`;
      case 'locations':
        return `SELECT * FROM ${preparedDataSchema}.locations`;
    }
  }, [filterClause, preparedDataSchema, selectedTable]);

  return (
    <Flex flexDir="column" flexGrow={1} gap={3} height="100%">
      <ProjectBuilderPanelHeader panelKey={ProjectPanelTypes.DATA_TABLES} />
      {isDataAvailable && query ? (
        <>
          <Flex flexDir="row" gap="3" alignItems="center">
            <Text fontSize="sm">Table</Text>
            <Flex>
              <Select
                size="xs"
                onChange={(evt) => setSelectedTable(evt.target.value)}
                value={selectedTable}
              >
                {OPTIONS.map((opt) => (
                  <option value={opt} key={opt}>
                    {opt}
                  </option>
                ))}
              </Select>
            </Flex>
          </Flex>
          <Flex flexGrow="1" overflow="auto">
            <QueryDataTable query={query} />
          </Flex>
        </>
      ) : null}
    </Flex>
  );
};

const FlowmapDataTablesPanel: FC<Props> = () => {
  return (
    <FlowmapViewStateProvider viewId={'flowmap'}>
      <DataTablesPanel />
    </FlowmapViewStateProvider>
  );
};

export default FlowmapDataTablesPanel;
