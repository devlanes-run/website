// Stands in for /tui/devlanes_tui_web.js in test/tui.test.ts, with the same API as the
// devlanes-tui-web bundle. Calls are recorded on `window.tuiDemo`. Keys listed in
// `window.tuiDemo.unused` (chords as `Ctrl+<key>`) are reported as unused, like the TUI does for
// keys it ignores. `window.tuiDemoFail` makes one step fail the way a panic in the real module
// does: 'init', 'mount', 'key' or 'tick'; 'grid' makes every grid one column short.
const calls = {
  inits: 0,
  constructed: 0,
  mounts: [],
  keys: [],
  metaKeys: [],
  ticks: 0,
  resizes: 0,
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
   * Measures the element and builds a grid the way Ratzilla's DomBackend does, so the test
   * sees the number of cells the real TUI would get.
   */
  constructor(id) {
    calls.constructed += 1;
    failAt('mount');
    this.id = id;
    this.build();
  }

  /** Builds the grid at the element's current size, recording it as a mount. */
  build() {
    const id = this.id;
    const element = document.getElementById(id);
    element.innerHTML = '';
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
    // `grid`: the module measures the element differently from the page and builds a grid one
    // column short, whatever slack the page adds.
    const columns = Math.floor(area.width / size.width) - (window.tuiDemoFail === 'grid' ? 1 : 0);
    const rows = Math.floor(area.height / size.height);
    calls.mounts.push({ id, columns, rows });
    const grid = document.createElement('div');
    grid.id = `${id}_ratzilla_grid`;
    const label = 'devlanes live demo';
    for (let y = 0; y < rows; y += 1) {
      const line = document.createElement('pre');
      line.setAttribute('style', `height: ${size.height}px;`);
      for (let x = 0; x < columns; x += 1) {
        const span = document.createElement('span');
        span.textContent = y === 0 && x < label.length ? label[x] : ' ';
        span.setAttribute('style', 'display: inline-block; width: 1ch;');
        line.append(span);
      }
      grid.append(line);
    }
    element.append(grid);
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

  /** Lays the grid out again at the element's size, like the real module keeps its state. */
  resize() {
    calls.resizes += 1;
    this.build();
  }

  /** Counts a second of the fake daemon's clock. */
  tick() {
    failAt('tick');
    calls.ticks += 1;
  }

  /** Counts unmounts and empties the element, like the real module's Drop. */
  free() {
    calls.frees += 1;
    const element = document.getElementById(this.id);
    if (element) element.innerHTML = '';
  }
}
