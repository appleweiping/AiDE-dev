/**
 * skills.ts — Skills library system
 *
 * Skills are reusable prompt-based workflows stored as markdown files.
 * Similar to Claude Code's /skills and Gemini CLI's skills framework.
 *
 * A skill file is a markdown file with YAML frontmatter:
 *
 *   ---
 *   name: code-review
 *   description: Review code for bugs, style, and security issues
 *   args:
 *     - name: focus
 *       description: What to focus on (bugs/style/security/all)
 *       default: all
 *   ---
 *
 *   Review the following code for {{focus}} issues...
 *
 * Skills are loaded from:
 *   1. ~/.aide/skills/       (global)
 *   2. .aide/skills/         (project-local)
 *   3. Built-in skills       (bundled with AiDE)
 */

import { readFile, readdir, access } from 'node:fs/promises';
import { join, resolve, basename, extname } from 'node:path';
import { homedir } from 'node:os';
import type { ToolDefinition } from '@aide/shared';
import type { ToolResult } from './registry.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SkillArg {
  name: string;
  description: string;
  required?: boolean;
  default?: string;
}

export interface Skill {
  name: string;
  description: string;
  args: SkillArg[];
  template: string;
  source: 'builtin' | 'global' | 'project';
  filePath?: string;
}

// ---------------------------------------------------------------------------
// Built-in skills
// ---------------------------------------------------------------------------

const BUILTIN_SKILLS: Skill[] = [
  {
    name: 'code-review',
    description: 'Review code for bugs, style, security issues, and best practices',
    args: [{ name: 'focus', description: 'What to focus on: bugs, style, security, or all', default: 'all' }],
    template: 'Please review the code in the current working directory for {{focus}} issues. Be thorough and specific. List each issue with file path, line number, severity (high/medium/low), and a suggested fix.',
    source: 'builtin',
  },
  {
    name: 'write-tests',
    description: 'Write unit tests for the specified file or function',
    args: [
      { name: 'target', description: 'File or function to test', required: true },
      { name: 'framework', description: 'Test framework to use', default: 'auto-detect' },
    ],
    template: 'Write comprehensive unit tests for {{target}} using {{framework}}. Cover happy paths, edge cases, and error conditions. Follow the existing test patterns in the project.',
    source: 'builtin',
  },
  {
    name: 'explain',
    description: 'Explain how a piece of code works',
    args: [{ name: 'target', description: 'File, function, or concept to explain', required: true }],
    template: 'Explain how {{target}} works. Start with a high-level overview, then walk through the key logic step by step. Include any important design decisions or non-obvious behavior.',
    source: 'builtin',
  },
  {
    name: 'refactor',
    description: 'Refactor code for better readability, performance, or maintainability',
    args: [
      { name: 'target', description: 'File or function to refactor', required: true },
      { name: 'goal', description: 'Refactoring goal: readability, performance, or maintainability', default: 'readability' },
    ],
    template: 'Refactor {{target}} to improve {{goal}}. Preserve all existing behavior. Explain each change you make and why it improves the code.',
    source: 'builtin',
  },
  {
    name: 'fix-bug',
    description: 'Investigate and fix a bug',
    args: [{ name: 'description', description: 'Description of the bug', required: true }],
    template: 'Investigate and fix the following bug: {{description}}. First reproduce the issue by reading the relevant code, then identify the root cause, then implement a fix with a test to prevent regression.',
    source: 'builtin',
  },
  {
    name: 'add-docs',
    description: 'Add documentation to code',
    args: [{ name: 'target', description: 'File or function to document', required: true }],
    template: 'Add clear, concise documentation to {{target}}. Follow the existing documentation style in the project. Document public APIs, complex logic, and non-obvious behavior.',
    source: 'builtin',
  },
  {
    name: 'security-audit',
    description: 'Audit code for security vulnerabilities',
    args: [],
    template: 'Perform a security audit of the codebase. Check for: SQL injection, XSS, CSRF, insecure dependencies, hardcoded secrets, improper input validation, authentication/authorization issues, and other OWASP Top 10 vulnerabilities. Report each finding with severity and remediation steps.',
    source: 'builtin',
  },
  {
    name: 'optimize',
    description: 'Optimize code for performance',
    args: [{ name: 'target', description: 'File or function to optimize', required: true }],
    template: 'Analyze and optimize {{target}} for performance. Profile the code mentally, identify bottlenecks, and implement improvements. Measure the impact of each optimization.',
    source: 'builtin',
  },
];

// ---------------------------------------------------------------------------
// SkillsManager
// ---------------------------------------------------------------------------

export class SkillsManager {
  private skills = new Map<string, Skill>();
  private workingDirectory: string;

  constructor(workingDirectory: string) {
    this.workingDirectory = resolve(workingDirectory);
    for (const skill of BUILTIN_SKILLS) {
      this.skills.set(skill.name, skill);
    }
  }

  async loadFromDisk(): Promise<void> {
    const dirs = [
      { path: join(homedir(), '.aide', 'skills'), source: 'global' as const },
      { path: join(this.workingDirectory, '.aide', 'skills'), source: 'project' as const },
    ];

    for (const { path, source } of dirs) {
      try {
        await access(path);
        const files = await readdir(path);
        for (const file of files) {
          if (extname(file) !== '.md') continue;
          const filePath = join(path, file);
          const skill = await this.parseSkillFile(filePath, source);
          if (skill) this.skills.set(skill.name, skill);
        }
      } catch { /* directory doesn't exist */ }
    }
  }

  private async parseSkillFile(filePath: string, source: Skill['source']): Promise<Skill | null> {
    try {
      const content = await readFile(filePath, 'utf-8');
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      if (!frontmatterMatch) return null;

      const [, yaml, template] = frontmatterMatch;
      const nameMatch = yaml.match(/^name:\s*(.+)$/m);
      const descMatch = yaml.match(/^description:\s*(.+)$/m);
      if (!nameMatch) return null;

      const name = nameMatch[1].trim();
      const description = descMatch?.[1].trim() ?? '';

      const args: SkillArg[] = [];
      const argsSection = yaml.match(/^args:\n((?:  .+\n?)*)/m);
      if (argsSection) {
        const argLines = argsSection[1].split('\n').filter(Boolean);
        let currentArg: Partial<SkillArg> = {};
        for (const line of argLines) {
          const nameM = line.match(/^\s*-\s*name:\s*(.+)$/);
          const descM = line.match(/^\s*description:\s*(.+)$/);
          const defM = line.match(/^\s*default:\s*(.+)$/);
          const reqM = line.match(/^\s*required:\s*(.+)$/);
          if (nameM) { if (currentArg.name) args.push(currentArg as SkillArg); currentArg = { name: nameM[1].trim() }; }
          if (descM) currentArg.description = descM[1].trim();
          if (defM) currentArg.default = defM[1].trim();
          if (reqM) currentArg.required = reqM[1].trim() === 'true';
        }
        if (currentArg.name) args.push(currentArg as SkillArg);
      }

      return { name, description, args, template: template.trim(), source, filePath };
    } catch {
      return null;
    }
  }

  get(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  list(): Skill[] {
    return [...this.skills.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Render a skill template with provided arguments */
  render(skill: Skill, args: Record<string, string>): string {
    let result = skill.template;
    for (const arg of skill.args) {
      const value = args[arg.name] ?? arg.default ?? '';
      result = result.replace(new RegExp(`\\{\\{${arg.name}\\}\\}`, 'g'), value);
    }
    return result;
  }
}

// ---------------------------------------------------------------------------
// Tool factory
// ---------------------------------------------------------------------------

export function createSkillTool(skillsManager: SkillsManager): ToolDefinition & {
  execute: (args: Record<string, unknown>) => Promise<ToolResult>;
} {
  return {
    name: 'skill',
    description: 'Execute a reusable skill (prompt-based workflow). Use skill_list to see available skills.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Skill name to execute' },
        args: {
          type: 'object',
          description: 'Arguments for the skill (key-value pairs)',
          additionalProperties: { type: 'string' },
        },
      },
      required: ['name'],
    },
    async execute(toolArgs) {
      const skill = skillsManager.get(toolArgs.name as string);
      if (!skill) {
        const available = skillsManager.list().map((s) => s.name).join(', ');
        return { output: `Unknown skill: "${toolArgs.name}". Available: ${available}`, isError: true };
      }
      const skillArgs = (toolArgs.args as Record<string, string>) ?? {};
      const missing = skill.args.filter((a) => a.required && !skillArgs[a.name]);
      if (missing.length > 0) {
        return { output: `Missing required args: ${missing.map((a) => a.name).join(', ')}`, isError: true };
      }
      const prompt = skillsManager.render(skill, skillArgs);
      return { output: prompt, isError: false, injectAsMessage: true } as ToolResult & { injectAsMessage: boolean };
    },
  };
}

export function createSkillListTool(skillsManager: SkillsManager): ToolDefinition & {
  execute: (args: Record<string, unknown>) => Promise<ToolResult>;
} {
  return {
    name: 'skill_list',
    description: 'List all available skills with their descriptions and arguments.',
    parameters: { type: 'object', properties: {}, required: [] },
    async execute(_args) {
      const skills = skillsManager.list();
      if (skills.length === 0) return { output: 'No skills available.', isError: false };
      const lines = skills.map((s) => {
        const argStr = s.args.length > 0
          ? ` (args: ${s.args.map((a) => a.required ? a.name : `[${a.name}]`).join(', ')})`
          : '';
        return `• ${s.name}${argStr} — ${s.description} [${s.source}]`;
      });
      return { output: lines.join('\n'), isError: false };
    },
  };
}
