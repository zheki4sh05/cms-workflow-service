import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let loaded = false;

export function loadEnvFile(): void {
  if (loaded) {
    return;
  }

  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) {
    loaded = true;
    return;
  }

  const content = readFileSync(envPath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex < 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    const rawValue = line.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, '');
    process.env[key] = value;
  }

  loaded = true;
}

export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required env variable: ${name}`);
  }

  return value.trim();
}

export function getRequiredNumberEnv(name: string): number {
  const value = getRequiredEnv(name);
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Env variable ${name} must be a number`);
  }

  return parsed;
}

export function getNumberEnvOrDefault(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (value === undefined || !value.trim()) {
    return defaultValue;
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Env variable ${name} must be a number`);
  }

  return parsed;
}
