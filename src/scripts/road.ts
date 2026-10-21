function initializeRoad(): void {
  const road = document.querySelector<HTMLElement>('[data-road]');
  const traffic = road?.querySelector<HTMLElement>('[data-road-traffic]');
  if (!road || !traffic) return;

  const templates = Array.from(traffic.querySelectorAll<HTMLElement>('.vehicle'));
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const motion = document.getElementById('motion');
  const root = document.documentElement;
  let paused = preference.matches;
  let frame: number | undefined;
  let last: number | undefined;
  let elapsed = 0;
  let height = 0;
  let repeats = 0;
  let fleet: { node: HTMLElement; track: number; phase: number; speed: number }[] = [];

  function draw(): void {
    const length = height + 160;
    for (const item of fleet) {
      const travel = ((elapsed * item.speed + item.phase) % length) - 80;
      const y = item.track > 0 ? height - travel : travel;
      item.node.style.transform = `translateY(${y.toFixed(1)}px)`;
      item.node.style.opacity = String(0.72 * Math.max(0, Math.min(1, y / 80, (height - y) / 100)));
    }
  }

  function updateMarkings(): void {
    if (!paused && !document.hidden) {
      road?.style.setProperty('--road-scroll', `${(-window.scrollY * 0.2) % 76}px`);
    }
  }

  function tick(now: number): void {
    frame = undefined;
    if (paused || document.hidden) return;
    if (last !== undefined) elapsed += Math.min(now - last, 64) / 1000;
    last = now;
    draw();
    frame = window.requestAnimationFrame(tick);
  }

  function syncMotion(): void {
    root.dataset.motion = paused ? 'paused' : 'running';
    if (motion) {
      motion.hidden = false;
      motion.textContent = paused ? 'Play motion' : 'Pause motion';
      motion.setAttribute('aria-pressed', String(paused));
    }
    if (frame !== undefined) window.cancelAnimationFrame(frame);
    frame = undefined;
    last = undefined;
    if (!paused && !document.hidden) {
      updateMarkings();
      frame = window.requestAnimationFrame(tick);
    }
  }

  function measure(): void {
    if (!road || !traffic) return;
    height = Math.max(document.body.scrollHeight, document.body.offsetHeight, root.clientHeight);
    const laneWidth =
      Number.parseFloat(getComputedStyle(root).getPropertyValue('--lane-width')) || 160;
    const outerLane = Math.max(2, Math.floor(root.clientWidth / (2 * laneWidth)));
    const count = Math.max(1, Math.ceil(height / 1200));

    if (count !== repeats) {
      repeats = count;
      fleet = [];
      const fragment = document.createDocumentFragment();
      for (let copy = 0; copy < count; copy += 1) {
        for (const template of templates) {
          const node = template.cloneNode(true);
          if (!(node instanceof HTMLElement)) continue;
          const track = Number(template.dataset.track);
          const group = Number(template.dataset.group);
          const service = Number(template.dataset.service);
          node.style.top = '0';
          fragment.append(node);
          fleet.push({
            node,
            track,
            phase: copy * 1200 + group * 317 + service * 155,
            speed: 45 + group * 3
          });
        }
      }
      traffic.replaceChildren(fragment);
    }

    for (const item of fleet) {
      const lane = outerLane - 2 + Math.abs(item.track);
      item.node.style.setProperty('--lane-offset', String(Math.sign(item.track) * (lane - 0.5)));
    }
    draw();
    updateMarkings();
  }

  motion?.addEventListener('click', () => {
    paused = !paused;
    syncMotion();
  });
  preference.addEventListener('change', (event) => {
    paused = event.matches;
    syncMotion();
  });
  document.addEventListener('visibilitychange', syncMotion);
  window.addEventListener('scroll', updateMarkings, { passive: true });
  window.addEventListener('resize', measure);
  const observer = new ResizeObserver(measure);
  observer.observe(document.body);
  void document.fonts.ready.then(measure);
  measure();
  syncMotion();
}

initializeRoad();
