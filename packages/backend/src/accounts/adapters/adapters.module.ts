import { Module } from "@nestjs/common";
import { AdapterFactory } from "./adapter.factory";
import { TopStepXAdapter } from "./topstepx.adapter";
import { TopStepXRealAdapter } from "./topstepx-real.adapter";
import { TakeProfitTraderRealAdapter } from "./takeprofit-real.adapter";
import { AlphaFuturesRealAdapter } from "./alphafutures-real.adapter";
import { MyFundedFuturesRealAdapter } from "./myfunded-real.adapter";
import { TradefyRealAdapter } from "./tradefy-real.adapter";
import { RithmicAdapter } from "./rithmic/rithmic-adapter";
import { TradovateAdapter } from "./tradovate/tradovate-adapter";
import { NinjaTraderAdapter } from "./ninjatrader/ninjatrader-adapter";
import { TradingFirm } from "@prisma/client";

@Module({
  providers: [
    AdapterFactory,
    TopStepXAdapter, // Mock adapter
    // Real adapters
    TopStepXRealAdapter, // Uses ProjectX
    TakeProfitTraderRealAdapter, // Uses Rithmic (backward compatibility)
    MyFundedFuturesRealAdapter, // Uses Rithmic (backward compatibility)
    TradefyRealAdapter,
    AlphaFuturesRealAdapter,
    // Platform-specific adapters - create instances for each firm that uses them
    {
      provide: "TradovateAdapter_TakeProfit",
      useFactory: () => new TradovateAdapter(TradingFirm.TAKEPROFIT_TRADER),
    },
    {
      provide: "TradovateAdapter_MyFunded",
      useFactory: () => new TradovateAdapter(TradingFirm.MYFUNDED_FUTURES),
    },
    {
      provide: "NinjaTraderAdapter_TakeProfit",
      useFactory: () => new NinjaTraderAdapter(TradingFirm.TAKEPROFIT_TRADER),
    },
    {
      provide: "NinjaTraderAdapter_MyFunded",
      useFactory: () => new NinjaTraderAdapter(TradingFirm.MYFUNDED_FUTURES),
    },
  ],
  exports: [AdapterFactory],
})
export class AdaptersModule {}
