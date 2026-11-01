// Stands in for /tui/devlanes_tui_web.js in test/monitor.test.ts, with the same API as the
// devlanes-tui-web bundle. Calls are recorded on `window.tuiDemo`; keys listed in
// `window.tuiDemo.unused` are reported as unused, like the TUI does for keys it ignores.
const calls = {
  inits: 0,
  mounts: [],
  keys: [],
  ticks: 0,
  frees: 0,
  unused: ['Tab', 'Shift'],
  // Set by a test to make `tick` throw, as a panic in the real module does.
  failTick: false
};
window.tuiDemo = calls;

/** Resolves like wasm-bindgen's init once the `.wasm` would be loaded. */
export default async function init() {
  calls.inits += 1;
}

export class Demo {
  /**
   * Measures the element the way Ratzilla's DomBackend does, so the test sees the number of
   * cells the real TUI would get.
   */
  constructor(id) {
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

  /** Records the key and reports it as used unless the test listed it in `unused`. */
  key(key, ctrl, alt, shift) {
    calls.keys.push([key, ctrl, alt, shift]);
    return !calls.unused.includes(key);
  }

  /** Counts a second of the fake daemon's clock, or throws when the test asked for a failure. */
  tick() {
    if (calls.failTick) throw new Error('RuntimeError: unreachable');
    calls.ticks += 1;
  }

  /** Counts unmounts. */
  free() {
    calls.frees += 1;
  }
}
