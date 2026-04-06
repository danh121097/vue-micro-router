/**
 * Navigation benchmark — measures push/back/stepWise latency.
 *
 * Run: bun run bench
 */
import { useNavigation } from '../libs/composables/use-navigation';
import { usePageTracker } from '../libs/composables/use-page-tracker';

const ITERATIONS = 100;

function createNav() {
  const tracker = usePageTracker();
  return useNavigation({ defaultPath: 'home', stepDelay: 0 }, tracker);
}

function formatStats(times: number[]) {
  times.sort((a, b) => a - b);
  const p50 = times[Math.floor(times.length * 0.5)]!;
  const p95 = times[Math.floor(times.length * 0.95)]!;
  const p99 = times[Math.floor(times.length * 0.99)]!;
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  return { avg: avg.toFixed(3), p50: p50.toFixed(3), p95: p95.toFixed(3), p99: p99.toFixed(3) };
}

async function benchPush() {
  const nav = createNav();
  // Register routes
  for (let i = 0; i < 50; i++) {
    nav.registerRoute({ path: `route${i}`, component: { render: () => null } } as any);
  }
  nav.registerRoute({ path: 'home', component: { render: () => null } } as any);

  const times: number[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const target = `route${i % 50}`;
    const start = performance.now();
    await nav.push(target);
    times.push(performance.now() - start);
    // Reset for next iteration — use pushCore via absolute path
    await nav.push('/home');
  }
  return times;
}

async function benchBack() {
  const nav = createNav();
  nav.registerRoute({ path: 'home', component: { render: () => null } } as any);
  nav.registerRoute({ path: 'page', component: { render: () => null } } as any);

  const times: number[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    await nav.push('page');
    const start = performance.now();
    await nav.push(-1);
    times.push(performance.now() - start);
  }
  return times;
}

function benchResolveRoutes() {
  const nav = createNav();
  for (let i = 0; i < 50; i++) {
    nav.registerRoute({ path: `r${i}`, component: { render: () => null } } as any);
  }

  const times: number[] = [];
  for (let i = 0; i < 1000; i++) {
    const start = performance.now();
    // Access computed to trigger resolution
    void nav.resolveRoutes.value;
    times.push(performance.now() - start);
  }
  return times;
}

async function main() {
  console.log('=== vue-micro-router Performance Benchmarks ===\n');

  console.log(`push() — ${ITERATIONS} iterations:`);
  const pushTimes = await benchPush();
  console.log('  ', formatStats(pushTimes), 'ms\n');

  console.log(`push(-1) back — ${ITERATIONS} iterations:`);
  const backTimes = await benchBack();
  console.log('  ', formatStats(backTimes), 'ms\n');

  console.log('resolveRoutes (50 routes) — 1000 accesses:');
  const resolveTimes = benchResolveRoutes();
  console.log('  ', formatStats(resolveTimes), 'ms\n');
}

main().catch(console.error);
