import { useActor as usePkgActor } from "@caffeineai/core-infrastructure";
import type { CreateActorOptions } from "@caffeineai/core-infrastructure";
import {
  type ExternalBlob,
  type backendInterface,
  createActor,
} from "../backend";

type CreateActorFn = (
  canisterId: string,
  uploadFile: (file: ExternalBlob) => Promise<Uint8Array>,
  downloadFile: (file: Uint8Array) => Promise<ExternalBlob>,
  options: CreateActorOptions,
) => backendInterface;

/**
 * Thin wrapper that binds the backend-specific `createActor` to the platform
 * useActor hook, so every hook and page can import from `./useActor` without
 * knowing about the core-infrastructure package directly.
 */
export function useActor() {
  return usePkgActor<backendInterface>(createActor as CreateActorFn);
}
