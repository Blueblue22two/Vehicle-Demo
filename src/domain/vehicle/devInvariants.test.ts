import { describe, expect, it } from 'vitest';
import {
  checkAllInvariants,
  checkTransitionConsistency,
  checkValidStates,
} from './devInvariants';
import type { WindowId, WindowState } from './types';

describe('devInvariants', () => {
  const allClosed = {
    frontLeft: 'closed' as WindowState,
    frontRight: 'closed' as WindowState,
    rearLeft: 'closed' as WindowState,
    rearRight: 'closed' as WindowState,
  };

  describe('checkValidStates', () => {
    it('passes for all-closed state', () => {
      expect(checkValidStates(allClosed)).toEqual([]);
    });

    it('passes for mixed stable state', () => {
      expect(
        checkValidStates({
          frontLeft: 'open',
          frontRight: 'closed',
          rearLeft: 'transitioning',
          rearRight: 'closed',
        }),
      ).toEqual([]);
    });

    it('reports invalid state values', () => {
      const violations = checkValidStates({
        frontLeft: 'open',
        frontRight: 'closed',
        rearLeft: 'broken' as WindowState,
        rearRight: 'closed',
      });
      expect(violations).toHaveLength(1);
      expect(violations[0].windowId).toBe('rearLeft');
      expect(violations[0].message).toContain('broken');
    });
  });

  describe('checkTransitionConsistency', () => {
    const emptyTransitions = {};

    it('passes when no windows are transitioning and no transitions exist', () => {
      expect(checkTransitionConsistency(allClosed, emptyTransitions)).toEqual(
        [],
      );
    });

    it('passes when transitioning windows have matching transitions', () => {
      expect(
        checkTransitionConsistency(
          { ...allClosed, frontLeft: 'transitioning' },
          {
            frontLeft: { target: 'open', previous: 'closed' },
          },
        ),
      ).toEqual([]);
    });

    it('reports transitioning window with no transition entry', () => {
      const violations = checkTransitionConsistency(
        { ...allClosed, frontLeft: 'transitioning' },
        emptyTransitions,
      );
      expect(violations).toHaveLength(1);
      expect(violations[0].windowId).toBe('frontLeft');
      expect(violations[0].message).toContain('no transition entry');
    });

    it('reports stable window with leftover transition entry', () => {
      const violations = checkTransitionConsistency(allClosed, {
        frontRight: { target: 'open', previous: 'closed' },
      } as Partial<Record<WindowId, { target: string; previous: string }>>);
      expect(violations).toHaveLength(1);
      expect(violations[0].windowId).toBe('frontRight');
      expect(violations[0].message).toContain('still has a transition entry');
    });

    it('detects multiple violations at once', () => {
      const violations = checkTransitionConsistency(
        {
          frontLeft: 'transitioning',
          frontRight: 'closed',
          rearLeft: 'transitioning',
          rearRight: 'open',
        },
        {
          frontRight: { target: 'open', previous: 'closed' },
        } as Partial<Record<WindowId, { target: string; previous: string }>>,
      );

      // frontLeft: transitioning but no transition
      // frontRight: stable but has transition
      // rearLeft: transitioning but no transition
      expect(violations).toHaveLength(3);
    });
  });

  describe('checkAllInvariants', () => {
    it('returns empty for a consistent all-closed store snapshot', () => {
      expect(
        checkAllInvariants({
          windows: allClosed,
          transitions: {},
        }),
      ).toEqual([]);
    });

    it('returns empty for a valid transitioning state', () => {
      expect(
        checkAllInvariants({
          windows: {
            frontLeft: 'transitioning',
            frontRight: 'closed',
            rearLeft: 'closed',
            rearRight: 'closed',
          },
          transitions: {
            frontLeft: { target: 'open', previous: 'closed' },
          },
        }),
      ).toEqual([]);
    });

    it('aggregates violations from multiple checks', () => {
      const violations = checkAllInvariants({
        windows: {
          frontLeft: 'transitioning',
          frontRight: 'closed',
          rearLeft: 'broken' as WindowState,
          rearRight: 'closed',
        },
        transitions: {},
      });
      // frontLeft: transitioning with no transition
      // rearLeft: invalid state
      expect(violations.length).toBeGreaterThanOrEqual(2);
    });
  });
});
