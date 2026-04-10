const express = require('express');
const axios = require('axios');
const analyst = require('./analyst'); // 引用分析邏輯檔

const app = express();
app.use(express.json());

// --- 配置區 (從 Railway 環境變數讀取) ---
const LINE_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

// 1. 下載 Yahoo Finance 資料的函數
async function getStockData(symbol) {
    // 抓取約一年交易日的資料
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1y`;
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        return response.data;
    } catch (error) {
        console.error(`[錯誤] Yahoo API 抓取失敗 (${symbol}):`, error.message);
        return null;
    }
}

// 2. 主 Webhook 入口
app.post('/webhook', async (req, res) => {
    const events = req.body.events;

    // 如果沒有事件則直接結束
    if (!events || events.length === 0) {
        return res.status(200).send('OK');
    }

    for (let event of events) {
        if (event.type === 'message' && event.message.type === 'text') {
            const stockSymbol = event.message.text.trim().toUpperCase();
            const replyToken = event.replyToken;

            console.log(`---> 收到 LINE 訊息: ${stockSymbol}`);

            // Step A: 下載資料
            const rawData = await getStockData(stockSymbol);
            if (!rawData || !rawData.chart || !rawData.chart.result) {
                console.log(`[提示] 找不到代號或資料格式錯誤: ${stockSymbol}`);
                await sendLineReply(replyToken, `❌ 找不到代號 "${stockSymbol}"，請確認格式 (例如: 2330.TW 或 AAPL)`);
                continue;
            }

            try {
                // Step B: 清洗資料
                const cleanData = analyst.cleanData(rawData);

                // Step C: 執行分析
                const longTerm = analyst.analyzeLongTerm(cleanData);
                const shortTerm = analyst.analyzeShortTerm(cleanData);

                // Step D: 合併訊息
                const message = `📊 米奇林分析報告：${stockSymbol}\n` +
                              `------------------\n` +
                              `📈 長期：夏普率 ${longTerm.sharpe_ratio} (${longTerm.quality})\n` +
                              `🔍 短期：${shortTerm.light} ${shortTerm.status}\n` +
                              `💰 現價：${shortTerm.details.close}\n` +
                              `📉 支撐：${shortTerm.details.trough_n || '計算中'}\n` +
                              `------------------\n` +
                              `🏗️ 結構：${shortTerm.details.structure}`;

                // Step E: 回傳 LINE
                await sendLineReply(replyToken, message);
                console.log(`[成功] 已回傳 ${stockSymbol} 的分析報告`);

            } catch (err) {
                console.error(`[分析錯誤] 處理 ${stockSymbol} 時出錯:`, err.message);
                await sendLineReply(replyToken, `⚠️ 處理 "${stockSymbol}" 時發生邏輯錯誤。`);
            }
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
        console.error("[LINE 回傳失敗]:", error.response ? error.response.data : error.message);
    }
}

// 啟動伺服器
const PORT = process.env.PORT || 8080; 
app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 米奇林系統已啟動，監聽 Port: ${PORT}`);
});