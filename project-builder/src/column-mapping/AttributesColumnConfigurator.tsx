import {Flex, Heading, useToast} from '@chakra-ui/react';
import {AppContext, InfoBox} from '@flowmapcity/components';
import {
  DuckQueryError,
  escapeId,
  getAttributeColumnType,
} from '@flowmapcity/duckdb';
import {
  AttributeType,
  AttributesList,
  ColumnMapping,
} from '@flowmapcity/project-config';
import {convertToUniqueColumnOrTableName} from '@flowmapcity/utils';
import {produce} from 'immer';
import {FC, useContext} from 'react';
import {useProjectStore} from '../ProjectStateProvider';
import {
  AttributesColumnsList,
  Props as AttributesColumnsListProps,
} from './AttributesColumnsList';
import ColumnOrExpressionSelect from './ColumnOrExpressionSelect';
import {InputColumnOption} from './FieldSelect';

type Props = {
  mode: 'attributes' | 'partitionBy';
  title: string;
  helpText: string;
  buttonLabel: string;
  buttonIcon: React.ReactElement;
  onChange: (columnMapping: ColumnMapping | undefined) => void;
  columnMapping?: ColumnMapping;
  unusedInputColumns: Array<InputColumnOption>;
} & Omit<AttributesColumnsListProps, 'onChange'>;

export const AttributesColumnConfigurator: FC<Props> = (props) => {
  const {
    mode,
    title,
    helpText,
    buttonLabel,
    buttonIcon,
    columnMapping,
    usedOutputColNames,
    unusedInputColumns,
    onChange,
  } = props;
  const {captureException} = useContext(AppContext);
  const isReadOnly = useProjectStore((state) => state.isReadOnly);
  const toast = useToast();

  const handleAttrsChange = (attributes?: AttributesList) => {
    if (!columnMapping) return;
    const nextResult = produce(columnMapping, (draft) => {
      draft[mode] = attributes;
    });
    onChange(nextResult);
  };

  const handleAddAttribute = async (columnName: string) => {
    if (!columnMapping?.tableName || !unusedInputColumns.length) return;

    let type: AttributeType | undefined;
    try {
      type = await getAttributeColumnType(
        columnMapping.tableName,
        escapeId(columnName),
      );
    } catch (err) {
      toast({
        title: `Could not add attribute`,
        description:
          err instanceof DuckQueryError ? err.getMessageForUser() : `${err}`,
        status: 'error',
        duration: 5000,
        isClosable: true,
        position: 'top',
      });
      console.error(err);
      captureException(err);
      return;
    }

    onChange(
      produce(columnMapping, (draft) => {
        // TODO:
        const newColName = convertToUniqueColumnOrTableName(
          columnName,
          usedOutputColNames,
        );
        const cols = draft[mode] ?? [];
        cols.push({
          label: columnName,
          column: newColName,
          expression: escapeId(columnName),
          type,
        });
        draft[mode] = cols;
      }),
    );
  };

  return (
    <Flex flexDir="column" gap="3">
      <Flex flexDir="column" gap="3">
        <Flex>
          <InfoBox content={helpText}>
            <Heading fontSize="xs" textTransform="uppercase" color="gray.400">
              {title}
            </Heading>
          </InfoBox>
        </Flex>

        {!isReadOnly ? (
          <ColumnOrExpressionSelect
            title={buttonLabel}
            icon={buttonIcon}
            onSelect={handleAddAttribute}
            unusedInputColumns={unusedInputColumns}
          />
        ) : null}
      </Flex>
      <AttributesColumnsList {...props} onChange={handleAttrsChange} />
    </Flex>
  );
};

export default AttributesColumnConfigurator;
