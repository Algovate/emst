# emst

一个用于从东方财富获取股票数据的爬虫工具。

[![npm version](https://img.shields.io/npm/v/emst.svg)](https://www.npmjs.com/package/emst)
[![npm](https://img.shields.io/npm/dm/emst.svg)](https://www.npmjs.com/package/emst)

📦 **npm 包**: [https://www.npmjs.com/package/emst](https://www.npmjs.com/package/emst)

## 功能特性

- 支持多个市场（A股、港股、美股）的K线数据获取
- 支持股票、指数、基金和ETF
- 支持多种时间周期：日线、周线、月线，以及日内数据（5分钟、15分钟、30分钟、60分钟）
- 实时行情获取
- 支持导出为 JSON 或 CSV 格式
- 日期范围筛选
- 复权价格支持（不复权/前复权/后复权）
- 自选股管理
- 本地缓存和增量同步

## 安装

### 作为 npm 包使用

```bash
npm install -g emst
```

安装后，可以直接使用 `emst` 命令：

```bash
emst --code 688005
emst quote --code 688005
emst watchlist add 688005
```

### 从源码安装

```bash
git clone <repository-url>
cd emst
npm install
npm run build
```

## 使用方法

> **注意**: 如果通过 `npm install -g emst` 全局安装，可以直接使用 `emst` 命令。如果从源码运行，请使用 `npm run start --`。

### 基本获取

```bash
# 获取日线K线数据
emst --code 688005
# 或从源码运行: npm run start -- --code 688005

# 指定时间周期
emst --code 688005 --timeframe weekly

# 指定日期范围
emst --code 688005 --start 20240101 --end 20241231

# 保存到文件
emst --code 688005 --output data.json

# 导出为CSV
emst --code 688005 --output data.csv --format csv

# 不同市场（A股代码会自动检测市场，无需指定）
emst --code 000001              # 深圳（自动检测）
emst --code 688005              # 上海（自动检测）
emst --code 00700 --market 116  # 港股（需要指定）
emst --code AAPL --market 105   # 美股（需要指定）

# 复权类型
emst --code 688005 --fqt 0  # 不复权
emst --code 688005 --fqt 1  # 前复权（默认）
emst --code 688005 --fqt 2  # 后复权

# 获取实时行情
emst quote --code 688005
```

### 自选股管理

```bash
# 添加股票（A股代码会自动检测市场）
emst watchlist add 688005       # 上海（自动检测）
emst watchlist add 000001       # 深圳（自动检测）
emst watchlist add 00700 --market 116  # 港股（需要指定）
emst watchlist add AAPL --market 105   # 美股（需要指定）

# 列出自选股
emst watchlist list

# 同步自选股
emst watchlist sync

# 同步指定时间周期
emst watchlist sync --timeframe weekly
```

### 命令行选项

**获取命令：**

- `-c, --code <code>`: 股票代码（必需）
- `-m, --market <market>`: 市场代码（0=深圳，1=上海，105=美股，116=港股，默认：1）
- `-t, --timeframe <timeframe>`: 时间周期（daily/weekly/monthly/5min/15min/30min/60min，默认：daily）
- `-s, --start <date>`: 开始日期（YYYYMMDD）
- `-e, --end <date>`: 结束日期（YYYYMMDD）
- `-o, --output <path>`: 输出文件路径
- `-f, --format <format>`: 输出格式（json/csv，默认：json）
- `--fqt <0|1|2>`: 复权类型（0=不复权，1=前复权，2=后复权，默认：1）
- `--no-cache`: 绕过缓存

**自选股命令：**

- `watchlist add <code> [--market <market>]`: 添加股票
- `watchlist remove <code>`: 移除股票
- `watchlist list`: 列出所有
- `watchlist sync [--timeframe <timeframe>] [--force]`: 同步数据

## 缓存

数据缓存在 `.emst/` 目录：

- 自选股：`.emst/watchlist.json`
- 缓存：`.emst/cache/`

默认启用缓存，自动检查有效性并增量更新。

## 数据格式

每条K线记录包含：

- `date`, `open`, `close`, `high`, `low`, `volume`, `amount` 等字段

## 文档

详细文档请参阅 [docs/](docs/) 目录。

## 许可证

MIT
