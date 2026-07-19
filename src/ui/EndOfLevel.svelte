<script lang="ts">
  import type { Game } from '../game/loop';
  import { hud } from '../game/state';

  let { game }: { game: Game } = $props();

  const missText = (d: number | null) => (d == null ? '' : `${Math.round(d)} away`);
  // Filled vs outline is a SHAPE difference, so the rating reads without relying on color.
  const STARS = [0, 1, 2];
</script>

{#if $hud.status === 'won'}
  <div class="banner win" role="dialog" aria-label="Level complete">
    <div class="headline">Target reached</div>

    <div class="stars" aria-label={`${$hud.stars} of 3 stars`}>
      {#each STARS as i (i)}
        <span class="star" class:filled={i < $hud.stars}>{i < $hud.stars ? '★' : '☆'}</span>
      {/each}
    </div>

    <div class="sub">
      in {$hud.attempts} {$hud.attempts === 1 ? 'try' : 'tries'} · par {$hud.par}
    </div>
    {#if $hud.bestAttempts != null}
      <div class="best">
        Best: {$hud.bestStars}★ in {$hud.bestAttempts}
        {$hud.bestAttempts === 1 ? 'try' : 'tries'}
      </div>
    {/if}

    <div class="actions">
      <button onclick={() => game.restartLevel()}>Replay</button>
      {#if $hud.levelIndex < $hud.levelCount - 1}
        <button class="primary" onclick={() => game.nextLevel()}>Next →</button>
      {/if}
    </div>
  </div>
{:else if $hud.status === 'lost'}
  <div class="banner lose" role="dialog" aria-label="Shot failed">
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

<style>
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
    z-index: 10;
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
  .stars {
    margin-top: 10px;
    font-size: 26px;
    letter-spacing: 4px;
    line-height: 1;
  }
  .star {
    color: var(--ink-dim);
  }
  .star.filled {
    color: #ffd166;
  }
  .sub {
    color: var(--ink-dim);
    margin-top: 8px;
    font-size: 14px;
  }
  .best {
    color: var(--ink-dim);
    margin-top: 2px;
    font-size: 12px;
    opacity: 0.85;
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
</style>
