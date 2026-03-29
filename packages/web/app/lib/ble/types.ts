export interface BleConnection {
  deviceId: string;
  deviceName?: string;
}

export interface BluetoothAdapter {
  /** Check if BLE is available and enabled */
  isAvailable(): Promise<boolean>;

  /** Scan for and connect to a board. Shows platform-appropriate device picker. */
  requestAndConnect(): Promise<BleConnection>;

  /** Disconnect from the current device */
  disconnect(): Promise<void>;

  /**
   * Write the COMPLETE packet to the board's UART characteristic.
   * The adapter handles transport-level chunking internally.
   * Callers pass the full output of getBluetoothPacket().
   */
  write(data: Uint8Array): Promise<void>;

  /** Register a callback for disconnection events. Returns an unsubscribe function. */
  onDisconnect(callback: () => void): () => void;
}
