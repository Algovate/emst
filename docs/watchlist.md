# 自选股指南

自选股功能允许您管理一组股票代码并高效同步它们的数据。

## 概述

自选股存储在项目目录的 `.emst/watchlist.json` 文件中。您可以通过CLI命令或直接编辑JSON文件来管理它。

## CLI 命令

### 添加股票

```bash
# 添加上海市场股票（自动检测）
emst watchlist add 688005

# 添加深圳市场股票（自动检测）
emst watchlist add 000001

# 显式指定市场添加
emst watchlist add 600000 --market 1
emst watchlist add 000002 --market 0

# 添加港股（需要指定市场）
emst watchlist add 00700 --market 116

# 添加美股（需要指定市场）
emst watchlist add AAPL --market 105
```

### 移除股票

```bash
# 从自选股中移除
emst watchlist remove 688005
```

### 列出股票

```bash
# 列出所有自选股（基本信息，文本格式）
emst watchlist list

# 列出详细信息（包含缓存统计）
emst watchlist list --info

# JSON格式输出
emst watchlist list --format json

# 表格格式输出
emst watchlist list --format table
```

**基本输出示例（文本格式）：**
```
Watchlist (3 symbols):

1. 688005 - Shanghai (股票名称) - Added: 2024-01-01
2. 000001 - Shenzhen (另一只股票) - Added: 2024-01-02
3. 600000 - Shanghai - Added: 2024-01-03
```

**JSON格式输出示例：**
```json
[
  {
    "code": "688005",
    "market": 1,
    "marketName": "Shanghai",
    "name": "股票名称",
    "addedDate": "2024-01-01"
  },
  {
    "code": "000001",
    "market": 0,
    "marketName": "Shenzhen",
    "name": "另一只股票",
    "addedDate": "2024-01-02"
  }
]
```

**详细输出示例（使用 `--info` 标志）：**
```
Watchlist (1 symbols):

1. 688005 - Shanghai
   Name: 容百科技
   Added: 2025-11-17
   Cache:
     daily   :   1533 records (2019-07-22 to 2025-11-17)
              Last sync: 11/17/2025, 3:10:52 PM
     weekly  :    325 records (2019-07-26 to 2025-11-17)
              Last sync: 11/17/2025, 3:15:27 PM
     monthly :     77 records (2019-07-31 to 2025-11-17)
              Last sync: 11/17/2025, 3:15:27 PM
     5min    :   1536 records (2025-09-25 09:35 to 2025-11-17 15:00)
              Last sync: 11/17/2025, 3:15:27 PM
     ...
```

`--info` 标志显示：
- 股票名称
- 添加到自选股的日期
- 缓存的时间周期及记录数
- 缓存数据的日期范围
- 每个时间周期的最后同步时间戳

**注意：** 自选股同步默认使用前复权（fqt=1）。如需使用其他复权类型，请使用 `fetch` 命令并指定 `--fqt` 参数。

### 同步自选股

**默认情况下，`watchlist sync` 会同步自选股中所有股票的所有时间周期。**

```bash
# 同步所有股票的所有时间周期（默认行为）
emst watchlist sync

# 仅同步指定时间周期
emst watchlist sync --timeframe weekly

# 指定日期范围同步（适用于所有时间周期）
emst watchlist sync --start 20240101 --end 20241231

# 强制刷新（忽略缓存）
emst watchlist sync --force

# 组合选项
emst watchlist sync --timeframe daily --start 20240101 --force
```

### 默认行为：所有时间周期

当您运行 `watchlist sync` 而不指定时间周期时，它会自动同步所有可用的时间周期：

- `daily` - 日线K线数据
- `weekly` - 周线K线数据
- `monthly` - 月线K线数据
- `5min` - 5分钟日内数据
- `15min` - 15分钟日内数据
- `30min` - 30分钟日内数据
- `60min` - 60分钟日内数据

**同步所有时间周期时的输出示例：**

```
Syncing watchlist...
Timeframe: all (daily, weekly, monthly, 5min, 15min, 30min, 60min)

688005 (Shanghai):
  ✓ daily: 1533 records
  ✓ weekly: 220 records
  ✓ monthly: 52 records
  ✓ 5min: 0 records
  ✓ 15min: 0 records
  ✓ 30min: 0 records
  ✓ 60min: 0 records

Sync complete: 7 succeeded, 0 failed
```

### 同步单个时间周期

如果您只想同步特定时间周期，使用 `--timeframe` 选项：

```bash
# 仅同步日线数据
emst watchlist sync --timeframe daily

# 仅同步周线数据
emst watchlist sync --timeframe weekly

# 仅同步月线数据
emst watchlist sync --timeframe monthly

# 仅同步日内数据（5min, 15min, 30min, 60min）
emst watchlist sync --timeframe 5min
emst watchlist sync --timeframe 15min
emst watchlist sync --timeframe 30min
emst watchlist sync --timeframe 60min
```

**注意：** 每个时间周期都是单独缓存的。您可以同时为同一只股票缓存日线、周线、月线和日内数据。

## 手动JSON编辑

您可以直接编辑 `.emst/watchlist.json`：

```json
[
  {
    "code": "688005",
    "market": 1,
    "name": "股票名称",
    "addedDate": "2024-01-01"
  },
  {
    "code": "000001",
    "market": 0,
    "name": "另一只股票",
    "addedDate": "2024-01-02"
  }
]
```

### 字段说明

- `code`（必需）：6位股票代码（如 "688005"）
- `market`（必需）：市场代码（0=深圳，1=上海）
- `name`（可选）：股票名称（如果未提供，同步时会自动获取）
- `addedDate`（可选）：添加到自选股的日期（YYYY-MM-DD格式）

## 同步行为

运行 `watchlist sync` 时：

1. **增量同步**：仅获取上次缓存日期之后的新数据
2. **错误处理**：如果一只股票失败，其他股票继续同步
3. **进度报告**：显示每只股票的成功/失败状态
4. **缓存更新**：自动更新每只股票的缓存

### 同步输出示例

```
Syncing watchlist...
Timeframe: daily

✓ 688005 (Shanghai): 250 records
✓ 000001 (Shenzhen): 180 records
✗ 600000 (Shanghai): Network error

Sync complete: 2 succeeded, 1 failed
```

## 最佳实践

1. **定期同步**：定期运行 `watchlist sync` 以保持数据最新
2. **谨慎使用强制刷新**：仅在需要刷新所有数据时使用 `--force`
3. **日期范围**：仅在需要特定时间段时使用日期范围
4. **手动编辑**：对于批量操作或程序化管理，直接编辑JSON

## 故障排除

### 检查市场代码

```bash
# 检查自选股市场代码（文本格式，默认）
emst watchlist check

# JSON格式输出
emst watchlist check --format json
```

### 股票未找到

如果同步时找不到股票，请检查：
- 股票代码正确（6位数字）
- 市场代码与股票交易所匹配
- 股票正在交易

### 同步失败

如果同步失败：
- 检查网络连接
- 验证股票代码和市场是否正确
- 尝试单独同步股票以隔离问题
- 使用 `--force` 刷新缓存
