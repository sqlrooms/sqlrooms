import {
  Button,
  HStack,
  Icon,
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  Slider,
  SliderFilledTrack,
  SliderThumb,
  SliderTrack,
  Text,
  VStack,
} from '@chakra-ui/react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import {
  AdjustmentsHorizontalIcon,
  PauseIcon,
  PlayIcon,
} from '@heroicons/react/24/solid';
import { TimeInterval } from 'd3-time';
import { FC, useCallback, useEffect, useRef } from 'react';

interface Props {
  darkMode: boolean;
  current: Date;
  timeExtent: [Date, Date];
  interval: TimeInterval;
  /**
   * `speed` controls how much time advances per update (e.g., 100ms * 2 = 200ms)
   */
  speed: number;
  isPlaying: boolean;
  isDisabled: boolean;
  onPlay: () => void;
  onPause: () => void;
  onAdvance: (date: Date) => void;
  onSpeedChange?: (speed: number) => void;
}

/**
 * Controls how frequently the animation updates (in milliseconds)
 */
const updateInterval = 50;

const PlayControl: FC<Props> = ({
  current,
  timeExtent,
  interval,
  speed = 1,
  isPlaying,
  isDisabled,
  onPlay,
  onPause,
  onAdvance,
  onSpeedChange,
}) => {
  const playTimeoutRef = useRef<NodeJS.Timeout>();
  const partialStepRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (playTimeoutRef.current) {
        clearTimeout(playTimeoutRef.current);
      }
    };
  }, []);

  const clearPlayTimeout = useCallback(() => {
    if (playTimeoutRef.current != null) {
      clearTimeout(playTimeoutRef.current);
      playTimeoutRef.current = undefined;
    }
  }, []);

  const nextStep = useCallback(() => {
    if (isPlaying) {
      if (speed >= 1) {
        // For normal/fast speeds, behavior stays the same
        const next = interval.offset(current, Math.floor(speed));
        if (next > timeExtent[1]) {
          onAdvance(timeExtent[0]);
        } else {
          onAdvance(next);
        }
      } else {
        // For slow speeds, accumulate partial steps
        // (because interval.offset() is flooring to interval boundaries)
        partialStepRef.current += speed;
        if (partialStepRef.current >= 1) {
          // We have accumulated enough for a full step
          const next = interval.offset(current, 1);
          partialStepRef.current -= 1; // Subtract the used step
          if (next > timeExtent[1]) {
            onAdvance(timeExtent[0]);
          } else {
            onAdvance(next);
          }
        }
      }
      scheduleNextStep();
    }
  }, [isPlaying, interval, timeExtent, current, speed, onAdvance]);

  const scheduleNextStep = useCallback(() => {
    clearPlayTimeout();
    playTimeoutRef.current = setTimeout(nextStep, updateInterval);
  }, [clearPlayTimeout, nextStep]);

  useEffect(() => {
    if (isPlaying) {
      scheduleNextStep();
    } else {
      clearPlayTimeout();
    }
  }, [isPlaying, scheduleNextStep, clearPlayTimeout]);

  const start = useCallback(() => {
    if (!isPlaying) {
      if (current >= timeExtent[1]) {
        onAdvance(timeExtent[0]);
      }
      onPlay();
    }
  }, [isPlaying, onPlay, current, timeExtent, onAdvance]);

  const stop = useCallback(() => {
    clearPlayTimeout();
    partialStepRef.current = 0;
    if (isPlaying) {
      onPause();
    }
  }, [clearPlayTimeout, isPlaying, onPause]);

  const handleTogglePlay = useCallback(() => {
    if (isPlaying) {
      stop();
    } else {
      start();
    }
  }, [isPlaying, stop, start]);

  const stepBackward = useCallback(() => {
    if (!isPlaying) {
      const next = interval.offset(current, -1);
      if (next >= timeExtent[0]) {
        onAdvance(next);
      }
    }
  }, [isPlaying, interval, current, timeExtent, onAdvance]);

  const stepForward = useCallback(() => {
    if (!isPlaying) {
      const next = interval.offset(current, 1);
      if (next <= timeExtent[1]) {
        onAdvance(next);
      }
    }
  }, [isPlaying, interval, current, timeExtent, onAdvance]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        isDisabled ||
        !document.activeElement?.closest('[data-timeline-container]')
      )
        return;

      if (e.key === 'ArrowLeft') {
        stepBackward();
      } else if (e.key === 'ArrowRight') {
        stepForward();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDisabled, stepBackward, stepForward]);

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
            onClick={handleTogglePlay}
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
                <VStack spacing={2} align="stretch">
                  <Text fontSize="sm">Animation Speed</Text>
                  <Slider
                    min={-1}
                    max={1}
                    step={0.01}
                    value={Math.log10(speed)}
                    onChange={(value) => onSpeedChange?.(Math.pow(10, value))}
                  >
                    <SliderTrack>
                      <SliderFilledTrack />
                    </SliderTrack>
                    <SliderThumb />
                  </Slider>
                  <Text fontSize="xs" textAlign="center">
                    {speed.toFixed(1)}x
                  </Text>
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
            onClick={stepBackward}
          >
            <Icon w={5} h={5} as={ChevronLeftIcon} />
          </Button>
          <Button
            w={6}
            h={6}
            variant="ghost"
            color="gray.400"
            isDisabled={isDisabled || isPlaying}
            onClick={stepForward}
          >
            <Icon w={5} h={5} as={ChevronRightIcon} />
          </Button>
        </HStack>
      </VStack>
    </HStack>
  );
};

export default PlayControl;
