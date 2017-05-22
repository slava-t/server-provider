import ServerProvider from '../dist';
import DoVpsApiFake from './do-vps-api-fake'
import chai from 'chai';

const  expect = chai.expect;

describe('DigitalOcean server provider', function() {
  this.timeout(10000);
  let provider;
  let store;
  let api;

  beforeEach(function() {
    api = new DoVpsApiFake();
    store = api.getStore();
    provider = new ServerProvider('do_vps', {
      apiKey: 'someKey',
      api
    });
  });

  async function acquire(count, options) {
    return await provider.acquire(count, Object.assign({
      timeout: 1000,
      interval: 2
    }, options || {}));
  }

  function validateServer(data) {
    const {server, droplet, timeBefore, timeAfter, batchId, name} = data;

    expect(server.ip.startsWith('192.168.')).to.equal(true);
    expect(droplet.name).to.equal(name);
    expect(droplet.status).to.equal('active');

    const createdAt = Date.parse(droplet.created_at);
    expect(createdAt >= timeBefore && createdAt <= timeAfter).to.equal(true);

    const options = droplet._options;
    const tagSet = new Set(options.tags);

    expect(options.region).to.equal('tor1');
    expect(options.size).to.equal('512mb');
    expect(options.image).to.equal('ubuntu-14-04-x64');
    expect(options.backups).to.equal(false);
    expect(options.ipv6).to.equal(false);
    expect(options.private_networking).to.equal(false);
    expect(options.monitoring).to.equal(false);

    expect(tagSet.has('ad01a05d-35cf-4521-9ce7-a97f17fb9341')).to.equal(true);
    expect(tagSet.has(batchId)).to.equal(true);
    expect(options.tags.length).to.equal(2);
  }

  async function validateBatch(data) {
    const {batch, name, timeBefore, timeAfter, count} = data;
    const {servers, batchId} = batch;

    expect(batch.batchId.startsWith('cfa36a570079-')).to.equal(true);

    const droplets = batch.rawInfo.droplets;

    let listedServers = await provider.list(batchId);

    expect(servers.length).to.equal(count);
    expect(droplets.length).to.equal(count);
    expect(listedServers.length).to.equal(count);

    for(let i = 0; i < count; ++i) {
      const server = servers[i];
      const droplet = droplets[i];
      const listedServer = listedServers[i];
      validateServer({
        server,
        droplet,
        timeBefore,
        timeAfter,
        batchId,
        name: count > 1 ? name + '-' + (i + 1) : name
      });
      expect(listedServer.ip).to.equal(server.ip);
      expect(listedServer.id).to.equal(server.id);
    }
  }

  it('successfully acquires and releases a server instance', async function() {
    const timeBefore = Date.now();
    const batch = await acquire(1);
    expect((await provider.list()).length).to.equal(1);
    const timeAfter = Date.now();

    await validateBatch({
      batch, name: 'vps', timeBefore, timeAfter, count: 1
    });

    await provider.release(batch.batchId);
    expect((await provider.list()).length).to.equal(0);
  });


  it('successfully creates and releases three batches', async function() {
    const timeBefore = Date.now();
    const batch1 = await acquire(5, {name: 'a'});
    expect((await provider.list()).length).to.equal(5);

    const timeBefore2 = Date.now();
    const batch2 = await acquire(2);
    expect((await provider.list()).length).to.equal(7);

    const timeBefore3 = Date.now();
    const batch3 = await acquire(4, {name: 'test'});
    expect((await provider.list()).length).to.equal(11);
    const timeAfter = Date.now();

    await validateBatch({batch: batch1, name: 'a', timeBefore, timeAfter: timeBefore2, count: 5});
    await validateBatch({batch: batch2, name: 'vps', timeBefore: timeBefore2, timeAfter: timeBefore3, count: 2});
    await validateBatch({batch: batch3, name: 'test', timeBefore: timeBefore3, timeAfter, count: 4});

    await provider.release(batch2.batchId);
    await validateBatch({batch: batch1, name: 'a', timeBefore, timeAfter: timeBefore2, count: 5});
    await validateBatch({batch: batch3, name: 'test', timeBefore: timeBefore3, timeAfter, count: 4});
    expect((await provider.list()).length).to.equal(9);


    await provider.release(batch1.batchId);
    await validateBatch({batch: batch3, name: 'test', timeBefore: timeBefore3, timeAfter, count: 4});
    expect((await provider.list()).length).to.equal(4);

    await provider.release(batch3.batchId);
    expect((await provider.list()).length).to.equal(0);
  });

  it('correctly destroys servers with releaseOlderThan', async function() {
    const m27 = 27 * 60000;
    const m42 = 42 * 60000;
    const m35 = 35 * 60000;

    const time1 = Date.now() - m27;
    const batch1 = await acquire(6, {name: 'a'});
    expect((await provider.list()).length).to.equal(6);
    store.setCreationTime(batch1.batchId, time1);


    const time2 = Date.now() - m42;
    const batch2 = await acquire(8);
    expect((await provider.list()).length).to.equal(14);
    store.setCreationTime(batch2.batchId, time2);

    const time3 = Date.now() - m35;
    const batch3 = await acquire(3, {name: 'test'});
    expect((await provider.list()).length).to.equal(17);
    store.setCreationTime(batch3.batchId, time3);

    await validateBatch({batch: batch1, name: 'a', timeBefore: time1, timeAfter: time1, count: 6});
    await validateBatch({batch: batch2, name: 'vps', timeBefore: time2, timeAfter: time2, count: 8});
    await validateBatch({batch: batch3, name: 'test', timeBefore: time3, timeAfter: time3, count: 3});

    await provider.releaseOlderThan(40);
    expect((await provider.list()).length).to.equal(9);
    await validateBatch({batch: batch1, name: 'a', timeBefore: time1, timeAfter: time1, count: 6});
    await validateBatch({batch: batch3, name: 'test', timeBefore: time3, timeAfter: time3, count: 3});

    await provider.releaseOlderThan(30);
    expect((await provider.list()).length).to.equal(6);
    await validateBatch({batch: batch1, name: 'a', timeBefore: time1, timeAfter: time1, count: 6});

    await provider.releaseOlderThan(20);
    expect((await provider.list()).length).to.equal(0);
  });
});