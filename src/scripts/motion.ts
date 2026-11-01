// The footer's pause button and the reduced-motion preference both set `data-motion` on the
// root; the road scene and the live TUI watch it and stop while it says `paused`.
const root = document.documentElement;
const button = document.getElementById('motion');
const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
let paused = preference.matches;

function sync(): void {
  root.dataset.motion = paused ? 'paused' : 'running';
  if (button) {
    button.hidden = false;
    button.textContent = paused ? 'Play motion' : 'Pause motion';
    button.setAttribute('aria-pressed', String(paused));
  }
}

button?.addEventListener('click', () => {
  paused = !paused;
  sync();
});
preference.addEventListener('change', (event) => {
  paused = event.matches;
  sync();
});
sync();
