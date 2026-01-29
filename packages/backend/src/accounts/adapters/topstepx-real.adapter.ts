import { Injectable } from "@nestjs/common";
import { TradingFirm, Platform } from "@prisma/client";
import { ProjectXAdapter } from "./projectx/projectx-adapter";

/**
 * Real TopStepX Adapter
 * 
 * TopStepX uses ProjectX as their trading platform.
 * This adapter extends ProjectXAdapter with TopStepX-specific configuration.
 */
@Injectable()
export class TopStepXRealAdapter extends ProjectXAdapter {
  constructor() {
    super(TradingFirm.TOPSTEPX);
  }

  /**
   * Override discovery URLs to include TopStepX-specific endpoints
   */
  protected getDiscoveryUrls(): string[] {
    return [
      "https://api.topstepx.com",
      "https://api.topstepx.com/v1",
      "https://projectx.topstepx.com",
      "https://projectx.topstepx.com/api",
      "https://api.projectx.com",
      "https://api.projectx.com/v1",
      ...super.getDiscoveryUrls(), // Include base ProjectX URLs
    ];
  }
}
