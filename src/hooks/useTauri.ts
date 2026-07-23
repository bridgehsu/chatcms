/** 统一 Tauri API 入口，业务代码不要各自 import @tauri-apps/* */
import {
  convertFileSrc as tauriConvertFileSrc,
  invoke as tauriInvoke,
} from "@tauri-apps/api/core";
import { listen as tauriListen, type UnlistenFn } from "@tauri-apps/api/event";

export const invoke = <T = unknown>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T> => tauriInvoke<T>(cmd, args);

export const listen = <T>(
  event: string,
  handler: (event: { payload: T }) => void,
): Promise<UnlistenFn> => tauriListen<T>(event, handler);

export const convertFileSrc = (filePath: string, protocol?: string): string =>
  tauriConvertFileSrc(filePath, protocol);
