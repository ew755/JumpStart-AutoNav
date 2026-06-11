/**
 * Doc-verification: every workspace command and flag documented in the
 * multi-workspace guides must actually exist in the CLI. Prevents the docs
 * from silently diverging from the code (Spec-First Power Inversion).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const { WORKSPACE_COMMANDS, COMMAND_FLAGS } = require('../bin/workspace.js');

const DOC_FILES = [
  '.jumpstart/MULTI_WORKSPACE.md',
  '.jumpstart/MULTI_WORKSPACE_SETUP.md',
];

function extractCodeBlocks(markdown) {
  const blocks = [];
  let inBlock = false;
  let isShell = false;
  let current = [];

  for (const line of markdown.split(/\r?\n/)) {
    const fenceMatch = line.match(/^\s*```\s*([a-zA-Z]*)\s*$/);
    if (fenceMatch) {
      if (!inBlock) {
        inBlock = true;
        const lang = fenceMatch[1].toLowerCase();
        isShell = lang === '' || lang === 'bash' || lang === 'sh' || lang === 'shell';
        current = [];
      } else {
        if (isShell) {
          blocks.push(current.join('\n'));
        }
        inBlock = false;
      }
      continue;
    }
    if (inBlock) {
      current.push(line);
    }
  }
  return blocks;
}

/**
 * Join backslash-continued lines, then pull `workspace <command> [args...]`
 * invocations out of shell code blocks.
 */
function extractWorkspaceInvocations(blockText) {
  const joined = blockText.replace(/\\\r?\n/g, ' ');
  const invocations = [];
  for (const rawLine of joined.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match =
      line.match(/(?:npx\s+)?jumpstart-mode\s+workspace\s+([a-z-]+)(.*)$/) ||
      line.match(/node\s+bin\/workspace\.js\s+([a-z-]+)(.*)$/);
    if (match) {
      invocations.push({ command: match[1], rest: match[2] || '', line });
    }
  }
  return invocations;
}

function extractLongFlags(rest) {
  return [...rest.matchAll(/--([a-z-]+)(?:=|\s|$)/g)].map((m) => m[1]);
}

describe('workspace documentation matches the CLI', () => {
  const docs = DOC_FILES.filter((rel) => existsSync(join(ROOT, rel)));

  it('covers at least the main multi-workspace guide', () => {
    expect(docs.length).toBeGreaterThan(0);
  });

  for (const docRel of docs) {
    describe(docRel, () => {
      const content = readFileSync(join(ROOT, docRel), 'utf8');
      const invocations = extractCodeBlocks(content).flatMap(extractWorkspaceInvocations);

      it('documents at least one workspace command', () => {
        expect(invocations.length).toBeGreaterThan(0);
      });

      it('every documented workspace command exists', () => {
        const unknown = invocations
          .filter((inv) => !WORKSPACE_COMMANDS.includes(inv.command))
          .map((inv) => inv.line);
        expect(unknown).toEqual([]);
      });

      it('documented flags exist for flag-validated commands', () => {
        const problems = [];
        for (const inv of invocations) {
          const flagDefs = COMMAND_FLAGS[inv.command];
          if (!flagDefs) continue;
          for (const flag of extractLongFlags(inv.rest)) {
            if (!(flag in flagDefs)) {
              problems.push(`--${flag} not accepted by 'workspace ${inv.command}' (${inv.line})`);
            }
          }
        }
        expect(problems).toEqual([]);
      });
    });
  }
});
