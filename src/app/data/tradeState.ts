const ACTIVE_TRADES_KEY = 'vinyl-check-active-trades';
const COMPLETION_PREFIX = 'vinyl-check-trade-completion';

export interface ActiveTrade {
  albumId: string;
  buyerName: string;
  offerPrice: number;
  acceptedAt: string;
  status: 'selling' | 'completed';
}

export interface TradeCompletion {
  buyerChecked: boolean;
  sellerChecked: boolean;
  completedAt?: string;
}

export function getActiveTrades(): ActiveTrade[] {
  try {
    return JSON.parse(localStorage.getItem(ACTIVE_TRADES_KEY) || '[]') as ActiveTrade[];
  } catch {
    return [];
  }
}

export function saveActiveTrade(trade: ActiveTrade) {
  const trades = getActiveTrades();
  const nextTrades = [
    ...trades.filter(item => item.albumId !== trade.albumId),
    trade,
  ];
  localStorage.setItem(ACTIVE_TRADES_KEY, JSON.stringify(nextTrades));
}

export function getActiveTrade(albumId: string) {
  return getActiveTrades().find(trade => trade.albumId === albumId);
}

export function completeActiveTrade(albumId: string) {
  const trades = getActiveTrades().map(trade =>
    trade.albumId === albumId
      ? { ...trade, status: 'completed' as const }
      : trade
  );
  localStorage.setItem(ACTIVE_TRADES_KEY, JSON.stringify(trades));
}

export function getTradeCompletion(albumId: string): TradeCompletion {
  try {
    return JSON.parse(localStorage.getItem(`${COMPLETION_PREFIX}:${albumId}`) || '{}') as TradeCompletion;
  } catch {
    return { buyerChecked: false, sellerChecked: false };
  }
}

export function saveTradeCompletion(albumId: string, completion: TradeCompletion) {
  localStorage.setItem(`${COMPLETION_PREFIX}:${albumId}`, JSON.stringify(completion));
}
