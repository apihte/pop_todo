import { readable } from 'svelte/store';

// Timers keep updating while collapsed; focus/visibility refresh after sleep or clock changes.
export const currentTime = readable(Date.now(), (set) => {
  const update = () => set(Date.now());
  update();
  const timer = setInterval(update, 1000);
  if (typeof window !== 'undefined') window.addEventListener('focus', update);
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', update);
  return () => {
    clearInterval(timer);
    if (typeof window !== 'undefined') window.removeEventListener('focus', update);
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', update);
  };
});
