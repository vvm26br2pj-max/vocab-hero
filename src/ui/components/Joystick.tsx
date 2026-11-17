// On-screen joystick for phones and tablets. Touch anywhere in the left part of the screen: the stick appears under
// your thumb. Left/right moves, push down to crouch or drop through a platform, push up to jump (hold to hover).
import { useEffect, useRef, useState } from 'react';
import { setInput, type InputState } from '../../combat/input';

const RADIUS = 52;      // how far the knob can travel (px)
const DEAD_X = 0.3;     // sideways dead zone (fraction of RADIUS)
const UP = 0.62, DOWN = 0.6;

export function Joystick({ player = 0, upJumps = true }: { player?: number; upJumps?: boolean }) {
  const zone = useRef<HTMLDivElement>(null);
  const [stick, setStick] = useState<{ bx: number; by: number; kx: number; ky: number } | null>(null);
  const pid = useRef<number | null>(null);
  const held = useRef<Partial<Record<keyof InputState, boolean>>>({});

  const apply = (dx: number, dy: number) => {
    const nx = dx / RADIUS, ny = dy / RADIUS;
    const want: Partial<Record<keyof InputState, boolean>> = { left: nx < -DEAD_X, right: nx > DEAD_X, down: ny > DOWN, ...(upJumps ? { jump: ny < -UP } : {}) };
    for (const k of Object.keys(want) as (keyof InputState)[]) if (!!held.current[k] !== !!want[k]) { held.current[k] = want[k]; setInput(k, !!want[k], player); }
  };
  const release = () => {
    pid.current = null; setStick(null);
    for (const k of Object.keys(held.current) as (keyof InputState)[]) if (held.current[k]) setInput(k, false, player);
    held.current = {};
  };
  useEffect(() => release, []);

  const onDown = (e: React.PointerEvent) => {
    if (pid.current !== null) return;
    e.preventDefault();
    pid.current = e.pointerId;
    try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); } catch { /* keep going without capture */ }
    const r = zone.current!.getBoundingClientRect();
    const bx = e.clientX - r.left, by = e.clientY - r.top;
    setStick({ bx, by, kx: 0, ky: 0 });
  };
  const onMove = (e: React.PointerEvent) => {
    if (e.pointerId !== pid.current || !stick) return;
    e.preventDefault();
    const r = zone.current!.getBoundingClientRect();
    let dx = e.clientX - r.left - stick.bx, dy = e.clientY - r.top - stick.by;
    const d = Math.hypot(dx, dy);
    // drag past the edge and the base follows your thumb, so the stick never "runs out"
    let { bx, by } = stick;
    if (d > RADIUS * 1.6) { const k = (d - RADIUS) / d; bx += dx * k; by += dy * k; dx -= dx * k; dy -= dy * k; }
    else if (d > RADIUS) { dx = (dx / d) * RADIUS; dy = (dy / d) * RADIUS; }
    setStick({ bx, by, kx: dx, ky: dy });
    apply(dx, dy);
  };
  const onUp = (e: React.PointerEvent) => { if (e.pointerId === pid.current) release(); };

  return (
    <div ref={zone} className="joy-zone" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onContextMenu={(e) => e.preventDefault()} aria-label="Movement joystick: drag to move, up to jump, down to crouch">
      {stick ? (
        <div className="joy-base" style={{ left: stick.bx, top: stick.by }}>
          <div className="joy-knob" style={{ transform: `translate(${stick.kx}px, ${stick.ky}px)` }} />
        </div>
      ) : (
        <div className="joy-base idle"><div className="joy-knob" /><span className="joy-hint">drag to move</span></div>
      )}
    </div>
  );
}
