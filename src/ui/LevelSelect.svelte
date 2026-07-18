<script lang="ts">
  import type { Game } from '../game/loop';
  import { hud } from '../game/state';
  import { LEVELS } from '../game/levels';

  let { game }: { game: Game } = $props();

  const isUnlocked = (i: number, unlocked: number, dev: boolean) => dev || i < unlocked;
</script>

<div class="levelselect">
  <div class="row">
    <div class="pills">
      {#each LEVELS as level, i (level.id)}
        {@const unlocked = isUnlocked(i, $hud.unlockedCount, $hud.devMode)}
        <button
          class="pill"
          class:current={i === $hud.levelIndex}
          class:locked={!unlocked}
          disabled={!unlocked}
          title={unlocked ? level.name : 'Locked'}
          aria-label={`Level ${i + 1}: ${unlocked ? level.name : 'locked'}`}
          onclick={() => game.goToLevel(i)}
        >
          {unlocked ? i + 1 : '🔒'}
        </button>
      {/each}
    </div>

    <button
      class="dev"
      class:on={$hud.devMode}
      title="Dev mode: unlock all levels"
      onclick={() => game.toggleDevMode()}
    >
      DEV
    </button>
  </div>
  <div class="name">{$hud.levelName}</div>
</div>

<style>
  .levelselect {
    position: fixed;
    top: calc(env(safe-area-inset-top, 0px) + 10px);
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    pointer-events: none;
    z-index: 5;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .name {
    color: var(--ink-dim);
    font-size: 12px;
    font-weight: 600;
  }
  .pills {
    display: flex;
    gap: 6px;
    background: rgba(19, 26, 58, 0.7);
    border: 1px solid rgba(150, 170, 255, 0.18);
    border-radius: 999px;
    padding: 4px;
    backdrop-filter: blur(6px);
  }
  .pill {
    pointer-events: auto;
    width: 34px;
    height: 34px;
    border-radius: 999px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--ink);
    font: inherit;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    font-variant-numeric: tabular-nums;
    -webkit-tap-highlight-color: transparent;
  }
  .pill.current {
    background: var(--accent, #6ad2ff);
    color: #04203a;
  }
  .pill.locked {
    color: var(--ink-dim);
    cursor: default;
    font-size: 12px;
  }
  .pill:not(.current):not(.locked):hover {
    border-color: rgba(150, 170, 255, 0.4);
  }

  .dev {
    pointer-events: auto;
    font: inherit;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.5px;
    color: var(--ink-dim);
    background: rgba(19, 26, 58, 0.7);
    border: 1px solid rgba(150, 170, 255, 0.18);
    border-radius: 999px;
    padding: 7px 10px;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .dev.on {
    color: #ffd166;
    border-color: #ffd166;
  }
</style>
