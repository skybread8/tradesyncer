import { Injectable } from "@nestjs/common";
import { TradingFirm, Platform } from "@prisma/client";
import { RithmicAdapter } from "./rithmic/rithmic-adapter";

/**
 * Real AlphaFutures Adapter
 * 
 * AlphaFutures uses Rithmic as its trading platform.
 * This adapter extends RithmicAdapter with AlphaFutures-specific configuration.
 * 
 * Real API URLs:
 * - https://api.alphafutures.com
 * - https://api.rithmic.com (fallback)
 */
@Injectable()
export class AlphaFuturesRealAdapter extends RithmicAdapter {
  constructor() {
    super(TradingFirm.ALPHA_FUTURES);
    
    // Override base URLs with AlphaFutures-specific URLs if available
    const customApiUrl = process.env.ALPHAFUTURES_API_URL || process.env.RITHMIC_API_URL;
    
    if (customApiUrl) {
      this.httpClient.defaults.baseURL = customApiUrl;
    }
  }

  /**
   * Override to add AlphaFutures-specific API URLs to discovery
   */
  protected getDiscoveryUrls(): string[] {
    return [
      "https://api.alphafutures.com",
      "https://api.alphafutures.com/v1",
      "https://api.alphafutures.com/api",
      "https://alphafutures.rithmic.com",
      "https://alphafutures.rithmic.com/api",
      "https://api.rithmic.com",
      "https://api.rithmic.com/v1",
    ];
  }

}
