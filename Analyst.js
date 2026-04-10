// analyst.js - 整合你的三大核心邏輯

// 1. Data Cleaner 邏輯
function cleanData(rawYahooData) {
    const result = rawYahooData.chart.result[0];
    const timestamps = result.timestamp;
    const closePrices = result.indicators.quote[0].close;

    return timestamps.map((ts, index) => ({
        date: new Date(ts * 1000).toISOString().split('T')[0],
        close: closePrices[index] ? parseFloat(closePrices[index].toFixed(2)) : null
    })).filter(item => item.close !== null);
}

// 2. Long Term Analyst 邏輯
function analyzeLongTerm(data) {
    const len = data.length;
    if (len < 2) return { error: "數據不足" };
    
    const returns = [];
    for (let i = 1; i < len; i++) {
        returns.push((data[i].close - data[i-1].close) / data[i-1].close);
    }

    const avgReturn = returns.reduce((a, b) => a + b) / returns.length;
    const stdDev = Math.sqrt(returns.map(x => Math.pow(x - avgReturn, 2)).reduce((a, b) => a + b) / returns.length);
    const annualizedSharpe = (avgReturn / stdDev) * Math.sqrt(252); 

    return {
        analysis_type: "長期體質分析",
        sharpe_ratio: annualizedSharpe.toFixed(2),
        annual_return: ( (data[len-1].close - data[0].close) / data[0].close * 100 ).toFixed(2) + "%",
        quality: annualizedSharpe > 1 ? "優秀" : "一般"
    };
}

// 3. Short Term Analyst 邏輯 (PA 狀態機)
function analyzeShortTerm(rawData) {
    if (rawData.length < 20) {
        return { score: 0, light: "? 灰燈", status: "數據量不足" };
    }

    // 計算 5MA 並標記 Zone
    let processedData = rawData.map((d, index) => {
        if (index < 4) return { ...d, ma5: null };
        const last5 = rawData.slice(index - 4, index + 1);
        const ma5 = last5.reduce((sum, item) => sum + item.close, 0) / 5;
        return { ...d, ma5: ma5, zone: d.close > ma5 ? 'BULL' : 'BEAR' };
    }).filter(d => d.ma5 !== null);

    // 提取極值 Peak/Trough
    let peaks = [];
    let troughs = [];
    let currentSegment = { zone: '', values: [] };

    processedData.forEach(d => {
        if (d.zone !== currentSegment.zone) {
            if (currentSegment.values.length > 0) {
                if (currentSegment.zone === 'BULL') peaks.push(Math.max(...currentSegment.values));
                else troughs.push(Math.min(...currentSegment.values));
            }
            currentSegment = { zone: d.zone, values: [d.close] };
        } else {
            currentSegment.values.push(d.close);
        }
    });

    const n = peaks.length - 1;
    const m = troughs.length - 1;
    if (n < 1 || m < 1) return { score: 0, light: "? 灰燈", status: "結構尚未成形" };

    const isHigherLow = troughs[m] > troughs[m-1];
    const isHigherHigh = peaks[n] > peaks[n-1];
    const isLowerLow = troughs[m] < troughs[m-1];
    const isLowerHigh = peaks[n] < peaks[n-1];

    const current = processedData[processedData.length - 1];
    const lastPeak = peaks[n];
    const lastTrough = troughs[m];

    let res = { score: 0, color: "? 灰燈", status: "盤整期" };

    if (isHigherLow && isHigherHigh) {
        if (current.close > lastPeak) res = { score: 3, color: "?? 紅燈", status: "多頭趨勢 - 突破中" };
        else if (current.close >= current.ma5) res = { score: 2, color: "?? 橙燈", status: "多頭趨勢 - 強勢整理" };
        else res = { score: 1, color: "?? 黃燈", status: "多頭趨勢 - 轉弱回檔" };
    } else if (isLowerLow && isLowerHigh) {
        if (current.close < lastTrough) res = { score: -3, color: "?? 綠燈", status: "空頭趨勢 - 破底中" };
        else if (current.close <= current.ma5) res = { score: -2, color: "?? 藍燈", status: "空頭趨勢 - 弱勢反彈" };
        else res = { score: -1, color: "?? 紫燈", status: "空頭趨勢 - 強勢反彈" };
    }

    return {
        score: res.score,
        light: res.color,
        status: res.status,
        details: {
            close: current.close,
            ma5: current.ma5.toFixed(2),
            structure: `HL:${isHigherLow}/HH:${isHigherHigh}`
        }
    };
}

// 導出模組
module.exports = { cleanData, analyzeLongTerm, analyzeShortTerm };