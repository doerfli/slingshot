<script lang="ts">
  import { onMount } from 'svelte';
  import { Game } from './game/loop';
  import { attachAim } from './input/aim';
  import Hud from './ui/Hud.svelte';
  import LevelSelect from './ui/LevelSelect.svelte';
  import EndOfLevel from './ui/EndOfLevel.svelte';

  let canvas: HTMLCanvasElement;
  let game = $state<Game | undefined>(undefined);

  onMount(() => {
    const g = new Game(canvas);
    const detachAim = attachAim(canvas, g);
    const onResize = () => g.resize();
    window.addEventListener('resize', onResize);
    g.start();
    game = g;

    return () => {
      window.removeEventListener('resize', onResize);
      detachAim();
      g.stop();
    };
  });
</script>

<canvas class="world" bind:this={canvas}></canvas>
{#if game}
  <LevelSelect {game} />
  <Hud {game} />
  <EndOfLevel {game} />
{/if}
