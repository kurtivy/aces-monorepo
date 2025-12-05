export const LIVE_TRADING_SYMBOLS = new Set(['APKAWS', 'RMILLE', 'ILLICIT']);

export const normalizeSymbol = (input?: string | null): string | null => {
  if (!input) {
    return null;
  }

  const normalized = input.trim().replace(/^\$/u, '').toUpperCase();
  return normalized.length > 0 ? normalized : null;
};

export const isSymbolTradingLive = (input?: string | null): boolean => {
  const normalized = normalizeSymbol(input);
  return normalized ? LIVE_TRADING_SYMBOLS.has(normalized) : false;
};
