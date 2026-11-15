// Starlight has one sidebar for the whole site. The examples sit in one group of it
// (astro.config.mjs), which this shows alone on their pages and hides on the docs, so each
// section has its own navigation. Previous and next links stay inside the section too.
import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import { examplesGroup } from './example-taxonomy.mjs';

export const onRequest = defineRouteMiddleware((context) => {
  const route = context.locals.starlightRoute;
  const inExamples = route.id.startsWith('examples/');
  const group = route.sidebar.find(
    (entry) => entry.type === 'group' && entry.label === examplesGroup
  );
  if (group?.type !== 'group') return;

  if (inExamples) {
    route.sidebar = [
      {
        type: 'link',
        label: 'All examples',
        href: '/examples/',
        isCurrent: false,
        badge: undefined,
        attrs: {}
      },
      ...group.entries
    ];
  } else {
    route.sidebar = route.sidebar.filter((entry) => entry !== group);
  }
  const outside = (href: string | undefined) =>
    href !== undefined && href.startsWith('/examples/') !== inExamples;
  if (outside(route.pagination.prev?.href)) route.pagination.prev = undefined;
  if (outside(route.pagination.next?.href)) route.pagination.next = undefined;
});
