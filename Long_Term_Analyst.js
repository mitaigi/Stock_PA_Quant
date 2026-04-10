const data = items.map(i => i.json);
const len = data.length; // 補上這行定義，告訴電腦 len 是什麼
const returns = [];

// 1. 計算每日報酬率
for (let i = 1; i < len; i++) {
  returns.push((data[i].close - data[i-1].close) / data[i-1].close);
}

// 2. 計算平均回報與標準差 (年化夏普值)
const avgReturn = returns.reduce((a, b) => a + b) / returns.length;
const stdDev = Math.sqrt(returns.map(x => Math.pow(x - avgReturn, 2)).reduce((a, b) => a + b) / returns.length);
const annualizedSharpe = (avgReturn / stdDev) * Math.sqrt(252); 

return [{
  json: {
    analysis_type: "長期體質分析",
    sharpe_ratio: annualizedSharpe.toFixed(2),
    // 這裡現在可以正確讀取 len 了
    annual_return: ( (data[len-1].close - data[0].close) / data[0].close * 100 ).toFixed(2) + "%",
    quality: annualizedSharpe > 1 ? "優秀" : "一般"
  }
}];