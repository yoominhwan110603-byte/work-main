import type { RouteLocationNormalizedLoaded, Router } from 'vue-router';

const PRIMARY_APP_PATHS = new Set([
  '/app',
  '/app/search',
  '/app/sell',
  '/app/collection',
  '/app/profile',
]);

const routeParam = (value: unknown) => encodeURIComponent(String(Array.isArray(value) ? value[0] || '' : value || ''));

function historyTargetPath(router: Router) {
  const target = router.options.history.state.back;
  if (typeof target !== 'string' || !target) return '';
  const hashIndex = target.indexOf('#');
  const normalizedTarget = hashIndex >= 0 ? target.slice(hashIndex + 1) || '/' : target;
  try {
    return router.resolve(normalizedTarget).path;
  } catch {
    return '';
  }
}

export function isPrimaryAppPath(path: string) {
  return PRIMARY_APP_PATHS.has(path);
}

export function hasSafeBackTarget(router: Router) {
  const currentPath = router.currentRoute.value.path;
  const targetPath = historyTargetPath(router);
  if (!targetPath || targetPath === currentPath) return false;

  const currentIsAppContent = currentPath.startsWith('/app')
    || currentPath.startsWith('/sell')
    || currentPath.startsWith('/collection')
    || currentPath.startsWith('/transaction')
    || currentPath.startsWith('/market')
    || currentPath === '/frequency';
  if (currentIsAppContent && (targetPath === '/' || targetPath.startsWith('/auth/'))) return false;
  return true;
}

export function fallbackPathForRoute(route: Pick<RouteLocationNormalizedLoaded, 'path' | 'params'>) {
  const { path, params } = route;
  if (path === '/frequency' || path === '/app/favorites') return '/app';
  if (path === '/app/pressing') return '/app/search';
  if (path.startsWith('/app/album/')) return '/app';
  if (path === '/app/settings' || path === '/app/notifications') return '/app/profile';
  if (path.startsWith('/app/profile/')) return '/app';
  if (path === '/app/collection/new') return '/app/collection';
  if (path.endsWith('/edit') && path.startsWith('/app/collection/')) return `/app/collection/${routeParam(params.id)}`;
  if (path.endsWith('/offer') && path.startsWith('/app/collection/')) return `/app/collection/${routeParam(params.id)}`;
  if (path.startsWith('/app/collection/')) return '/app/collection';
  if (path.endsWith('/edit') && path.startsWith('/app/sell/')) return '/app/profile';
  if (path === '/sell/camera' || path === '/sell/analysis') return '/app/sell';
  if (path === '/sell/analysis/result') return '/sell/analysis';
  if (path.startsWith('/market/buy-order/')) return `/app/album/${routeParam(params.listingId)}`;
  if (path.startsWith('/transaction/offer/')) return `/app/album/${routeParam(params.albumId)}`;
  if (path.startsWith('/transaction/location/') || path.startsWith('/transaction/cancel/') || path.startsWith('/transaction/review/')) {
    return `/transaction/ongoing/${routeParam(params.transactionId)}`;
  }
  if (path.startsWith('/transaction/')) return '/app';
  if (path.startsWith('/auth/') && path !== '/auth/login') return '/auth/login';
  return '/app';
}

export function goBackOr(router: Router, fallback: string) {
  if (hasSafeBackTarget(router)) {
    router.back();
    return;
  }
  void router.replace(fallback);
}

export function goBack(router: Router) {
  goBackOr(router, fallbackPathForRoute(router.currentRoute.value));
}
