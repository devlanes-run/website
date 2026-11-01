// The hero's background: toon-shaded charcoal cars (Kenney Car Kit, CC0) driving along four lanes
// in the sign's yellow. The camera sits behind and left of the hero car and follows it; nothing is
// tied to scroll.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const PAINT = 0xf5c542;
const CHARCOAL = 0x24221e;
const LANE_W = 4.4;
const HERO = 1;
// dashes loop behind the hero so the road never ends
const LOOP = 136;
// every car in the kit is CC0
const KIT = [
  'sedan',
  'hatchback-sports',
  'race',
  'taxi',
  'suv',
  'van',
  'police',
  'truck',
  'delivery',
  'suv-luxury'
];

interface Car {
  g: THREE.Group;
  speed: number;
  /** The lane's centre; the car wanders a little either side of it. */
  x: number;
  /** Two slow sine waves per car, so no two wander alike. */
  wander: { phase: number; rate: number; phase2: number; rate2: number };
}

const WANDER = 0.16;

function laneX(lane: number): number {
  return (lane - 1.5) * LANE_W;
}

function pick(): string {
  return KIT[Math.floor(Math.random() * KIT.length)] ?? 'sedan';
}

function contactShadow(): THREE.Material | undefined {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;
  const grd = ctx.createRadialGradient(128, 128, 20, 128, 128, 128);
  grd.addColorStop(0, 'rgba(0,0,0,.5)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(canvas),
    transparent: true,
    depthWrite: false
  });
}

function start(host: HTMLElement): void {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = matchMedia('(max-width: 720px)').matches;

  // phones: no antialiasing, lower pixel ratio and only the hero's lane
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: !small,
    powerPreference: 'low-power'
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  // fog in the sign's own yellow: anything beyond the lower band fades out before the copy
  scene.fog = new THREE.Fog(PAINT, small ? 20 : 19, small ? 29 : 33);
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 160);

  // a warm hemisphere plus one key, so the toon bands read on charcoal
  scene.add(new THREE.HemisphereLight(0xfff1c2, 0x2a2200, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(4, 7, 5);
  scene.add(key);

  // three-band toon ramp
  const ramp = new THREE.DataTexture(
    new Uint8Array([70, 70, 70, 255, 160, 160, 160, 255, 255, 255, 255, 255]),
    3,
    1,
    THREE.RGBAFormat
  );
  ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
  ramp.needsUpdate = true;
  const carMat = new THREE.MeshToonMaterial({ color: CHARCOAL, gradientMap: ramp });

  // dashed dividers in black on the yellow, long enough to stream past while the hero drives
  const dash = new THREE.PlaneGeometry(0.12, 1.5);
  const dashMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.32,
    fog: true
  });
  const dashes: THREE.Mesh[] = [];
  const laneLines = small ? [HERO, HERO + 1] : [0, 1, 2, 3, 4];
  for (const i of laneLines) {
    for (let z = 16; z > -120; z -= 3.6) {
      const d = new THREE.Mesh(dash, dashMat);
      d.rotation.x = -Math.PI / 2;
      d.position.set(laneX(i) - LANE_W / 2, 0, z);
      scene.add(d);
      dashes.push(d);
    }
  }

  const shadowMat = contactShadow();
  const shadowGeo = new THREE.PlaneGeometry(4.6, 3.4);

  const loader = new GLTFLoader();
  const cars: Car[] = [];
  const makeCar = (
    file: string,
    lane: number,
    z: number,
    speed: number
  ): Promise<Car | undefined> =>
    new Promise((resolve) => {
      loader.load(
        `/models/${file}.glb`,
        (gltf) => {
          const g = new THREE.Group();
          gltf.scene.traverse((o) => {
            if (o instanceof THREE.Mesh) o.material = carMat;
          });
          const box = new THREE.Box3().setFromObject(gltf.scene);
          const size = box.getSize(new THREE.Vector3());
          gltf.scene.scale.setScalar(3.2 / Math.max(size.x, size.z));
          const b2 = new THREE.Box3().setFromObject(gltf.scene);
          const c = b2.getCenter(new THREE.Vector3());
          gltf.scene.position.set(-c.x, -b2.min.y, -c.z);
          // the kit's cars face +z; traffic drives toward -z
          gltf.scene.rotation.y = Math.PI;
          g.add(gltf.scene);
          if (shadowMat) {
            const sh = new THREE.Mesh(shadowGeo, shadowMat);
            sh.rotation.x = -Math.PI / 2;
            sh.position.y = 0.005;
            g.add(sh);
          }
          // models arrive while the hero is already driving, so traffic spawns around it
          g.position.set(laneX(lane), 0, z + (hero ? hero.g.position.z : 0));
          scene.add(g);
          const car: Car = {
            g,
            speed,
            x: laneX(lane),
            wander: {
              phase: Math.random() * Math.PI * 2,
              rate: 0.35 + Math.random() * 0.35,
              phase2: Math.random() * Math.PI * 2,
              rate2: 0.9 + Math.random() * 0.6
            }
          };
          cars.push(car);
          resolve(car);
        },
        undefined,
        // a missing model leaves a gap in its lane; the others still drive
        () => resolve(undefined)
      );
    });

  const fill = (lane: number, speed: number): Promise<Car | undefined>[] =>
    Array.from({ length: 4 }, (_, k) =>
      makeCar(pick(), lane, 6 - k * 16 - Math.random() * 6, speed)
    );

  let hero: Car | undefined;

  // camera: fixed behind and to the left of the hero, following it. The car's centre lands at
  // `frac` of the frame height, below the copy on every aspect ratio.
  const target = new THREE.Vector3(laneX(HERO), 2.45, 0);
  // the copy sits over the scene; the car's centre goes below its bottom edge, never above it
  const copy = host.parentElement?.querySelector<HTMLElement>('.hero');
  let frac = small ? 0.8 : 0.76;
  const measure = (): void => {
    const h = host.clientHeight;
    if (!copy || !h) return;
    const bottom = copy.getBoundingClientRect().bottom - host.getBoundingClientRect().top;
    // and stays clear of the fade at the foot of the sign
    frac = Math.min(1 - 190 / h, Math.max(small ? 0.8 : 0.76, (bottom + h * 0.16) / h));
  };
  const place = (): void => {
    const a = small ? -0.25 : -0.5;
    const e = 0.36;
    const r = 21;
    const visibleH = 2 * r * Math.tan((camera.fov * Math.PI) / 360);
    const ty = 0.75 + (frac - 0.5) * visibleH;
    // aim between the hero's lane and the idle one, so both side lanes stay in frame
    if (hero) {
      // the lane's centre, not the car's, so the frame holds still while the hero wanders
      target.set(hero.x + (small ? 0 : LANE_W * 0.4), ty, hero.g.position.z - 1);
    } else {
      target.y = ty;
    }
    camera.position.set(
      target.x + r * Math.sin(a) * Math.cos(e),
      r * Math.sin(e) + 0.8,
      target.z + r * Math.cos(a) * Math.cos(e)
    );
    camera.lookAt(target);
  };
  const render = (): void => {
    place();
    renderer.render(scene, camera);
  };

  host.prepend(renderer.domElement);
  const fit = (): void => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? 40 : 26;
    camera.updateProjectionMatrix();
    measure();
    render();
  };
  new ResizeObserver(fit).observe(host);
  fit();
  void document.fonts.ready.then(fit);

  // motion: main is slower than the hero, agent/perf faster, so traffic is overtaken and overtakes.
  // The road streams from the first frame; cars join as their models arrive. The loop sleeps off
  // screen, in hidden tabs and while the footer's motion button has it paused.
  let visible = true;
  let raf = 0;
  let last = 0;
  const active = (): boolean =>
    !reduced && visible && !document.hidden && document.documentElement.dataset.motion !== 'paused';
  const tick = (now: number): void => {
    raf = 0;
    if (!active()) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const heroZ = hero ? hero.g.position.z : 0;
    const t = now / 1000;
    for (const c of cars) {
      c.g.position.z -= c.speed * dt;
      // a slow drift across the lane plus a faster, smaller one; the car steers into it
      const { phase, rate, phase2, rate2 } = c.wander;
      const drift =
        Math.sin(t * rate + phase) * WANDER + Math.sin(t * rate2 + phase2) * (WANDER / 4);
      const slope =
        Math.cos(t * rate + phase) * WANDER * rate +
        Math.cos(t * rate2 + phase2) * (WANDER / 4) * rate2;
      c.g.position.x = c.x + drift;
      c.g.rotation.y = -slope / c.speed;
      c.g.rotation.z = slope * 0.04;
      if (c === hero) continue;
      // beyond the fog nothing is visible, so the loop is short and a car is never gone for long
      if (c.g.position.z < heroZ - 40) c.g.position.z = heroZ + 24 + Math.random() * 8;
      if (c.g.position.z > heroZ + 30) c.g.position.z = heroZ - 36 - Math.random() * 6;
    }
    for (const m of dashes) {
      if (m.position.z > heroZ + 22) m.position.z -= LOOP;
    }
    render();
    raf = requestAnimationFrame(tick);
  };
  const run = (): void => {
    if (raf || !active()) return;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  };

  // the hero starts where the dashes loop around (z 0) and the others spawn relative to it
  void makeCar('sedan-sports', HERO, 0, 7.5).then((c) => {
    hero = c;
    render();
  });
  if (!small) {
    for (const p of [...fill(0, 6.2), ...fill(3, 11.5)]) void p.then(render);
  }

  if (reduced) return;
  run();
  new IntersectionObserver(
    ([entry]) => {
      visible = entry?.isIntersecting ?? true;
      run();
    },
    { threshold: 0.02 }
  ).observe(host);
  document.addEventListener('visibilitychange', run);
  new MutationObserver(run).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-motion']
  });
}

function init(): void {
  const host = document.querySelector<HTMLElement>('[data-road-scene]');
  if (!host || !window.WebGLRenderingContext) return;
  try {
    start(host);
  } catch {
    // no usable WebGL: the sign stays plain yellow
  }
}

init();
