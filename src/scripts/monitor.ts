// Swaps the static monitor for the devlanes TUI compiled to WebAssembly. scripts/sync.mjs
// publishes the module under /tui/ when the release has it; until then, or when it fails to
// load, the static screen stays.

/** The `Demo` class exported by the devlanes-tui-web bundle. */
interface Demo {
  /** Sends a `KeyboardEvent.key`; true when the TUI used it. */
  key(key: string, ctrl: boolean, alt: boolean, shift: boolean): boolean;
  /** Advances the fake daemon by one second and redraws. */
  tick(): void;
  /** Unmounts the TUI. */
  free(): void;
}

/** The wasm-bindgen module at /tui/devlanes_tui_web.js. */
interface TuiModule {
  /** Loads the `.wasm` file next to the module. */
  default: () => Promise<unknown>;
  Demo: new (elementId: string) => Demo;
}

const section = document.querySelector<HTMLElement>('#monitor');
const fallback = section?.querySelector<HTMLElement>('[data-monitor-static]');
const live = section?.querySelector<HTMLElement>('[data-monitor-live]');
const viewport = live?.querySelector<HTMLElement>('.tui-live-viewport');
const container = live?.querySelector<HTMLElement>('#tui-demo');

if (section && fallback && live && viewport && container && 'IntersectionObserver' in window) {
  let demo: Demo | undefined;
  let visible = false;
  let timer: number | undefined;

  /** Runs the fake daemon's clock only while someone can see the demo. */
  const syncTicks = () => {
    const running = demo !== undefined && visible && !document.hidden;
    if (running && timer === undefined) {
      timer = window.setInterval(() => demo?.tick(), 1000);
    } else if (!running && timer !== undefined) {
      window.clearInterval(timer);
      timer = undefined;
    }
  };

  /**
   * Shrinks the demo to fit narrow layouts. The TUI keeps 120 by 40 cells, because the
   * element's unscaled size decides how many cells it gets.
   */
  const fit = () => {
    const scale = Math.min(1, viewport.clientWidth / container.offsetWidth);
    container.style.transform = scale < 1 ? `scale(${scale})` : '';
    viewport.style.height = `${container.offsetHeight * scale}px`;
  };

  /** Loads the module and mounts the TUI, leaving the static screen in place on any failure. */
  const start = async () => {
    try {
      // Built at runtime so Vite leaves the import alone: the file only exists after a sync.
      const url = new URL('/tui/devlanes_tui_web.js', window.location.href).href;
      const module = (await import(/* @vite-ignore */ url)) as TuiModule;
      await module.default();
      // The TUI measures its cells once when mounted, so the font has to be in place first.
      await document.fonts.load(`${getComputedStyle(container).fontSize} "JetBrains Mono"`);
      live.hidden = false;
      fit();
      demo = new module.Demo(container.id);
    } catch (error) {
      live.hidden = true;
      console.debug('The live TUI demo is unavailable, showing the static container.', error);
      return;
    }
    fallback.hidden = true;
    new ResizeObserver(fit).observe(viewport);
    syncTicks();
  };

  container.addEventListener('keydown', (event) => {
    // Command shortcuts on macOS belong to the browser.
    if (!demo || event.metaKey) return;
    if (demo.key(event.key, event.ctrlKey, event.altKey, event.shiftKey)) event.preventDefault();
  });

  for (const button of live.querySelectorAll<HTMLButtonElement>('[data-key]')) {
    button.addEventListener('click', () => {
      demo?.key(button.dataset.key ?? '', false, false, button.dataset.shift === 'true');
      container.focus({ preventScroll: true });
    });
  }

  // Loading starts early so the demo is usually live by the time the section scrolls in.
  const loader = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      loader.disconnect();
      void start();
    },
    { rootMargin: '600px 0px' }
  );
  loader.observe(section);

  new IntersectionObserver((entries) => {
    visible = entries.at(-1)?.isIntersecting ?? visible;
    syncTicks();
  }).observe(section);
  document.addEventListener('visibilitychange', syncTicks);
}
