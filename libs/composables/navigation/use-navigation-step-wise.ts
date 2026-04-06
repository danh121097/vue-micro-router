/**
 * Step-wise navigation — animate through intermediate pages one-by-one.
 *
 * stepWisePush walks forward through each segment with a delay between transitions.
 * stepWiseBack walks backward N-1 steps (the Nth step is the initial position).
 *
 * Extracted from use-navigation.ts to keep each module under 200 LOC.
 */
import {
  buildPathFromSegments,
  normalizePath,
  parsePathSegments
} from '../../utils/path-utils';
import { delay } from '../../utils/timer-manager';

interface StepWiseContext {
  /** Read current active path */
  getActivePath: () => string;
  /** Core push (no spam guard) — used for each intermediate step */
  pushCore: (destination: string | number, props?: Record<string, unknown>) => Promise<void>;
  /** Run guard pipeline against final destination. Returns false if blocked. */
  runGuards?: (to: string, from: string) => Promise<boolean>;
  /** Schedule isNavigating=false after delay */
  scheduleUnlock: () => void;
  /** Lock navigation to prevent concurrent step-wise + push conflicts */
  lock: () => void;
  /** Unlock navigation immediately (error recovery) */
  unlock: () => void;
  /** Check if navigation is currently locked */
  isLocked: () => boolean;
  /** Delay for push lock cooldown in ms */
  stepDelay: number;
  /** Delay between step-wise transitions — should be >= animation duration. Defaults to stepDelay * 1.2 */
  stepWiseDelay?: number;
}

export interface StepWiseNavigation {
  stepWisePush: (targetPath: string, props?: Record<string, unknown>) => Promise<void>;
  stepWiseBack: (steps: number) => Promise<void>;
}

export function createStepWiseNavigation(ctx: StepWiseContext): StepWiseNavigation {
  /** Delay between each step — longer than push lock to let animation fully complete */
  const betweenStepDelay = ctx.stepWiseDelay ?? Math.max(ctx.stepDelay * 1.2, ctx.stepDelay + 100);
  async function stepWisePush(
    targetPath: string,
    props?: Record<string, unknown>
  ) {
    if (!targetPath || ctx.isLocked()) return;

    const normalized = normalizePath(targetPath);
    if (ctx.getActivePath() === normalized) return;

    ctx.lock();
    try {
      // Run guards once for the final destination before starting step-wise traversal
      if (ctx.runGuards) {
        const fromPath = normalizePath(ctx.getActivePath());
        const allowed = await ctx.runGuards(normalized, fromPath);
        if (!allowed) {
          ctx.unlock();
          return;
        }
      }

      const currentSegments = parsePathSegments(ctx.getActivePath());
      const targetSegments = parsePathSegments(normalized);

      if (targetPath.startsWith('/')) {
        for (let i = 0; i < targetSegments.length; i++) {
          const intermediate = buildPathFromSegments(
            targetSegments.slice(0, i + 1)
          );
          if (ctx.getActivePath() === intermediate) continue;
          const isLast = i === targetSegments.length - 1;
          await ctx.pushCore(intermediate, isLast ? props : undefined);
          if (!isLast) await delay(betweenStepDelay);
        }
      } else {
        const toAdd = targetSegments.filter(
          (s) => !currentSegments.includes(s)
        );
        if (toAdd.length === 0) {
          await ctx.pushCore(targetPath, props);
          ctx.scheduleUnlock();
          return;
        }
        for (let i = 0; i < toAdd.length; i++) {
          const isLast = i === toAdd.length - 1;
          await ctx.pushCore(toAdd[i]!, isLast ? props : undefined);
          if (!isLast) await delay(betweenStepDelay);
        }
      }
      ctx.scheduleUnlock();
    } catch (e) {
      ctx.unlock();
      throw e;
    }
  }

  async function stepWiseBack(steps: number) {
    if (steps < 1 || ctx.isLocked()) return;
    const currentSegments = parsePathSegments(ctx.getActivePath());
    // Clamp to available segments (keep at least root)
    const actualSteps = Math.min(steps, currentSegments.length - 1);
    if (actualSteps < 1) return;

    ctx.lock();
    try {
      // Run guards for the final destination before stepping back
      if (ctx.runGuards) {
        const targetSegments = currentSegments.slice(0, currentSegments.length - actualSteps);
        const targetPath = buildPathFromSegments(targetSegments);
        const fromPath = normalizePath(ctx.getActivePath());
        const allowed = await ctx.runGuards(targetPath, fromPath);
        if (!allowed) {
          ctx.unlock();
          return;
        }
      }

      for (let i = 0; i < actualSteps; i++) {
        await ctx.pushCore(-1);
        if (i < actualSteps - 1) await delay(betweenStepDelay);
      }
      ctx.scheduleUnlock();
    } catch (e) {
      ctx.unlock();
      throw e;
    }
  }

  return { stepWisePush, stepWiseBack };
}
