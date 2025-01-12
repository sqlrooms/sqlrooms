import {
  Button,
  HStack,
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
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  AdjustmentsHorizontalIcon,
  PauseIcon,
  PlayIcon,
} from '@heroicons/react/24/solid';
import type {ComponentType} from 'react';
import {FC, useEffect} from 'react';
import {TimelineMode} from './TimelineConfig';

// Cast icons to ComponentType to fix TypeScript errors
const PlayIconComponent = PlayIcon as ComponentType<{
  width: number;
  height: number;
  className: string;
}>;
const PauseIconComponent = PauseIcon as ComponentType<{
  width: number;
  height: number;
  className: string;
}>;
const AdjustmentsIconComponent = AdjustmentsHorizontalIcon as ComponentType<{
  width: number;
  height: number;
  className: string;
}>;
const ChevronLeftIconComponent = ChevronLeftIcon as ComponentType<{
  width: number;
  height: number;
  className: string;
}>;
const ChevronRightIconComponent = ChevronRightIcon as ComponentType<{
  width: number;
  height: number;
  className: string;
}>;

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
            {isPlaying ? (
              <PauseIconComponent
                width={iconSize * 4}
                height={iconSize * 4}
                className="text-current"
              />
            ) : (
              <PlayIconComponent
                width={iconSize * 4}
                height={iconSize * 4}
                className="text-current"
              />
            )}
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
                <AdjustmentsIconComponent
                  width={20}
                  height={20}
                  className="text-current"
                />
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
            <ChevronLeftIconComponent
              width={20}
              height={20}
              className="text-current"
            />
          </Button>
          <Button
            w={6}
            h={6}
            variant="ghost"
            color="gray.400"
            isDisabled={isDisabled || isPlaying}
            onClick={onStepForward}
          >
            <ChevronRightIconComponent
              width={20}
              height={20}
              className="text-current"
            />
          </Button>
        </HStack>
      </VStack>
    </HStack>
  );
};

export default PlayControl;
