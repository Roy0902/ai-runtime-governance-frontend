import { en, type Messages } from '../locales/en';

type Join<Prefix extends string, Key extends string> = Prefix extends ''
  ? Key
  : `${Prefix}.${Key}`;

type LeafKeys<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? Join<Prefix, K>
    : T[K] extends Record<string, unknown>
      ? LeafKeys<T[K], Join<Prefix, K>>
      : never;
}[keyof T & string];

export type MessageKey = LeafKeys<Messages>;

type MessageParams = Record<string, string | number>;

function resolve(key: MessageKey): unknown {
  return key.split('.').reduce<unknown>((value, part) => {
    if (value && typeof value === 'object' && part in value) {
      return (value as Record<string, unknown>)[part];
    }
    return undefined;
  }, en);
}

function interpolate(message: string, params?: MessageParams): string {
  if (!params) {
    return message;
  }
  return message.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

export function t(key: MessageKey, params?: MessageParams): string {
  const message = resolve(key);
  if (typeof message !== 'string') {
    throw new Error(`Missing message for key: ${key}`);
  }
  return interpolate(message, params);
}
