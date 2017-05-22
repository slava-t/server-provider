import ServerProvider from '../../src';
/*
  usage example:
    babel-node acquire.js 98fc3ff8e5164876ef8bfc47f27bc16cc4a445e71bdf3c724ac4c992e3071c8d 3 'd4:e8:90:9c:a7:19:7f:3c:e3:4d:a8:db:88:b3:04:db'
*/

const apiKey = process.argv[2];

let count = parseInt(process.argv[3]);
if(!Number.isInteger(count)) {
  count = 1;
}

let sshKey = process.argv[4];


const provider = new ServerProvider('do_vps', {
  name: 'test-server',
  apiKey,
  instanceOptions: {
    size: '512mb',
    ssh_keys: [sshKey]
  }
});

provider.acquire(count).then(function(result) {
  console.log('result:', result);
}).catch(function(err) {
  console.error(err);
});
