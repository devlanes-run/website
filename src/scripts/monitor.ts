// Swaps the static screen of the monitor section for the devlanes TUI compiled to WebAssembly.
// scripts/sync.mjs publishes the module under /tui/ when the release has it; until then, when
// it fails to load or when the screen is too narrow to read it, the static screen stays.

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

// Below this scale the 120 columns are too small to read, so phones keep the static screen and
// never download the module.
const minimumScale = 0.6;

const section = document.querySelector<HTMLElement>('#monitor');
const staticScreen = section?.querySelector<HTMLElement>('[data-monitor-static]');
const live = section?.querySelector<HTMLElement>('[data-monitor-live]');
const viewport = live?.querySelector<HTMLElement>('.tui-live-viewport');
const container = live?.querySelector<HTMLElement>('#tui-demo');

if (
  section &&
  staticScreen &&
  live &&
  viewport &&
  container &&
  'IntersectionObserver' in window &&
  typeof WebAssembly === 'object'
) {
  const root = document.documentElement;
  let demo: Demo | undefined;
  let visible = false;
  let near = false;
  let started = false;
  let timer: number | undefined;

  /**
   * Runs `call` on the demo. A Rust panic surfaces here as an exception and leaves the module
   * unusable, so the first failure puts the static screen back for good.
   */
  const guard = <T>(call: (demo: Demo) => T): T | undefined => {
    if (!demo) return undefined;
    try {
      return call(demo);
    } catch (error) {
      console.debug('The live TUI demo stopped, showing the static screen.', error);
      demo = undefined;
      syncTicks();
      live.hidden = true;
      staticScreen.hidden = false;
      return undefined;
    }
  };

  /**
   * Runs the fake daemon's clock only while someone can see the demo and motion is allowed:
   * the footer's pause button and reduced motion both set `data-motion="paused"`.
   */
  const syncTicks = () => {
    const running =
      demo !== undefined && visible && !document.hidden && root.dataset.motion !== 'paused';
    if (running && timer === undefined) {
      timer = window.setInterval(() => guard((demo) => demo.tick()), 1000);
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

  /**
   * Whether the demo would be readable at the current width. It is measured with an off-screen
   * copy of the container, since the live block stays hidden until the module loads, against
   * the static screen's terminal, which has the same width as the live one.
   */
  const wideEnough = () => {
    const terminal = staticScreen.querySelector<HTMLElement>('.terminal');
    const probe = document.createElement('div');
    probe.className = 'tui-live';
    probe.style.cssText = 'position: absolute; visibility: hidden';
    document.body.append(probe);
    const width = probe.offsetWidth;
    probe.remove();
    return (terminal?.clientWidth ?? 0) >= width * minimumScale;
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
      console.debug('The live TUI demo is unavailable, showing the static screen.', error);
      return;
    }
    staticScreen.hidden = true;
    // Deferred to the next frame so resizing the viewport from here does not trigger a
    // "ResizeObserver loop" error.
    new ResizeObserver(() => requestAnimationFrame(fit)).observe(viewport);
    // The section is about the monitor, so the demo opens on it.
    guard((demo) => demo.key('M', false, false, true));
    syncTicks();
  };

  /** Starts loading once the section is close and the layout is wide enough, at most once. */
  const maybeStart = () => {
    if (started || !near || !wideEnough()) return;
    started = true;
    window.removeEventListener('resize', maybeStart);
    void start();
  };

  container.addEventListener('keydown', (event) => {
    // Command shortcuts on macOS belong to the browser.
    if (event.metaKey) return;
    // So does copying text selected inside the demo.
    const selection = window.getSelection();
    if (
      event.ctrlKey &&
      event.key === 'c' &&
      selection &&
      !selection.isCollapsed &&
      container.contains(selection.anchorNode)
    ) {
      return;
    }
    // AltGr arrives as Ctrl+Alt on Windows, but it types a character, not a chord.
    const altGraph = event.getModifierState('AltGraph');
    const used = guard((demo) =>
      demo.key(event.key, event.ctrlKey && !altGraph, event.altKey && !altGraph, event.shiftKey)
    );
    if (used) event.preventDefault();
  });

  for (const button of live.querySelectorAll<HTMLButtonElement>('[data-key]')) {
    button.addEventListener('click', () => {
      guard((demo) =>
        demo.key(button.dataset.key ?? '', false, false, button.dataset.shift === 'true')
      );
      container.focus({ preventScroll: true });
    });
  }

  // Loading starts early so the demo is usually live by the time the section scrolls in.
  const loader = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      loader.disconnect();
      near = true;
      maybeStart();
    },
    { rootMargin: '600px 0px' }
  );
  loader.observe(section);
  // A phone turned sideways or a wider window can make the demo readable later.
  window.addEventListener('resize', maybeStart);

  new IntersectionObserver((entries) => {
    visible = entries.at(-1)?.isIntersecting ?? visible;
    syncTicks();
  }).observe(section);
  document.addEventListener('visibilitychange', syncTicks);
  new MutationObserver(syncTicks).observe(root, { attributeFilter: ['data-motion'] });
}
