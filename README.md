# Server-provider

Server-provider is a promise based library for batch creation of VPS instances on different 
cloud providers. In this version only Digital Ocean provider is implemented.

## Installation

```bash
npm install --save server-provider
```

## Examples

##### Creating one or more instances on DigitalOcean


```js
import ServerProvider from 'server-provider';
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
```
Output
```
result: { batchId: 'cfa36a570079-55b98c5c-f54d-4ab8-8cde-9e584f866a8e',
  servers: 
   [ { id: 49587785, ip: '159.203.27.96' },
     { id: 49587786, ip: '138.197.175.170' },
     { id: 49587787, ip: '138.197.175.171' } ],
  rawInfo: 
   { droplets: [ [Object], [Object], [Object] ],
     links: {},
     meta: { total: 3 } } }
```

##### Listing all instances of a batch
```js
import ServerProvider from 'server-provider';

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
```

Output
```
result: [ { id: 49587785,
    ip: '159.203.27.96',
    batchId: 'cfa36a570079-55b98c5c-f54d-4ab8-8cde-9e584f866a8e' },
  { id: 49587786,
    ip: '138.197.175.170',
    batchId: 'cfa36a570079-55b98c5c-f54d-4ab8-8cde-9e584f866a8e' },
  { id: 49587787,
    ip: '138.197.175.171',
    batchId: 'cfa36a570079-55b98c5c-f54d-4ab8-8cde-9e584f866a8e' } ]
```

##### Destroying all instances of a batch
```js
import ServerProvider from 'server-provider';

/*
 usage example:
 babel-node release.js 98fc3ff8e5164876ef8bfc47f27bc16cc4a445e71bdf3c724ac4c992e3071c8d cfa36a570079-55b98c5c-f54d-4ab8-8cde-9e584f866a8e
 */

const apiKey = process.argv[2];
const batchId = process.argv[3];

const provider = new ServerProvider('do_vps', {
  apiKey
});

provider.release(batchId).then(function(result) {
  console.log('result:', result);
}).catch(function(err) {
  console.error(err);
});
```
Output
```
result: { batchId: 'cfa36a570079-55b98c5c-f54d-4ab8-8cde-9e584f866a8e',
  errors: 0,
  servers: 
   [ { id: 49587785, success: true },
     { id: 49587786, success: true },
     { id: 49587787, success: true } ] }
```

##### Destroying all instances older than a certain time in minutes 
```js
import ServerProvider from 'server-provider';

/*
 usage example:
   babel-node release-older-than.js 98fc3ff8e5164876ef8bfc47f27bc16cc4a445e71bdf3c724ac4c992e3071c8d 30
 */

const apiKey = process.argv[2];
let time = parseInt(process.argv[3]);
if(!Number.isInteger(time)) {
  time = 180;
}

const provider = new ServerProvider('do_vps', {
  apiKey
});

provider.releaseOlderThan(time).then(function(result) {
  console.log('result:', result);
}).catch(function(err) {
  console.error(err);
});
```
Output
```
result: { servers: 
   [ { id: 49586177, success: true },
     { id: 49586178, success: true },
     { id: 49586179, success: true } ],
  errors: 0 }
```
## API

### new ServerProvider(vendor, options)

 - `vendor` is the id of the cloud provider. In this version only the 'do_vps' value is valid.
 - `options` is a set of options some of which are vendor specific.
   - `name` is the default name of new instances. The default is `'vps'`.
   - `apiKey` is the api key. For DigitalOcean is required. 
   - `instanceOptions` is an object with default options for new instances. This options are passed to the vendor api. 
   - `api` is an object with an alternative implementation. This is mainly for unit testing.

### async ServerProvider.prototype.acquire(count, options)
It acquires one or more servers.
 - `count` is the number of instances to acquire. It defaults to 1 
 - `options` is an object representing options to pass to the vendor API.  

##### Return value
 - `batchId` is an id to reference this set of instances in other API calls.
 - `servers` is an array of objects 
    - `id` is the id of the instance
    - `ip` is the ip of the instance
 - `rawInfo` vendor specific info about the servers.
   
### async ServerProvider.prototype.list(batchId)
Queries the vendor API to get the needed list of servers
- `batchId` is the id of the batch to list. If `batchId` is missing all the servers created with this API will be returned.

##### Return value
An array of objects each one an instance.
- `id` the id of the instance
- `ip` the ip of the instance
- `batchId` the batch id this instance belongs to

### async ServerProvider.prototype.release(batchId)
Releases the instances of a batch
- `batchId` is the id of the batch to release.

##### Return value
Returns an object 
  - `errors` indicates the number of instances for which errors occurred while releasing
  - `servers` an array of objects corresponding to each instance in the batch
    - `id` is the id of the instance
    - 'success' is true if the instance has been released successfully, otherwise is false
    - 'error' is the error occurred while trying to release the instance
### async ServerProvider.prototype.releaseOlderThan(timeInMinutes)
Releases all instances created with this API which are older than the time provided in minutes.

##### Return value
Returns an object 
  - `errors` indicates the number of instances for which errors occurred while releasing
  - `servers` an array of objects corresponding to each instance in the batch
    - `id` is the id of the instance
    - 'success' is true if the instance has been released successfully, otherwise is false
    - 'error' is the error occurred while trying to release the instance
