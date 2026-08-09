// ============================================================
// 基金净值追踪 v2 - 带错误诊断
// ============================================================
const state = {
    code: '008591',
    rawData: [],
    filteredData: [],
    currentPeriod: '6M',
    fundName: '',
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
const errorMsg = $('errorMsg');

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
// 接口1: pingzhongdata (最常用)
// ============================================================
function fetchViaPingzhong(code) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        const callbackName = `_ping_${Date.now()}`;
        script.src = `https://fund.eastmoney.com/pingzhongdata/${code}.js?_=${Date.now()}`;
        script.onload = () => {
            const trend = window.Data_netWorthTrend;
            const name = window.fS_name || code;
            if (trend && Array.isArray(trend) && trend.length > 0) {
                const data = trend.map(item => ({ NAVDATE: item.x, NETVALUE: item.y }));
                resolve({ data, name });
            } else {
                reject(new Error('pingzhongdata 返回空数据'));
            }
            // 清理全局变量
            delete window.Data_netWorthTrend;
            delete window.fS_name;
        };
        script.onerror = () => reject(new Error('pingzhongdata 脚本加载失败'));
        document.head.appendChild(script);
        setTimeout(() => reject(new Error('pingzhongdata 超时')), 15000);
    });
}

// ============================================================
// 接口2: FundNetValue.ashx (JSONP, 备用)
// ============================================================
function fetchViaNetValue(code) {
    return new Promise((resolve, reject) => {
        const callback = `jsonp_${Date.now()}`;
        const url = `https://fund.eastmoney.com/f10/FundNetValue.ashx?type=all&code=${code}&callback=${callback}`;
        window[callback] = function(data) {
            delete window[callback];
            if (data && data.Data && Array.isArray(data.Data) && data.Data.length > 0) {
                resolve({ data: data.Data, name: null });
            } else {
                reject(new Error('FundNetValue 返回空数据'));
            }
        };
        const script = document.createElement('script');
        script.src = url;
        script.onerror = () => {
            delete window[callback];
            reject(new Error('FundNetValue 脚本加载失败'));
        };
        document.head.appendChild(script);
        setTimeout(() => {
            if (window[callback]) {
                delete window[callback];
                reject(new Error('FundNetValue 超时'));
            }
        }, 15000);
    });
}

// ============================================================
// 主获取函数：依次尝试两个接口
// ============================================================
async function fetchFundData(code) {
    const errors = [];
    // 先尝试 pingzhongdata
    try {
        return await fetchViaPingzhong(code);
    } catch (e) {
        errors.push('pingzhong: ' + e.message);
        console.warn('pingzhongdata 失败，尝试备用接口...');
        // 再尝试 FundNetValue
        try {
            const result = await fetchViaNetValue(code);
            // 若成功，尝试获取基金名称（从另一个接口补）
            let name = null;
            try {
                // 可以用 pingzhongdata 再单独取名称（仅取名称）
                const nameScript = document.createElement('script');
                nameScript.src = `https://fund.eastmoney.com/pingzhongdata/${code}.js?_=${Date.now()}`;
                await new Promise((resolve, reject) => {
                    nameScript.onload = () => {
                        const n = window.fS_name || code;
                        name = n;
                        delete window.fS_name;
                        resolve();
                    };
                    nameScript.onerror = () => resolve(); // 忽略，用 code 代替
                    document.head.appendChild(nameScript);
                    setTimeout(resolve, 3000);
                });
            } catch (_) {}
            result.name = name || code;
            return result;
        } catch (e2) {
            errors.push('FundNetValue: ' + e2.message);
            throw new Error('所有接口均失败：' + errors.join('; '));
        }
    }
}

// ============================================================
// 数据处理（与之前相同，略）
// ============================================================
// ... 请保留之前的 processRawData, filterByPeriod, calcStats, renderStats, renderTable, initChart, renderChart 等函数（完全一致）

// ============================================================
// 主流程（增强错误显示）
// ============================================================
async function loadFund(code, period) {
    if (state.isLoading) return;
    state.isLoading = true;
    fetchBtn.disabled = true;
    fetchBtn.textContent = '⏳ 加载中';
    chartLoading.style.display = 'flex';
    errorMsg.style.display = 'none';
    errorMsg.textContent = '';

    try {
        const { data, name } = await fetchFundData(code);
        const processed = processRawData(data);
        if (processed.length === 0) throw new Error('无有效净值数据');

        state.fundName = name || code;
        fundNameDisplay.innerHTML = `${state.fundName} <span class="code">${code}</span>`;
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
        console.error('加载错误:', err);
        // 显示错误信息
        errorMsg.style.display = 'block';
        errorMsg.innerHTML = `⚠️ 数据加载失败: ${err.message}<br><small style="color:#555;">请检查基金代码是否正确，或尝试使用本地服务器运行（见页面提示）</small>`;
        chartLoading.innerHTML = `
            <div style="color:#ff6b6b;font-size:14px;">⚠️ ${err.message}</div>
            <div style="color:#667799;font-size:12px;margin-top:4px;">请检查基金代码或网络，或尝试使用本地 HTTP 服务器</div>
        `;
        Object.values(statEls).forEach(el => el.textContent = '--');
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#445566;padding:20px;">加载失败，请查看上方错误信息</td></tr>`;
        tableCount.textContent = '';
        if (echartsInstance) echartsInstance.clear();
    } finally {
        state.isLoading = false;
        fetchBtn.disabled = false;
        fetchBtn.textContent = '🚀 查询';
    }
}

// ============================================================
// 事件绑定（和之前一样）
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