import { FastNewsItem, FastNewsListResponse, SSENewsData } from '../infra/types.js';

/**
 * Format timestamp to readable string
 */
function formatTime(timestamp?: number, timeStr?: string): string {
  if (timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }
  if (timeStr) {
    return timeStr;
  }
  return 'N/A';
}

/**
 * Truncate text to specified length
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Format fast news item as text
 */
export function formatFastNewsItemText(item: FastNewsItem, index?: number): string {
  const prefix = index !== undefined ? `${index + 1}. ` : '';
  const time = formatTime(item.timestamp, item.time);
  const title = item.title || '无标题';
  const content = item.content ? truncate(item.content, 100) : '';
  const source = item.source ? ` [${item.source}]` : '';
  
  let result = `${prefix}${time} - ${title}${source}`;
  if (content) {
    result += `\n   ${content}`;
  }
  if (item.url) {
    result += `\n   ${item.url}`;
  }
  
  return result;
}

/**
 * Format fast news list as text
 */
export function formatFastNewsListText(response: FastNewsListResponse): string {
  const items = response.data?.list || [];
  
  if (items.length === 0) {
    return '暂无新闻';
  }

  const lines: string[] = [];
  
  // Add header if available
  if (response.data?.total !== undefined) {
    lines.push(`共 ${response.data.total} 条新闻，显示 ${items.length} 条`);
    lines.push('');
  }

  // Format each item
  items.forEach((item, index) => {
    lines.push(formatFastNewsItemText(item, index));
    lines.push('');
  });

  // Add pagination info if available
  if (response.data?.hasMore) {
    lines.push('(还有更多...)');
  }

  return lines.join('\n');
}

/**
 * Format fast news item as table row
 */
export function formatFastNewsItemTable(item: FastNewsItem): string[] {
  const time = formatTime(item.timestamp, item.time);
  const title = item.title || '无标题';
  const content = item.content ? truncate(item.content, 80) : '';
  const source = item.source || '-';
  
  return [
    time,
    title,
    content,
    source,
  ];
}

/**
 * Format fast news list as table
 */
export function formatFastNewsListTable(response: FastNewsListResponse): string {
  const items = response.data?.list || [];
  
  if (items.length === 0) {
    return '暂无新闻';
  }

  const lines: string[] = [];
  
  // Table header
  const headers = ['时间', '标题', '内容', '来源'];
  const headerRow = headers.join(' | ');
  const separator = headers.map(() => '---').join(' | ');
  
  lines.push(headerRow);
  lines.push(separator);

  // Table rows
  items.forEach(item => {
    const row = formatFastNewsItemTable(item).join(' | ');
    lines.push(row);
  });

  // Add summary if available
  if (response.data?.total !== undefined) {
    lines.push('');
    lines.push(`共 ${response.data.total} 条新闻，显示 ${items.length} 条`);
  }

  if (response.data?.hasMore) {
    lines.push('(还有更多...)');
  }

  return lines.join('\n');
}

/**
 * Format SSE news data as text
 */
export function formatSSENewsText(news: SSENewsData): string {
  const time = news.timestamp 
    ? new Date(news.timestamp).toLocaleString('zh-CN')
    : new Date().toLocaleString('zh-CN');
  
  return `[${time}] [${news.type}] ${news.content}`;
}

/**
 * Format multiple SSE news items as text
 */
export function formatSSENewsListText(newsList: SSENewsData[]): string {
  if (newsList.length === 0) {
    return '暂无新闻';
  }

  return newsList.map(news => formatSSENewsText(news)).join('\n');
}

