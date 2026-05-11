import { customAlphabet } from 'nanoid';

const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
const make = customAlphabet(alphabet, 12);

export function newId(prefix: string): string {
  return `${prefix}_${make()}`;
}
