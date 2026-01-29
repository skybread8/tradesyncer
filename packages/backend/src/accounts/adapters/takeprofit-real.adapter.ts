import { Injectable } from "@nestjs/common";
import { TradingFirm, Platform } from "@prisma/client";
import { RithmicAdapter } from "./rithmic/rithmic-adapter";

/**
 * Real TakeProfitTrader Adapter
 * 
 * TakeProfitTrader uses Rithmic as its trading platform, just like TopStepX.
 * This adapter extends RithmicAdapter and uses the same authentication and connection flow.
 * 
 * Based on research:
 * - Uses Rithmic/R|Trader Pro platform
 * - Authentication: Email/Password (Rithmic credentials)
 * - Same WebSocket connection for real-time updates
 * - Same API endpoints structure
 * 
 * URLs to try (in order of discovery):
 * - https://api.takeprofittrader.com
 * - https://api.rithmic.com (fallback)
 * - https://takeprofittrader.rithmic.com
 */
@Injectable()
export class TakeProfitTraderRealAdapter extends RithmicAdapter {
  constructor() {
    super(TradingFirm.TAKEPROFIT_TRADER);
    
    // Override base URLs with TakeProfitTrader-specific URLs if available
    const customApiUrl = process.env.TAKEPROFIT_API_URL || process.env.RITHMIC_API_URL;
    const customWsUrl = process.env.TAKEPROFIT_WS_URL || process.env.RITHMIC_WS_URL;
    
    if (customApiUrl) {
      this.httpClient.defaults.baseURL = customApiUrl;
    }
    
    // Note: WebSocket URL is set in RithmicAdapter, but can be overridden if needed
  }

  /**
   * Override to add TakeProfitTrader-specific API URLs to discovery
   */
  protected getDiscoveryUrls(): string[] {
    return [
      "https://api.takeprofittrader.com",
      "https://api.takeprofittrader.com/v1",
      "https://takeprofittrader.rithmic.com",
      "https://takeprofittrader.rithmic.com/api",
      "https://api.rithmic.com",
      "https://api.rithmic.com/v1",
    ];
  }
}
