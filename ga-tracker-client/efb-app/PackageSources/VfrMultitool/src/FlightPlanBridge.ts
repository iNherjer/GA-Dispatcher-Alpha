import * as MsfsSdk from '@microsoft/msfs-sdk';
// @ts-ignore Shared native adapter, also loaded by the toolbar host.
import NativeBridgeImport from '../../../native-flightplan-bridge.js';

declare function RegisterViewListener(name: string, callback: () => void): any;

export function createNativeFlightPlanBridge(options: {
  host: 'efb' | 'toolbar'; getFrame: () => HTMLIFrameElement | null;
  getChannel: () => string; isActive: () => boolean; trackerOrigin: string;
  log: (stage: string, data: unknown) => void;
}): { handle: (event: MessageEvent) => boolean } {
  return (NativeBridgeImport as any).create({ ...options, sdk: MsfsSdk,
    registerViewListener: (name: string, callback: () => void): any => {
      if (typeof RegisterViewListener !== 'function') throw new Error('plannedroute_listener_unavailable');
      return RegisterViewListener(name, callback);
    }
  });
}
