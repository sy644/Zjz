// ============================================================
// 全局状态管理
// ============================================================
const state = {
    code: '008591',
    fundType: 'out', // out场外 / in场内
    rawData: [],
    filteredData: [],
    currentPeriod: '1Y', // 默认近1年
    fundName: '',
    price: null, // 场内现价
    priceTime: '', // 场内行情时间
    isLoading: false,
};
const $ = id => document.getElementById(id);
const fundInput = $('fundInput');
const fetchBtn = $('fetchBtn');
const fundNameDisplay = $('fundNameDisplay');
const fundCodeDisplay = $('fundCodeDisplay');
const chartEl = $('chart');
const chartLoading = $('chartLoading');
const tableBody = $('tableBody');
const tableCount = $('tableCount');
// 统计卡片DOM
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
    // 场内专属
    price: $('statPrice'),
    priceTime: $('statPriceTime'),
    premium: $('statPremium'),
};
// 场内卡片容器
const statPriceCard = $('statPriceCard');
const statPremiumCard = $('statPremiumCard');

let echartsInstance = null;

// ============================================================
// 1. 数据获取接口：场外 + 场内双接口
// ============================================================
/**
 * 获取场外基金净值（东方财富jsonp）
 */
async function fetchOutFundData(code) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `https://fund.eastmoney.com/pingzhongdata/${code}.js?_=${Date.now()}`;
        let resolved = false;
        const cleanup = () => { if (script.parentNode) script.parentNode.removeChild(script); };
        script.onload = () => {
            if (resolved) return;
            resolved = true;
            cleanup();
            const trend = window.Data_netWorthTrend;
            const name = window.fS_name || code;
            if (!trend || !Array.isArray(trend) || trend.length === 0) {
                return reject(new Error('未查询到场外基金净值数据'));
            }
            const data = trend.map(item => ({
                NAVDATE: item.x,
                NETVALUE: item.y
            }));
            delete window.Data_netWorthTrend;
            delete window.fS_name;
            resolve({ data, name, price: null, priceTime: '' });
        };
        script.onerror = () => {
            resolved = true;
            cleanup();
            reject(new Error('场外基金接口请求失败'));
        };
        document.head.appendChild(script);
        setTimeout(() => { if (!resolved) { resolved = true; cleanup(); reject(new Error('请求超时')); } }, 15000);
    });
}

/**
 * 获取场内ETF/LOF数据（净值+实时现价）
 */
async function fetchInFundData(code) {
    // 1. 获取历史净值（同场外接口）
    const netRes = await fetchOutFundData(code);
    // 2. 拉取场内实时行情（东方财富场内接口）
    const tickerRes = await fetch(`https://hq.eastmoney.com/quote/json?code=${code}`).then(r => r.json());
    const tick = tickerRes[code];
    if (!tick) throw new Error('场内行情数据不存在，请确认场内代码');
    const price = Number(tick.price);
    const priceTime = tick.time;
    return {
        ...netRes,
        price,
        priceTime
    };
}

/**
 * 统一入口分发场内/场外
 */
async function fetchFundData(code, type) {
    if (type === 'in') {
        return fetchInFundData(code);
    } else {
        return fetchOutFundData(code);
    }
}

// ============================================================
// 2. 数据清洗、周期过滤、指标计算
// ============================================================
function processRawData(raw) {
    return raw
        .map(item => ({
            date: item.NAVDATE || '',
            nav: parseFloat(item.NETVALUE || 0),
        }))
        .filter(d => d.date && d.nav > 0)
        .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * 周期过滤：1M/3M/6M/1Y/ALL，默认1年
 */
function filterByPeriod(data, period) {
    if (period === 'ALL' || data.length === 0) return data.slice();
    const now = new Date();
    let cutoff = new Date(now);
    switch (period) {
        case '1M': cutoff.setMonth(cutoff.getMonth() - 1); break;
        case '3M': cutoff.setMonth(cutoff.getMonth() - 3); break;
        case '6M': cutoff.setMonth(cutoff.getMonth() - 6); break;
        case '1Y': cutoff.setFullYear(cutoff.getFullYear() - 1); break;
        default: return data.slice();
    }
    const cutoffStr = cutoff.toISOString().split('T')[0];
    return data.filter(d => d.date >= cutoffStr);
}

/**
 * 计算核心统计指标 + 场内溢价率
 */
function calcStats(data, marketPrice) {
    if (!data || data.length === 0) return null;
    const current = data[data.length - 1];
    let high = data[0], low = data[0];
    for (const d of data) {
        if (d.nav > high.nav) high = d;
        if (d.nav < low.nav) low = d;
    }
    const riseFromLow = low.nav > 0 ? ((current.nav - low.nav) / low.nav * 100) : 0;
    const drawdownFromHigh = high.nav > 0 ? ((current.nav - high.nav) / high.nav * 100) : 0;
    const intervalChange = data.length > 1 ? ((current.nav - data[0].nav) / data[0].nav * 100) : 0;
    // 溢价率：(场内现价 / 当日净值 - 1) * 100
    let premium = null;
    if (marketPrice && current.nav > 0) {
        premium = ((marketPrice / current.nav) - 1) * 100;
    }
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
        premium,
        firstNav: data[0].nav,
        firstDate: data[0].date,
        count: data.length,
    };
}

// ============================================================
// 3. UI渲染：统计卡片、表格、图表、场内面板切换
// ============================================================
function renderFundTypePanel() {
    // 切换显示/隐藏场内专属卡片
    if (state.fundType === 'in') {
        statPriceCard.style.display = 'block';
        statPremiumCard.style.display = 'block';
    } else {
        statPriceCard.style.display = 'none';
        statPremiumCard.style.display = 'none';
    }
}

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

    // 场内现价、溢价
    if (state.price !== null) {
        statEls.price.textContent = state.price.toFixed(2);
        statEls.priceTime.textContent = state.priceTime;
    } else {
        statEls.price.textContent = '--';
        statEls.priceTime.textContent = '--';
    }
    if (stats.premium !== null) {
        statEls.premium.textContent = fmtPct(stats.premium);
        statEls.premium.style.color = stats.premium >= 0 ? '#ff6b6b' : '#4ecdc4';
    } else {
        statEls.premium.textContent = '--';
    }

    // 涨跌颜色
    const riseEl = statEls.rise;
    const ddEl = statEls.drawdown;
    const intEl = statEls.interval;
    riseEl.style.color = stats.riseFromLow >= 0 ? '#ff6b6b' : '#4ecdc4';
    ddEl.style.color = stats.drawdownFromHigh >= 0 ? '#ff6b6b' : '#4ecdc4';
    intEl.style.color = stats.intervalChange >= 0 ? '#ff6b6b' : '#4ecdc4';
}

function renderTable(data, stats) {
    if (!data || data.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#445566;padding:20px;">暂无数据</td></tr>`;
        tableCount.textContent = '';
        return;
    }
    const high = stats ? stats.high : 0;
    const low = stats ? stats.low : 0;
    let html = '';
    const reversed = data.slice().reverse();
    for (let i = 0; i < reversed.length; i++) {
        const d = reversed[i];
        // 当日环比涨跌（和前一天净值对比）
        const originalIdx = data.findIndex(item => item.date === d.date);
        const prevDay = originalIdx > 0 ? data[originalIdx - 1] : null;
        const dailyChg = prevDay ? ((d.nav - prevDay.nav) / prevDay.nav * 100) : 0;
        const fromHigh = high > 0 ? ((d.nav - high) / high * 100) : 0;
        const fromLow = low > 0 ? ((d.nav - low) / low * 100) : 0;
        const chgCls = dailyChg >= 0 ? 'highlight-up' : 'highlight-down';
        const fhCls = fromHigh >= 0 ? 'highlight-up' : 'highlight-down';
        const flCls = fromLow >= 0 ? 'highlight-up' : 'highlight-down';
        html += `<tr>
            <td>${d.date}</td>
            <td style="text-align:right;font-weight:600;">${d.nav.toFixed(4)}</td>
            <td style="text-align:right;" class="${chgCls}">${dailyChg >= 0 ? '+' : ''}${dailyChg.toFixed(2)}%</td>
            <td style="text-align:right;" class="${fhCls}">${fromHigh >= 0 ? '+' : ''}${fromHigh.toFixed(2)}%</td>
            <td style="text-align:right;" class="${flCls}">${fromLow >= 0 ? '+' : ''}${fromLow.toFixed(2)}%</td>
        </tr>`;
    }
    tableBody.innerHTML = html;
    tableCount.textContent = `共 ${data.length} 条净值记录`;
}

// ECharts 图表渲染
function initChart() {
    if (echartsInstance) {
        echartsInstance.dispose();
        echartsInstance = null;
    }
    const loading = document.querySelector('.chart-loading');
    if (loading) loading.style.display = 'flex';
    echartsInstance = echarts.init(chartEl, 'dark');
    return echartsInstance;
}

function renderChart(data, stats, period) {
    if (!data || data.length < 2) {
        if (echartsInstance) {
            echartsInstance.clear();
            echartsInstance.setOption({
                title: { text: '数据不足，无法绘图', left: 'center', top: 'center', textStyle: { color: '#667799', fontSize: 14 } }
            });
        }
        return;
    }
    const chart = initChart();
    const dates = data.map(d => d.date);
    const values = data.map(d => d.nav);
    const high = stats ? stats.high : Math.max(...values);
    const low = stats ? stats.low : Math.min(...values);
    const fundTypeText = state.fundType === 'in' ? '场内ETF/LOF' : '场外基金';
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
                        <div>单位净值: <b>${d.nav.toFixed(4)}</b></div>
                        <div>当日涨跌: <span style="color:${chg >= 0 ? '#ff6b6b' : '#4ecdc4'}">${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%</span></div>
                        ${d.nav === high ? '🔺 区间高点' : ''}
                        ${d.nav === low ? '🔻 区间低点' : ''}`;
            }
        },
        grid: { left: 50, right: 20, top: 40, bottom: 30 },
        xAxis: {
            type: 'category',
            data: dates,
            axisLine: { lineStyle: { color: 'rgba(0,200,255,0.15)' } },
            axisLabel: { color: '#667799', fontSize: 10, rotate: 30, interval: Math.max(1, Math.floor(data.length / 40)) },
            splitLine: { show: false },
        },
        yAxis: {
            type: 'value',
            axisLine: { show: false },
            axisLabel: { color: '#667799', fontSize: 10 },
            splitLine: { lineStyle: { color: 'rgba(0,200,255,0.06)', type: 'dashed' } },
        },
        series: [{
            name: '单位净值',
            type: 'line',
            data: values,
            smooth: true,
            symbol: 'none',
            lineStyle: { color: '#fdb813', width: 2.5 },
            areaStyle: {
                color: {
                    type: 'linear',
                    x: 0, y: 0, x2: 0, y2: 1,
                    colorStops: [
                        { offset: 0, color: 'rgba(253,184,19,0.25)' },
                        { offset: 1, color: 'rgba(253,184,19,0.02)' }
                    ]
                }
            },
            markPoint: {
                data: [
                    { type: 'max', name: '高点', symbol: 'pin', symbolSize: 50, itemStyle: { color: '#ff6b6b' }, label: { formatter: '{c:.4f}', color: '#fff', fontSize: 10 } },
                    { type: 'min', name: '低点', symbol: 'pin', symbolSize: 50, itemStyle: { color: '#4ecdc4' }, label: { formatter: '{c:.4f}', color: '#fff', fontSize: 10 } }
                ]
            },
            markLine: {
                silent: true,
                symbol: 'none',
                lineStyle: { color: 'rgba(255,255,255,0.08)', type: 'dashed' },
                data: [
                    { yAxis: high, label: { formatter: '高 ' + high.toFixed(4), color: '#ff6b6b', fontSize: 10 } },
                    { yAxis: low, label: { formatter: '低 ' + low.toFixed(4), color: '#4ecdc4', fontSize: 10 } }
                ]
            }
        }],
        dataZoom: [{
            type: 'inside',
            start: Math.max(0, 100 - 100 * 80 / data.length),
            end: 100,
            minSpan: 10,
        }, {
            type: 'slider',
            show: data.length > 60,
            height: 12,
            bottom: 4,
            start: Math.max(0, 100 - 100 * 80 / data.length),
            end: 100,
        }],
        title: {
            text: `📈 ${state.fundName || state.code} | ${fundTypeText} · ${period === 'ALL' ? '全部' : period}`,
            left: 10,
            top: 6,
            textStyle: { color: '#8899bb', fontSize: 13, fontWeight: 500 },
        },
    };
    chart.setOption(option);
    chart.resize();
}

// ============================================================
// 4. 主加载流程
// ============================================================
async function loadFund(code, period, fundType) {
    if (state.isLoading) return;
    state.isLoading = true;
    fetchBtn.disabled = true;
    fetchBtn.textContent = '⏳ 加载中';
    chartLoading.style.display = 'flex';
    // 更新全局类型并切换面板
    state.fundType = fundType;
    renderFundTypePanel();
    try {
        const res = await fetchFundData(code, fundType);
        const processed = processRawData(res.data);
        if (processed.length === 0) throw new Error('无有效净值数据，请核对代码与基金类型');
        // 更新全局状态
        state.fundName = res.name || code;
        state.price = res.price || null;
        state.priceTime = res.priceTime || '';
        fundNameDisplay.innerHTML = `${state.fundName} <span class="code">${code}</span>`;
        fundCodeDisplay.textContent = code;
        state.code = code;
        state.rawData = processed;
        state.currentPeriod = period || state.currentPeriod;
        const filtered = filterByPeriod(processed, state.currentPeriod);
        state.filteredData = filtered;
        const stats = calcStats(filtered, state.price);
        renderStats(stats);
        renderTable(filtered, stats);
        renderChart(filtered, stats, state.currentPeriod);
        chartLoading.style.display = 'none';
    } catch (err) {
        console.error(err);
        chartLoading.innerHTML = `
            <div style="color:#ff6b6b;font-size:14px;">⚠️ ${err.message}</div>
            <div style="color:#667799;font-size:12px;margin-top:4px;">切换基金类型或核对6位代码重试</div>
        `;
        Object.values(statEls).forEach(el => el.textContent = '--');
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#445566;padding:20px;">加载失败</td></tr>`;
        tableCount.textContent = '';
        if (echartsInstance) echartsInstance.clear();
    } finally {
        state.isLoading = false;
        fetchBtn.disabled = false;
        fetchBtn.textContent = '🚀 查询';
    }
}

// ============================================================
// 5. 事件绑定
// ============================================================
// 查询按钮
fetchBtn.addEventListener('click', () => {
    const code = fundInput.value.trim();
    const typeRadio = document.querySelector('input[name="fundType"]:checked');
    const type = typeRadio.value;
    if (!code || !/^\d{6}$/.test(code)) {
        alert('请输入6位纯数字基金代码');
        return;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    loadFund(code, state.currentPeriod, type);
});
// 输入框回车
fundInput.addEventListener('keydown', e => { if (e.key === 'Enter') fetchBtn.click(); });
// 周期切换
document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const period = btn.dataset.period;
        state.currentPeriod = period;
        if (state.rawData.length > 0) {
            const filtered = filterByPeriod(state.rawData, period);
            state.filteredData = filtered;
            const stats = calcStats(filtered, state.price);
            renderStats(stats);
            renderTable(filtered, stats);
            renderChart(filtered, stats, period);
        }
    });
});
// 窗口自适应图表
let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (echartsInstance) echartsInstance.resize(); }, 200);
});
// 页面初始化
document.addEventListener('DOMContentLoaded', () => {
    const defaultType = document.querySelector('input[name="fundType"]:checked').value;
    loadFund('008591', '1Y', defaultType);
});
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    if (!window._fundLoaded) {
        window._fundLoaded = true;
        const defaultType = document.querySelector('input[name="fundType"]:checked').value;
        loadFund('008591', '1Y', defaultType);
    }
}
