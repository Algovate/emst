# API 参考

emst 提供完整的编程式 API，用于获取股票数据、管理自选股和处理缓存。

## 安装

### 作为依赖安装（推荐）

```bash
npm install emst
```

### 从源码安装

```bash
git clone https://github.com/Algovate/emst.git
cd emst
npm install
npm run build
```

## 快速开始

### 导入模块

从主入口点导入所有 API（推荐方式，不会触发 CLI 代码）：

```typescript
import { 
  EastMoneyCrawler,
  Market, 
  Timeframe, 
  CrawlerOptions,
  addToWatchlist, 
  getWatchlist, 
  removeFromWatchlist,
  getCachedData, 
  setCachedData, 
  isCacheValid,
  syncWatchlist
} from 'emst';
```

如果从本地源码导入（开发时）：

```typescript
import { 
  EastMoneyCrawler,
  Market, 
  Timeframe, 
  CrawlerOptions,
  addToWatchlist, 
  getWatchlist, 
  removeFromWatchlist,
  getCachedData, 
  setCachedData, 
  isCacheValid,
  syncWatchlist
} from './dist/index.js';
```

## 爬虫 API

### EastMoneyCrawler

用于获取 K线数据、实时行情和快讯新闻的主类。

```typescript
const crawler = new EastMoneyCrawler();
```

#### fetchKlineData(options: CrawlerOptions): Promise<KlineData[]>

获取股票的 K线数据。

```typescript
const data = await crawler.fetchKlineData({
  code: '688005',
  market: Market.Shanghai,
  timeframe: 'daily',
  startDate: '20240101',
  endDate: '20241231',
  limit: 1000000,
  fqt: 1  // 0=不复权, 1=前复权, 2=后复权（默认：1）
});
```

#### getStockInfo(code: string, market: Market): Promise<StockInfo>

获取股票基本信息（名称、市场等）。

```typescript
const info = await crawler.getStockInfo('688005', Market.Shanghai);
// 返回: { code: '688005', name: '股票名称', market: 1 }
```

## 自选股 API

### addToWatchlist(code: string, market: Market, name?: string): void

添加股票到自选股。

```typescript
addToWatchlist('688005', Market.Shanghai, '股票名称');
```

### removeFromWatchlist(code: string): boolean

从自选股中移除股票。如果移除成功返回 `true`，未找到返回 `false`。

```typescript
const removed = removeFromWatchlist('688005');
```

### getWatchlist(): WatchlistEntry[]

获取所有自选股条目。

```typescript
const entries = getWatchlist();
entries.forEach(entry => {
  console.log(`${entry.code} - ${entry.market}`);
});
```

### getWatchlistEntry(code: string): WatchlistEntry | undefined

获取特定的自选股条目。

```typescript
const entry = getWatchlistEntry('688005');
if (entry) {
  console.log(entry.name);
}
```

### updateWatchlistEntry(code: string, updates: Partial<WatchlistEntry>): boolean

更新自选股条目。如果更新成功返回 `true`，未找到返回 `false`。

```typescript
updateWatchlistEntry('688005', { name: '新名称' });
```

## 缓存 API

### getCachedData(code: string, market: Market, timeframe: Timeframe, startDate?: string, endDate?: string, fqt?: AdjustmentType): KlineData[] | null

获取股票的缓存数据。如果缓存不存在返回 `null`。`fqt` 参数指定复权类型（默认：1，前复权）。

```typescript
const cached = getCachedData('688005', Market.Shanghai, 'daily', '20240101', '20241231', 1);
if (cached) {
  console.log(`找到 ${cached.length} 条缓存记录`);
}
```

### setCachedData(code: string, market: Market, timeframe: Timeframe, data: KlineData[], merge?: boolean, fqt?: AdjustmentType): void

保存数据到缓存。如果 `merge` 为 `true`，则与现有缓存合并。`fqt` 参数指定复权类型（默认：1，前复权）。

```typescript
setCachedData('688005', Market.Shanghai, 'daily', data, true, 1);
```

### isCacheValid(code: string, market: Market, timeframe: Timeframe, maxAge?: number, fqt?: AdjustmentType): boolean

检查缓存是否有效。`maxAge` 以毫秒为单位（默认：24小时）。`fqt` 参数指定复权类型（默认：1，前复权）。

```typescript
const valid = isCacheValid('688005', Market.Shanghai, 'daily', 24 * 60 * 60 * 1000, 1);
```

### getCacheDateRange(code: string, market: Market, timeframe: Timeframe, fqt?: AdjustmentType): DateRange | null

获取缓存数据的日期范围。如果缓存不存在返回 `null`。`fqt` 参数指定复权类型（默认：1，前复权）。

```typescript
const range = getCacheDateRange('688005', Market.Shanghai, 'daily', 1);
if (range) {
  console.log(`缓存范围: ${range.min} 到 ${range.max}`);
}
```

### clearCache(code?: string, market?: Market, timeframe?: Timeframe, fqt?: AdjustmentType): number

清除缓存。如果不提供参数，则清除所有缓存。`fqt` 参数指定复权类型（可选）。返回删除的文件数量。

```typescript
// 清除特定缓存（前复权）
clearCache('688005', Market.Shanghai, 'daily', 1);

// 清除所有缓存
const deleted = clearCache();
console.log(`删除了 ${deleted} 个缓存文件`);
```

## 同步 API

### syncWatchlist(options?: SyncOptions): Promise<SyncResult[]>

同步自选股中的所有股票。

```typescript
const results = await syncWatchlist({
  timeframe: 'daily',
  startDate: '20240101',
  endDate: '20241231',
  force: false
});

results.forEach(result => {
  if (result.success) {
    console.log(`${result.symbol}: ${result.recordsFetched} 条记录`);
  } else {
    console.error(`${result.symbol}: ${result.error}`);
  }
});
```

## 类型定义

### CrawlerOptions

```typescript
interface CrawlerOptions {
  code: string;
  market?: Market;
  timeframe?: Timeframe;
  startDate?: string; // YYYYMMDD
  endDate?: string; // YYYYMMDD
  limit?: number;
  fqt?: AdjustmentType; // Price adjustment type: 0=none, 1=forward, 2=backward (default: 1)
}
```

### AdjustmentType

```typescript
type AdjustmentType = 0 | 1 | 2;
// 0 = none (不复权)
// 1 = forward (前复权)
// 2 = backward (后复权)
```

### WatchlistEntry

```typescript
interface WatchlistEntry {
  code: string;
  market: Market;
  name?: string;
  addedDate?: string; // YYYY-MM-DD
}
```

### KlineData

```typescript
interface KlineData {
  date: string; // YYYY-MM-DD
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
  amount: number;
  amplitude?: number;
  changePercent?: number;
  changeAmount?: number;
  turnoverRate?: number;
}
```

### SyncOptions

```typescript
interface SyncOptions {
  timeframe?: Timeframe;
  startDate?: string; // YYYYMMDD
  endDate?: string; // YYYYMMDD
  force?: boolean;
}
```

注意：`maxAge` 参数已移除，缓存有效期现在通过配置文件管理。

### SyncResult

```typescript
interface SyncResult {
  symbol: string;
  market: Market;
  success: boolean;
  recordsFetched?: number;
  error?: string;
}
```

## 示例：完整工作流

```typescript
import { 
  EastMoneyCrawler,
  Market,
  addToWatchlist, 
  syncWatchlist,
  getCachedData
} from 'emst';

// 添加股票到自选股
addToWatchlist('688005', Market.Shanghai);
addToWatchlist('000001', Market.Shenzhen);

// 同步自选股
const results = await syncWatchlist({ timeframe: 'daily' });

// 获取缓存数据
const data = getCachedData('688005', Market.Shanghai, 'daily');
if (data) {
  console.log(`缓存了 ${data.length} 条记录`);
}
```

## 错误处理

所有函数都会抛出错误，应该进行捕获：

```typescript
try {
  const data = await crawler.fetchKlineData({ code: '688005', market: Market.Shanghai });
} catch (error) {
  console.error('获取失败:', error.message);
}
```

## 实时行情 API

#### getRealtimeQuote(code: string, market: Market): Promise<RealtimeQuote>

获取股票的实时行情快照。

```typescript
const crawler = new EastMoneyCrawler();
const quote = await crawler.getRealtimeQuote('688005', Market.Shanghai);
```

## 快讯新闻 API

#### fetchFastNews(options?: FastNewsOptions): Promise<FastNewsListResponse>

获取财经快讯列表。

```typescript
const crawler = new EastMoneyCrawler();

// 获取默认快讯列表
const news = await crawler.fetchFastNews();

// 指定分类和数量
const news = await crawler.fetchFastNews({
  category: 'live_724',  // 7x24 小时快讯
  pageSize: 100
});
```

### FastNewsOptions

```typescript
interface FastNewsOptions {
  category?: FastNewsCategory | string;  // 新闻分类或 fastColumn ID
  pageSize?: number;                     // 每页数量（1-200，默认：50）
}
```

### FastNewsListResponse

```typescript
interface FastNewsListResponse {
  items: FastNewsItem[];
  total?: number;
  pageSize?: number;
  category?: string;
}
```

### FastNewsItem

```typescript
interface FastNewsItem {
  id: string;              // 新闻ID
  title: string;           // 标题
  content: string;         // 内容摘要
  time: string;            // 时间字符串
  timestamp?: number;      // 时间戳（毫秒）
  source?: string;         // 来源
  url: string;             // 全文链接
  category?: string;       // 分类
}
```

### FastNewsCategory

支持的新闻分类：

```typescript
enum FastNewsCategory {
  LIVE_724 = 'live_724',  // 7x24 小时快讯
  FOCUS = 'focus',        // 焦点新闻
  BOND = 'bond',          // 债券新闻
  // ... 更多分类
}
```

### RealtimeQuote 接口

```typescript
interface RealtimeQuote {
  code: string;              // 股票代码
  name: string;              // 股票名称
  market: number;            // 市场代码
  latestPrice: number;       // 最新价
  open: number;              // 今开
  previousClose: number;     // 昨收
  high: number;              // 最高
  low: number;               // 最低
  volume: number;            // 成交量
  amount: number;            // 成交额
  changePercent?: number;    // 涨跌幅 (%)
  changeAmount?: number;     // 涨跌额
  totalMarketValue?: number; // 总市值
  circulatingMarketValue?: number; // 流通市值
  timestamp?: number;        // 数据获取时间戳
}
```

## 支持的市场和代码

### 市场

- **Market 0**: 深圳 - A股股票、指数、基金、ETF
- **Market 1**: 上海 - A股股票、指数
- **Market 105**: 美股
- **Market 116**: 港股

### 代码类型

**股票：**
- A股：6位数字（如 688005, 000001）
- 港股：5位数字，以0开头（如 00700）
- 美股：1-5个大写字母（如 AAPL, TSLA）

**指数（使用与股票相同的API）：**
- 000001 (上证指数) - Market 1
- 000300 (沪深300) - Market 1
- 399001 (深证成指) - Market 0
- 399006 (创业板指) - Market 0

**基金/ETF（使用与股票相同的API）：**
- 000001 (基金) - Market 0
- 159001 (ETF) - Market 0

## 注意事项

- API调用时所有日期格式为 YYYYMMDD
- 缓存数据使用 YYYY-MM-DD 格式
- 市场代码：0 = 深圳，1 = 上海，105 = 美股，116 = 港股
- 股票代码格式：
  - A股（深圳/上海）：6位数字（如 688005）
  - 港股：5位数字，以0开头（如 00700）
  - 美股：1-5个大写字母（如 AAPL）
- 指数和基金/ETF使用与股票相同的API和代码格式
- 缓存存储在 `.emst/cache/` 目录
- 自选股存储在 `.emst/watchlist.json`
