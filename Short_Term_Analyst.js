// 1. 取得所有輸入資料 (處理 n8n 多 items 情況)
const inputItems = items; 

// 2. 數據清洗：提取收盤價並確保數值化 (相容 Close 或 close)
const rawData = inputItems.map(item => ({
    close: parseFloat(item.json.close || item.json.Close || 0)
})).filter(d => d.close > 0);

// 3. 安全檢查：如果數據太少則跳出
if (rawData.length < 20) {
    return { json: { score: 0, light: "? 灰燈", status: "數據量不足(需至少20筆)" } };
}

// 4. 計算 5MA 並定義多空區間 (Zone)
let processedData = rawData.map((d, index) => {
    if (index < 4) return { ...d, ma5: null };
    const last5 = rawData.slice(index - 4, index + 1);
    const ma5 = last5.reduce((sum, item) => sum + item.close, 0) / 5;
    return { 
        ...d, 
        ma5: ma5,
        zone: d.close > ma5 ? 'BULL' : 'BEAR'
    };
}).filter(d => d.ma5 !== null);

// 5. 提取波段極值 (Peak & Trough)
let peaks = [];
let troughs = [];
let currentSegment = { zone: '', values: [] };

processedData.forEach(d => {
    if (d.zone !== currentSegment.zone) {
        if (currentSegment.values.length > 0) {
            if (currentSegment.zone === 'BULL') {
                peaks.push(Math.max(...currentSegment.values));
            } else {
                troughs.push(Math.min(...currentSegment.values));
            }
        }
        currentSegment = { zone: d.zone, values: [d.close] };
    } else {
        currentSegment.values.push(d.close);
    }
});

// 6. 趨勢結構判定 (比對最後兩組極值)
const n = peaks.length - 1;
const m = troughs.length - 1;

// 判斷是否具備足夠結構進行趨勢分析
if (n < 1 || m < 1) {
    return { json: { score: 0, light: "? 灰燈", status: "結構尚未成形" } };
}

const isHigherLow = troughs[m] > troughs[m-1];
const isHigherHigh = peaks[n] > peaks[n-1];
const isLowerLow = troughs[m] < troughs[m-1];
const isLowerHigh = peaks[n] < peaks[n-1];

const currentClose = processedData[processedData.length - 1].close;
const currentMA5 = processedData[processedData.length - 1].ma5;
const lastPeak = peaks[n];
const lastTrough = troughs[m];

let result = { score: 0, color: "? 灰燈", status: "盤整期" };

// 7. 燈號評分邏輯 (完全遵照 MD 規格書)
if (isHigherLow && isHigherHigh) { // 多頭趨勢
    if (currentClose > lastPeak) {
        result = { score: 3, color: "?? 紅燈", status: "多頭趨勢 - 突破中" };
    } else if (currentClose >= currentMA5) {
        result = { score: 2, color: "?? 橙燈", status: "多頭趨勢 - 強勢整理" };
    } else {
        result = { score: 1, color: "?? 黃燈", status: "多頭趨勢 - 轉弱回檔" };
    }
} else if (isLowerLow && isLowerHigh) { // 空頭趨勢
    if (currentClose < lastTrough) {
        result = { score: -3, color: "?? 綠燈", status: "空頭趨勢 - 破底中" };
    } else if (currentClose <= currentMA5) {
        result = { score: -2, color: "?? 藍燈", status: "空頭趨勢 - 弱勢反彈" };
    } else {
        result = { score: -1, color: "?? 紫燈", status: "空頭趨勢 - 強勢反彈" };
    }
}

// 8. 最終輸出
return {
    json: {
        score: result.score,
        light: result.color,
        status: result.status,
        details: {
            close: currentClose,
            ma5: currentMA5.toFixed(2),
            peak_n: lastPeak,
            trough_n: lastTrough,
            structure: `HL:${isHigherLow}/HH:${isHigherHigh}`
        }
    }
};