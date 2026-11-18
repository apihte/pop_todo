<script lang="ts">
  import { translator } from '../stores/i18n';
  import { badgeText } from '../lib/todos';
  import { DEFAULT_COLORS, STATUS_LABELS, contrastText, type ActiveStatus } from '../lib/status';
  import { startWindowDrag } from '../services/window-service';

  export let count = 0;
  export let status: ActiveStatus = 'normal';
  export let color = DEFAULT_COLORS.normal;
  export let onExpand: () => void;
  export let onError: (message: string) => void;
  let start: { x: number; y: number } | undefined;
  let dragged = false;

  function pointerDown(event: PointerEvent) {
    if (event.button !== 0) return;
    start = { x: event.clientX, y: event.clientY };
    dragged = false;
    if (event.currentTarget instanceof HTMLElement) event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function pointerMove(event: PointerEvent) {
    if (!start || dragged || !(event.buttons & 1)) return;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) < 5) return;
    dragged = true;
    void startWindowDrag().catch(() => onError('error.drag'));
  }

  function click() {
    if (!dragged) onExpand();
    start = undefined;
    dragged = false;
  }
</script>

<div class="floating-shell">
  <button class="floating-button" data-status={status} style:background={color} style:color={contrastText(color)} aria-label={$translator('icon.expand')} title={$translator('icon.hint', { status: $translator(STATUS_LABELS[status]) })}
    on:pointerdown={pointerDown} on:pointermove={pointerMove} on:click={click}>
    <span class="sr-only" role="status">{$translator(STATUS_LABELS[status])}</span>
    <span class="check-mark" aria-hidden="true">✓</span>
    {#if count > 0}
      <span class="badge" aria-label={$translator('icon.count', { count })}>{badgeText(count)}</span>
    {/if}
  </button>
</div>
