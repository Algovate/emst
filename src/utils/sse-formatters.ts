import { SSEQuoteData, SSETrendData, SSEDetailData } from '../infra/types.js';

/**
 * Format SSE quote data for display
 */
export function formatSSEQuote(quote: SSEQuoteData): string {
  const lines = [
    `代码: ${quote.code} | 名称: ${quote.name}`,
    `最新价: ${quote.latestPrice.toFixed(2)} | 涨跌: ${quote.changeAmount?.toFixed(2) || '0.00'} | 涨跌幅: ${quote.changePercent?.toFixed(2) || '0.00'}%`,
    `今开: ${quote.open.toFixed(2)} | 最高: ${quote.high.toFixed(2)} | 昨收: ${quote.previousClose.toFixed(2)}`,
    `成交量: ${quote.volume.toLocaleString()} | 成交额: ${quote.amount.toLocaleString()}`,
  ];

  if (quote.buy1Price && quote.sell1Price) {
    lines.push(
      `买一: ${quote.buy1Price.toFixed(2)} (${quote.buy1Volume || 0}) | 卖一: ${quote.sell1Price.toFixed(2)} (${quote.sell1Volume || 0})`
    );
  }

  return lines.join('\n');
}

/**
 * Format trend data for display
 */
export function formatTrendData(trends: SSETrendData[]): string {
  if (trends.length === 0) return 'No trend data';

  const latest = trends[trends.length - 1];
  return `时间: ${latest.time} | 价格: ${latest.price.toFixed(2)} | 成交量: ${latest.volume.toLocaleString()}`;
}

/**
 * Format detail data for display
 */
export function formatDetailData(details: SSEDetailData[]): string {
  if (details.length === 0) return 'No detail data';

  const latest = details[details.length - 1];
  return `时间: ${latest.time} | 价格: ${latest.price.toFixed(2)} | 成交量: ${latest.volume} | 方向: ${latest.direction}`;
}

