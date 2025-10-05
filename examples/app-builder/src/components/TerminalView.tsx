import {Terminal} from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import {SquareTerminalIcon} from 'lucide-react';
import {useEffect, useRef} from 'react';
import {useRoomStore} from '../store/store';

export const TerminalView = () => {
  const serverStatus = useRoomStore((s) => s.wc.serverStatus);
  const output = useRoomStore((s) => s.wc.output);
  const initialize = useRoomStore((s) => s.wc.initialize);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const lastIndexRef = useRef<number>(0);

  useEffect(() => {
    // Remove once RoomStore calls initialize() instead of RoomShellStore
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (!containerRef.current || terminalRef.current) {
      return;
    }
    const term = new Terminal({
      convertEol: true,
      disableStdin: true,
      fontSize: 12,
      cursorBlink: false,
      scrollback: 5000,
    });
    term.open(containerRef.current);
    terminalRef.current = term;

    // Seed existing output if any
    if (output && output.length > 0) {
      term.write(output);
      lastIndexRef.current = output.length;
    }

    return () => {
      term.dispose();
      terminalRef.current = null;
      lastIndexRef.current = 0;
    };
  }, [output]);

  useEffect(() => {
    const term = terminalRef.current;
    if (!term) {
      return;
    }
    // If output shrank (e.g. reset), clear and re-render
    if (output.length < lastIndexRef.current) {
      term.clear();
      term.write(output);
      lastIndexRef.current = output.length;
      return;
    }
    if (output.length === lastIndexRef.current) {
      return;
    }
    const nextChunk = output.slice(lastIndexRef.current);
    if (nextChunk.length > 0) {
      term.write(nextChunk);
      lastIndexRef.current = output.length;
    }
  }, [output]);

  return (
    <div className="relative h-full w-full p-2">
      <div className="gap-21 flex h-full flex-col">
        <div className="text-foreground flex w-full justify-between text-xs font-bold">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <SquareTerminalIcon className="h-5 w-5 text-gray-500" />
            Terminal
          </div>
          <div className="text-xs text-gray-500">{serverStatus.type}</div>
        </div>
        <div className="relative h-full w-full overflow-auto">
          <div ref={containerRef} className="h-full w-full text-xs" />
        </div>
      </div>
    </div>
  );
};
