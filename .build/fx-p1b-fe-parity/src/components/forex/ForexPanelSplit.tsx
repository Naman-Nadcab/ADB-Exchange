'use client';

import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { cn } from '@/lib/utils';

type Axis = 'x' | 'y';

/**
 * Professional terminal splitter — drag to resize adjacent panels.
 * Axis x: vertical bar (resize width). Axis y: horizontal bar (resize height).
 */
export function ForexPanelSplit(props: {
  axis: Axis;
  /** Current size of the panel being resized (px). */
  value: number;
  onChange: (next: number) => void;
  /** +1 grows value when pointer moves right/down; -1 inverts (e.g. ticket from right edge). */
  direction?: 1 | -1;
  className?: string;
  label: string;
}) {
  const direction = props.direction ?? 1;
  const drag = useRef<{ start: number; value: number } | null>(null);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      drag.current = {
        start: props.axis === 'x' ? e.clientX : e.clientY,
        value: props.value,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      e.preventDefault();
    },
    [props.axis, props.value]
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!drag.current) return;
      const cur = props.axis === 'x' ? e.clientX : e.clientY;
      const delta = (cur - drag.current.start) * direction;
      props.onChange(drag.current.value + delta);
    },
    [direction, props]
  );

  const onPointerUp = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    drag.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <div
      role="separator"
      aria-orientation={props.axis === 'x' ? 'vertical' : 'horizontal'}
      aria-label={props.label}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 24 : 8;
        if (props.axis === 'x') {
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            props.onChange(props.value - step * direction);
          } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            props.onChange(props.value + step * direction);
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          props.onChange(props.value - step * direction);
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          props.onChange(props.value + step * direction);
        }
      }}
      className={cn(
        'shrink-0 bg-border/80 transition-colors hover:bg-primary/50 focus-visible:bg-primary/60 focus-visible:outline-none',
        props.axis === 'x'
          ? 'w-1 cursor-col-resize self-stretch'
          : 'h-1 w-full cursor-row-resize',
        props.className
      )}
    />
  );
}
