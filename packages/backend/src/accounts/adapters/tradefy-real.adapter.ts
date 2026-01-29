import { Injectable } from "@nestjs/common";
import { TradingFirm, Platform } from "@prisma/client";
import { RithmicAdapter } from "./rithmic/rithmic-adapter";

/**
 * Real Tradefy Adapter
 * Connects to Tradefy via Rithmic platform (or native API if different)
 */
@Injectable()
export class TradefyRealAdapter extends RithmicAdapter {
  constructor() {
    super(TradingFirm.TRADEFY);
  }
}
