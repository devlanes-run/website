// Shows the docs of a config key (integrations/config-docs.mjs) in one floating tooltip: on
// hover with a mouse, on tap on touch screens. It lives in <body> so the code block's
// horizontal scrolling does not clip it.
(() => {
  const tip = document.createElement('div');
  tip.className = 'devlanes-config-tip';
  tip.setAttribute('role', 'tooltip');
  tip.hidden = true;
  let anchor = null;
  let hideTimer;
  let lastPointer = 'mouse';

  const keyOf = (target) =>
    target instanceof Element ? target.closest('.devlanes-config-key') : null;

  function place() {
    if (!anchor) return;
    const box = anchor.getBoundingClientRect();
    const gap = 6;
    const margin = 8;
    const left = Math.min(box.left, innerWidth - tip.offsetWidth - margin);
    const fitsBelow = box.bottom + gap + tip.offsetHeight + margin <= innerHeight;
    const fitsAbove = box.top - gap - tip.offsetHeight >= margin;
    tip.style.left = `${Math.max(margin, left)}px`;
    tip.style.top = `${fitsBelow || !fitsAbove ? box.bottom + gap : box.top - gap - tip.offsetHeight}px`;
  }

  function hide() {
    clearTimeout(hideTimer);
    anchor?.classList.remove('is-active');
    anchor = null;
    tip.hidden = true;
  }

  function show(key) {
    clearTimeout(hideTimer);
    if (key === anchor) return;
    const docs = key.closest('.devlanes-config')?.querySelector('.devlanes-config-docs');
    const doc = docs?.querySelector(`[data-doc="${key.dataset.doc}"]`);
    if (!doc) return;
    anchor?.classList.remove('is-active');
    anchor = key;
    key.classList.add('is-active');
    tip.replaceChildren(...doc.cloneNode(true).childNodes);
    if (!tip.isConnected) document.body.append(tip);
    tip.hidden = false;
    place();
  }

  // A short delay lets the pointer cross the gap from the key into the tooltip.
  function hideSoon() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hide, 150);
  }

  document.addEventListener('pointerdown', (event) => {
    lastPointer = event.pointerType;
  });

  document.addEventListener('pointerover', (event) => {
    if (event.pointerType === 'touch') return;
    const key = keyOf(event.target);
    if (key) show(key);
    else if (tip.contains(event.target)) clearTimeout(hideTimer);
  });

  document.addEventListener('pointerout', (event) => {
    if (event.pointerType === 'touch' || !anchor) return;
    if (keyOf(event.target) || tip.contains(event.target)) hideSoon();
  });

  document.addEventListener('click', (event) => {
    const key = keyOf(event.target);
    if (key && key === anchor && lastPointer === 'touch') hide();
    else if (key) show(key);
    else if (!tip.contains(event.target)) hide();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hide();
  });

  // Capturing catches the code block's own horizontal scroll as well as the page's.
  addEventListener('scroll', place, { capture: true, passive: true });
  addEventListener('resize', hide);
})();
