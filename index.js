'use strict';

const launchChrome = require('@serverless-chrome/lambda');
const CDP = require('chrome-remote-interface');
const puppeteer = require('puppeteer');

// 取得URL
const testUrl = 'https://developers.google.com/speed/pagespeed/insights/?hl=ja&url=' + encodeURIComponent(process.env.TEST_URL) + '&tab=mobile';

// Slack通知
const webhookUrl = process.env.WEBHOOK_URL;

const postToSlack = (message) => {

  const https = require('https');
  let posturl = require('url');

  let postData = JSON.stringify({
    username: "Pagespeed Insights bot",
    icon_emoji: ":racing_car:",
    text: message
  });

  let options = posturl.parse(webhookUrl);
  options.method = 'POST';
  options.headers = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  };

  let req = https.request(options, (res) =>{
    if(res.statusCode===200){
      console.log("OK:"+res.statusCode);
    }else{
      console.log("Status Error:"+res.statusCode);
    }
  });

  // データ送信
  req.write(postData);
  req.end();
}

// Googleスプレッドシートに追記
const {google} = require('googleapis')
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

async function appendData(message1,message2) {
  const auth = await google.auth.getClient({
    // Scopes can be specified either as an array or as a single, space-delimited string.
    scopes: SCOPES
  })
 
  const sheets = google.sheets({version: 'v4', auth: auth})
  const res = await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: "A1:B1",
    valueInputOption: "USER_ENTERED",
    resource: {
      values: [
        [
          new Date().toISOString().replace(/T/, ' ').replace(/\..+/, ''),
          message1,
          message2
        ]
      ]
    }
  }).catch((err) => {
    console.log('The API returned an error: ' + err)
    throw err
  })
 
  console.log("Successed")
  console.log("Status: " + res.status)
}

exports.handler = async (event, context, callback) => {
  try {
    console.log('start crawl: ' + testUrl);

    // chrome起動
    const slsChrome = await launchChrome();
    const browser = await puppeteer.connect({
      browserWSEndpoint: (await CDP.Version()).webSocketDebuggerUrl
    });
    const context = browser.defaultBrowserContext();
    const page = await context.newPage();
    await page.goto(testUrl, {waitUntil:'networkidle2', timeout:60000});
    await page.waitForNavigation({waitUntil:'domcontentloaded', timeout:60000})
      .catch(e => console.log('timeout exceed. proceed to next operation'));

    console.log('getting url');

    // 指定した要素の一覧を取得
    const scrapingData = await page.evaluate(() => {
      const dataList = [];
      const nodeList =  document.querySelectorAll("div.lh-gauge__percentage");
  
      nodeList.forEach(_node => {
        dataList.push(_node.innerText);
      });
  
      return dataList;
    });

    // 結果出力
    console.log('end crawl');
    console.log(scrapingData);

    appendData(scrapingData[0],scrapingData[1]);

    const slackMessage = '*本日のPagespeed Insightsスコア*\n' +
      '測定対象URL: `' + process.env.TEST_URL + '` \n' +
      '> モバイル *' + scrapingData[0] + '*\n' +
      '> パソコン *' + scrapingData[1] + '*';
    postToSlack(slackMessage);

    await browser.close();
    return callback(null, JSON.stringify({ result: 'OK' }));
  } catch (err) {
    console.log(err);
    return callback(null, JSON.stringify({ result: 'NG' }));
  }
}
