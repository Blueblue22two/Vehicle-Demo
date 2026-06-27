import { beforeEach, describe, expect, it } from 'vitest';
import {
  useVehicleStore,
  WINDOW_IDS,
  type CommandSource,
  type VehicleCommand,
  type WindowId,
} from './vehicleStore';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fresh store snapshot — always call fresh, never stash. */
const s = () => useVehicleStore.getState();

/** Build a VehicleCommand from a specific source. */
const cmd = (
  source: CommandSource,
  target: VehicleCommand['target'],
  action: VehicleCommand['action'],
): VehicleCommand => ({ source, target, action });

/** Shorthand execute. */
const exec = (
  source: CommandSource,
  target: VehicleCommand['target'],
  action: VehicleCommand['action'],
) => s().executeCommand(cmd(source, target, action));

/** Complete a transition by window id. */
const complete = (id: WindowId) => s().completeWindowTransition(id);

/** Fail a transition by window id. */
const fail = (id: WindowId) => s().failWindowTransition(id);

/** Complete all active transitions. */
const completeAll = () => {
  for (const id of WINDOW_IDS) {
    s().completeWindowTransition(id);
  }
};

/** Get window state. */
const w = (id: WindowId) => s().windows[id];

// ---------------------------------------------------------------------------
// Multi-source integration tests
// ---------------------------------------------------------------------------

describe('multi-input integration', () => {
  beforeEach(() => {
    s().resetVehicleState();
  });

  describe('cross-source consistency (AC-12)', () => {
    it('click open → voice close → text open on same window', () => {
      // Click opens frontLeft (pointer source, toggle action)
      const r1 = exec('pointer', 'frontLeft', 'toggle');
      expect(r1.status).toBe('accepted');
      expect(r1.command.source).toBe('pointer');
      complete('frontLeft');
      expect(w('frontLeft')).toBe('open');

      // Voice closes frontLeft
      const r2 = exec('voice', 'frontLeft', 'close');
      expect(r2.status).toBe('accepted');
      expect(r2.command.source).toBe('voice');
      complete('frontLeft');
      expect(w('frontLeft')).toBe('closed');

      // Text opens frontLeft
      const r3 = exec('text', 'frontLeft', 'open');
      expect(r3.status).toBe('accepted');
      expect(r3.command.source).toBe('text');
      complete('frontLeft');
      expect(w('frontLeft')).toBe('open');

      // Final state correct
      expect(w('frontLeft')).toBe('open');
    });

    it('voice open → click toggle → text close on rear window', () => {
      exec('voice', 'rearRight', 'open');
      complete('rearRight');
      expect(w('rearRight')).toBe('open');

      exec('pointer', 'rearRight', 'toggle');
      complete('rearRight');
      expect(w('rearRight')).toBe('closed');

      exec('text', 'rearRight', 'open');
      complete('rearRight');
      expect(w('rearRight')).toBe('open');
    });

    it('all three sources produce correct lastCommandResult', () => {
      const r1 = exec('pointer', 'frontLeft', 'toggle');
      expect(s().lastCommandResult).toEqual(r1);
      complete('frontLeft');

      const r2 = exec('voice', 'frontLeft', 'close');
      expect(s().lastCommandResult).toEqual(r2);
      complete('frontLeft');

      const r3 = exec('text', 'frontLeft', 'open');
      expect(s().lastCommandResult).toEqual(r3);
    });
  });

  describe('concurrency (AC-13)', () => {
    it('blocks same-window command while transitioning regardless of source', () => {
      // Pointer starts transition
      exec('pointer', 'frontLeft', 'toggle');
      expect(w('frontLeft')).toBe('transitioning');

      // Voice blocked on same window
      const r2 = exec('voice', 'frontLeft', 'open');
      expect(r2.status).toBe('blocked');
      expect(r2.command.source).toBe('voice');

      // Text blocked on same window
      const r3 = exec('text', 'frontLeft', 'close');
      expect(r3.status).toBe('blocked');
      expect(r3.command.source).toBe('text');

      // State unchanged
      expect(w('frontLeft')).toBe('transitioning');
    });

    it('allows different-window operations while one is transitioning', () => {
      // Pointer starts frontLeft
      exec('pointer', 'frontLeft', 'toggle');
      expect(w('frontLeft')).toBe('transitioning');

      // Voice operates frontRight — should succeed
      const r2 = exec('voice', 'frontRight', 'open');
      expect(r2.status).toBe('accepted');

      // Text operates rearLeft — should succeed
      const r3 = exec('text', 'rearLeft', 'open');
      expect(r3.status).toBe('accepted');

      // Both transitioning
      expect(w('frontRight')).toBe('transitioning');
      expect(w('rearLeft')).toBe('transitioning');
    });

    it('handles rapid-fire commands from different sources', () => {
      // Open four windows from different sources
      const sources: CommandSource[] = ['pointer', 'voice', 'text', 'pointer'];
      const ids: WindowId[] = [...WINDOW_IDS];

      const results = ids.map((id, i) =>
        exec(sources[i], id, sources[i] === 'pointer' ? 'toggle' : 'open'),
      );

      expect(results.every((r) => r.status === 'accepted')).toBe(true);
      expect(ids.map(w)).toEqual([
        'transitioning',
        'transitioning',
        'transitioning',
        'transitioning',
      ]);

      // Complete all
      completeAll();
      expect(ids.map(w)).toEqual(['open', 'open', 'open', 'open']);
    });
  });

  describe('all-windows commands with mixed sources', () => {
    it('text allWindows open opens all four windows', () => {
      const r = exec('text', 'allWindows', 'open');
      expect(r.status).toBe('accepted');
      expect(r.started).toHaveLength(4);
      expect(r.command.source).toBe('text');

      completeAll();
      for (const id of WINDOW_IDS) {
        expect(w(id)).toBe('open');
      }
    });

    it('voice allWindows close closes all four windows', () => {
      // Open all first
      exec('pointer', 'allWindows', 'open');
      completeAll();

      const r = exec('voice', 'allWindows', 'close');
      expect(r.status).toBe('accepted');
      expect(r.started).toHaveLength(4);
      expect(r.command.source).toBe('voice');

      completeAll();
      for (const id of WINDOW_IDS) {
        expect(w(id)).toBe('closed');
      }
    });

    it('allWindows skips transitioning windows with partial status', () => {
      // Start two transitions from different sources
      exec('pointer', 'frontLeft', 'toggle');
      exec('text', 'rearLeft', 'open');

      const r = exec('voice', 'allWindows', 'open');
      expect(r.status).toBe('partial');
      expect(r.skipped).toContain('frontLeft');
      expect(r.skipped).toContain('rearLeft');
      expect(r.started).toContain('frontRight');
      expect(r.started).toContain('rearRight');
    });

    it('allWindows returns noop when all already at target', () => {
      exec('text', 'allWindows', 'open');
      completeAll();

      const r = exec('pointer', 'allWindows', 'open');
      expect(r.status).toBe('noop');
      expect(r.started).toHaveLength(0);
      expect(r.alreadySatisfied).toHaveLength(4);
    });

    it('allWindows notes already-satisfied windows and starts remaining', () => {
      // Open two windows
      exec('pointer', 'frontLeft', 'open');
      exec('voice', 'frontRight', 'open');
      complete('frontLeft');
      complete('frontRight');

      const r = exec('text', 'allWindows', 'open');
      // already-satisfied is not a blocking condition — the command is
      // still accepted because actionable windows started successfully.
      expect(r.status).toBe('accepted');
      expect(r.alreadySatisfied).toContain('frontLeft');
      expect(r.alreadySatisfied).toContain('frontRight');
      expect(r.started).toContain('rearLeft');
      expect(r.started).toContain('rearRight');
    });
  });

  describe('20-operation alternating stress test (AC-12)', () => {
    it('maintains consistency after 20 alternating multi-source operations', () => {
      // Alternating sequence of operations across sources
      const ops: Array<{
        source: CommandSource;
        target: VehicleCommand['target'];
        action: VehicleCommand['action'];
      }> = [
        { source: 'pointer', target: 'frontLeft', action: 'toggle' },
        { source: 'voice', target: 'frontRight', action: 'open' },
        { source: 'text', target: 'rearLeft', action: 'open' },
        { source: 'pointer', target: 'rearRight', action: 'toggle' },
        { source: 'voice', target: 'allWindows', action: 'open' },
        { source: 'text', target: 'frontLeft', action: 'close' },
        { source: 'pointer', target: 'frontRight', action: 'toggle' },
        { source: 'voice', target: 'rearLeft', action: 'close' },
        { source: 'text', target: 'rearRight', action: 'close' },
        { source: 'pointer', target: 'allWindows', action: 'close' },
        { source: 'voice', target: 'frontLeft', action: 'open' },
        { source: 'text', target: 'frontRight', action: 'close' },
        { source: 'pointer', target: 'rearLeft', action: 'toggle' },
        { source: 'voice', target: 'rearRight', action: 'open' },
        { source: 'text', target: 'allWindows', action: 'open' },
        { source: 'pointer', target: 'frontLeft', action: 'toggle' },
        { source: 'voice', target: 'frontRight', action: 'open' },
        { source: 'text', target: 'rearLeft', action: 'toggle' },
        { source: 'pointer', target: 'rearRight', action: 'toggle' },
        { source: 'voice', target: 'allWindows', action: 'close' },
      ];

      for (const op of ops) {
        const result = exec(op.source, op.target, op.action);
        // Every command must produce a valid result
        expect(['accepted', 'partial', 'noop', 'blocked']).toContain(
          result.status,
        );
        expect(result.command.source).toBe(op.source);

        // Complete any started transitions before next operation
        for (const id of result.started) {
          complete(id);
        }
      }

      // After all 20 ops complete, every window must be in a stable state
      for (const id of WINDOW_IDS) {
        expect(['open', 'closed']).toContain(w(id));
      }

      // No lingering transitions
      for (const id of WINDOW_IDS) {
        expect(s().completeWindowTransition(id)).toBe(false);
        expect(s().failWindowTransition(id)).toBe(false);
      }
    });
  });

  describe('recovery paths', () => {
    it('recovers from animation failure via rollback', () => {
      const before = { ...s().windows };

      exec('pointer', 'frontLeft', 'toggle');
      expect(w('frontLeft')).toBe('transitioning');

      // Animation fails
      const ok = fail('frontLeft');
      expect(ok).toBe(true);

      // Window rolls back to previous state
      expect(w('frontLeft')).toBe('closed');

      // Other windows unaffected
      expect(w('frontRight')).toBe(before.frontRight);
      expect(w('rearLeft')).toBe(before.rearLeft);
      expect(w('rearRight')).toBe(before.rearRight);
    });

    it('recovers from multiple animation failures', () => {
      exec('text', 'allWindows', 'open');
      expect(w('frontLeft')).toBe('transitioning');
      expect(w('frontRight')).toBe('transitioning');

      // Fail two windows
      fail('frontLeft');
      fail('frontRight');

      expect(w('frontLeft')).toBe('closed');
      expect(w('frontRight')).toBe('closed');

      // Other windows still transitioning
      expect(w('rearLeft')).toBe('transitioning');
      expect(w('rearRight')).toBe('transitioning');

      // Complete the remaining
      complete('rearLeft');
      complete('rearRight');
      expect(w('rearLeft')).toBe('open');
      expect(w('rearRight')).toBe('open');
    });

    it('allows retry after animation failure', () => {
      exec('pointer', 'frontLeft', 'toggle');
      fail('frontLeft');
      expect(w('frontLeft')).toBe('closed');

      // Retry with text source
      const r2 = exec('text', 'frontLeft', 'open');
      expect(r2.status).toBe('accepted');
      complete('frontLeft');
      expect(w('frontLeft')).toBe('open');
    });

    it('resetVehicleState clears all transitions', () => {
      exec('pointer', 'frontLeft', 'toggle');
      exec('voice', 'frontRight', 'open');
      exec('text', 'rearLeft', 'open');

      s().resetVehicleState();

      // All windows back to closed
      for (const id of WINDOW_IDS) {
        expect(w(id)).toBe('closed');
      }

      // No residual transitions
      expect(s().lastCommandResult).toBeNull();
      expect(complete('frontLeft')).toBe(false);
      expect(fail('frontLeft')).toBe(false);
    });

    it('handles unrecognised window id in transition operations', () => {
      // completeWindowTransition and failWindowTransition reject
      // window IDs that have no active transition
      expect(complete('frontLeft')).toBe(false);
      expect(fail('frontLeft')).toBe(false);
      // Store unchanged
      expect(s().windows).toEqual({
        frontLeft: 'closed',
        frontRight: 'closed',
        rearLeft: 'closed',
        rearRight: 'closed',
      });
    });
  });

  describe('state invariants', () => {
    it('never has transitioning without a corresponding transition', () => {
      exec('pointer', 'frontLeft', 'toggle');
      exec('voice', 'frontRight', 'open');

      // Both are transitioning
      expect(w('frontLeft')).toBe('transitioning');
      expect(w('frontRight')).toBe('transitioning');

      // These should complete/fail cleanly
      complete('frontLeft');
      fail('frontRight');

      // After completion/failure, no window is transitioning
      expect(w('frontLeft')).toBe('open');
      expect(w('frontRight')).toBe('closed');

      // Verify no orphaned transitions — completing again returns false
      expect(complete('frontLeft')).toBe(false);
      expect(fail('frontRight')).toBe(false);
    });

    it('lastCommandResult reflects the most recent command', () => {
      exec('text', 'frontLeft', 'open');
      expect(s().lastCommandResult?.command.source).toBe('text');

      complete('frontLeft');

      exec('voice', 'frontLeft', 'close');
      expect(s().lastCommandResult?.command.source).toBe('voice');

      complete('frontLeft');

      exec('pointer', 'frontLeft', 'toggle');
      expect(s().lastCommandResult?.command.source).toBe('pointer');
    });

    it('store reset clears lastCommandResult', () => {
      exec('text', 'frontLeft', 'open');
      expect(s().lastCommandResult).not.toBeNull();

      s().resetVehicleState();
      expect(s().lastCommandResult).toBeNull();
    });
  });

  describe('source attribution', () => {
    it.each([
      ['pointer' as const, 'frontLeft' as const, 'toggle' as const],
      ['voice' as const, 'frontRight' as const, 'open' as const],
      ['text' as const, 'rearLeft' as const, 'close' as const],
    ])('%s source is preserved in command result', (source, target, action) => {
      const r = exec(source, target, action);
      expect(r.command.source).toBe(source);
      expect(r.command.target).toBe(target);
      expect(r.command.action).toBe(action);
    });

    it('all three sources appear in lastCommandResult across operations', () => {
      const sources: CommandSource[] = [];

      exec('pointer', 'frontLeft', 'toggle');
      sources.push(s().lastCommandResult!.command.source);
      complete('frontLeft');

      exec('voice', 'frontRight', 'open');
      sources.push(s().lastCommandResult!.command.source);
      complete('frontRight');

      exec('text', 'rearLeft', 'open');
      sources.push(s().lastCommandResult!.command.source);

      expect(sources).toEqual(['pointer', 'voice', 'text']);
    });
  });
});
