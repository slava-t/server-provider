const ServerProvider = require('../../src');

/*
 usage example:
 babel-node releaseByIp.js 98fc3ff8e5164876ef8bfc47f27bc16cc4a445e71bdf3c724ac4c992e3071c8d cfa36a57007955b98c5cf54d4ab88cde
 */

const apiKey = process.argv[2];
const ip = process.argv[3];

const provider = new ServerProvider('linode_vps', {
  auth: apiKey
});

provider.releaseByIp(ip).then(function(result) {
  console.log('result:', result);
}).catch(function(err) {
  console.error(err);
});
