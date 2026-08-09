<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>📊 基金净值追踪 · 场内/场外 · 高低点/涨幅/回撤</title>
    <script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js">
    </script>
    <style>
        /* ===== 全局重置 & 暗色主题 ===== */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #0b1424;
            color: #e8edf5;
            min-height: 100vh;
            padding: 20px;
            display: flex;
            justify-content: center;
        }
        .app {
            max-width: 1200px;
            width: 100%;
        }

        /* ===== 头部 ===== */
        .header {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 24px;
            padding: 16px 20px;
            background: rgba(18, 30, 56, 0.7);
            border-radius: 16px;
            border: 1px solid rgba(0, 200, 255, 0.12);
            backdrop-filter: blur(6px);
        }
        .header h1 {
            font-size: 22px;
            font-weight: 700;
            background: linear-gradient(135deg, #00d4ff, #7b61ff);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            letter-spacing: 0.5px;
        }
        .header h1 small {
            font-size: 14px;
            font-weight: 400;
            -webkit-text-fill-color: #8899bb;
            background: none;
            margin-left: 8px;
        }
        .search-box {
            display: flex;
            gap: 10px;
            align-items: center;
            flex-wrap: wrap;
        }
        .search-box label {
            font-size: 13px;
            color: #8899bb;
            font-weight: 500;
        }
        .search-box input {
            width: 120px;
            padding: 8px 12px;
            border-radius: 10px;
            border: 1.5px solid rgba(0, 200, 255, 0.25);
            background: rgba(0, 20, 50, 0.6);
            color: #e8edf5;
            font-size: 15px;
            font-weight: 600;
            font-family: monospace;
            text-align: center;
            outline: none;
            transition: border 0.3s;
        }
        .search-box input:focus {
            border-color: #00d4ff;
            box-shadow: 0 0 12px rgba(0, 200, 255, 0.2);
        }
        .search-box button {
            padding: 8px 20px;
            border-radius: 10px;
            border: none;
            background: linear-gradient(135deg, #00c8ff, #7b61ff);
            color: #fff;
            font-weight: 700;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.25s;
            box-shadow: 0 0 16px rgba(0, 200, 255, 0.2);
        }
        .search-box button:hover {
            transform: scale(1.03);
            box-shadow: 0 0 24px rgba(0, 200, 255, 0.35);
        }
        .search-box button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
        }
        .fund-name-display {
            font-size: 15px;
            font-weight: 600;
            color: #7bc8ff;
            margin-left: 4px;
            min-width: 140px;
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
        }
        .fund-name-display .code {
            color: #8899bb;
            font-weight: 400;
            font-size: 13px;
        }
        .fund-type-badge {
            font-size: 10px;
            font-weight: 700;
            padding: 2px 10px;
            border-radius: 20px;
            letter-spacing: 0.4px;
            background: rgba(0, 200, 255, 0.15);
            color: #00d4ff;
            border: 1px solid rgba(0, 200, 255, 0.2);
        }
        .fund-type-badge.on-exchange {
            background: rgba(255, 184, 0, 0.15);
            color: #fdb813;
            border-color: rgba(253, 184, 19, 0.25);
        }
        .fund-type-badge.off-exchange {
            background: rgba(0, 200, 255, 0.12);
            color: #00d4ff;
            border-color: rgba(0, 200, 255, 0.2);
        }

        /* ===== 统计卡片 ===== */
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
            gap: 12px;
            margin-bottom: 20px;
        }
        .stat-card {
            background: rgba(18, 30, 56, 0.6);
            border-radius: 14px;
            padding: 14px 16px;
            border: 1px solid rgba(0, 200, 255, 0.08);
            backdrop-filter: blur(4px);
            transition: border 0.3s;
        }
        .stat-card:hover {
            border-color: rgba(0, 200, 255, 0.25);
        }
        .stat-card .label {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: #667799;
            font-weight: 600;
        }
        .stat-card .value {
            font-size: 20px;
            font-weight: 700;
            margin-top: 4px;
            font-family: 'SF Mono', 'Menlo', monospace;
            letter-spacing: 0.3px;
        }
        .stat-card .value .sub {
            font-size: 13px;
            font-weight: 400;
            color: #8899bb;
            margin-left: 4px;
        }
        .stat-card .date-tag {
            font-size: 11px;
            color: #667799;
            margin-top: 2px;
        }
        .stat-card .highlight-up {
            color: #ff6b6b;
        }
        .stat-card .highlight-down {
            color: #4ecdc4;
        }
        .stat-card .highlight-neutral {
            color: #ffd93d;
        }

        /* ===== 时间周期切换 ===== */
        .period-bar {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
            margin-bottom: 16px;
            padding: 4px 0;
        }
        .period-btn {
            padding: 6px 16px;
            border-radius: 20px;
            border: 1px solid rgba(0, 200, 255, 0.15);
            background: transparent;
            color: #8899bb;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.25s;
        }
        .period-btn:hover {
            border-color: rgba(0, 200, 255, 0.4);
            color: #c8d8f0;
        }
        .period-btn.active {
            background: rgba(0, 200, 255, 0.15);
            border-color: #00c8ff;
            color: #00d4ff;
            box-shadow: 0 0 16px rgba(0, 200, 255, 0.1);
        }

        /* ===== 图表容器 ===== */
        .chart-wrapper {
            background: rgba(12, 22, 44, 0.7);
            border-radius: 16px;
            padding: 12px 12px 4px 12px;
            border: 1px solid rgba(0, 200, 255, 0.08);
            margin-bottom: 20px;
            position: relative;
        }
        #chart {
            width: 100%;
            height: 400px;
        }
        .chart-loading {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 400px;
            color: #667799;
            font-size: 14px;
            flex-direction: column;
            gap: 12px;
        }
        .chart-loading .spinner {
            width: 32px;
            height: 32px;
            border: 3px solid rgba(0, 200, 255, 0.1);
            border-top-color: #00c8ff;
            border-radius: 50%;
            animation: spin 0.9s linear infinite;
        }
        @keyframes spin {
            to {
                transform: rotate(360deg);
            }
        }

        /* ===== 数据表格 ===== */
        .table-section {
            background: rgba(12, 22, 44, 0.6);
            border-radius: 16px;
            padding: 16px 18px;
            border: 1px solid rgba(0, 200, 255, 0.06);
            max-height: 280px;
            overflow-y: auto;
        }
        .table-section::-webkit-scrollbar {
            width: 4px;
        }
        .table-section::-webkit-scrollbar-track {
            background: rgba(0, 0, 0, 0.2);
            border-radius: 4px;
        }
        .table-section::-webkit-scrollbar-thumb {
            background: rgba(0, 200, 255, 0.3);
            border-radius: 4px;
        }
        .table-section table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }
        .table-section th {
            text-align: left;
            padding: 8px 6px;
            color: #667799;
            font-weight: 600;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-bottom: 1px solid rgba(0, 200, 255, 0.08);
            position: sticky;
            top: 0;
            background: rgba(12, 22, 44, 0.95);
            backdrop-filter: blur(4px);
        }
        .table-section td {
            padding: 6px 6px;
            border-bottom: 1px solid rgba(0, 200, 255, 0.04);
            font-family: 'SF Mono', 'Menlo', monospace;
            font-size: 12px;
            color: #b8c8e0;
        }
        .table-section td:first-child {
            color: #8899bb;
        }
        .table-section tr:hover td {
            background: rgba(0, 200, 255, 0.04);
        }
        .table-section .highlight-up {
            color: #ff6b6b;
        }
        .table-section .highlight-down {
            color: #4ecdc4;
        }

        /* ===== 响应式 ===== */
        @media (max-width: 640px) {
            .header {
                flex-direction: column;
                align-items: stretch;
                gap: 12px;
            }
            .header h1 {
                font-size: 18px;
                text-align: center;
            }
            .search-box {
                justify-content: center;
            }
            .search-box input {
                width: 100px;
            }
            .stats-grid {
                grid-template-columns: repeat(2, 1fr);
            }
            .stat-card .value {
                font-size: 17px;
            }
            #chart {
                height: 280px;
            }
            .table-section {
                max-height: 180px;
            }
            .fund-name-display {
                min-width: 100px;
                font-size: 13px;
            }
        }

        /* 辅助类 */
        .text-muted {
            color: #667799;
        }
        .mt-8 {
            margin-top: 8px;
        }
        .flex-between {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .gap-4 {
            gap: 4px;
        }
        .fw-700 {
            font-weight: 700;
        }
    </style>
</head>
<body>
    <div class="app" id="app">
        <header class="header">
            <h1>📈 净值追踪 <small>场内 · 场外</small></h1>
            <div class="search-box">
                <label for="fundInput">基金代码</label>
                <input type="text" id="fundInput" value="008591" maxlength="6" placeholder="如 008591" />
                <button id="fetchBtn">🚀 查询</button>
                <span class="fund-name-display" id="fundNameDisplay">
                    <span class="code" id="fundCodeDisplay">008591</span>
                    <span class="fund-type-badge off-exchange" id="fundTypeBadge">场外</span>
                </span>
            </div>
        </header>

        <div class="stats-grid" id="statsGrid">
            <div class="stat-card"><div class="label">📌 当前净值</div><div class="value" id="statCurrent">--</div><div class="date-tag" id="statDate">--</div></div>
            <div class="stat-card"><div class="label">🔺 近期高点</div><div class="value highlight-up" id="statHigh">--</div><div class="date-tag" id="statHighDate">--</div></div>
            <div class="stat-card"><div class="label">🔻 近期低点</div><div class="value highlight-down" id="statLow">--</div><div class="date-tag" id="statLowDate">--</div></div>
            <div class="stat-card"><div class="label">📈 低点→现涨幅</div><div class="value highlight-up" id="statRise">--</div><div class="date-tag" id="statRiseDate">--</div></div>
            <div class="stat-card"><div class="label">📉 高点回撤</div><div class="value highlight-down" id="statDrawdown">--</div><div class="date-tag" id="statDrawdownDate">--</div></div>
            <div class="stat-card"><div class="label">📊 区间涨跌</div><div class="value" id="statInterval">--</div><div class="date-tag" id="statIntervalDate">--</div></div>
        </div>

        <div class="period-bar" id="periodBar">
            <button class="period-btn" data-period="1M">近1月</button>
            <button class="period-btn" data-period="3M">近3月</button>
            <button class="period-btn" data-period="6M">近6月</button>
            <button class="period-btn active" data-period="1Y">近1年</button>
            <button class="period-btn" data-period="ALL">全部</button>
        </div>

        <div class="chart-wrapper">
            <div id="chart">
                <div class="chart-loading" id="chartLoading">
                    <div class="spinner"></div>
                    <span>加载数据中…</span>
                </div>
            </div>
        </div>

        <div class="table-section" id="tableSection">
            <div style="font-size:12px;color:#667799;margin-bottom:8px;font-weight:600;letter-spacing:0.5px;">
                📋 历史净值明细
                <span style="font-weight:400;color:#445566;margin-left:8px;" id="tableCount"></span>
            </div>
            <table>
                <thead><tr><th>日期</th><th style="text-align:right;">净值</th><th style="text-align:right;">涨跌幅</th><th style="text-align:right;">距高点</th><th style="text-align:right;">距低点</th></tr></thead>
                <tbody id="tableBody"><tr><td colspan="5" style="text-align:center;color:#445566;padding:20px;">暂无数据</td></tr></tbody>
            </table>
        </div>
    </div>

    <script>
        // ================================================================
        //  核心数据管理
        // ================================================================
        const state = {
            code: '008591',
            rawData: [],
            filteredData: [],
            currentPeriod: '1Y',          // 默认近一年
            fundName: '',
            fundType: 'off-exchange',
            isLoading: false,
        };

        const $ = id => document.getElementById(id);
        const fundInput = $('fundInput');
        const fetchBtn = $('fetchBtn');
        const fundNameDisplay = $('fundNameDisplay');
        const fundCodeDisplay = $('fundCodeDisplay');
        const fundTypeBadge = $('fundTypeBadge');
        const chartEl = $('chart');
        const chartLoading = $('chartLoading');
        const tableBody = $('tableBody');
        const tableCount = $('tableCount');

        const statEls = {
            current: $('statCurrent'),
            date: $('statDate'),
            high: $('statHigh'),
            highDate: $('statHighDate'),
            low: $('statLow'),
            lowDate: $('statLowDate'),
            rise: $('statRise'),
            riseDate: $('statRiseDate'),
            drawdown: $('statDrawdown'),
            drawdownDate: $('statDrawdownDate'),
            interval: $('statInterval'),
            intervalDate: $('statIntervalDate'),
        };

        let echartsInstance = null;

        // ================================================================
        //  工具函数 —— 基金类型检测
        // ================================================================
        function detectFundType(code) {
            const onExchangePrefixes = ['50', '51', '56', '58', '159', '16'];
            for (const p of onExchangePrefixes) {
                if (code.startsWith(p)) return 'on-exchange';
            }
            return 'off-exchange';
        }

        function getSecId(code, type) {
            if (type === 'on-exchange') {
                if (code.startsWith('5')) return `1.${code}`;
                if (code.startsWith('1')) return `0.${code}`;
                return `0.${code}`;
            }
            return null;
        }

        // ================================================================
        //  数据获取 —— 场外基金
        // ================================================================
        function fetchOffExchangeData(code) {
            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src =
                    `https://fund.eastmoney.com/pingzhongdata/${code}.js?_=${Date.now()}`;
                let resolved = false;

                const cleanup = () => {
                    if (script.parentNode) script.parentNode.removeChild(script);
                };

                script.onload = () => {
                    if (resolved) return;
                    resolved = true;
                    cleanup();
                    const trend = window.Data_netWorthTrend;
                    const name = window.fS_name || code;
                    if (trend && Array.isArray(trend) && trend.length > 0) {
                        const data = trend.map(item => ({
                            NAVDATE: item.x,
                            NETVALUE: item.y
                        }));
                        resolve({ data, name, type: 'off-exchange' });
                    } else {
                        reject(new Error('未获取到净值数据，请确认基金代码正确'));
                    }
                    delete window.Data_netWorthTrend;
                    delete window.fS_name;
                };

                script.onerror = () => {
                    if (resolved) return;
                    resolved = true;
                    cleanup();
                    reject(new Error('网络请求失败，请检查网络或基金代码'));
                };

                document.head.appendChild(script);

                setTimeout(() => {
                    if (!resolved) {
                        resolved = true;
                        cleanup();
                        reject(new Error('请求超时，请稍后重试'));
                    }
                }, 15000);
            });
        }

        // ================================================================
        //  数据获取 —— 场内基金
        // ================================================================
        async function fetchOnExchangeData(code) {
            const secid = getSecId(code, 'on-exchange');
            if (!secid) throw new Error('无效的场内基金代码');

            const url =
                `https://push2.eastmoney.com/api/qt/stock/kline/get?secid=${secid}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61&klt=101&fqt=1&end=20500101&lmt=2000`;

            const resp = await fetch(url);
            if (!resp.ok) throw new Error(`网络请求失败 (${resp.status})`);

            const json = await resp.json();
            if (!json.data || !json.data.klines || json.data.klines.length === 0) {
                throw new Error('未获取到行情数据，请确认基金代码正确');
            }

            const name = json.data.name || code;
            const klines = json.data.klines;

            const data = klines.map(line => {
                const parts = line.split(',');
                return {
                    NAVDATE: parts[0],
                    NETVALUE: parseFloat(parts[2])
                };
            }).filter(d => d.NAVDATE && !isNaN(d.NETVALUE) && d.NETVALUE > 0);

            if (data.length === 0) throw new Error('解析行情数据失败');

            return { data, name, type: 'on-exchange' };
        }

        // ================================================================
        //  统一数据获取入口
        // ================================================================
        async function fetchFundData(code) {
            const type = detectFundType(code);
            if (type === 'on-exchange') {
                return fetchOnExchangeData(code);
            } else {
                return fetchOffExchangeData(code);
            }
        }

        // ================================================================
        //  数据处理
        // ================================================================
        function processRawData(raw) {
            return raw
                .map(item => ({
                    date: item.NAVDATE || '',
                    nav: parseFloat(item.NETVALUE || 0),
                }))
                .filter(d => d.date && d.nav > 0)
                .sort((a, b) => a.date.localeCompare(b.date));
        }

        function filterByPeriod(data, period) {
            if (period === 'ALL' || data.length === 0) return data.slice();
            const now = new Date();
            let cutoff = new Date(now);
            switch (period) {
                case '1M':
                    cutoff.setMonth(cutoff.getMonth() - 1);
                    break;
                case '3M':
                    cutoff.setMonth(cutoff.getMonth() - 3);
                    break;
                case '6M':
                    cutoff.setMonth(cutoff.getMonth() - 6);
                    break;
                case '1Y':
                    cutoff.setFullYear(cutoff.getFullYear() - 1);
                    break;
                default:
                    return data.slice();
            }
            const cutoffStr = cutoff.toISOString().split('T')[0];
            return data.filter(d => d.date >= cutoffStr);
        }

        function calcStats(data) {
            if (!data || data.length === 0) return null;
            const current = data[data.length - 1];
            let high = data[0],
                low = data[0];
            for (const d of data) {
                if (d.nav > high.nav) high = d;
                if (d.nav < low.nav) low = d;
            }
            const riseFromLow = low.nav > 0 ? ((current.nav - low.nav) / low.nav * 100) : 0;
            const drawdownFromHigh = high.nav > 0 ? ((current.nav - high.nav) / high.nav * 100) : 0;
            const intervalChange = data.length > 1 ? ((current.nav - data[0].nav) / data[0].nav * 100) : 0;
            return {
                current: current.nav,
                currentDate: current.date,
                high: high.nav,
                highDate: high.date,
                low: low.nav,
                lowDate: low.date,
                riseFromLow,
                drawdownFromHigh,
                intervalChange,
                firstNav: data[0].nav,
                firstDate: data[0].date,
                count: data.length,
            };
        }

        // ================================================================
        //  渲染 UI
        // ================================================================
        function renderStats(stats) {
            if (!stats) {
                Object.values(statEls).forEach(el => el.textContent = '--');
                return;
            }
            const fmt = v => v.toFixed(4);
            const fmtPct = v => (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
            const fmtDate = d => d || '--';

            statEls.current.textContent = fmt(stats.current);
            statEls.date.textContent = fmtDate(stats.currentDate);
            statEls.high.textContent = fmt(stats.high);
            statEls.highDate.textContent = fmtDate(stats.highDate);
            statEls.low.textContent = fmt(stats.low);
            statEls.lowDate.textContent = fmtDate(stats.lowDate);
            statEls.rise.textContent = fmtPct(stats.riseFromLow);
            statEls.riseDate.textContent = `低点 ${fmtDate(stats.lowDate)}`;
            statEls.drawdown.textContent = fmtPct(stats.drawdownFromHigh);
            statEls.drawdownDate.textContent = `高点 ${fmtDate(stats.highDate)}`;
            statEls.interval.textContent = fmtPct(stats.intervalChange);
            statEls.intervalDate.textContent = `${fmtDate(stats.firstDate)} → ${fmtDate(stats.currentDate)}`;

            const riseEl = statEls.rise;
            const ddEl = statEls.drawdown;
            const intEl = statEls.interval;
            riseEl.style.color = stats.riseFromLow >= 0 ? '#ff6b6b' : '#4ecdc4';
            ddEl.style.color = stats.drawdownFromHigh >= 0 ? '#ff6b6b' : '#4ecdc4';
            intEl.style.color = stats.intervalChange >= 0 ? '#ff6b6b' : '#4ecdc4';
        }

        function renderTable(data, stats) {
            if (!data || data.length === 0) {
                tableBody.innerHTML =
                    `<tr><td colspan="5" style="text-align:center;color:#445566;padding:20px;">暂无数据</td></tr>`;
                tableCount.textContent = '';
                return;
            }
            const high = stats ? stats.high : 0;
            const low = stats ? stats.low : 0;
            let html = '';
            const reversed = data.slice().reverse();
            for (const d of reversed) {
                const chg = data.length > 1 ? ((d.nav - data[0].nav) / data[0].nav * 100) : 0;
                const fromHigh = high > 0 ? ((d.nav - high) / high * 100) : 0;
                const fromLow = low > 0 ? ((d.nav - low) / low * 100) : 0;
                const chgCls = chg >= 0 ? 'highlight-up' : 'highlight-down';
                const fhCls = fromHigh >= 0 ? 'highlight-up' : 'highlight-down';
                const flCls = fromLow >= 0 ? 'highlight-up' : 'highlight-down';
                html += `<tr>
                        <td>${d.date}</td>
                        <td style="text-align:right;font-weight:600;">${d.nav.toFixed(4)}</td>
                        <td style="text-align:right;" class="${chgCls}">${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%</td>
                        <td style="text-align:right;" class="${fhCls}">${fromHigh >= 0 ? '+' : ''}${fromHigh.toFixed(2)}%</td>
                        <td style="text-align:right;" class="${flCls}">${fromLow >= 0 ? '+' : ''}${fromLow.toFixed(2)}%</td>
                    </tr>`;
            }
            tableBody.innerHTML = html;
            tableCount.textContent = `共 ${data.length} 条`;
        }

        // ================================================================
        //  ECharts 图表渲染
        // ================================================================
        function initChart() {
            if (echartsInstance) {
                echartsInstance.dispose();
                echartsInstance = null;
            }
            const loading = document.querySelector('.chart-loading');
            if (loading) loading.remove();
            echartsInstance = echarts.init(chartEl, 'dark');
            return echartsInstance;
        }

        function renderChart(data, stats, period) {
            if (!data || data.length < 2) {
                if (echartsInstance) {
                    echartsInstance.clear();
                    echartsInstance.setOption({
                        title: { text: '数据不足', left: 'center', top: 'center', textStyle: { color: '#667799',
                                fontSize: 14 } }
                    });
                }
                return;
            }
            const chart = initChart();
            const dates = data.map(d => d.date);
            const values = data.map(d => d.nav);
            const high = stats ? stats.high : Math.max(...values);
            const low = stats ? stats.low : Math.min(...values);

            const option = {
                tooltip: {
                    trigger: 'axis',
                    backgroundColor: 'rgba(10,20,40,0.9)',
                    borderColor: 'rgba(0,200,255,0.3)',
                    borderWidth: 1,
                    textStyle: { color: '#e8edf5', fontSize: 12 },
                    formatter: function(params) {
                        const p = params[0];
                        if (!p) return '';
                        const idx = p.dataIndex;
                        const d = data[idx];
                        const prev = idx > 0 ? data[idx - 1] : null;
                        const chg = prev ? ((d.nav - prev.nav) / prev.nav * 100) : 0;
                        return `<div style="font-weight:600;margin-bottom:4px;">${d.date}</div>
                                <div>净值: <b>${d.nav.toFixed(4)}</b></div>
                                <div>涨跌: <span style="color:${chg >= 0 ? '#ff6b6b' : '#4ecdc4'}">${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%</span></div>
                                ${d.nav === high ? '🔺 近期高点' : ''}
                                ${d.nav === low ? '🔻 近期低点' : ''}`;
                    }
                },
                grid: { left: 50, right: 20, top: 40, bottom: 30 },
                xAxis: {
                    type: 'category',
                    data: dates,
                    axisLine: { lineStyle: { color: 'rgba(0,200,255,0.15)' } },
                    axisLabel: { color: '#667799', fontSize: 10, rotate: 30, interval: Math.max(1, Math.floor(
                            data.length / 40)) },
                    splitLine: { show: false },
                },
                yAxis: {
                    type: 'value',
                    axisLine: { show: false },
                    axisLabel: { color: '#667799', fontSize: 10 },
                    splitLine: { lineStyle: { color: 'rgba(0,200,255,0.06)', type: 'dashed' } },
                },
                series: [{
                    name: '净值',
                    type: 'line',
                    data: values,
                    smooth: true,
                    symbol: 'none',
                    lineStyle: { color: '#fdb813', width: 2.5 },
                    areaStyle: {
                        color: {
                            type: 'linear',
                            x: 0,
                            y: 0,
                            x2: 0,
                            y2: 1,
                            colorStops: [
                                { offset: 0, color: 'rgba(253,184,19,0.25)' },
                                { offset: 1, color: 'rgba(253,184,19,0.02)' }
                            ]
                        }
                    },
                    markPoint: {
                        data: [
                            { type: 'max', name: '高点', symbol: 'pin', symbolSize: 50,
                                itemStyle: { color: '#ff6b6b' }, label: { formatter: '{c:.4f}', color: '#fff',
                                    fontSize: 10 } },
                            { type: 'min', name: '低点', symbol: 'pin', symbolSize: 50,
                                itemStyle: { color: '#4ecdc4' }, label: { formatter: '{c:.4f}', color: '#fff',
                                    fontSize: 10 } }
                        ],
                        label: { show: true, formatter: p => p.value ? p.value.toFixed(4) : '', fontSize: 10,
                            color: '#fff' }
                    },
                    markLine: {
                        silent: true,
                        symbol: 'none',
                        lineStyle: { color: 'rgba(255,255,255,0.08)', type: 'dashed' },
                        data: [
                            { yAxis: high, name: '高点', label: { formatter: '高 ' + high.toFixed(4),
                                    color: '#ff6b6b', fontSize: 10 } },
                            { yAxis: low, name: '低点', label: { formatter: '低 ' + low.toFixed(4),
                                    color: '#4ecdc4', fontSize: 10 } }
                        ]
                    },
                    markArea: {
                        silent: true,
                        data: [
                            [{ yAxis: low, itemStyle: { color: 'rgba(78,205,196,0.06)' } },
                            { yAxis: high, itemStyle: { color: 'rgba(78,205,196,0.02)' } }
                            ]
                        ]
                    }
                }],
                dataZoom: [{
                    type: 'inside',
                    start: Math.max(0, 100 - 100 * 60 / data.length),
                    end: 100,
                    minSpan: 10,
                }, {
                    type: 'slider',
                    show: data.length > 60,
                    height: 12,
                    bottom: 4,
                    borderColor: 'rgba(0,200,255,0.1)',
                    backgroundColor: 'rgba(0,0,0,0.2)',
                    fillerColor: 'rgba(0,200,255,0.08)',
                    handleStyle: { color: 'rgba(0,200,255,0.3)' },
                    textStyle: { color: '#667799', fontSize: 9 },
                    start: Math.max(0, 100 - 100 * 60 / data.length),
                    end: 100,
                }],
                title: {
                    text: `📈 ${state.fundName || state.code}  ·  ${period === 'ALL' ? '全部' : period}`,
                    left: 10,
                    top: 6,
                    textStyle: { color: '#8899bb', fontSize: 13, fontWeight: 500 },
                },
            };
            chart.setOption(option);
            chart.resize();
        }

        // ================================================================
        //  主流程
        // ================================================================
        async function loadFund(code, period) {
            if (state.isLoading) return;
            state.isLoading = true;
            fetchBtn.disabled = true;
            fetchBtn.textContent = '⏳ 加载中';
            chartLoading.style.display = 'flex';
            chartLoading.innerHTML = `
                    <div class="spinner"></div>
                    <span>加载数据中…</span>
                `;

            try {
                const { data, name, type } = await fetchFundData(code);
                const processed = processRawData(data);
                if (processed.length === 0) throw new Error('无有效净值数据');

                state.fundName = name || code;
                state.fundType = type || 'off-exchange';

                fundCodeDisplay.textContent = code;
                const typeLabel = type === 'on-exchange' ? '场内' : '场外';
                const typeCls = type === 'on-exchange' ? 'on-exchange' : 'off-exchange';
                fundTypeBadge.textContent = typeLabel;
                fundTypeBadge.className = `fund-type-badge ${typeCls}`;
                fundNameDisplay.innerHTML = `
                        ${state.fundName}
                        <span class="code">${code}</span>
                        <span class="fund-type-badge ${typeCls}">${typeLabel}</span>
                    `;

                state.code = code;
                state.rawData = processed;
                state.currentPeriod = period || state.currentPeriod;

                const filtered = filterByPeriod(processed, state.currentPeriod);
                state.filteredData = filtered;
                const stats = calcStats(filtered);

                renderStats(stats);
                renderTable(filtered, stats);
                renderChart(filtered, stats, state.currentPeriod);
                chartLoading.style.display = 'none';
            } catch (err) {
                console.error(err);
                chartLoading.innerHTML = `
                        <div style="color:#ff6b6b;font-size:14px;">⚠️ ${err.message}</div>
                        <div style="color:#667799;font-size:12px;margin-top:4px;">请检查基金代码或稍后重试</div>
                    `;
                Object.values(statEls).forEach(el => el.textContent = '--');
                tableBody.innerHTML =
                    `<tr><td colspan="5" style="text-align:center;color:#445566;padding:20px;">加载失败</td></tr>`;
                tableCount.textContent = '';
                if (echartsInstance) echartsInstance.clear();
                fundTypeBadge.textContent = '--';
                fundTypeBadge.className = 'fund-type-badge';
            } finally {
                state.isLoading = false;
                fetchBtn.disabled = false;
                fetchBtn.textContent = '🚀 查询';
            }
        }

        // ================================================================
        //  事件绑定
        // ================================================================
        fetchBtn.addEventListener('click', () => {
            const code = fundInput.value.trim();
            if (!code || !/^\d{6}$/.test(code)) {
                alert('请输入6位基金代码，如 008591 或 510050');
                return;
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
            loadFund(code, state.currentPeriod);
        });

        fundInput.addEventListener('keydown', e => { if (e.key === 'Enter') fetchBtn.click(); });

        document.querySelectorAll('.period-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const period = btn.dataset.period;
                state.currentPeriod = period;
                if (state.rawData.length > 0) {
                    const filtered = filterByPeriod(state.rawData, period);
                    state.filteredData = filtered;
                    const stats = calcStats(filtered);
                    renderStats(stats);
                    renderTable(filtered, stats);
                    renderChart(filtered, stats, period);
                }
            });
        });

        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => { if (echartsInstance) echartsInstance.resize(); }, 200);
        });

        // ================================================================
        //  启动 —— 默认加载近一年
        // ================================================================
        document.addEventListener('DOMContentLoaded', () => {
            loadFund('008591', '1Y');
        });

        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            if (!window._fundLoaded) {
                window._fundLoaded = true;
                loadFund('008591', '1Y');
            }
        }
    </script>
</body>
</html>