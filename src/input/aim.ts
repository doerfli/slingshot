// Drag-to-aim gesture. Pointer Events so touch and mouse share one path (spec §5.1).
// Screen (CSS-pixel) coordinates are handed to the Game controller, which converts
// them to world space via the camera. The whole canvas is the drag area — large and
// forgiving for thumb play (spec §13).

import type { Game } from '../game/loop';

export function attachAim(canvas: HTMLCanvasElement, game: Game): () => void {
  function pointFromEvent(e: PointerEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onDown(e: PointerEvent): void {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    game.beginAim(pointFromEvent(e));
  }

  function onMove(e: PointerEvent): void {
    if (!canvas.hasPointerCapture(e.pointerId)) return;
    e.preventDefault();
    game.updateAim(pointFromEvent(e));
  }

  function onUp(e: PointerEvent): void {
    if (!canvas.hasPointerCapture(e.pointerId)) return;
    e.preventDefault();
    canvas.releasePointerCapture(e.pointerId);
    game.endAim();
  }

  function onCancel(): void {
    game.cancelAim();
  }

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onCancel);

  return () => {
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onCancel);
  };
}
