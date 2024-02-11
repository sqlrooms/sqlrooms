import {Box, HStack, Text, useTheme, VStack} from '@chakra-ui/react';
import styled from '@emotion/styled';
import {formatDate} from '@sqlrooms/utils';
import {max} from 'd3-array';
import {scaleLinear, ScaleTime, scaleTime} from 'd3-scale';
import {EventManager} from 'mjolnir.js';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useMeasure, useThrottle} from 'react-use';
import PlayControl from './PlayControl';
import {areRangesEqual, tickMultiFormat, TimeGranularity} from './time';

interface Props {
  selectedRange: [Date, Date];
  timeExtent: [Date, Date];
  totalCountsByTime: CountByTime[];
  darkMode: boolean;
  timeGranularity: TimeGranularity;
  onChange: (range: [Date, Date]) => void;
}

export interface CountByTime {
  time: Date;
  count: number;
}

const AXIS_AREA_HEIGHT = 15;

const handleWidth = 6;
const handleHGap = 6;

const margin = {
  top: 6,
  bottom: 6,
  left: 10,
  right: 10,
};

const TimelineSvg = styled.svg<{darkMode: boolean}>(() => ({
  cursor: 'pointer',
  // backgroundColor: theme.colors.gray[700],
}));

const OuterRect = styled.rect({
  cursor: 'crosshair',
  fill: 'rgba(255,255,255,0)',
  stroke: 'none',
});

const HandleOuter = styled.g<{darkMode: boolean}>(() => {
  const theme = useTheme();
  return {
    cursor: 'ew-resize',
    '& > path': {
      stroke: theme.colors.gray[700],
      transition: 'fill 0.2s',
      fill: theme.colors.gray[300],
    },
    '&:hover path': {
      fill: theme.colors.gray[100],
    },
  };
});

const HandlePath = styled.path({
  strokeWidth: 1,
} as any);

const HandleHoverTarget = styled.rect({
  fillOpacity: 0,
});

const SelectedRangeRect = styled.rect({
  cursor: 'move',
  transition: 'fill-opacity 0.2s',
  fillOpacity: 0.3,
  '&:hover': {
    fillOpacity: 0.4,
  },
});

const AxisPath = styled.path({
  fill: 'none',
  opacity: 0.5,
  shapeRendering: 'crispEdges',
} as any);

const TickLine = styled.line({
  fill: 'none',
  opacity: 0.5,
  shapeRendering: 'crispEdges',
} as any);

const TickText = styled.text<{darkMode: boolean}>(() => ({
  fontSize: 10,
  textAnchor: 'start',
}));

const Bar = styled.rect<{darkMode: boolean}>(() => ({
  // props.darkMode ? Colors.LIGHT_GRAY1 : ColorScheme.primary,
  stroke: 'none',
  // stroke: props.darkMode
  //   ? schemeTeal[3]
  //   : hcl(ColorScheme.primary).darker().toString(),
}));

type Side = 'start' | 'end';

interface HandleProps {
  width: number;
  height: number;
  darkMode: boolean;
  side: Side;
  onMove: (pos: number, side: Side) => void;
}
const TimelineHandle: React.FC<HandleProps> = (props) => {
  const {width, height, side, darkMode, onMove} = props;
  const theme = useTheme();
  const handleMoveRef = useRef<any>();
  handleMoveRef.current = ({center}: any) => {
    onMove(center.x, side);
  };
  const ref = useRef<SVGRectElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const eventManager = new EventManager(
      ref.current as unknown as HTMLElement,
      {},
    );
    if (handleMoveRef.current) {
      eventManager.on('panstart', handleMoveRef.current);
      eventManager.on('panmove', handleMoveRef.current);
      eventManager.on('panend', handleMoveRef.current);
    }
    return () => {
      // eventManager.off('panstart', handleMove);
      // eventManager.off('panmove', handleMove);
      // eventManager.off('panend', handleMove);
      eventManager.destroy();
    };
  }, [handleMoveRef]);

  const [w, h] = [width, width];
  return (
    <HandleOuter darkMode={darkMode}>
      <HandlePath
        transform={`translate(${side === 'start' ? 0 : width},0)`}
        d={
          side === 'start'
            ? `M0,${h} Q${-w},${h} ${-w},0 L0,0 0,${height} ${-w},${height} Q${-w},${
                height - h
              } 0,${height - h} z`
            : `M0,${h} Q${w},${h} ${w},0 L0,0 0,${height} ${w},${height} Q${w},${
                height - h
              } 0,${height - h} z`
        }
      />
      <HandleHoverTarget
        x={side === 'start' ? -w : w}
        ref={ref}
        fill={theme.colors.gray[400]}
        height={height}
        width={width}
      />
    </HandleOuter>
  );
};

interface TimelineChartProps extends Props {
  width: number;
  height: number;
}

type MoveSideHandler = (pos: number, side: Side) => void;

const Bars = React.memo(
  (props: {
    height: number;
    totalCountsByTime: CountByTime[];
    darkMode: boolean;
    timeGranularity: TimeGranularity;
    timeScale: ScaleTime<number, number>;
  }) => {
    const {height, totalCountsByTime, timeGranularity, timeScale, darkMode} =
      props;
    const totalCountScale = scaleLinear()
      .domain([0, max(totalCountsByTime, (d) => d.count) ?? 0])
      .range([0, height]);

    const theme = useTheme();
    // TODO: timeline bars in canvas render using
    return (
      <>
        {props.totalCountsByTime.map(({time, count}) => (
          <Bar
            fill={theme.colors.gray[300]}
            darkMode={darkMode}
            key={time.getTime()}
            x={timeScale(time)}
            y={height - totalCountScale(count)!}
            width={Math.max(
              timeScale(timeGranularity.interval.offset(time))! -
                timeScale(time)! -
                1,
              1,
            )}
            height={totalCountScale(count)}
          />
        ))}
      </>
    );
  },
);
Bars.displayName = 'Bars';

function getAllSelected(selectedRange: any, timeExtent: any) {
  return (
    selectedRange[0].getTime() === timeExtent[0].getTime() &&
    selectedRange[1].getTime() === timeExtent[1].getTime()
  );
}

const TimelineChart: React.FC<TimelineChartProps> = React.memo((props) => {
  const {
    width,
    height,
    timeExtent,
    selectedRange,
    timeGranularity,
    totalCountsByTime,
    darkMode,
    onChange,
  } = props;

  const chartHeight = height - margin.top - margin.bottom;
  const handleHeight = chartHeight + handleHGap * 2;
  const chartWidth = width - margin.left - margin.right;
  const timeScale = useMemo(
    () => scaleTime().domain(timeExtent).range([0, chartWidth]),
    [timeExtent, chartWidth],
  );

  const [offset, setOffset] = useState<number>();
  const [panStart, setPanStart] = useState<Date>();

  const svgRef = useRef<SVGSVGElement>(null);
  const outerRectRef = useRef<SVGRectElement>(null);
  const selectedRangeRectRef = useRef<SVGRectElement>(null);

  const mousePosition = (absPos: number) => {
    const {current} = svgRef;
    if (current != null) {
      const {left} = current.getBoundingClientRect();
      return absPos - left - margin.left;
    }
    return undefined;
  };

  const timeFromPos = (pos: number) => {
    const relPos = mousePosition(pos);
    if (relPos != null) return timeScale.invert(relPos);
    return undefined;
  };

  const handleMoveRef = useRef<any>();
  handleMoveRef.current = ({center}: any) => {
    if (offset == null) {
      const pos = mousePosition(center.x);
      if (pos != null) {
        const selectedPos = timeScale(selectedRange[0]);
        if (selectedPos != null) {
          setOffset(selectedPos - pos);
        }
      }
    } else {
      let nextStart = timeFromPos(center.x + offset);
      if (nextStart) {
        const {interval} = timeGranularity;
        nextStart = interval.round(nextStart);
        if (nextStart) {
          const length = (interval as any).count(
            selectedRange[0],
            selectedRange[1],
          );
          let nextEnd = interval.offset(nextStart, length);
          if (nextStart < timeExtent[0]) {
            nextStart = timeExtent[0];
            nextEnd = interval.offset(timeExtent[0], length);
          }
          if (nextEnd > timeExtent[1]) {
            nextStart = interval.offset(timeExtent[1], -length);
            nextEnd = timeExtent[1];
          }
          onChange([nextStart, nextEnd]);
        }
      }
    }
  };
  const handleMove = (evt: any) => handleMoveRef.current(evt);
  const handleMoveEnd = (evt: any) => {
    handleMoveRef.current(evt);
    setOffset(undefined);
  };

  const handleClickRef = useRef<any>();
  handleClickRef.current = () => {
    onChange(timeExtent);
  };
  const handleClick = (evt: any) => handleClickRef.current(evt);

  const handlePanStartRef = useRef<any>();
  handlePanStartRef.current = ({center}: any) => {
    let start = timeFromPos(center.x);
    if (start) {
      start = timeGranularity.interval.round(start);
      if (start < timeExtent[0]) start = timeExtent[0];
      if (start > timeExtent[1]) start = timeExtent[1];
      setPanStart(start);
      onChange([start, start]);
    }
  };
  const handlePanStart = (evt: any) => handlePanStartRef.current(evt);

  const handlePanMoveRef = useRef<any>();
  handlePanMoveRef.current = ({center}: any) => {
    let end = timeFromPos(center.x);
    if (panStart && end) {
      end = timeGranularity.interval.round(end);
      if (end < timeExtent[0]) end = timeExtent[0];
      if (end > timeExtent[1]) end = timeExtent[1];
      const range: [Date, Date] =
        panStart < end ? [panStart, end] : [end, panStart];
      onChange(range);
    }
  };
  const handlePanMove = (evt: any) => handlePanMoveRef.current(evt);
  const handlePanEnd = (evt: any) => {
    handlePanMoveRef.current(evt);
    setPanStart(undefined);
  };

  useEffect(() => {
    let outerEvents: any;
    if (outerRectRef.current) {
      outerEvents = new EventManager(
        outerRectRef.current as unknown as HTMLElement,
        {},
      );
      outerEvents.on('click', handleClick);
      outerEvents.on('panstart', handlePanStart);
      outerEvents.on('panmove', handlePanMove);
      outerEvents.on('panend', handlePanEnd);
    }
    let selectedRangeEvents: any;
    if (selectedRangeRectRef.current) {
      selectedRangeEvents = new EventManager(
        selectedRangeRectRef.current as unknown as HTMLElement,
        {},
      );
      selectedRangeEvents.on('panstart', handleMove);
      selectedRangeEvents.on('panmove', handleMove);
      selectedRangeEvents.on('panend', handleMoveEnd);
    }
    return () => {
      outerEvents?.destroy();
      selectedRangeEvents?.destroy();
    };
  }, []);

  const handleMoveSideRef = useRef<MoveSideHandler>();
  handleMoveSideRef.current = (pos, side) => {
    let t = timeFromPos(pos);
    if (t != null) {
      t = timeGranularity.interval.round(t);
      if (t < timeExtent[0]) t = timeExtent[0];
      if (t > timeExtent[1]) t = timeExtent[1];
      if (side === 'start') {
        onChange([
          t < selectedRange[1] ? t : selectedRange[1],
          selectedRange[1],
        ]);
      } else {
        onChange([
          selectedRange[0],
          t > selectedRange[0] ? t : selectedRange[0],
        ]);
      }
    }
  };
  const handleMoveSide: MoveSideHandler = (pos, kind) => {
    if (handleMoveSideRef.current) {
      handleMoveSideRef.current(pos, kind);
    }
  };

  const minLabelWidth = 70;
  const ticks = timeScale.ticks(
    Math.min(
      (timeGranularity.interval as any).count(timeExtent[0], timeExtent[1]),
      chartWidth / minLabelWidth,
    ),
  );

  const tickLabelFormat = tickMultiFormat; // timeScale.tickFormat();
  const isAllSelected = getAllSelected(selectedRange, timeExtent);

  const theme = useTheme();

  return (
    <TimelineSvg ref={svgRef} darkMode={darkMode} width={width} height={height}>
      <g transform={`translate(${margin.left},${margin.top})`}>
        {/*<rect*/}
        {/*  width={chartWidth}*/}
        {/*  height={chartHeight}*/}
        {/*  fill={theme.colors.gray[800]}*/}
        {/*  fillOpacity={0.5}*/}
        {/*/>*/}
        {ticks.map((t, i) => {
          const xPos = timeScale(t);
          if (xPos == null) return null;
          return (
            <g key={i} transform={`translate(${xPos},${0})`}>
              <TickLine
                y1={0}
                y2={chartHeight}
                stroke={theme.colors.gray[700]}
              />
              {xPos < chartWidth && (
                <TickText
                  fill={theme.colors.gray[500]}
                  darkMode={darkMode}
                  x={3}
                  y={AXIS_AREA_HEIGHT - 3}
                >
                  {
                    // timeGranularity.format(t)
                    tickLabelFormat(t)
                  }
                </TickText>
              )}
            </g>
          );
        })}
        <AxisPath d={`M0,0 ${chartWidth},0`} stroke={theme.colors.gray[700]} />
        <AxisPath
          transform={`translate(0,${chartHeight})`}
          stroke={theme.colors.gray[700]}
          d={`M0,0 ${chartWidth},0`}
        />
        <g transform={`translate(0,${AXIS_AREA_HEIGHT})`}>
          <Bars
            height={chartHeight - AXIS_AREA_HEIGHT}
            darkMode={darkMode}
            timeGranularity={timeGranularity}
            totalCountsByTime={totalCountsByTime}
            timeScale={timeScale}
          />
        </g>
      </g>
      <OuterRect ref={outerRectRef} width={width} height={height} />
      <g transform={`translate(${margin.left},${margin.top})`}>
        <g
          transform={`translate(${timeScale(selectedRange[0])},0)`}
          style={{pointerEvents: isAllSelected ? 'none' : 'all'}}
          // visibility={isAllSelected ? 'hidden' : 'visible'}
        >
          <SelectedRangeRect
            ref={selectedRangeRectRef}
            fill={theme.colors.gray[500]}
            height={chartHeight}
            width={timeScale(selectedRange[1])! - timeScale(selectedRange[0])!}
          />
        </g>
        <g
          transform={`translate(${timeScale(selectedRange[0])},${-handleHGap})`}
        >
          <TimelineHandle
            darkMode={darkMode}
            width={handleWidth}
            height={handleHeight}
            side="start"
            onMove={handleMoveSide}
          />
        </g>
        <g
          transform={`translate(${
            timeScale(selectedRange[1])! - handleWidth
          },${-handleHGap})`}
        >
          <TimelineHandle
            darkMode={darkMode}
            width={handleWidth}
            height={handleHeight}
            side="end"
            onMove={handleMoveSide}
          />
        </g>
      </g>
    </TimelineSvg>
  );
});
TimelineChart.displayName = 'TimelineChart';

const Timeline: React.FC<Props> = (props) => {
  const [measureRef, dimensions] = useMeasure();
  const {timeExtent, selectedRange, timeGranularity, darkMode, onChange} =
    props;
  const [internalRange, setInternalRange] =
    useState<[Date, Date]>(selectedRange);
  const throttledRange = useThrottle(internalRange, 100);
  const onChangeRef = useRef<(range: [Date, Date]) => void>();
  onChangeRef.current = (range) => onChange(range);
  useEffect(() => {
    const {current} = onChangeRef;
    if (current) current(throttledRange);
  }, [throttledRange, onChangeRef]);

  const [prevSelectedRange, setPrevSelectedRange] = useState(selectedRange);
  if (!areRangesEqual(selectedRange, prevSelectedRange)) {
    setInternalRange(selectedRange);
    setPrevSelectedRange(selectedRange);
  }

  const [isPlaying, setPlaying] = useState(false);

  const handlePlay = () => {
    const {interval} = timeGranularity;
    if (selectedRange[1] >= timeExtent[1]) {
      const length = (interval as any).count(
        selectedRange[0],
        selectedRange[1],
      );
      setInternalRange([timeExtent[0], interval.offset(timeExtent[0], length)]);
    }
    setPlaying(true);
  };

  const handlePlayAdvance = (start: Date) => {
    const {interval} = timeGranularity;
    const length = (interval as any).count(selectedRange[0], selectedRange[1]);
    const end = interval.offset(start, length);
    if (end >= timeExtent[1]) {
      setPlaying(false);
      setInternalRange([interval.offset(end, -length), end]);
    } else {
      setInternalRange([start, end]);
    }
  };

  const handleMove = useCallback(
    (range: [Date, Date]) => {
      setInternalRange(range);
      setPlaying(false);
    },
    [setInternalRange, setPlaying],
  );
  const isAllSelected = getAllSelected(selectedRange, timeExtent);

  return (
    <VStack height="100%" padding="5px 20px" userSelect="none" gap={0}>
      {internalRange ? (
        <Text fontSize="xs">
          {`${formatDate(internalRange[0])} - ${formatDate(internalRange[1])}`}
        </Text>
      ) : null}
      <HStack flexGrow={1} gap={0} width="100%">
        <Box alignSelf="center">
          <PlayControl
            darkMode={darkMode}
            timeExtent={timeExtent}
            current={internalRange[0]}
            interval={timeGranularity.interval}
            stepDuration={100}
            speed={1}
            isDisabled={isAllSelected}
            isPlaying={isPlaying}
            onPlay={handlePlay}
            onPause={() => setPlaying(false)}
            onAdvance={handlePlayAdvance}
          />
        </Box>
        <Box
          width={'100%'}
          height="100%"
          ref={measureRef as any}
          position="relative"
          overflow={'hidden'}
        >
          {dimensions.width > 0 && (
            <Box position={'absolute'}>
              <TimelineChart
                {...props}
                selectedRange={internalRange}
                width={dimensions.width}
                height={dimensions.height}
                onChange={handleMove}
              />
            </Box>
          )}
        </Box>
      </HStack>
    </VStack>
  );
};

export default Timeline;
