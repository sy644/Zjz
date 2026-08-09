// ============================================================
// 核心数据管理
// ============================================================
const state = {
    code: '008591',
    rawData: [],        // { date, nav }
    filteredData: [],   // 按周期过滤后的数据
    currentPeriod: '6M',
    fundName: '',
    isLoading: false,
};

// DOM 引用
const $ = (id) => document.getElementById(id);
const fundInput = $('fundInput');
const fetchBtn = $('fetchBtn');
const fundNameDisplay = $('fundNameDisplay');
const fundCodeDisplay = $('fundCodeDisplay');
const chartEl = $('chart');
const chartLoading = $('chartLoading');
const tableBody = $('tableBody');
const tableCount = $('tableCount');

// 统计卡片元素
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

// ============================================================
// 数据获取
// ============================================================
async function fetchNavHistory(code) {
    const url =
        `https://fund.eastmoney.com/f10/FundNetValue.ashx?type=all&code=${code}&_=${Date.now()}`;
    const resp = await fetch(url);
    const text = await resp.text();

    // 解析 var Data = {...};
    const match = text.match(/var\s+Data\s*=\s*({[\s\S]*?});/);
    if (!match) {
        throw new Error('无法解析净值数据，请检查基金代码');
    }
    const json = JSON.parse(match[1]);
    if (!json.Data || !Array.isArray(json.Data) || json.Data.length === 0) {
        throw new Error('该基金暂无净值数据');
    }
    return json.Data;
}

async function fetchFundName(code) {
    try {
        const url =
            `https://fund.eastmoney.com/pingzhongdata/${code}.js?_=${Date.now()}`;
        const resp = await fetch(url);
        const text = await resp.text();
        // 匹配 fS_name: "xxx"
        const match = text.match(/fS_name\s*:\s*"([^"]+)"/);
        if (match) return match[1];
    } catch (_) { /* ignore */ }
    return null;
}

// ============================================================
// 数据处理
// ============================================================
function processRawData(raw) {
    const list = raw
        .map(item => ({
            date: item.NAVDATE || '',
            nav: parseFloat(item.NETVALUE || 0),
        }))
        .filter(d => d.date && d.nav > 0)
        .sort((a, b) => a.date.localeCompare(b.date)); // 从旧到新
    return list;
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
    const currentNav = current.nav;
    const currentDate = current.date;

    let high = data[0],
        low = data[0];
    for (const d of data) {
        if (d.nav > high.nav) high = d;
        if (d.nav < low.nav) low = d;
    }

    const riseFromLow = low.nav > 0 ? ((currentNav - low.nav) / low.nav * 100) : 0;
    const drawdownFromHigh = high.nav > 0 ? ((currentNav - high.nav) / high.nav * 100) : 0;
    const intervalChange = data.length > 1 ? ((currentNav - data[0].nav) / data[0].nav * 100) : 0;

    return {
        current: currentNav,
        currentDate,
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

// ============================================================
// 渲染 UI
// ============================================================
function renderStats(stats) {
    if (!stats) {
        Object.values(statEls).forEach(el => el.textContent = '--');
        return;
    }
    const fmt = (v) => v.toFixed(4);
    const fmtPct = (v) => (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
    const fmtDate = (d) => d || '--';

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
    statEls.intervalDate.textContent =
        `${fmtDate(stats.firstDate)} → ${fmtDate(stats.currentDate)}`;

    // 颜色
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
    // 从新到旧显示
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

// ============================================================
// ECharts 图表
// ============================================================
function initChart() {
    if (echartsInstance) {
        echartsInstance.dispose();
        echartsInstance = null;
    }
    // 移除 loading 占位
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
                return `
                            <div style="font-weight:600;margin-bottom:4px;">${d.date}</div>
                            <div>净值: <b>${d.nav.toFixed(4)}</b></div>
                            <div>涨跌: <span style="color:${chg >= 0 ? '#ff6b6b' : '#4ecdc4'}">${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%</span></div>
                            ${d.nav === high ? '🔺 近期高点' : ''}
                            ${d.nav === low ? '🔻 近期低点' : ''}
                        `;
            }
        },
        grid: {
            left: 50,
            right: 20,
            top: 40,
            bottom: 30,
        },
        xAxis: {
            type: 'category',
            data: dates,
            axisLine: { lineStyle: { color: 'rgba(0,200,255,0.15)' } },
            axisLabel: { color: '#667799', fontSize: 10, rotate: 30, interval: Math.max(1, Math.floor(data
                    .length / 40)) },
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
            lineStyle: {
                color: '#fdb813',
                width: 2.5,
            },
            areaStyle: {
                color: {
                    type: 'linear',
                    x: 0,
                    y: 0,
                    x2: 0,
                    y2: 1,
                    colorStops: [
                        { offset: 0, color: 'rgba(253,184,19,0.25)' },
                        { offset: 1, color: 'rgba(253,184,19,0.02)' },
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
                            fontSize: 10 } },
                ],
                label: {
                    show: true,
                    formatter: function(p) {
                        return p.value ? p.value.toFixed(4) : '';
                    },
                    fontSize: 10,
                    color: '#fff',
                }
            },
            markLine: {
                silent: true,
                symbol: 'none',
                lineStyle: { color: 'rgba(255,255,255,0.08)', type: 'dashed' },
                data: [
                    { yAxis: high, name: '高点', label: { formatter: '高 ' + high.toFixed(4),
                            color: '#ff6b6b', fontSize: 10 } },
                    { yAxis: low, name: '低点', label: { formatter: '低 ' + low.toFixed(4),
                            color: '#4ecdc4', fontSize: 10 } },
                ]
            },
            markArea: {
                silent: true,
                data: [
                    [{
                        yAxis: low,
                        itemStyle: { color: 'rgba(78,205,196,0.06)' },
                    }, {
                        yAxis: high,
                        itemStyle: { color: 'rgba(78,205,196,0.02)' },
                    }]
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

// ============================================================
// 主流程
// ============================================================
async function loadFund(code, period) {
    if (state.isLoading) return;
    state.isLoading = true;
    fetchBtn.disabled = true;
    fetchBtn.textContent = '⏳ 加载中';

    chartLoading.style.display = 'flex';

    try {
        const raw = await fetchNavHistory(code);
        const processed = processRawData(raw);
        if (processed.length === 0) throw new Error('无有效净值数据');

        let name = await fetchFundName(code);
        if (!name) name = code;
        state.fundName = name;
        fundNameDisplay.innerHTML =
            `${name} <span class="code">${code}</span>`;
        fundCodeDisplay.textContent = code;

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
        if (echartsInstance) {
            echartsInstance.clear();
        }
    } finally {
        state.isLoading = false;
        fetchBtn.disabled = false;
        fetchBtn.textContent = '🚀 查询';
    }
}

// ============================================================
// 事件绑定
// ============================================================
fetchBtn.addEventListener('click', () => {
    const code = fundInput.value.trim();
    if (!code || !/^\d{6}$/.test(code)) {
        alert('请输入6位基金代码，如 008591');
        return;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    loadFund(code, state.currentPeriod);
});

fundInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') fetchBtn.click();
});

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
    resizeTimer = setTimeout(() => {
        if (echartsInstance) echartsInstance.resize();
    }, 200);
});

// ============================================================
// 启动
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    loadFund('008591', '6M');
});

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    if (!window._fundLoaded) {
        window._fundLoaded = true;
        loadFund('008591', '6M');
    }
}