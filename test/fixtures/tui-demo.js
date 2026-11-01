// Stands in for /tui/devlanes_tui_web.js in test/monitor.test.ts, with the same API as the
// devlanes-tui-web bundle. Calls are recorded on `window.tuiDemo`. Keys listed in
// `window.tuiDemo.unused` (chords as `Ctrl+<key>`) are reported as unused, like the TUI does for
// keys it ignores. `window.tuiDemoFail` makes one step fail the way a panic in the real module
// does: 'init', 'mount', 'key' or 'tick'.
const calls = {
  inits: 0,
  constructed: 0,
  mounts: [],
  keys: [],
  metaKeys: [],
  ticks: 0,
  frees: 0,
  unused: ['Tab', 'Shift', 'Control', 'Ctrl+l']
};
window.tuiDemo = calls;

/** Throws when the test asked `step` to fail. */
function failAt(step) {
  if (window.tuiDemoFail === step) throw new Error('RuntimeError: unreachable');
}

/** Resolves like wasm-bindgen's init once the `.wasm` would be loaded. */
export default async function init() {
  calls.inits += 1;
  failAt('init');
}

export class Demo {
  /**
   * Measures the element the way Ratzilla's DomBackend does, so the test sees the number of
   * cells the real TUI would get.
   */
  constructor(id) {
    calls.constructed += 1;
    failAt('mount');
    const element = document.getElementById(id);
    const probe = document.createElement('pre');
    probe.setAttribute('style', 'margin: 0; padding: 0; border: 0; line-height: normal;');
    const cell = document.createElement('span');
    cell.textContent = '\u2588';
    cell.setAttribute('style', 'display: inline-block; width: 1ch;');
    probe.append(cell);
    element.append(probe);
    const size = cell.getBoundingClientRect();
    probe.remove();
    const area = element.getBoundingClientRect();
    calls.mounts.push({
      id,
      columns: Math.floor(area.width / size.width),
      rows: Math.floor(area.height / size.height)
    });
    element.textContent = 'devlanes live demo';
  }

  /**
   * Records the key and reports it as used unless the test listed it in `unused`. Meta chords
   * are recorded apart and refused, as the real module leaves them to the browser.
   */
  key(key, ctrl, alt, shift, meta) {
    if (meta) {
      calls.metaKeys.push(key);
      return false;
    }
    calls.keys.push([key, ctrl, alt, shift]);
    failAt('key');
    const name = ctrl && key !== 'Control' ? `Ctrl+${key}` : key;
    return !calls.unused.includes(name);
  }

  /** Counts a second of the fake daemon's clock. */
  tick() {
    failAt('tick');
    calls.ticks += 1;
  }

  /** Counts unmounts. */
  free() {
    calls.frees += 1;
  }
}
