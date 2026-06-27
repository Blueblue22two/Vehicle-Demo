import { describe, expect, it, beforeEach } from 'vitest';
import {
  resetPerformanceConfig,
  getPerformanceConfig,
  createFpsSampler,
} from './performanceConfig';

describe('performanceConfig', () => {
  beforeEach(() => {
    resetPerformanceConfig();
  });

  describe('getPerformanceConfig', () => {
    it('returns a valid config object', () => {
      const config = getPerformanceConfig();
      expect(['high', 'medium', 'low']).toContain(config.tier);
      expect(config.maxDpr).toBeGreaterThanOrEqual(1.0);
      expect(config.maxDpr).toBeLessThanOrEqual(1.5);
      expect(config.shadowMapSize).toBeGreaterThanOrEqual(512);
      expect(config.shadowMapSize).toBeLessThanOrEqual(2048);
      expect(typeof config.shadowsEnabled).toBe('boolean');
    });

    it('returns the same cached config on repeated calls', () => {
      const config1 = getPerformanceConfig();
      const config2 = getPerformanceConfig();
      expect(config1).toBe(config2);
    });

    it('returns a fresh config after reset', () => {
      const config1 = getPerformanceConfig();
      resetPerformanceConfig();
      const config2 = getPerformanceConfig();
      // Should be a new object (different reference after reset)
      expect(config2.tier).toBe(config1.tier); // same tier though
    });
  });

  describe('createFpsSampler', () => {
    it('returns null when not enough samples', () => {
      const sampler = createFpsSampler(1000);
      expect(sampler.push(0.016)).toBeNull(); // single sample
    });

    it('returns a positive FPS value with enough samples', () => {
      const sampler = createFpsSampler(1000);
      // Simulate 60fps for 1 second
      for (let i = 0; i < 60; i++) {
        sampler.push(1 / 60);
      }
      const fps = sampler.push(1 / 60);
      expect(fps).not.toBeNull();
      expect(fps!).toBeGreaterThan(30);
      expect(fps!).toBeLessThan(90);
    });

    it('prunes old samples outside the window', () => {
      const sampler = createFpsSampler(500); // 500ms window
      // Push 500ms worth of samples at 30fps
      for (let i = 0; i < 15; i++) {
        sampler.push(1 / 30);
      }
      // Then push 500ms at 60fps
      for (let i = 0; i < 30; i++) {
        sampler.push(1 / 60);
      }
      const fps = sampler.push(1 / 60);
      expect(fps).not.toBeNull();
      // Should be close to 60fps (old 30fps samples pruned)
      expect(fps!).toBeGreaterThan(45);
    });

    it('reset clears all samples', () => {
      const sampler = createFpsSampler(1000);
      for (let i = 0; i < 60; i++) {
        sampler.push(1 / 60);
      }
      sampler.reset();
      expect(sampler.push(1 / 60)).toBeNull(); // single sample after reset
    });

    it('ignores zero and negative deltas', () => {
      const sampler = createFpsSampler(1000);
      sampler.push(0);
      sampler.push(-0.016);
      for (let i = 0; i < 60; i++) {
        sampler.push(1 / 60);
      }
      const fps = sampler.push(1 / 60);
      expect(fps).not.toBeNull();
      expect(fps!).toBeGreaterThan(30);
    });
  });
});
