const Apify = require('apify');
const fs = require('fs');

const urls = [
  'https://www.jd.com/?ds_rl=1272299&cu=true&utm_source=google-search&utm_medium=cpc&utm_campaign=t_262767352_googlesearch&utm_term=kwd-362776698237_0_bd6290d047e84576a5d6947ff0f8ecf1',
  'https://ai.taobao.com/',
  'https://www.tmall.com/',
  'https://www.zhihu.com/',
];

function startCrawel(urls, cb) {
  Apify.main(async () => {
    // 启动一个浏览器
    const browser = await Apify.launchPuppeteer({headless: true});
    // 异步队列
    const queue = []
    // 最大并发数
    const max_parallel = 2
    // 开始指针
    let start = 0

    for(let i = 0; i < urls.length; i++) {
      // 添加异步队列
      queue.push(fetchPage(browser, i, urls[i]))
      if(i && 
          (i+1) % max_parallel === 0 
            || i === (urls.length - 1)) {
        // 每隔2条执行一次, 实现异步分流执行, 控制并发数
        await Promise.all(queue.slice(start, i+1))
        start = i
      }
    }

    cb && cb(1)
    await browser.close();

    async function fetchPage(browser, index, url) {
      // 在浏览器中打开新标签
      const page = await browser.newPage();

      // 设置页面分辨率
      await page.setViewport({width: 1920, height: 1080});

      // 导航到url
      await page.goto(url, {waitUntil: 'domcontentloaded'});
      // 等待页面加载
      await page.waitFor(1000);

      // let title = await page.title();

      // 滚动高度
      let scrollStep = 1080;
      // 最大滚动高度
      let max_height = 30000;
      let m = {prevScroll: -1, curScroll: 0}

      while (m.prevScroll !== m.curScroll && m.curScroll < max_height) {
        m = await page.evaluate((scrollStep) => {
          if (document.scrollingElement) {
            let prevScroll = document.scrollingElement.scrollTop;
            document.scrollingElement.scrollTop = prevScroll + scrollStep; 
            let curScroll = document.scrollingElement.scrollTop
            return {prevScroll, curScroll}
          }
        }, scrollStep);

        await sleep(3600);
      }

      
      const txt = await page.$eval('body', e => {
        // 提取文本
        function getNodeTextInfo(node) {
          var list = [];
          traverseNodes(node)
          return list 

          function traverseNodes(node){	
            //判断是否是元素节点
            if(node.nodeType === 1){
              let nodeCss = window.getComputedStyle(node, null)
              if(nodeCss.display !== 'none' && nodeCss.visibility !== 'hidden') {
                //判断该元素节点是否有子节点
                if(node.hasChildNodes){
                  //得到所有的子节点
                  var sonnodes = node.childNodes;
                  //遍历所哟的子节点
                  for (var i = 0; i < sonnodes.length; i++) {
                    //得到具体的某个子节点
                    var sonnode = sonnodes.item(i);
                    //递归遍历
                    traverseNodes(sonnode);
                  }
                }
              }
            }else if(node.nodeType === 3 && node.parentNode.nodeName.toLowerCase() !== 'script'){
              let str = node.nodeValue.replace(/\s*/g,"");
              if(str){
                // 捕获文本节点
                let css = window.getComputedStyle(node.parentNode, null)
                if(css.display !== 'none' || css.visibility !== 'hidden') {
                  let pos = getPos(node.parentNode)
                  list.push({
                    x: pos.x,
                    y: pos.y,
                    text: node.nodeValue,
                    width: node.parentNode.offsetWidth,
                    height: node.parentNode.offsetHeight,
                    fontSize: css.fontSize,
                    xpath: getPathTo(node.parentNode),
                    color: css.color,
                    fontWeight: css.fontWeight
                  })
                }
              } 
            }
          }

          function getPos(el) {
            return {
              x: el.getBoundingClientRect().left + document.documentElement.scrollLeft,
              y: el.getBoundingClientRect().top + document.documentElement.scrollTop
            }
          }
        }
        // 获取xpath路径
        function getPathTo(element) {
          if (element.id!=='')
              return 'id("'+element.id+'")';
          if (element===document.body)
              return element.tagName;

          var ix= 0;
          var siblings= element.parentNode.childNodes;
          for (var i= 0; i<siblings.length; i++) {
              var sibling= siblings[i];
              if (sibling===element)
                  return getPathTo(element.parentNode)+'/'+element.tagName+'['+(ix+1)+']';
              if (sibling.nodeType===1 && sibling.tagName===element.tagName)
                  ix++;
          }
        }
        return getNodeTextInfo(e)
      });

      let uid = uuid(6, 10);
      await fs.writeFileSync(`./db/${uid}.json`, JSON.stringify(txt))

      const screenshot = await page.screenshot({path: `static/${uid}.jpg`, fullPage: true, quality: 70});
    }
    
    // Save the screenshot to the default key-value store
    // await Apify.setValue('a', screenshot, { contentType: 'image/png' });
    // Close Puppeteer
    
  });
}

process.on('message', (msg) => {
  console.log('child', msg)
  startCrawel(msg ? msg.split(',') : urls, (flag) => {
    process.send(flag);
  })
});


//延时函数
function sleep(delay) {
  return new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve(1)
      }, delay)
  })
}

// 生成uuid
function uuid(len, radix) {  
  let chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');  
  let uuid = [], i;  
  radix = radix || chars.length;  
 
  if (len) {
    for (i = 0; i < len; i++) uuid[i] = chars[0 | Math.random()*radix];  
  } else {  
    let r;   
    uuid[8] = uuid[13] = uuid[18] = uuid[23] = '-';  
    uuid[14] = '4';  

    for (i = 0; i < 36; i++) {  
      if (!uuid[i]) {  
        r = 0 | Math.random()*16;  
        uuid[i] = chars[(i === 19) ? (r & 0x3) | 0x8 : r];  
      }  
    }  
  }  
 
  return uuid.join('');  
}