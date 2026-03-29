interface CapacitorGlobal {
  isNativePlatform(): boolean;
  getPlatform(): string;
  Plugins: Record<string, unknown>;
}

declare global {
  interface Window {
    Capacitor?: CapacitorGlobal;
  }
}

export {};
