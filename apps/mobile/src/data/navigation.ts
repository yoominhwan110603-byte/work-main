import type { Router } from 'vue-router';

export function goBackOr(router: Router, fallback: string) {
  if (window.history.length > 1) {
    router.back();
    return;
  }
  router.push(fallback);
}
