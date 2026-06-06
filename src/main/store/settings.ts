/**
 * Settings — delegates to ConfigManager.
 * Backward-compatible API for existing callers.
 */
import { getSetting as cfgGet, setSetting as cfgSet, getAllSettings as cfgAll, setProjectRoot as cfgProject } from '../config/ConfigManager'

export async function getSetting(key: string): Promise<unknown> { return cfgGet(key as any) }
export async function setSetting(key: string, value: unknown): Promise<void> { return cfgSet(key as any, value) }
export async function getAllSettings(): Promise<Record<string, unknown>> { return cfgAll() as Promise<Record<string, unknown>> }
export function setProjectRoot(root: string | null): void { cfgProject(root) }
export function getProjectRoot(): string | null { return null }
