<script lang="ts">
  import type { Game } from '../game/loop';
  import { hud } from '../game/state';

  let { game }: { game: Game } = $props();

  // Round the near-miss distance for display.
  const missText = (d: number | null) => (d == null ? '' : `${Math.round(d)} away`);
</script>

<!-- Top-right attempts. Non-interactive, so it never eats the drag gesture.
     (The centered level selector lives in LevelSelect.svelte.) -->
<div class="topbar">
  <div class="attempts" aria-label="attempts">
    ⟳ {$hud.attempts}<span class="par">/ par {$hud.par}</span>
  </div>
</div>

<!-- Result banner + actions. Only interactive when a shot has resolved. -->
{#if $hud.status === 'won'}
  <div class="banner win">
    <div class="headline">Target reached</div>
    <div class="sub">in {$hud.attempts} {$hud.attempts === 1 ? 'try' : 'tries'}</div>
    <div class="actions">
      <button onclick={() => game.restartLevel()}>Replay</button>
      {#if $hud.levelIndex < $hud.levelCount - 1}
        <button class="primary" onclick={() => game.nextLevel()}>Next →</button>
      {/if}
    </div>
  </div>
{:else if $hud.status === 'lost'}
  <div class="banner lose">
    <div class="headline">
      {$hud.lostReason === 'crash' ? 'Crashed' : 'Flew off course'}
    </div>
    {#if $hud.closestApproach != null}
      <div class="sub">{missText($hud.closestApproach)}</div>
    {/if}
    <div class="actions">
      <button class="primary" onclick={() => game.resetShot()}>Retry</button>
    </div>
  </div>
{/if}

<!-- Bottom hint + reset, thumb-reachable. -->
<div class="bottombar">
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

  .banner {
    position: fixed;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    background: rgba(19, 26, 58, 0.92);
    border: 1px solid rgba(150, 170, 255, 0.18);
    border-radius: 16px;
    padding: 20px 24px;
    text-align: center;
    min-width: 220px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
    pointer-events: auto;
  }
  .headline {
    font-size: 20px;
    font-weight: 700;
  }
  .win .headline {
    color: var(--target, #37d6a6);
  }
  .lose .headline {
    color: #ff9f6a;
  }
  .sub {
    color: var(--ink-dim);
    margin-top: 4px;
    font-size: 14px;
  }
  .actions {
    display: flex;
    gap: 10px;
    justify-content: center;
    margin-top: 16px;
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
  button.primary {
    background: var(--accent, #6ad2ff);
    color: #04203a;
    border-color: transparent;
    font-weight: 600;
  }
  button.ghost {
    background: transparent;
    color: var(--ink-dim);
    border-color: rgba(150, 170, 255, 0.2);
  }
</style>
