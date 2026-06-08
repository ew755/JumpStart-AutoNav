/**
 * Unit tests for createMultiWorkspaceAnalystRegistry mock responses.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { createMultiWorkspaceAnalystRegistry } = require('../bin/lib/mock-responses.js');

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(__dirname, 'e2e/scenarios/multi-workspace/02-analyst/product-brief.md');

describe('createMultiWorkspaceAnalystRegistry', () => {
  it('returns non-null completion message on turn 1 with create_file tool call', () => {
    const registry = createMultiWorkspaceAnalystRegistry();
    expect(typeof registry.getCompletionMessage).toBe('function');

    const message = registry.getCompletionMessage([], []);
    expect(message).toBeTruthy();
    expect(message.tool_calls).toHaveLength(1);
    expect(message.tool_calls[0].function.name).toBe('create_file');

    const args = JSON.parse(message.tool_calls[0].function.arguments);
    expect(args.filePath).toBe('specs/product-brief.md');
    expect(args.content).toContain('Product Brief');
  });

  it('fixture product-brief exists with analyst sections', () => {
    expect(existsSync(FIXTURE)).toBe(true);
    const content = readFileSync(FIXTURE, 'utf8');
    expect(content).toContain('## User Personas');
    expect(content).toContain('## Scope Recommendation');
  });
});
