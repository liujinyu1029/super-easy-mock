const http = require('http')
const fs = require('fs')
const path = require('path')
const utils = require('./utils/utils')
const request = require('request');

const server = () => {
	// 配置
	const configPath = path.join(__dirname, 'config.js')
	fs.chmodSync(configPath, '0755')
	let config = require('./config')

	// server服务部分
	const app = http.createServer();

	app.on('request', function (req, res) {
		// post请求
		if (req.method === 'POST') {
			//mock数据文件 预前准备
			const result = utils.parseUrl(req.url)
			const jsonFilePath = result.jsonFilePath
			const fileName = result.fileName
			const filerPath = path.join(process.cwd(), jsonFilePath, fileName + '.json')

			// 判断2个服务方向  1、本地静态文件   2、代理到真实远端
			if (config.mock && fileName && fs.existsSync(filerPath)) {
				//1情况 -- 如果有本地mock数据文件，则接口响应 该文件内容
				const file = fs.readFileSync(filerPath, 'utf8')
				const returnValue = new Function(`const a = ${file}; return a;`)()
				const json = JSON.stringify(returnValue)
				res.writeHead(200, {
					'Content-Type': 'application/json;charset=utf8'
				});
				res.write(json);
				res.end();
			} else {
				//2情况 -- 代理该请求 直接走远端服务器
				let data = '';
				req.on('data', function (chunk) {
					data += chunk;
				});
				req.on('end', function () {
					// 获取请求体
					let bodyData;
					try {
						bodyData = JSON.parse(decodeURI(data))
					} catch (e) {
						bodyData = {}
						console.error(e)
					}
					// 使用 request 抓取目标远端数据
					emitRequest({
						...req,
						body: bodyData,
						targetUrl: `${config.protocol || 'http'}://${config.domain}` + (config.port != 80 ? (':' + config.port) : '') + req.url
					}, response => {
						// 抓取完毕 给前端响应
						res.writeHead(200, {
							'Content-Type': 'application/json;charset=utf8'
						});
						res.write(JSON.stringify(response));
						res.end();
					})
				});
			}
		} else {
			res.writeHead(200, {
				'Content-Type': 'application/json;charset=utf8'
			});
			res.write('{ret:0,errMsg:"api接口数据尽量使用post方式"}');
			res.end();
		}
	});
	app.listen(3000, function () {
		console.log('Proxy server is running on port 3000');
	});
}

// 抓取远端数据
const emitRequest = ({ targetUrl, method, headers, body }, cb) => {
	var options = {
		url: targetUrl,
		method,
		json: true,
		headers: {
			// "Content-Length":0, // Content-Length最好不要写，用默认值，会自动计算长度
			'content-type': 'application/json',
			'cookie': headers.cookie || ''
		},
		body
	};
	request(options, function (error, response, body) {
		console.log('\x1B[32m%s\x1B[39m', "========================== response begin ==========================");
		console.log('[url]:', options.url)
		console.log('[status]:', response.statusCode)
		console.log('\x1B[32m%s\x1B[39m', "========================== response end ============================");

		if (!error && response && response.statusCode == 200) {
			cb(body || {
				ret: 0,
				errMsg: '获取数据为空'
			});
		} else {
			cb({
				ret: 0,
				errMsg: '获取远端接口数据失败'
			});
		}
	})
}

module.exports = server;
