import type {
  CommandAction,
  CommandTarget,
  VehicleCommand,
} from '../../domain/vehicle';

export type ParseFailureReason =
  | 'missing-action'
  | 'missing-target'
  | 'conflict'
  | 'unsupported';

export type ParseResult =
  | { ok: true; command: VehicleCommand; normalizedText: string }
  | { ok: false; reason: ParseFailureReason };

type ParserSource = 'voice' | 'text';

const ACTION_ALIASES: Readonly<Record<CommandAction, readonly string[]>> = {
  open: ['打开', '开启', '降下'],
  close: ['关闭', '关上', '升起'],
  toggle: [],
};

const TARGET_ALIASES: readonly {
  target: CommandTarget;
  aliases: readonly string[];
}[] = [
  {
    target: 'frontLeft',
    aliases: ['驾驶位车窗', '左前车窗', '左前窗'],
  },
  {
    target: 'frontRight',
    aliases: ['副驾驶车窗', '右前车窗', '右前窗'],
  },
  { target: 'rearLeft', aliases: ['左后车窗', '左后窗'] },
  { target: 'rearRight', aliases: ['右后车窗', '右后窗'] },
  {
    target: 'allWindows',
    aliases: ['全部车窗', '所有车窗', '四个车窗'],
  },
];

const POLITE_CONNECTORS = ['帮我', '请', '把'] as const;
const UNSUPPORTED_PATTERNS = [
  '开一点',
  '开一半',
  '半开',
  '部分开度',
  '除了',
] as const;

const removeAll = (text: string, token: string): string =>
  text.split(token).join('');

export function normalizeCommandText(text: string): string {
  let normalized = text.replace(/[\s\p{P}\p{S}]+/gu, '');

  for (const connector of POLITE_CONNECTORS) {
    normalized = removeAll(normalized, connector);
  }

  return normalized;
}

const findActions = (text: string): Set<CommandAction> => {
  const actions = new Set<CommandAction>();

  for (const action of ['open', 'close'] as const) {
    if (ACTION_ALIASES[action].some((alias) => text.includes(alias))) {
      actions.add(action);
    }
  }

  return actions;
};

const findTargets = (text: string): Set<CommandTarget> => {
  const targets = new Set<CommandTarget>();

  for (const entry of TARGET_ALIASES) {
    if (entry.aliases.some((alias) => text.includes(alias))) {
      targets.add(entry.target);
    }
  }

  return targets;
};

const stripKnownTokens = (text: string): string => {
  let remainder = text;
  const aliases = [
    ...ACTION_ALIASES.open,
    ...ACTION_ALIASES.close,
    ...TARGET_ALIASES.flatMap((entry) => entry.aliases),
  ].sort((left, right) => right.length - left.length);

  for (const alias of aliases) {
    remainder = removeAll(remainder, alias);
  }

  return remainder;
};

export function parseVehicleCommand(
  text: string,
  source: ParserSource,
): ParseResult {
  const normalizedText = normalizeCommandText(text);
  if (
    normalizedText.length === 0 ||
    UNSUPPORTED_PATTERNS.some((pattern) => normalizedText.includes(pattern))
  ) {
    return { ok: false, reason: 'unsupported' };
  }

  const actions = findActions(normalizedText);
  const targets = findTargets(normalizedText);

  if (actions.size > 1 || targets.size > 1) {
    return { ok: false, reason: 'conflict' };
  }

  const remainder = stripKnownTokens(normalizedText);
  if (actions.size === 0 && targets.size === 0) {
    return { ok: false, reason: 'unsupported' };
  }

  if (actions.size === 0) {
    return remainder.length === 0
      ? { ok: false, reason: 'missing-action' }
      : { ok: false, reason: 'unsupported' };
  }

  if (targets.size === 0) {
    return remainder === '' || remainder === '车窗'
      ? { ok: false, reason: 'missing-target' }
      : { ok: false, reason: 'unsupported' };
  }

  if (remainder.length > 0) {
    return { ok: false, reason: 'unsupported' };
  }

  const action = actions.values().next().value;
  const target = targets.values().next().value;
  if (!action || !target) {
    return { ok: false, reason: 'unsupported' };
  }

  return {
    ok: true,
    command: { source, target, action },
    normalizedText,
  };
}
