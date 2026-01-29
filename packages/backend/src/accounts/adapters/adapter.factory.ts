import { Injectable, Inject } from "@nestjs/common";
import { TradingFirm, Platform } from "@prisma/client";
import { ITradingAdapter } from "./trading-adapter.interface";
import { TopStepXAdapter } from "./topstepx.adapter";
import { TopStepXRealAdapter } from "./topstepx-real.adapter";
import { TakeProfitTraderRealAdapter } from "./takeprofit-real.adapter";
import { AlphaFuturesRealAdapter } from "./alphafutures-real.adapter";
import { MyFundedFuturesRealAdapter } from "./myfunded-real.adapter";
import { TradefyRealAdapter } from "./tradefy-real.adapter";
import { TradovateAdapter } from "./tradovate/tradovate-adapter";
import { NinjaTraderAdapter } from "./ninjatrader/ninjatrader-adapter";

@Injectable()
export class AdapterFactory {
  private adapters: Map<string, ITradingAdapter>;

  constructor(
    private topStepXAdapter: TopStepXAdapter,
    private topStepXRealAdapter: TopStepXRealAdapter,
    private takeProfitTraderRealAdapter: TakeProfitTraderRealAdapter,
    private alphaFuturesRealAdapter: AlphaFuturesRealAdapter,
    private myFundedFuturesRealAdapter: MyFundedFuturesRealAdapter,
    private tradefyRealAdapter: TradefyRealAdapter,
    @Inject("TradovateAdapter_TakeProfit") private tradovateAdapterTakeProfit: TradovateAdapter,
    @Inject("TradovateAdapter_MyFunded") private tradovateAdapterMyFunded: TradovateAdapter,
    @Inject("NinjaTraderAdapter_TakeProfit") private ninjaTraderAdapterTakeProfit: NinjaTraderAdapter,
    @Inject("NinjaTraderAdapter_MyFunded") private ninjaTraderAdapterMyFunded: NinjaTraderAdapter
  ) {
    this.adapters = new Map();
    this.registerAdapters();
  }

  private registerAdapters() {
    // Register mock adapters (for testing/development)
    this.adapters.set(this.getKey(Platform.RITHMIC, TradingFirm.TOPSTEPX), this.topStepXAdapter);
    
    // Register real adapters (use environment variable to switch)
    const useRealAdapters = process.env.USE_REAL_ADAPTERS === "true";
    
    if (useRealAdapters) {
      // TopStepX uses ProjectX platform
      this.adapters.set(this.getKey(Platform.PROJECTX, TradingFirm.TOPSTEPX), this.topStepXRealAdapter);
      
      // TakeProfitTrader and MyFundedFutures - using Tradovate by default
      // If they use NinjaTrader, update the platform mapping accordingly
      this.adapters.set(this.getKey(Platform.TRADOVATE, TradingFirm.TAKEPROFIT_TRADER), this.tradovateAdapterTakeProfit);
      this.adapters.set(this.getKey(Platform.TRADOVATE, TradingFirm.MYFUNDED_FUTURES), this.tradovateAdapterMyFunded);
      
      // NinjaTrader adapters (if needed)
      this.adapters.set(this.getKey(Platform.NINJATRADER, TradingFirm.TAKEPROFIT_TRADER), this.ninjaTraderAdapterTakeProfit);
      this.adapters.set(this.getKey(Platform.NINJATRADER, TradingFirm.MYFUNDED_FUTURES), this.ninjaTraderAdapterMyFunded);
      
      // Keep Rithmic adapters for backward compatibility
      this.adapters.set(this.getKey(Platform.RITHMIC, TradingFirm.TAKEPROFIT_TRADER), this.takeProfitTraderRealAdapter);
      this.adapters.set(this.getKey(Platform.RITHMIC, TradingFirm.MYFUNDED_FUTURES), this.myFundedFuturesRealAdapter);
      
      // Other firms
      this.adapters.set(this.getKey(Platform.RITHMIC, TradingFirm.TRADEFY), this.tradefyRealAdapter);
      this.adapters.set(this.getKey(Platform.RITHMIC, TradingFirm.ALPHA_FUTURES), this.alphaFuturesRealAdapter);
    }
  }

  private getKey(platform: Platform, firm: TradingFirm): string {
    return `${platform}_${firm}`;
  }

  getAdapter(platform: Platform, firm: TradingFirm): ITradingAdapter {
    const key = this.getKey(platform, firm);
    const adapter = this.adapters.get(key);

    if (!adapter) {
      throw new Error(`No adapter found for platform ${platform} and firm ${firm}`);
    }

    return adapter;
  }

  registerAdapter(platform: Platform, firm: TradingFirm, adapter: ITradingAdapter) {
    const key = this.getKey(platform, firm);
    this.adapters.set(key, adapter);
  }
}
