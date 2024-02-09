import {Flex, Text, Textarea, VStack} from '@chakra-ui/react';
import {EditableText} from '@sqlrooms/components';
import {useBaseProjectStore} from '@sqlrooms/project-builder';
import {
  DEFAULT_PROJECT_TITLE,
  ProjectPanelTypes,
} from '@sqlrooms/project-config';
import {useCallback} from 'react';
import ProjectBuilderPanelHeader from '../ProjectBuilderPanelHeader';

export default function ProjectDetailsPanel() {
  const title = useBaseProjectStore((state) => state.projectConfig.title);
  const isReadOnly = useBaseProjectStore((state) => state.isReadOnly);
  const setProjectTitle = useBaseProjectStore((state) => state.setProjectTitle);
  const description = useBaseProjectStore(
    (state) => state.projectConfig.description,
  );
  const setDescription = useBaseProjectStore((state) => state.setDescription);

  const handleSetProjectTitle = useCallback(
    (title: string) => {
      const nextTitle = title.trim() || DEFAULT_PROJECT_TITLE;
      setProjectTitle(nextTitle);
      return nextTitle; // Pass corrected title to EditableText
    },
    [setProjectTitle],
  );

  return (
    <Flex flexDir="column" flexGrow={1} gap={3}>
      <ProjectBuilderPanelHeader panelKey={ProjectPanelTypes.PROJECT_DETAILS} />
      <VStack gap={3} alignItems="stretch" flexGrow="1">
        <VStack alignItems="flex-start">
          <Text
            color="gray.400"
            fontWeight="bold"
            textTransform="uppercase"
            fontSize="xs"
          >
            Title
          </Text>
          {/* <Input
            value={title}
            onChange={(e) => setProjectTitle(e.target.value)}
            bg={'gray.800'}
            color={'white'}
            _placeholder={{color: 'gray.600'}}
            placeholder="A descriptive title for the project"
            maxLength={128}
            size="sm"
          /> */}
          <Flex overflow="hidden" width="100%" fontSize="sm">
            {isReadOnly ? (
              title
            ) : (
              <EditableText
                isDisabled={isReadOnly}
                value={title}
                width="100%"
                placeholder={DEFAULT_PROJECT_TITLE}
                onChange={handleSetProjectTitle}
                bg={'gray.700'}
                color={'white'}
              />
            )}
          </Flex>
        </VStack>

        <VStack alignItems="flex-start" flexGrow="1">
          <Text
            color="gray.400"
            fontWeight="bold"
            textTransform="uppercase"
            fontSize="xs"
          >
            Description
          </Text>
          {isReadOnly ? (
            <Text fontSize="xs">{description}</Text>
          ) : (
            <Textarea
              minHeight={0}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              size="sm"
              fontSize="xs"
              // rows={10}
              bg={'gray.700'}
              color={'gray.200'}
              border="none"
              _placeholder={{color: 'gray.600'}}
              placeholder="A story behind this project, what it represents"
              maxLength={4096}
              flexGrow="1"
              resize="none"
            />
          )}
        </VStack>
      </VStack>
    </Flex>
  );
}
