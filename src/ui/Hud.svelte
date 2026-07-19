<script lang="ts">
  import type { Game } from '../game/loop';
  import { hud, type PreviewMode } from '../game/state';

  let { game }: { game: Game } = $props();

  // Preview length is the game's main difficulty lever (spec §7) and doubles as an
  // accessibility aid (full preview). Cycle partial → full → none.
  const NEXT: Record<PreviewMode, PreviewMode> = { partial: 'full', full: 'none', none: 'partial' };
  const LABEL: Record<PreviewMode, string> = { partial: 'Partial', full: 'Full', none: 'None' };
</script>

<!-- Top-right attempts. Non-interactive, so it never eats the drag gesture.
     (The centered level selector lives in LevelSelect.svelte.) -->
<div class="topbar">
  <div class="attempts" aria-label="attempts">
    ⟳ {$hud.attempts}<span class="par">/ par {$hud.par}</span>
  </div>
</div>

<!-- The win/lose summary now lives in EndOfLevel.svelte. -->

<!-- Bottom bar: hint, preview-mode toggle, reset — all thumb-reachable. -->
<div class="bottombar">
  <button
    class="ghost"
    title="Trajectory preview length"
    aria-label={`Preview: ${LABEL[$hud.previewMode]}`}
    onclick={() => game.setPreviewMode(NEXT[$hud.previewMode])}
  >
    Preview: {LABEL[$hud.previewMode]}
  </button>
  <span class="hint">
    {#if $hud.status === 'flying'}Flying…{:else}Pull back & release to launch{/if}
  </span>
  <button class="ghost" onclick={() => game.restartLevel()}>Reset</button>
</div>

<style>
  /* All HUD chrome sits above the canvas; only buttons capture pointer events. */
  .topbar,
  .bottombar {
    position: fixed;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: calc(env(safe-area-inset-top, 0px) + 12px) 16px 12px;
    pointer-events: none;
    font-variant-numeric: tabular-nums;
  }
  .topbar {
    top: 0;
    justify-content: flex-end;
  }
  .bottombar {
    bottom: 0;
    top: auto;
    padding: 12px 16px calc(env(safe-area-inset-bottom, 0px) + 14px);
  }

  .attempts {
    color: var(--ink);
    font-size: 15px;
  }
  .par {
    color: var(--ink-dim);
    margin-left: 6px;
    font-size: 13px;
  }
  .hint {
    color: var(--ink-dim);
    font-size: 13px;
  }

  button {
    pointer-events: auto;
    font: inherit;
    font-size: 15px;
    color: var(--ink);
    background: rgba(120, 140, 220, 0.18);
    border: 1px solid rgba(150, 170, 255, 0.25);
    border-radius: 10px;
    padding: 9px 16px;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  button:active {
    transform: translateY(1px);
  }
  button.ghost {
    background: transparent;
    color: var(--ink-dim);
    border-color: rgba(150, 170, 255, 0.2);
    font-size: 13px;
    padding: 7px 12px;
  }
</style>
