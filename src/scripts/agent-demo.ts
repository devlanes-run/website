const controls = document.querySelectorAll<HTMLButtonElement>('[data-scene]');
for (const button of controls) {
  button.addEventListener('click', () => {
    for (const control of controls)
      control.setAttribute('aria-pressed', String(control === button));
    for (const scene of document.querySelectorAll<HTMLElement>('.scene'))
      scene.hidden = scene.id !== `scene-${button.dataset.scene}`;
  });
  button.hidden = false;
}
const sceneControls = document.querySelector<HTMLElement>('.scene-controls');
if (sceneControls) sceneControls.hidden = false;
