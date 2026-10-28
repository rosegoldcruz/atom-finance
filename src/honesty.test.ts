import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return files(full);
    return /\.(ts|tsx)$/.test(name) && !name.endsWith('.test.ts') ? [full] : [];
  });
}

describe('product surface', () => {
  test('does not fabricate dashboard numbers or execution controls', () => {
    const banned = ['Math.random', 'VALKYRIE', 'Jordan_D', '422,912', '4,291.50', 'etherscan.io', 'private key', 'signTransaction'];
    for (const file of files('src')) {
      const text = readFileSync(file, 'utf8');
      for (const term of banned) {
        expect(text.includes(term), `${file} contains ${term}`).toBe(false);
      }
    }
  });
});
