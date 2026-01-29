import { Injectable } from "@nestjs/common";
import { TradingFirm, Platform } from "@prisma/client";
import { RithmicAdapter } from "./rithmic/rithmic-adapter";

/**
 * Real MyFundedFutures Adapter
 * 
 * MyFundedFutures uses Rithmic as its trading platform, just like TopStepX and TakeProfitTrader.
 * This adapter extends RithmicAdapter and uses the same authentication and connection flow.
 * 
 * Based on research:
 * - Uses Rithmic/R|Trader Pro platform
 * - Authentication: Email/Password (Rithmic credentials)
 * - Same WebSocket connection for real-time updates
 * - Same API endpoints structure
 * 
 * URLs to try (in order of discovery):
 * - https://api.myfundedfutures.com
 * - https://api.rithmic.com (fallback)
 * - https://myfundedfutures.rithmic.com
 */
@Injectable()
export class MyFundedFuturesRealAdapter extends RithmicAdapter {
  constructor() {
    super(TradingFirm.MYFUNDED_FUTURES);
    
    // Override base URLs with MyFundedFutures-specific URLs if available
    const customApiUrl = process.env.MYFUNDED_API_URL || process.env.RITHMIC_API_URL;
    const customWsUrl = process.env.MYFUNDED_WS_URL || process.env.RITHMIC_WS_URL;
    
    if (customApiUrl) {
      this.httpClient.defaults.baseURL = customApiUrl;
    }
    
    // Note: WebSocket URL is set in RithmicAdapter, but can be overridden if needed
  }

  /**
   * Override to add MyFundedFutures-specific API URLs to discovery
   */
  protected getDiscoveryUrls(): string[] {
    return [
      "https://api.myfundedfutures.com",
      "https://api.myfundedfutures.com/v1",
      "https://myfundedfutures.rithmic.com",
      "https://myfundedfutures.rithmic.com/api",
      "https://api.rithmic.com",
      "https://api.rithmic.com/v1",
    ];
  }
}
