// The demo project in the terminal mockups. Numbers follow devlanes' defaults: lane N owns
// the 10-port block from 20000 + 10N, and units take offsets in alphabetical order.
export interface Unit {
  name: 'api' | 'web' | 'worker';
  state: 'ready' | 'running';
  cpu: number;
  mem: number;
  uptime: string;
}

export interface Lane {
  index: number;
  branch: string;
  units: Unit[];
}

const unit = (name: Unit['name'], cpu: number, mem: number, uptime: string): Unit => ({
  name,
  state: name === 'worker' ? 'running' : 'ready',
  cpu,
  mem,
  uptime
});

export const lanes: Lane[] = [
  {
    index: 0,
    branch: 'main',
    units: [
      unit('api', 4.1, 118, '2h 14m'),
      unit('web', 3.2, 97, '2h 14m'),
      unit('worker', 1.7, 71, '2h 14m')
    ]
  },
  {
    index: 1,
    branch: 'feat/checkout',
    units: [
      unit('api', 7.9, 142, '18m'),
      unit('web', 3.1, 126, '18m'),
      unit('worker', 1.6, 73, '18m')
    ]
  },
  // Stopped, so status shows it as idle and the monitor leaves it out.
  { index: 2, branch: 'fix/login', units: [] },
  {
    index: 3,
    branch: 'agent/perf',
    units: [unit('api', 31.2, 288, '6m'), unit('web', 4, 131, '6m'), unit('worker', 3.2, 94, '6m')]
  }
];

const offsets = { api: 0, web: 1, worker: 2 };

export const port = (lane: number, name: Unit['name']) => 20000 + lane * 10 + offsets[name];

export const domain = (lane: number) =>
  lane === 0 ? 'myapp.localhost' : `myapp-${lane}.localhost`;

export const total = (units: Unit[], key: 'cpu' | 'mem') =>
  units.reduce((sum, item) => sum + item[key], 0);
