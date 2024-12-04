import {
  Button,
  HStack,
  Icon,
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  Radio,
  RadioGroup,
  Slider,
  SliderFilledTrack,
  SliderThumb,
  SliderTrack,
  Text,
  VStack,
} from '@chakra-ui/react';
import {ChevronLeftIcon, ChevronRightIcon} from '@heroicons/react/24/outline';
import {
  AdjustmentsHorizontalIcon,
  PauseIcon,
  PlayIcon,
} from '@heroicons/react/24/solid';
import {FC, useEffect} from 'react';
import {TimelineMode} from '@sqlrooms/project-config';

interface Props {
  darkMode: boolean;
  isPlaying: boolean;
  isDisabled: boolean;
  speed: number;
  mode: TimelineMode;
  onTogglePlay: () => void;
  onStepForward: () => void;
  onStepBackward: () => void;
  onSpeedChange: (speed: number) => void;
  onModeChange: (mode: TimelineMode) => void;
}

const PlayControl: FC<Props> = ({
  isPlaying,
  isDisabled,
  speed,
  mode,
  onTogglePlay,
  onStepForward,
  onStepBackward,
  onSpeedChange,
  onModeChange,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        isDisabled ||
        !document.activeElement?.closest('[data-timeline-container]')
      )
        return;

      if (e.key === 'ArrowLeft') {
        onStepBackward();
      } else if (e.key === 'ArrowRight') {
        onStepForward();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDisabled, onStepBackward, onStepForward]);

  const iconSize = 10;
  return (
    <HStack spacing={1}>
      <VStack spacing={1}>
        <HStack>
          <Button
            w={12}
            h={12}
            variant="ghost"
            color="gray.400"
            isDisabled={isDisabled}
            onClick={onTogglePlay}
          >
            <Icon
              w={iconSize}
              h={iconSize}
              as={isPlaying ? PauseIcon : PlayIcon}
            />
          </Button>
          <Popover placement="top">
            <PopoverTrigger>
              <Button
                w={8}
                h={8}
                variant="ghost"
                color="gray.400"
                isDisabled={isDisabled}
              >
                <Icon w={5} h={5} as={AdjustmentsHorizontalIcon} />
              </Button>
            </PopoverTrigger>
            <PopoverContent w="200px">
              <PopoverBody>
                <VStack spacing={4} align="stretch">
                  <VStack spacing={2} align="stretch">
                    <Text fontSize="sm">Animation Speed</Text>
                    <Slider
                      min={-1}
                      max={1}
                      step={0.1}
                      value={Math.log10(speed)}
                      onChange={(value) => onSpeedChange(Math.pow(10, value))}
                    >
                      <SliderTrack>
                        <SliderFilledTrack />
                      </SliderTrack>
                      <SliderThumb />
                    </Slider>
                    <Text fontSize="xs" textAlign="center">
                      {speed < 1
                        ? `${speed.toFixed(2)}x`
                        : `${speed.toFixed(1)}x`}
                    </Text>
                  </VStack>

                  <VStack spacing={2} align="stretch">
                    <Text fontSize="sm">Animation Mode</Text>
                    <RadioGroup
                      value={mode}
                      onChange={(value) => onModeChange(value as TimelineMode)}
                      size="sm"
                    >
                      <VStack align="start" spacing={1}>
                        <Radio value="sliding">
                          <Text fontSize="xs">Sliding Window</Text>
                        </Radio>
                        <Radio value="incremental">
                          <Text fontSize="xs">Incremental</Text>
                        </Radio>
                      </VStack>
                    </RadioGroup>
                  </VStack>
                </VStack>
              </PopoverBody>
            </PopoverContent>
          </Popover>
        </HStack>
        <HStack spacing={1}>
          <Button
            w={6}
            h={6}
            variant="ghost"
            color="gray.400"
            isDisabled={isDisabled || isPlaying}
            onClick={onStepBackward}
          >
            <Icon w={5} h={5} as={ChevronLeftIcon} />
          </Button>
          <Button
            w={6}
            h={6}
            variant="ghost"
            color="gray.400"
            isDisabled={isDisabled || isPlaying}
            onClick={onStepForward}
          >
            <Icon w={5} h={5} as={ChevronRightIcon} />
          </Button>
        </HStack>
      </VStack>
    </HStack>
  );
};

export default PlayControl;
