import type { Router } from 'vue-router';

export function goBackOr(router: Router, fallback: string) {
  const back = router.options.history.state.back;
  if (typeof back === 'string' && back) {
    router.back();
    return;
  }
  router.push(fallback);
}
