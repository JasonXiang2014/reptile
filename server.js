const request = require("request")
const {
    JSDOM
} = require("jsdom")
const readline = require("readline")
const fs = require("fs")
const Events = require("events")

let myEmitter = new Events()
let imageSrcList = []

let searchStr = "";
let rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
})

rl.question("你喜欢的内容：", function (answer) {
    searchStr = answer
    rl.close()
})

rl.on("close", function () {
    let isDownloadDirExists = fs.existsSync(`${__dirname}/download`)
    if(!isDownloadDirExists)fs.mkdirSync(`${__dirname}/download`, 0777)
    request({
        method: "GET",
        url: `https://www.meitulu.com/search/${encodeURIComponent(searchStr)}`,
        headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.163 Safari/537.36"
        }
    }, function (error, response, body) {
        let dom = new JSDOM(body)
        let document = dom.window.document
        let searchResult = document.querySelectorAll("ul.img>li")
        let targetUrls = []
        searchResult.forEach(item => {
            targetUrls.push({
                url: item.querySelector("a").href,
                title: item.querySelector("p.p_title").textContent,
                num: item.querySelector("p").textContent,
            })
        })
        myEmitter.emit("getDetailMsg", targetUrls)
    });
})

myEmitter.on("getDetailMsg", function (targetUrls) {
    let proList = []
    targetUrls.forEach(item => {
        let {
            url,
            title
        } = item
        title = title.replace(/[\s\\/:\*\?\"<>\|]/g, "")
        proList.push(new Promise((resolve) => getImgSrc(url, title, resolve)).then(() => {
            let isExists = fs.existsSync(`${__dirname}/download/${title}`)
            if (!isExists) {
                fs.mkdirSync(`${__dirname}/download/${title}`, 0777)
            }
        }))
    })
    Promise.all(proList).then(() => {
        imageSrcList.forEach(item => {
            request(item.imgSrc).on("error", (err)=>{
            }).pipe(fs.createWriteStream(`${__dirname}/download/${item.title}/${item.name}`))
        })
    })

})

function getImgSrc(url, title, resolve) {
    request({
        method: 'GET',
        url,
        headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.163 Safari/537.36"
        }
    }, function (error, response, body) {
        if (error) {
            console.log(`url${url}访问出错`, error)
            resolve()
        } else {
            try {
                let dom = new JSDOM(body)
                let searchImgResult = dom.window.document.querySelectorAll(
                    "div.content>center>img")
                searchImgResult.forEach(item => {
                    imageSrcList.push({
                        imgSrc: item.src,
                        name: item.src.toString().substring(item.src.toString().lastIndexOf("/") + 1),
                        title: title,
                    })
                })
                let nextPos = dom.window.document.querySelector("#pages>span+a")
                if (nextPos.textContent === "下一页") {
                    resolve();
                    return;
                } else {
                    getImgSrc(`https://www.meitulu.com${nextPos.href}`, title, resolve)
                }
            } catch (error) {
                resolve()
            }
        }
    })
}