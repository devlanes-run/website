// Swaps the static screen of every `[data-tui]` for the devlanes TUI compiled to WebAssembly.
// scripts/sync.mjs publishes the module under /tui/ when the release has it; without it, or
// when the module throws, the static screen stays. The TUI gets as many columns as fit the
// wrapper and a fixed number of rows, in cells of its own font: it is never scaled.

/** The `Demo` class exported by the devlanes-tui-web bundle. */
interface Demo {
  /** Sends a `KeyboardEvent.key` with its modifiers; true when the TUI used it. */
  key(key: string, ctrl: boolean, alt: boolean, shift: boolean, meta: boolean): boolean;
  /** Advances the fake daemon by one second and redraws. */
  tick(): void;
  /** Measures the element again and lays the TUI out at the new size, keeping its state. */
  resize(): void;
  /** Unmounts the TUI and empties its element. */
  free(): void;
}

/** The wasm-bindgen module at /tui/devlanes_tui_web.js. */
interface TuiModule {
  /** Loads the `.wasm` file next to the module. */
  default: () => Promise<unknown>;
  Demo: new (elementId: string) => Demo;
}

/** The grid the TUI gets, and the cell it was computed from. */
interface Grid {
  cols: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
}

const minimumCols = 40;
const maximumCols = 140;
/** Keys that open another page, replayed after a remount so the same page is open. */
const pages = ['M', 'D', 'B', 'Escape'];
/**
 * The pages a touch screen cycles through until it is tapped: taps reach the TUI, but without
 * a keyboard nothing invites one.
 */
const tour = ['M', 'Escape', 'D'];

const coarse = window.matchMedia('(pointer: coarse)').matches;
const mobile = window.matchMedia('(max-width: 720px)');
const wrappers = document.querySelectorAll<HTMLElement>('[data-tui]');

let loading: Promise<TuiModule> | undefined;

/** Loads and initialises the module once for every demo on the page. */
const load = () => {
  loading ??= (async () => {
    // Built at runtime so Vite leaves the import alone: the file only exists after a sync.
    const url = new URL('/tui/devlanes_tui_web.js', window.location.href).href;
    const module = (await import(/* @vite-ignore */ url)) as TuiModule;
    await module.default();
    // The TUI measures its cells once when mounted, so the font has to be in place first.
    await document.fonts.load('13px "JetBrains Mono"');
    return module;
  })();
  return loading;
};

/** Whether `key` is sent with Shift: the page keys are uppercase letters. */
const shifted = (key: string) => /^[A-Z]$/.test(key);

function setup(wrapper: HTMLElement) {
  const staticScreen = wrapper.querySelector<HTMLElement>('[data-tui-static]');
  const live = wrapper.querySelector<HTMLElement>('[data-tui-live]');
  const screen = live?.querySelector<HTMLElement>('.tui-screen');
  const badge = wrapper.querySelector<HTMLElement>('[data-tui-badge]');
  const badgeText = badge?.querySelector<HTMLElement>('[data-tui-badge-text]');
  const hint = live?.querySelector<HTMLElement>('[data-tui-hint]');
  if (!staticScreen || !live || !screen?.id) return;
  const idleLabel = coarse ? 'Live, tap to interact' : 'Live, click to interact';
  const hintText = hint?.querySelector('span');
  if (hintText) hintText.textContent = coarse ? 'Tap to interact' : 'Click to interact';
  // The overlay sits over the screen while the bundle loads and until the pointer reaches the
  // live TUI, then stays away for good. Hovering the empty box while loading dismisses nothing.
  let hinted = false;
  let armed = false;
  const dismissHint = () => {
    hinted = true;
    if (hint) hint.hidden = true;
  };
  const armHint = () => {
    if (armed) return;
    armed = true;
    for (const type of ['pointerenter', 'pointerdown', 'focus'] as const)
      screen.addEventListener(type, dismissHint, { once: true });
  };

  const desktopRows = Number(wrapper.dataset.rows) || 34;
  const mobileRows = Number(wrapper.dataset.mobileRows) || 26;
  let view = wrapper.dataset.view || 'M';
  let demo: Demo | undefined;
  let module: TuiModule | undefined;
  let grid: Grid | undefined;
  let visible = false;
  let started = false;
  let dead = false;
  let failures = 0;
  let ticker: number | undefined;
  let tourTimer: number | undefined;
  let tourStep = 0;
  let touring = coarse;
  let remount: number | undefined;
  let refit: number | undefined;

  /**
   * Measures one cell the way Ratzilla's DomBackend does (a `pre` with `line-height: normal`
   * holding an inline-block span of `1ch`), so the grid computed here is the one the TUI gets.
   * The block glyph may come from a fallback font, which makes the line taller than `1lh`.
   */
  const measure = (): Grid => {
    const pre = document.createElement('pre');
    pre.style.cssText = 'margin: 0; padding: 0; border: 0; line-height: normal;';
    const cell = document.createElement('span');
    cell.textContent = '\u2588';
    cell.style.cssText = 'display: inline-block; width: 1ch;';
    pre.append(cell);
    screen.append(pre);
    const { width, height } = cell.getBoundingClientRect();
    pre.remove();
    const cellWidth = width || 1;
    const cellHeight = height || 1;
    const cols = Math.min(
      maximumCols,
      Math.max(minimumCols, Math.floor(wrapper.clientWidth / cellWidth))
    );
    return { cols, rows: mobile.matches ? mobileRows : desktopRows, cellWidth, cellHeight };
  };

  const same = (a: Grid, b: Grid) =>
    a.cols === b.cols &&
    a.rows === b.rows &&
    a.cellWidth === b.cellWidth &&
    a.cellHeight === b.cellHeight;

  /**
   * Gives the element the grid's size, which Ratzilla divides by the cell it measures. The
   * size is exact unless the browser's rounding lost a cell, when `slack` adds a fraction of
   * one so the division comes out whole.
   */
  const apply = (next: Grid, slack: number) => {
    screen.style.width = `${next.cols * next.cellWidth + slack}px`;
    screen.style.height = `${next.rows * next.cellHeight + slack}px`;
    screen.style.setProperty('--tui-cell-height', `${next.cellHeight}px`);
    screen.dataset.cols = String(next.cols);
    screen.dataset.rows = String(next.rows);
  };

  /** Whether the grid Ratzilla built has the rows and columns the element was sized for. */
  const built = (next: Grid) => {
    const lines = screen.querySelectorAll('pre');
    return lines.length === next.rows && lines[0]?.childElementCount === next.cols;
  };

  /** Puts the static screen back for good. */
  const stop = (error: unknown) => {
    dead = true;
    unmount();
    window.clearTimeout(remount);
    window.clearTimeout(refit);
    remount = undefined;
    refit = undefined;
    live.hidden = true;
    if (badge) badge.hidden = true;
    if (hint) hint.hidden = true;
    staticScreen.hidden = false;
    syncTicks();
    console.debug('The live TUI demo is unavailable, showing the static screen.', error);
  };

  /** Frees the demo and empties its element; a failing `free` is not the page's problem. */
  const unmount = () => {
    const current = demo;
    demo = undefined;
    try {
      current?.free();
    } catch {
      /* The module is unusable after a panic; the element is emptied below anyway. */
    }
    screen.replaceChildren();
    syncTicks();
  };

  /**
   * Runs `call` on the demo. A Rust panic surfaces here as an exception and leaves the module
   * unusable, so the demo is remounted once; a second failure puts the static screen back.
   */
  const guard = <T>(call: (demo: Demo) => T): T | undefined => {
    if (!demo) return undefined;
    try {
      return call(demo);
    } catch (error) {
      failures += 1;
      if (failures > 1) {
        stop(error);
      } else {
        console.debug('The live TUI demo failed, remounting it.', error);
        unmount();
        schedule();
      }
      return undefined;
    }
  };

  /** Sends a key, remembering the page it opens for the next remount. */
  const send = (key: string, shift = shifted(key)) => {
    const used = guard((demo) => demo.key(key, false, false, shift, false));
    if (used && pages.includes(key)) view = key;
    return used;
  };

  /** Mounts the TUI at the grid that fits now and opens the page that was open. */
  const mount = async () => {
    try {
      module ??= await load();
    } catch (error) {
      stop(error);
      return;
    }
    if (dead || demo) return;
    // Shown before measuring, since a hidden element has no size. Construction is synchronous,
    // so the swap and the first frame paint together.
    staticScreen.hidden = true;
    live.hidden = false;
    screen.replaceChildren();
    const next = measure();
    try {
      for (const slack of [0, 2]) {
        apply(next, slack);
        demo = new module.Demo(screen.id);
        if (built(next)) break;
        unmount();
      }
      // A grid of another size than the element was sized for, with both slacks, is a failure
      // too: the module built something, but not the terminal the page laid out.
      if (!demo) throw new Error('the TUI grid did not match the measured size');
    } catch (error) {
      failures += 1;
      if (failures > 1) stop(error);
      else {
        console.debug('The live TUI demo failed to mount, retrying.', error);
        schedule();
      }
      return;
    }
    grid = next;
    if (badge) badge.hidden = false;
    if (hint) hint.hidden = hinted;
    armHint();
    send(view);
    syncTicks();
  };

  /** Remounts once the size has settled. */
  const schedule = () => {
    window.clearTimeout(remount);
    remount = window.setTimeout(() => {
      remount = undefined;
      void mount();
    }, 150);
  };

  /**
   * Gives the element the grid that fits now and has the demo lay the TUI out again at that
   * size, keeping its state. The element keeps its old size until the width settles, so the
   * demo's own window-resize handler, which runs after this one, rebuilds the same grid.
   */
  const fit = () => {
    refit = undefined;
    if (dead || !demo || !grid) return;
    const next = measure();
    if (same(next, grid)) return;
    grid = next;
    for (const slack of [0, 2]) {
      apply(next, slack);
      guard((demo) => demo.resize());
      // a failed resize has already scheduled a fresh mount
      if (!demo || built(next)) return;
    }
  };

  const resized = () => {
    if (dead || !started) return;
    if (remount !== undefined) {
      schedule();
      return;
    }
    window.clearTimeout(refit);
    refit = window.setTimeout(fit, 150);
  };

  /**
   * Runs the fake daemon's clock, and the touch screens' tour of the pages, only while someone
   * can see the demo and motion is allowed: the footer's pause button and reduced motion both
   * set `data-motion="paused"`.
   */
  const syncTicks = () => {
    const running =
      demo !== undefined &&
      visible &&
      !document.hidden &&
      document.documentElement.dataset.motion !== 'paused';
    if (running && ticker === undefined) {
      ticker = window.setInterval(() => guard((demo) => demo.tick()), 1000);
      if (touring) {
        tourTimer = window.setInterval(() => {
          tourStep = (tourStep + 1) % tour.length;
          send(tour[tourStep] ?? 'M');
        }, 6000);
      }
    } else if (!running && ticker !== undefined) {
      window.clearInterval(ticker);
      window.clearInterval(tourTimer);
      ticker = undefined;
      tourTimer = undefined;
    }
  };

  // The first tap ends the tour: from then on the page is whatever was tapped.
  screen.addEventListener(
    'pointerdown',
    () => {
      touring = false;
      window.clearInterval(tourTimer);
      tourTimer = undefined;
    },
    { once: true }
  );
  if (badgeText) {
    badgeText.textContent = idleLabel;
    screen.addEventListener('focus', () => {
      badgeText.textContent = 'Live, keys go to it';
    });
    screen.addEventListener('blur', () => {
      badgeText.textContent = idleLabel;
    });
  }

  screen.addEventListener('keydown', (event) => {
    // Copying text selected inside the demo belongs to the browser; the module leaves Command
    // shortcuts to it too, from the Meta flag.
    const selection = window.getSelection();
    if (
      event.ctrlKey &&
      event.key === 'c' &&
      selection &&
      !selection.isCollapsed &&
      screen.contains(selection.anchorNode)
    ) {
      return;
    }
    // AltGr arrives as Ctrl+Alt on Windows, but it types a character, not a chord.
    const altGraph = event.getModifierState('AltGraph');
    const used = guard((demo) =>
      demo.key(
        event.key,
        event.ctrlKey && !altGraph,
        event.altKey && !altGraph,
        event.shiftKey,
        event.metaKey
      )
    );
    if (!used) return;
    event.preventDefault();
    if (pages.includes(event.key)) view = event.key;
  });

  // With scripting, the static table never shows: an empty window of the live grid's size
  // holds the place under the hint, and the TUI appears in it already running. The static
  // table comes back only if the bundle is missing or throws.
  staticScreen.hidden = true;
  live.hidden = false;
  apply(measure(), 0);
  if (hint) hint.hidden = false;

  // Before the demo exists, so this listener runs before the demo's own on every resize.
  window.addEventListener('resize', resized);
  new ResizeObserver(resized).observe(wrapper);

  // Loading starts early so the demo is usually live by the time the wrapper scrolls in.
  const loader = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      loader.disconnect();
      started = true;
      void mount();
    },
    { rootMargin: '600px 0px' }
  );
  loader.observe(wrapper);

  new IntersectionObserver((entries) => {
    visible = entries.at(-1)?.isIntersecting ?? visible;
    syncTicks();
  }).observe(wrapper);
  document.addEventListener('visibilitychange', syncTicks);
  new MutationObserver(syncTicks).observe(document.documentElement, {
    attributeFilter: ['data-motion']
  });
}

if (typeof WebAssembly === 'object' && 'IntersectionObserver' in window) {
  for (const wrapper of wrappers) setup(wrapper);
}
