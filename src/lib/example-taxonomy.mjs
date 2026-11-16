// How the examples catalogue (catalog.json of devlanes-run/examples) is read on the site: which
// of its values get an icon and a filter, and how its features fold into groups. Plain JS so
// astro.config.mjs can list the icons to bundle.

/** Label of the sidebar group that holds the examples; see src/lib/route-data.ts. */
export const examplesGroup = 'Examples';

/** Categories in the catalogue's order, with the line shown under each heading. */
export const categories = [
  { id: 'basics', label: 'Basics', text: 'Start here if devlanes is new to you.' },
  { id: 'languages', label: 'Languages', text: 'Services written in Python, Rust, Java and Go.' },
  { id: 'web', label: 'Web', text: 'Browser apps and the APIs they call, behind the HTTPS proxy.' },
  {
    id: 'frameworks',
    label: 'Frameworks',
    text: 'Dev servers that devlanes runs through a preset.'
  },
  {
    id: 'infra',
    label: 'Infra',
    text: 'Databases and other containers, shared between lanes or one for each.'
  },
  { id: 'workflows', label: 'Workflows', text: 'How a team repository uses devlanes day to day.' },
  {
    id: 'showcase',
    label: 'Showcase',
    text: 'Larger stacks for trying the TUI and seeing failures.'
  },
  { id: 'remote', label: 'Remote', text: 'Lanes that run on another machine and open on yours.' }
];

// Icons are the brands' own logos in their own colours (the `logos` set). A brand whose logo is
// black or white (Rust, Next.js, Deno, Tailscale) is drawn in the text colour instead, so it
// reads in both themes, and one the set lacks is a single-colour glyph in the brand's `color`.

/** Languages of the catalogue's `languages` field. */
export const languages = [
  { id: 'typescript', label: 'TypeScript', icon: 'logos:typescript-icon' },
  { id: 'python', label: 'Python', icon: 'logos:python' },
  { id: 'rust', label: 'Rust', icon: 'simple-icons:rust' },
  { id: 'java', label: 'Java', icon: 'logos:java' },
  { id: 'go', label: 'Go', icon: 'logos:go' },
  { id: 'shell', label: 'Shell', icon: 'simple-icons:gnubash', color: '#4eaa25' },
  { id: 'deno', label: 'Deno', icon: 'simple-icons:deno' }
];

/**
 * Tools that get an icon and a filter. `from` lists the catalogue's `frameworks` values that
 * count as the tool; values no entry names show as plain text on an example's page.
 */
export const stacks = [
  { id: 'hono', label: 'Hono', icon: 'logos:hono', from: ['hono'] },
  { id: 'vite', label: 'Vite', icon: 'logos:vitejs', from: ['vite'] },
  { id: 'react', label: 'React', icon: 'logos:react', from: ['react'] },
  { id: 'next', label: 'Next.js', icon: 'simple-icons:nextdotjs', from: ['next'] },
  { id: 'fastapi', label: 'FastAPI', icon: 'logos:fastapi-icon', from: ['fastapi'] },
  { id: 'tauri', label: 'Tauri', icon: 'logos:tauri', from: ['tauri'] },
  {
    id: 'cloudflare',
    label: 'Cloudflare',
    icon: 'logos:cloudflare-icon',
    from: ['wrangler', 'cloudflare-vite-plugin', 'cloudflared']
  },
  { id: 'docker', label: 'Docker', icon: 'logos:docker-icon', from: ['docker', 'docker-compose'] },
  { id: 'postgres', label: 'Postgres', icon: 'logos:postgresql', from: ['postgres'] },
  { id: 'redis', label: 'Redis', icon: 'logos:redis', from: ['redis'] },
  {
    id: 'clickhouse',
    label: 'ClickHouse',
    icon: 'simple-icons:clickhouse',
    color: '#f5b800',
    from: ['clickhouse']
  },
  { id: 'rabbitmq', label: 'RabbitMQ', icon: 'logos:rabbitmq-icon', from: ['rabbitmq'] },
  { id: 'pnpm', label: 'pnpm', icon: 'simple-icons:pnpm', color: '#f69220', from: ['pnpm'] },
  { id: 'turbo', label: 'Turborepo', icon: 'logos:turborepo-icon', from: ['turbo'] },
  { id: 'caddy', label: 'Caddy', icon: 'simple-icons:caddy', color: '#1f88c0', from: ['caddy'] },
  {
    id: 'github-actions',
    label: 'GitHub Actions',
    icon: 'logos:github-actions',
    from: ['github-actions']
  },
  {
    id: 'openid',
    label: 'OpenID Connect',
    icon: 'simple-icons:openid',
    color: '#f78c40',
    from: ['openid-client']
  },
  { id: 'tailscale', label: 'Tailscale', icon: 'simple-icons:tailscale', from: ['tailscale'] },
  { id: 'ssh', label: 'SSH', icon: 'mdi:console-network', from: ['ssh'] }
];

/**
 * Groups of the catalogue's `features`, in the order a reader meets them. A feature joins the
 * first group one of whose patterns matches it; the last group takes the rest.
 */
export const featureGroups = [
  {
    id: 'infra',
    label: 'Databases and containers',
    match: [/^infra\b/, /^DEVLANES_COMPOSE/]
  },
  {
    id: 'hosts',
    label: 'Hostnames and HTTPS',
    match: [/^hosts\b/, /^domain\(\)$/, /^lane\.domain$/, /^lanes\.hosts_file$/, /_CERT/, /^proxy /]
  },
  {
    id: 'env',
    label: 'Ports, URLs and variables',
    match: [
      /^services\.<name>\./,
      /^self\.port/,
      /^DEVLANES_/,
      /^env\./,
      /^global_env$/,
      /^lanes\.vars$/,
      /^lane\.data_path$/,
      /^project\.primary_path$/,
      /^--env$/,
      /^ports\./
    ]
  },
  { id: 'ready', label: 'Ready checks', match: [/^ready\b/] },
  { id: 'tasks', label: 'Tasks and lane events', match: [/^tasks\b/] },
  {
    id: 'profiles',
    label: 'Profiles, tags and templates',
    match: [
      /^profiles\b/,
      /^tags$/,
      /^templates$/,
      /^extends$/,
      /^autostart$/,
      /^devlanes\.local\.yaml$/,
      /^devlanes --file$/
    ]
  },
  { id: 'presets', label: 'Framework presets', match: [/^preset: /, /^wrangler\./] },
  {
    id: 'run',
    label: 'Run scripts and languages',
    match: [/^run$/, /^run_scripts?\b/, /^platform\b/, /^mise$/, /^direnv$/]
  },
  {
    id: 'workers',
    label: 'Workers and replicas',
    match: [/^replicas?\b/, /^keep_awake$/, /^stop\.signal$/, /^pty$/, /^startup$/]
  },
  {
    id: 'projects',
    label: 'Monorepos and several projects',
    match: [/^projects\.<name>\./, /^devlanes -p$/, /^lanes\.main\./]
  },
  {
    id: 'remote',
    label: 'Remote boxes',
    match: [/^remote\./, /^devlanes remote /, /^devlanes daemon /, /^hidden$/, /^sync$/]
  },
  { id: 'cli', label: 'Commands and debugging', match: [/^devlanes\b/] }
];

/** Icon names astro-icon must bundle for the examples pages. */
export const taxonomyIcons = () => {
  /** @type {Record<string, string[]>} */
  const sets = {};
  for (const { icon } of [...languages, ...stacks]) {
    const [set = '', name = ''] = icon.split(':');
    sets[set] = [...(sets[set] ?? []), name];
  }
  return sets;
};
