import { beforeEach, describe, expect, it } from 'vitest';
import { useVehicleStore } from '../../domain/vehicle';
import { normalizeCommandText, parseVehicleCommand } from './commandParser';

describe('normalizeCommandText', () => {
  it('removes whitespace, punctuation, and polite connector words', () => {
    expect(normalizeCommandText(' 请，帮我 把左前车窗打开！ ')).toBe(
      '左前车窗打开',
    );
  });
});

describe('parseVehicleCommand', () => {
  beforeEach(() => {
    useVehicleStore.getState().resetVehicleState();
  });

  it.each([
    ['打开左前窗', 'frontLeft', 'open'],
    ['关闭左前窗', 'frontLeft', 'close'],
    ['打开右前窗', 'frontRight', 'open'],
    ['关闭右前窗', 'frontRight', 'close'],
    ['打开左后窗', 'rearLeft', 'open'],
    ['关闭左后窗', 'rearLeft', 'close'],
    ['打开右后窗', 'rearRight', 'open'],
    ['关闭右后窗', 'rearRight', 'close'],
    ['打开全部车窗', 'allWindows', 'open'],
    ['关闭全部车窗', 'allWindows', 'close'],
  ] as const)('parses standard command %s', (text, target, action) => {
    expect(parseVehicleCommand(text, 'voice')).toEqual({
      ok: true,
      command: { source: 'voice', target, action },
      normalizedText: text,
    });
  });

  it.each([
    ['开启驾驶位车窗', 'frontLeft', 'open'],
    ['降下副驾驶车窗', 'frontRight', 'open'],
    ['关上左后车窗', 'rearLeft', 'close'],
    ['升起右后车窗', 'rearRight', 'close'],
    ['开启所有车窗', 'allWindows', 'open'],
    ['升起四个车窗', 'allWindows', 'close'],
  ] as const)('maps supported synonym command %s', (text, target, action) => {
    expect(parseVehicleCommand(text, 'text')).toMatchObject({
      ok: true,
      command: { source: 'text', target, action },
    });
  });

  it('accepts repeated synonyms from the same action group', () => {
    expect(parseVehicleCommand('打开开启左前车窗', 'text')).toMatchObject({
      ok: true,
      command: { action: 'open', target: 'frontLeft' },
    });
  });

  it('parses a polite command containing whitespace and punctuation', () => {
    expect(parseVehicleCommand(' 请，帮我 把左前车窗打开！ ', 'text')).toEqual({
      ok: true,
      command: { source: 'text', target: 'frontLeft', action: 'open' },
      normalizedText: '左前车窗打开',
    });
  });

  it('uses canonical target de-duplication for overlapping aliases', () => {
    expect(parseVehicleCommand('打开左前车窗', 'text')).toMatchObject({
      ok: true,
      command: { target: 'frontLeft' },
    });
  });

  it('reports missing target and missing action separately', () => {
    expect(parseVehicleCommand('打开车窗', 'text')).toEqual({
      ok: false,
      reason: 'missing-target',
    });
    expect(parseVehicleCommand('左前窗', 'text')).toEqual({
      ok: false,
      reason: 'missing-action',
    });
  });

  it.each(['打开再关闭左前窗', '打开左前窗和右前窗'])(
    'rejects conflicting command %s',
    (text) => {
      expect(parseVehicleCommand(text, 'text')).toEqual({
        ok: false,
        reason: 'conflict',
      });
    },
  );

  it.each([
    '',
    '今天天气怎么样',
    '打开天窗',
    '左前窗开一点',
    '左前窗开一半',
    '左前窗半开',
    '左前窗部分开度',
    '除了左前窗都关闭',
  ])('rejects unsupported command %s', (text) => {
    expect(parseVehicleCommand(text, 'voice')).toEqual({
      ok: false,
      reason: 'unsupported',
    });
  });

  it('does not mutate vehicle state while parsing', () => {
    const before = { ...useVehicleStore.getState().windows };

    parseVehicleCommand('打开左前窗', 'text');
    parseVehicleCommand('关闭全部车窗', 'voice');

    expect(useVehicleStore.getState().windows).toEqual(before);
    expect(useVehicleStore.getState().lastCommandResult).toBeNull();
  });
});
