const HttpProxyAgent = require('http-proxy-agent');
const http = require('http');
http.globalAgent = new HttpProxyAgent('http://proxy:5566');
let rp = require('request-promise');
const request = require('request');
var url = require('url');

var endpoint = 'http://nodejs.org/api/';
var parsed = url.parse(endpoint);



const proxy = process.env.PROXY_URL;
if (proxy) {
}
console.log(parsed)
rp(endpoint).then((err, text) => console.log('req'));
//request(parsed, (err, text) => console.log('DONE'));
/*
http.get({uri: endpoint}, function (res) {
  console.log('"response" event!', res.headers);
  res.pipe(process.stdout);
});
*/
