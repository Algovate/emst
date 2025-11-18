# 使用示例

本文档提供了在各种场景下使用 emst 的实用示例。

> **注意**: 如果通过 `npm install -g emst` 全局安装，可以直接使用 `emst` 命令。如果从源码运行，请使用 `npm run start --`。

## 基本数据获取

### 获取日线数据

```bash
# 获取最新日线数据（默认输出为 JSON 格式到 stdout）
emst stock fetch --code 688005

# 或使用简写形式
emst stock f --code 688005

# 获取并保存到文件
emst stock fetch --code 688005 --output daily.json

# 指定日期范围获取
emst stock fetch --code 688005 --start 20240101 --end 20241231 --output 2024.json

# 使用表格格式输出
emst stock fetch --code 688005 --format table

# 使用文本格式输出
emst stock fetch --code 688005 --format text

# 静默模式（仅输出数据，不显示进度信息）
emst stock fetch --code 688005 --quiet

# 详细模式（显示调试信息）
emst stock fetch --code 688005 --verbose
```

### 获取不同时间周期

```bash
# 周线数据
emst stock fetch --code 688005 --timeframe weekly --output weekly.json

# 月线数据
emst stock fetch --code 688005 --timeframe monthly --output monthly.json

# 5分钟日内数据
emst stock fetch --code 688005 --timeframe 5min --output 5min.json

# 15分钟日内数据
emst stock fetch --code 688005 --timeframe 15min --output 15min.json

# 30分钟日内数据
emst stock fetch --code 688005 --timeframe 30min --output 30min.json

# 60分钟日内数据
emst stock fetch --code 688005 --timeframe 60min --output 60min.json
```

### 导出格式

```bash
# JSON格式（默认）
emst stock fetch --code 688005 --output data.json --format json

# 表格格式
emst stock fetch --code 688005 --format table

# 文本格式
emst stock fetch --code 688005 --format text

# CSV格式（通过文件扩展名自动识别）
emst stock fetch --code 688005 --output data.csv
```

### 复权类型

```bash
# 不复权
emst stock fetch --code 688005 --fqt 0 --output none.json

# 前复权（默认）
emst stock fetch --code 688005 --fqt 1 --output forward.json
# 或
emst stock fetch --code 688005 --output forward.json

# 后复权
emst stock fetch --code 688005 --fqt 2 --output backward.json
```

### 多市场支持

```bash
# A股（自动检测市场，无需指定）
emst stock fetch --code 688005              # 上海（自动检测）
emst stock fetch --code 000001              # 深圳（自动检测）

# 显式指定A股市场
emst stock fetch --code 600000 --market 1   # 上海
emst stock fetch --code 000001 --market 0   # 深圳

# 港股（需要指定市场）
emst stock fetch --code 00700 --market 116

# 美股（需要指定市场）
emst stock fetch --code AAPL --market 105
```

## 新闻功能

### 获取快讯列表

```bash
# 获取快讯列表（默认文本格式）
emst news list

# 指定分类
emst news list --category live_724  # 7x24小时快讯
emst news list --category focus     # 焦点新闻
emst news list --category bond      # 债券新闻

# 指定数量
emst news list --page-size 100

# JSON格式输出
emst news list --format json

# 表格格式输出
emst news list --format table
```

### 实时新闻流

```bash
# 实时新闻流（SSE）
emst news stream

# JSON格式输出
emst news stream --format json

# 文本格式输出（默认）
emst news stream --format text
```

## 实时行情

### 获取实时行情快照

```bash
# 获取实时行情（表格格式，默认）
emst stock quote --code 688005

# JSON格式输出
emst stock quote --code 688005 --format json

# 文本格式输出
emst stock quote --code 688005 --format text

# 港股实时行情
emst stock quote --code 00700 --market 116

# 美股实时行情
emst stock quote --code AAPL --market 105
```

### 实时数据流（SSE）

```bash
# 监控单个股票的实时行情
emst stock stream --code 688005

# 订阅多种数据类型
emst stock stream --code 688005 --types quote,trend,detail

# JSON格式输出
emst stock stream --code 688005 --format json

# 文本格式输出
emst stock stream --code 688005 --format text

# 监控自选股列表
emst stock stream --watchlist

# 监控自选股并订阅所有类型
emst stock stream --watchlist --types quote,trend,detail,news

# 设置更新间隔（毫秒）
emst stock stream --code 688005 --interval 2000
```

## 自选股工作流

### 设置自选股

```bash
# 添加股票（A股代码会自动检测市场）
emst stock watchlist add 688005       # 上海（自动检测）
emst stock watchlist add 000001       # 深圳（自动检测）

# 显式指定市场添加
emst stock watchlist add 600000 --market 1
emst stock watchlist add 000002 --market 0

# 添加港股
emst stock watchlist add 00700 --market 116

# 添加美股
emst stock watchlist add AAPL --market 105

# 验证自选股
emst stock watchlist list

# 查看详细信息（包含缓存统计）
emst stock watchlist list --info

# JSON格式列出
emst stock watchlist list --format json

# 检查自选股市场代码
emst stock watchlist check

# JSON格式检查
emst stock watchlist check --format json

# 移除股票
emst stock watchlist remove 688005
```

### 定期同步工作流

```bash
# 同步所有时间周期（默认行为）
emst stock watchlist sync

# 仅同步日线数据
emst stock watchlist sync --timeframe daily

# 周线数据同步
emst stock watchlist sync --timeframe weekly

# 月线数据同步
emst stock watchlist sync --timeframe monthly

# 日内数据同步
emst stock watchlist sync --timeframe 5min
emst stock watchlist sync --timeframe 15min
emst stock watchlist sync --timeframe 30min
emst stock watchlist sync --timeframe 60min
```

### 历史数据收集

```bash
# 同步2024年的历史数据
emst stock watchlist sync --start 20240101 --end 20241231

# 同步多年历史数据
emst stock watchlist sync --start 20200101 --end 20231231

# 强制刷新所有数据（忽略缓存）
emst stock watchlist sync --force

# 组合选项：同步特定时间周期的历史数据
emst stock watchlist sync --timeframe daily --start 20240101 --end 20241231 --force
```

## 缓存管理

### 使用缓存

```bash
# 首次获取（创建缓存）
emst stock fetch --code 688005

# 第二次获取（如果缓存有效则使用缓存）
emst stock fetch --code 688005

# 强制获取新数据
emst stock fetch --code 688005 --no-cache
```

### 带日期范围的缓存

```bash
# 指定日期范围获取（使用缓存）
emst stock fetch --code 688005 --start 20240101 --end 20240630

# 获取扩展范围（使用缓存 + 获取新数据）
emst stock fetch --code 688005 --start 20240101 --end 20241231
```

### 验证缓存

```bash
# 检查缓存文件
ls -lh .emst/cache/

# 查看缓存文件（前复权，默认）
cat .emst/cache/688005_1_daily_fqt1.json | jq '.lastSync'

# 查看缓存数据范围
cat .emst/cache/688005_1_daily_fqt1.json | jq '.data[0].date, .data[-1].date'
```

### 清除并重建缓存

```bash
# 清除所有缓存
rm -rf .emst/cache/*

# 重新同步所有股票
emst stock watchlist sync
```

## 高级场景

### 批量处理

```bash
# 添加多个股票
for code in 688005 600000 000001; do
  emst stock watchlist add $code
done

# 同步所有
emst stock watchlist sync

# 批量导出数据
for code in 688005 600000 000001; do
  emst stock fetch --code $code --output ${code}.json
done
```

### 数据导出工作流

```bash
# 1. 添加股票到自选股
emst stock watchlist add 688005
emst stock watchlist add 000001

# 2. 同步数据
emst stock watchlist sync --start 20240101 --end 20241231

# 3. 导出单个股票
emst stock fetch --code 688005 --start 20240101 --end 20241231 --output stock1.json
emst stock fetch --code 000001 --start 20240101 --end 20241231 --output stock2.json

# 4. 导出为CSV格式（通过文件扩展名自动识别）
emst stock fetch --code 688005 --output stock1.csv
```

### 多时间周期分析

```bash
# 同步所有时间周期
emst stock watchlist sync

# 获取特定时间周期进行分析
emst stock fetch --code 688005 --timeframe daily --output daily.json
emst stock fetch --code 688005 --timeframe weekly --output weekly.json
emst stock fetch --code 688005 --timeframe monthly --output monthly.json

# 获取日内数据
emst stock fetch --code 688005 --timeframe 5min --output 5min.json
emst stock fetch --code 688005 --timeframe 15min --output 15min.json
```

### 日内数据收集

```bash
# 同步5分钟数据
emst stock watchlist sync --timeframe 5min

# 同步15分钟数据
emst stock watchlist sync --timeframe 15min

# 同步30分钟数据
emst stock watchlist sync --timeframe 30min

# 同步60分钟数据
emst stock watchlist sync --timeframe 60min
```

### 多市场数据收集

```bash
# 添加不同市场的股票
emst stock watchlist add 688005              # A股（上海）
emst stock watchlist add 000001              # A股（深圳）
emst stock watchlist add 00700 --market 116  # 港股
emst stock watchlist add AAPL --market 105   # 美股

# 同步所有市场的数据
emst stock watchlist sync

# 获取特定市场的实时行情
emst stock quote --code 00700 --market 116
emst stock quote --code AAPL --market 105
```

## 脚本示例

### 日线同步Shell脚本

创建 `sync-daily.sh`：

```bash
#!/bin/bash
# 日线同步脚本

echo "开始日线同步..."
emst stock watchlist sync --timeframe daily

echo "同步完成！"
```

使其可执行：

```bash
chmod +x sync-daily.sh
./sync-daily.sh
```

### 实时监控脚本

创建 `monitor.sh`：

```bash
#!/bin/bash
# 实时监控脚本

echo "开始监控自选股..."
emst stock stream --watchlist --types quote,trend
```

### Python数据分析脚本

```python
import json
import subprocess

# 获取数据
subprocess.run([
    'emst', 'stock', 'fetch', '--code', '688005',
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
execSync('emst stock watchlist sync', { stdio: 'inherit' });

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
emst stock watchlist sync --force

# 强制刷新特定股票
emst stock fetch --code 688005 --no-cache
```

### 验证自选股配置

```bash
# 检查自选股列表
emst stock watchlist list

# 检查市场代码是否正确
emst stock watchlist check

# 查看详细缓存信息
emst stock watchlist list --info
```

### 清除并重建缓存

```bash
# 清除所有缓存
rm -rf .emst/cache/*

# 重新同步所有股票
emst stock watchlist sync
```

### 网络问题处理

```bash
# 如果网络不稳定，可以分批同步
emst stock watchlist sync --timeframe daily
emst stock watchlist sync --timeframe weekly

# 或者单独同步每只股票
emst stock fetch --code 688005 --no-cache
emst stock fetch --code 600000 --no-cache
```

## 最佳实践

### 每日工作流

```bash
# 早上：同步最新数据
emst stock watchlist sync --timeframe daily

# 查看实时行情
emst stock quote --code 688005

# 分析：获取特定数据
emst stock fetch --code 688005 --output analysis.json
```

### 每周工作流

```bash
# 周一：同步周线数据
emst stock watchlist sync --timeframe weekly

# 整周：使用日线同步
emst stock watchlist sync --timeframe daily
```

### 每月工作流

```bash
# 月初：同步月线数据
emst stock watchlist sync --timeframe monthly

# 如需要也同步历史数据
emst stock watchlist sync --start 20200101 --end 20231231
```

### 实时监控工作流

```bash
# 开盘前：查看实时行情
emst stock quote --code 688005

# 交易时间：启动实时流监控
emst stock stream --code 688005 --types quote,trend

# 监控自选股
emst stock stream --watchlist --types quote
```

## 集成示例

### 使用 Cron（Linux/Mac）

添加到 crontab（`crontab -e`）：

```bash
# 每天上午9点同步日线数据
0 9 * * * emst stock watchlist sync --timeframe daily

# 每周一上午9点同步周线数据
0 9 * * 1 emst stock watchlist sync --timeframe weekly

# 每月1号上午9点同步月线数据
0 9 1 * * emst stock watchlist sync --timeframe monthly
```

### 使用任务计划程序（Windows）

创建批处理文件 `sync-daily.bat`：

```batch
@echo off
cd /d C:\path\to\project
emst stock watchlist sync --timeframe daily
```

创建批处理文件 `sync-weekly.bat`：

```batch
@echo off
cd /d C:\path\to\project
emst stock watchlist sync --timeframe weekly
```

将其安排为定期运行。

### 使用 GitHub Actions

创建 `.github/workflows/sync.yml`：

```yaml
name: Daily Sync

on:
  schedule:
    - cron: '0 9 * * *'  # 每天上午9点
  workflow_dispatch:     # 允许手动触发

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm install -g emst
      - run: emst stock watchlist sync --timeframe daily
      - name: Commit changes
        run: |
          git config --local user.email "action@github.com"
          git config --local user.name "GitHub Action"
          git add .emst/
          git diff --staged --quiet || git commit -m "Auto-sync stock data"
          git push
```

### 使用 systemd（Linux）

创建服务文件 `/etc/systemd/system/emst-sync.service`：

```ini
[Unit]
Description=EMST Daily Stock Data Sync
After=network.target

[Service]
Type=oneshot
User=your-username
WorkingDirectory=/path/to/your/project
ExecStart=/usr/bin/emst stock watchlist sync --timeframe daily
```

创建定时器文件 `/etc/systemd/system/emst-sync.timer`：

```ini
[Unit]
Description=Run EMST sync daily
Requires=emst-sync.service

[Timer]
OnCalendar=daily
OnCalendar=09:00
Persistent=true

[Install]
WantedBy=timers.target
```

启用定时器：

```bash
sudo systemctl enable emst-sync.timer
sudo systemctl start emst-sync.timer
```

## 常见使用场景

### 场景1：快速查看股票行情

```bash
# 查看实时行情
emst stock quote --code 688005

# 查看最近数据
emst stock fetch --code 688005 --start 20241201 --end 20241231
```

### 场景2：建立股票数据库

```bash
# 1. 添加关注的股票
emst stock watchlist add 688005
emst stock watchlist add 600000
emst stock watchlist add 000001

# 2. 同步历史数据
emst stock watchlist sync --start 20200101 --end 20241231

# 3. 定期更新
emst stock watchlist sync --timeframe daily
```

### 场景3：技术分析数据准备

```bash
# 获取多时间周期数据
emst stock fetch --code 688005 --timeframe daily --output daily.json
emst stock fetch --code 688005 --timeframe weekly --output weekly.json
emst stock fetch --code 688005 --timeframe monthly --output monthly.json

# 获取不同复权类型
emst stock fetch --code 688005 --fqt 0 --output none.json
emst stock fetch --code 688005 --fqt 1 --output forward.json
emst stock fetch --code 688005 --fqt 2 --output backward.json
```

### 场景4：实时监控交易

```bash
# 监控单只股票
emst stock stream --code 688005 --types quote,trend,detail

# 监控自选股列表
emst stock stream --watchlist --types quote
```

### 场景5：数据导出和分析

```bash
# 导出为CSV用于Excel分析（通过文件扩展名自动识别）
emst stock fetch --code 688005 --output data.csv

# 导出JSON用于程序分析
emst stock fetch --code 688005 --output data.json --format json

# 批量导出自选股数据
for code in $(emst stock watchlist list | grep -oE '[0-9]{6}'); do
  emst stock fetch --code $code --output ${code}.json
done
```
