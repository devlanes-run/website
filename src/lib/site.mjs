// Shared by astro.config.mjs, the site layout and the files written for language models.
export const siteDescription =
  'devlanes is an open source CLI and daemon that runs your dev stack per Git worktree, each with its own ports, hostnames and databases, on your machine or mirrored from a box over ssh.';

// Pages outside the docs. integrations/markdown.mjs converts each one's built HTML into its
// Markdown twin, and llms.txt lists them under Optional. A page with `endpoint` writes its own
// twin instead: the examples index is a list of data, which reads better written from the data.
/** @type {{ path: string, twin: string, title: string, endpoint?: boolean }[]} */
export const sitePages = [
  { path: '/', twin: '/index.md', title: 'Home page' },
  { path: '/lanes/', twin: '/lanes.md', title: 'Lanes' },
  { path: '/remote/', twin: '/remote.md', title: 'Remote boxes' },
  { path: '/agents/', twin: '/agents.md', title: 'Coding agents' },
  { path: '/examples/', twin: '/examples.md', title: 'Examples', endpoint: true }
];
