import {Button, Icon} from '@chakra-ui/react';
import {PauseIcon, PlayIcon} from '@heroicons/react/24/solid';
import {TimeInterval} from 'd3-time';
import React from 'react';

interface Props {
  darkMode: boolean;
  current: Date;
  timeExtent: [Date, Date];
  interval: TimeInterval;
  /**
   * Controls how frequently the animation updates (in milliseconds)
   */
  updateInterval: number;
  /**
   * `speed` controls how much time advances per update (e.g., 100ms * 2 = 200ms)
   */
  speed: number;
  isPlaying: boolean;
  isDisabled: boolean;
  onPlay: () => void;
  onPause: () => void;
  onAdvance: (date: Date) => void;
}

class PlayControl extends React.Component<Props> {
  playTimeout: NodeJS.Timeout | undefined;
  static defaultProps = {
    speed: 1,
    updateInterval: 200,
  };

  componentWillUnmount(): void {
    this.clearPlayTimeOut();
  }

  start = () => {
    const {isPlaying, onPlay} = this.props;
    if (!isPlaying) {
      const {timeExtent, current, onAdvance} = this.props;
      onPlay();
      this.scheduleNextStep();
      if (current >= timeExtent[1]) {
        // rewind
        onAdvance(timeExtent[0]);
      }
    }
  };

  stop = () => {
    this.clearPlayTimeOut();
    const {isPlaying, onPause} = this.props;
    if (isPlaying) {
      onPause();
    }
  };

  clearPlayTimeOut = () => {
    if (this.playTimeout != null) {
      clearTimeout(this.playTimeout);
      this.playTimeout = undefined;
    }
  };

  scheduleNextStep = () => {
    this.clearPlayTimeOut();
    const {updateInterval} = this.props;
    this.playTimeout = setTimeout(this.nextStep, updateInterval);
  };

  nextStep = () => {
    const {isPlaying, speed} = this.props;
    if (isPlaying) {
      const {interval, timeExtent, current, onAdvance} = this.props;
      // @ts-ignore
      const numSteps = interval.count(timeExtent[0], timeExtent[1]);
      const next = interval.offset(
        current,
        speed * Math.max(1, Math.floor(numSteps / 60)),
      );
      if (next > timeExtent[1]) {
        this.stop();
      } else {
        onAdvance(next);
        this.scheduleNextStep();
      }
    }
  };

  render() {
    const {isPlaying} = this.props;
    const handleTogglePlay = () => {
      if (isPlaying) {
        this.stop();
      } else {
        this.start();
      }
    };

    const iconSize = 10;
    const buttonSize = 12;
    return (
      <Button
        w={buttonSize}
        h={buttonSize}
        variant="ghost"
        color="gray.400"
        isDisabled={this.props.isDisabled}
        onClick={handleTogglePlay}
      >
        <Icon w={iconSize} h={iconSize} as={isPlaying ? PauseIcon : PlayIcon} />
      </Button>
    );
  }
}

export default PlayControl;
