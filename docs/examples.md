# 使用示例

本文档提供了在各种场景下使用 emst 的实用示例。

## 基本数据获取

### 获取日线数据

```bash
# 获取最新日线数据
npm run start -- --code 688005

# 获取并保存到文件
npm run start -- --code 688005 --output daily.json

# 指定日期范围获取
npm run start -- --code 688005 --start 20240101 --end 20241231 --output 2024.json
```

### 获取不同时间周期

```bash
# 周线数据
npm run start -- --code 688005 --timeframe weekly --output weekly.json

# 月线数据
npm run start -- --code 688005 --timeframe monthly --output monthly.json

# 5分钟日内数据
npm run start -- --code 688005 --timeframe 5min --output 5min.json

# 15分钟日内数据
npm run start -- --code 688005 --timeframe 15min --output 15min.json
```

### 导出格式

```bash
# JSON格式（默认）
npm run start -- --code 688005 --output data.json --format json

# CSV格式
npm run start -- --code 688005 --output data.csv --format csv
```

### 复权类型

```bash
# 不复权
npm run start -- --code 688005 --fqt 0 --output none.json

# 前复权（默认）
npm run start -- --code 688005 --fqt 1 --output forward.json
# 或
npm run start -- --code 688005 --output forward.json

# 后复权
npm run start -- --code 688005 --fqt 2 --output backward.json
```

## 自选股工作流

### 设置自选股

```bash
# 添加多个股票
npm run start -- watchlist add 688005
npm run start -- watchlist add 000001 --market 0
npm run start -- watchlist add 600000
npm run start -- watchlist add 000002 --market 0

# 验证自选股
npm run start -- watchlist list
```

### 定期同步工作流

```bash
# 日线同步（每天运行）
npm run start -- watchlist sync

# 周线数据同步
npm run start -- watchlist sync --timeframe weekly

# 月线数据同步
npm run start -- watchlist sync --timeframe monthly
```

### 历史数据收集

```bash
# 同步2024年的历史数据
npm run start -- watchlist sync --start 20240101 --end 20241231

# 同步多年历史数据
npm run start -- watchlist sync --start 20200101 --end 20231231
```

## 缓存管理

### 使用缓存

```bash
# 首次获取（创建缓存）
npm run start -- --code 688005

# 第二次获取（如果缓存有效则使用缓存）
npm run start -- --code 688005

# 强制获取新数据
npm run start -- --code 688005 --no-cache
```

### 带日期范围的缓存

```bash
# 指定日期范围获取（使用缓存）
npm run start -- --code 688005 --start 20240101 --end 20240630

# 获取扩展范围（使用缓存 + 获取新数据）
npm run start -- --code 688005 --start 20240101 --end 20241231
```

## 高级场景

### 批量处理

```bash
# 添加多个股票
for code in 688005 600000 000001; do
  npm run start -- watchlist add $code
done

# 同步所有
npm run start -- watchlist sync
```

### 数据导出工作流

```bash
# 1. 添加股票到自选股
npm run start -- watchlist add 688005
npm run start -- watchlist add 000001 --market 0

# 2. 同步数据
npm run start -- watchlist sync --start 20240101 --end 20241231

# 3. 导出单个股票
npm run start -- --code 688005 --start 20240101 --end 20241231 --output stock1.json
npm run start -- --code 000001 --start 20240101 --end 20241231 --output stock2.json --market 0
```

### 多时间周期分析

```bash
# 同步日线数据
npm run start -- watchlist sync --timeframe daily

# 同步周线数据
npm run start -- watchlist sync --timeframe weekly

# 同步月线数据
npm run start -- watchlist sync --timeframe monthly

# 获取特定时间周期进行分析
npm run start -- --code 688005 --timeframe daily --output daily.json
npm run start -- --code 688005 --timeframe weekly --output weekly.json
npm run start -- --code 688005 --timeframe monthly --output monthly.json
```

### 日内数据收集

```bash
# 同步5分钟数据
npm run start -- watchlist sync --timeframe 5min

# 同步15分钟数据
npm run start -- watchlist sync --timeframe 15min

# 同步30分钟数据
npm run start -- watchlist sync --timeframe 30min

# 同步60分钟数据
npm run start -- watchlist sync --timeframe 60min
```

## 脚本示例

### 日线同步Shell脚本

创建 `sync-daily.sh`：

```bash
#!/bin/bash
# 日线同步脚本

echo "开始日线同步..."
npm run start -- watchlist sync --timeframe daily

echo "同步完成！"
```

使其可执行：

```bash
chmod +x sync-daily.sh
./sync-daily.sh
```

### Python数据分析脚本

```python
import json
import subprocess

# 获取数据
subprocess.run([
    'npm', 'run', 'start', '--',
    '--code', '688005',
    '--output', 'data.json'
])

# 加载并分析
with open('data.json') as f:
    data = json.load(f)
    
# 计算平均成交量
avg_volume = sum(d['volume'] for d in data) / len(data)
print(f"平均成交量: {avg_volume}")
```

### Node.js 脚本

```javascript
import { execSync } from 'child_process';
import { readFileSync } from 'fs';

// 同步自选股
execSync('npm run start -- watchlist sync', { stdio: 'inherit' });

// 读取缓存数据（前复权，默认）
const data = JSON.parse(
  readFileSync('.emst/cache/688005_1_daily_fqt1.json', 'utf-8')
);

console.log(`缓存了 ${data.data.length} 条记录`);
```

### 使用编程式 API

```typescript
import { EastMoneyCrawler } from './core/crawler.js';
import { Market } from './infra/types.js';
import { addToWatchlist, syncWatchlist } from './storage/watchlist.js';
import { getCachedData } from './storage/cache.js';

// 添加股票到自选股
addToWatchlist('688005', Market.Shanghai);

// 同步自选股
const results = await syncWatchlist({ timeframe: 'daily' });

// 获取缓存数据
const data = getCachedData('688005', Market.Shanghai, 'daily');
if (data) {
  console.log(`缓存了 ${data.length} 条记录`);
}
```

## 故障排除示例

### 强制刷新所有数据

```bash
# 强制刷新所有股票
npm run start -- watchlist sync --force

# 强制刷新特定股票
npm run start -- --code 688005 --no-cache
```

### 验证缓存

```bash
# 检查缓存文件
ls -lh .emst/cache/

# 查看缓存文件（前复权，默认）
cat .emst/cache/688005_1_daily_fqt1.json | jq '.lastSync'
```

### 清除并重建缓存

```bash
# 清除所有缓存
rm -rf .emst/cache/*

# 重新同步所有股票
npm run start -- watchlist sync
```

## 最佳实践

### 每日工作流

```bash
# 早上：同步最新数据
npm run start -- watchlist sync

# 分析：获取特定数据
npm run start -- --code 688005 --output analysis.json
```

### 每周工作流

```bash
# 周一：同步周线数据
npm run start -- watchlist sync --timeframe weekly

# 整周：使用日线同步
npm run start -- watchlist sync --timeframe daily
```

### 每月工作流

```bash
# 月初：同步月线数据
npm run start -- watchlist sync --timeframe monthly

# 如需要也同步历史数据
npm run start -- watchlist sync --start 20200101 --end 20231231
```

## 集成示例

### 使用 Cron（Linux/Mac）

添加到 crontab（`crontab -e`）：

```bash
# 每天上午9点同步
0 9 * * * cd /path/to/emst && npm run start -- watchlist sync
```

### 使用任务计划程序（Windows）

创建批处理文件 `sync.bat`：

```batch
cd C:\path\to\emst
npm run start -- watchlist sync
```

将其安排为每天运行。

### 使用 GitHub Actions

创建 `.github/workflows/sync.yml`：

```yaml
name: Daily Sync

on:
  schedule:
    - cron: '0 9 * * *'  # 每天上午9点

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '20'
      - run: npm install
      - run: npm run build
      - run: npm run start -- watchlist sync
```
