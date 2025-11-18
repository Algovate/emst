# emst

[东方财富](https://quote.eastmoney.com/)股票数据工具。

[![npm version](https://img.shields.io/npm/v/emst.svg)](https://www.npmjs.com/package/emst)
[![npm](https://img.shields.io/npm/dm/emst.svg)](https://www.npmjs.com/package/emst)

## 功能特性

- 支持多个市场（A股、港股、美股）的K线数据获取
- 支持股票、指数、基金和ETF
- 支持多种时间周期：日线、周线、月线，以及日内数据（5分钟、15分钟、30分钟、60分钟）
- 实时行情获取（REST API）
- **SSE实时数据流**：支持实时行情、分时走势、成交明细的实时推送
- **快讯新闻**：支持获取和实时流式推送财经快讯
- 支持导出为 JSON 或 CSV 格式
- 日期范围筛选
- 复权价格支持（不复权/前复权/后复权）
- 自选股管理
- 本地缓存和增量同步

## 安装

### 作为 npm 包使用（推荐）

```bash
# 全局安装
npm install -g emst

# 或作为项目依赖安装
npm install emst
```

全局安装后，可以直接使用 `emst` 命令：

```bash
emst stock fetch --code 688005
emst stock quote --code 688005
emst stock watchlist add 688005
emst news list
```

### 从源码安装

```bash
git clone https://github.com/Algovate/emst.git
cd emst
npm install
npm run build
```

## 使用方法

> **注意**: 如果通过 `npm install -g emst` 全局安装，可以直接使用 `emst` 命令。如果从源码运行，请使用 `npm run start --`。

### 基本获取

```bash
# 获取日线K线数据
emst stock fetch --code 688005
# 或从源码运行: npm run start -- stock fetch --code 688005

# 指定时间周期
emst stock fetch --code 688005 --timeframe weekly

# 指定日期范围
emst stock fetch --code 688005 --start 20240101 --end 20241231

# 保存到文件
emst stock fetch --code 688005 --output data.json

# 导出为CSV（通过文件扩展名自动识别）
emst stock fetch --code 688005 --output data.csv

# 不同市场（A股代码会自动检测市场，无需指定）
emst stock fetch --code 000001              # 深圳（自动检测）
emst stock fetch --code 688005              # 上海（自动检测）
emst stock fetch --code 00700 --market 116  # 港股（需要指定）
emst stock fetch --code AAPL --market 105   # 美股（需要指定）

# 复权类型
emst stock fetch --code 688005 --fqt 0  # 不复权
emst stock fetch --code 688005 --fqt 1  # 前复权（默认）
emst stock fetch --code 688005 --fqt 2  # 后复权

# 获取实时行情
emst stock quote --code 688005

# 实时数据流（SSE）
emst stock stream --code 688005
emst stock stream --code 688005 --types quote,trend,detail
emst stock stream --watchlist
```

### 自选股管理

```bash
# 添加股票（A股代码会自动检测市场）
emst stock watchlist add 688005       # 上海（自动检测）
emst stock watchlist add 000001       # 深圳（自动检测）
emst stock watchlist add 00700 --market 116  # 港股（需要指定）
emst stock watchlist add AAPL --market 105   # 美股（需要指定）

# 列出自选股
emst stock watchlist list

# 同步自选股
emst stock watchlist sync

# 同步指定时间周期
emst stock watchlist sync --timeframe weekly
```

### 新闻功能

```bash
# 获取快讯列表（REST API）
emst news list
emst news list --category live_724  # 指定分类
emst news list --page-size 100      # 指定数量

# 实时新闻流（SSE）
emst news stream
```

### 命令行选项

**股票获取命令 (`stock fetch`)：**

- `-c, --code <code>`: 股票代码（必需）
- `-m, --market <market>`: 市场代码（0=深圳，1=上海，105=美股，116=港股）。A股代码会自动检测，无需指定
- `-t, --timeframe <timeframe>`: 时间周期（daily/weekly/monthly/5min/15min/30min/60min，默认：daily）
- `-s, --start <date>`: 开始日期（YYYYMMDD）
- `-e, --end <date>`: 结束日期（YYYYMMDD）
- `-o, --output <path>`: 输出文件路径（如果扩展名为 .csv，自动使用 CSV 格式）
- `-f, --format <format>`: 输出格式（json/table/text，默认：json）
- `--fqt <0|1|2>`: 复权类型（0=不复权，1=前复权，2=后复权，默认：1）
- `--no-cache`: 绕过缓存
- `--verbose`: 启用详细日志（debug 级别）
- `--quiet`: 禁用所有输出（包括数据），仅显示错误

**实时行情命令 (`stock quote`)：**

- `stock quote --code <code> [--market <market>] [--format <format>]`: 获取实时行情快照
  - `--format <format>`: 输出格式（json/table/text，默认：table）

**实时流命令 (`stock stream`)：**

- `stock stream --code <code> [--market <market>]`: 实时监控单个股票
- `stock stream --watchlist`: 监控自选股列表
- `--types <types>`: 订阅类型（quote,trend,detail,news，默认：quote）
- `--format <format>`: 输出格式（json/table/text，默认：table）

**自选股命令 (`stock watchlist`)：**

- `stock watchlist add <code> [--market <market>]`: 添加股票
- `stock watchlist remove <code>`: 移除股票
- `stock watchlist list [--info] [--format <format>]`: 列出所有
  - `--info`: 显示详细信息（包含缓存统计）
  - `--format <format>`: 输出格式（json/table/text，默认：text）
- `stock watchlist check [--format <format>]`: 检查市场代码
  - `--format <format>`: 输出格式（json/table/text，默认：text）
- `stock watchlist sync [--timeframe <timeframe>] [--force]`: 同步数据

**新闻命令 (`news`)：**

- `news list [--category <category>] [--page-size <size>] [--format <format>]`: 获取快讯列表
  - `--category <category>`: 新闻分类（live_724, focus, bond 等）或 fastColumn ID
  - `--page-size <size>`: 每页数量（1-200，默认：50）
  - `--format <format>`: 输出格式（json/table/text，默认：text）
- `news stream [--format <format>]`: 实时新闻流（SSE）
  - `--format <format>`: 输出格式（json/table/text，默认：text）

## 缓存

数据缓存在 `.emst/` 目录：

- 自选股：`.emst/watchlist.json`
- 缓存：`.emst/cache/`

默认启用缓存，自动检查有效性并增量更新。

## 数据格式

每条K线记录包含：

- `date`, `open`, `close`, `high`, `low`, `volume`, `amount` 等字段

## 文档

详细文档请参阅 [docs/](docs/) 目录：

- [API 文档](docs/api.md) - 完整的 API 参考
- [使用示例](docs/examples.md) - 更多使用示例
- [缓存机制](docs/cache.md) - 缓存系统说明
- [自选股管理](docs/watchlist.md) - 自选股功能详解

## 相关链接

- 📦 [npm 包页面](https://www.npmjs.com/package/emst)
- 🐛 [问题反馈](https://github.com/Algovate/emst/issues)
- 💡 [功能建议](https://github.com/Algovate/emst/issues)

## 许可证

MIT
