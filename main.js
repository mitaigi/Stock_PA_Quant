const express = require('express');
const axios = require('axios');
const analyst = require('./analyst'); // 引用我們剛才寫的邏輯檔

const app = express();
app.use(express.json());

// --- 配置區 (之後要在 Railway 設定環境變數) ---
const LINE_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

// 1. 下載 Yahoo Finance 資料的函數 (取代 Download StockData 節點)
async function getStockData(symbol) {
    // 這裡我們抓取 251 筆資料 (約一年交易日)
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1y`;
    try {
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        console.error("Yahoo API 抓取失敗:", error.message);
        return null;
    }
}

// 2. 主 Webhook 入口
app.post('/webhook', async (req, res) => {
    const events = req.body.events;

    for (let event of events) {
        if (event.type === 'message' && event.message.type === 'text') {
            const stockSymbol = event.message.text.trim().toUpperCase(); // 使用者輸入的代號 (例如: 2330.TW)
            const replyToken = event.replyToken;

            // Step A: 下載資料
            const rawData = await getStockData(stockSymbol);
            if (!rawData) {
                await sendLineReply(replyToken, `? 找不到代號 "${stockSymbol}"，請確認格式 (例如: 2330.TW)`);
                continue;
            }

            // Step B: 清洗資料 (Data Cleaner)
            const cleanData = analyst.cleanData(rawData);

            // Step C: 執行分析 (Long-term & Short-term)
            const longTerm = analyst.analyzeLongTerm(cleanData);
            const shortTerm = analyst.analyzeShortTerm(cleanData);

            // Step D: 合併訊息 (取代 Merge 節點)
            const message = `?? 米奇林分析報告：${stockSymbol}\n` +
                          `------------------\n` +
                          `?? 長期：夏普率 ${longTerm.sharpe_ratio} (${longTerm.quality})\n` +
                          `?? 短期：${shortTerm.light} ${shortTerm.status}\n` +
                          `?? 現價：${shortTerm.details.close}\n` +
                          `?? 支撐：${shortTerm.details.trough_n || '計算中'}\n` +
                          `------------------\n` +
                          `結構：${shortTerm.details.structure}`;

            // Step E: 回傳 LINE
            await sendLineReply(replyToken, message);
        }
    }
    res.status(200).send('OK');
});

// LINE 回傳訊息函數
async function sendLineReply(replyToken, text) {
    try {
        await axios.post('https://api.line.me/v2/bot/message/reply', {
            replyToken: replyToken,
            messages: [{ type: 'text', text: text }]
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`
            }
        });
    } catch (error) {
        console.error("LINE 回傳失敗:", error.response.data);
    }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`?? 米奇林系統已啟動，監聽 Port: ${PORT}`));