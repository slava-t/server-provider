import ServerProvider from '../../src';

/*
 usage example:
 babel-node list.js 98fc3ff8e5164876ef8bfc47f27bc16cc4a445e71bdf3c724ac4c992e3071c8d cfa36a570079-55b98c5c-f54d-4ab8-8cde-9e584f866a8e
 */

const apiKey = process.argv[2];
const batchId = process.argv[3];

const provider = new ServerProvider('do_vps', {
  apiKey
});

provider.list(batchId).then(function(result) {
  console.log('result:', result);
}).catch(function(err) {
  console.error(err);
});
