import type { Action } from 'svelte/action';

/** Focus and keyboard containment shared by in-window dialogs. */
export const modalFocus: Action<HTMLElement, () => void> = (node, cancel) => {
  const previous = document.activeElement;
  const controls = () => Array.from(node.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLTextAreaElement | HTMLSelectElement>('button, input, textarea, select'))
    .filter((element) => !element.disabled);
  controls()[0]?.focus();
  function keydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      if (event.isComposing || event.keyCode === 229) return;
      event.preventDefault(); cancel();
    }
    if (event.key === 'Tab') {
      const elements = controls();
      const first = elements[0]; const last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }
  node.addEventListener('keydown', keydown);
  return {
    update(next) { cancel = next; },
    destroy() {
      node.removeEventListener('keydown', keydown);
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    }
  };
};
