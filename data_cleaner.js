const result = items[0].json.chart.result[0];
const timestamps = result.timestamp;
const closePrices = result.indicators.quote[0].close;

return timestamps.map((ts, index) => ({
  json: {
    date: new Date(ts * 1000).toISOString().split('T')[0],
    close: closePrices[index] ? parseFloat(closePrices[index].toFixed(2)) : null
  }
})).filter(item => item.json.close !== null);