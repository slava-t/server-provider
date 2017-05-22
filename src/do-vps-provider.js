import DigitalOcean from 'do-wrapper';
import uuid from 'node-uuid';
import sleep from 'sleep-promise';

const AUTO_CREATED_TAG = 'ad01a05d-35cf-4521-9ce7-a97f17fb9341';
const BATCH_PREFIX_CODE = 'cfa36a570079';
const BATCH_PREFIX = BATCH_PREFIX_CODE + '-';

export default class DoVpsProvider {
  constructor(options = {}) {
    const apiKey = options.apiKey;
    if(typeof apiKey !== 'string') {
      throw new Error('The \'apiKey\' property is missing or invalid.');
    }

    this._api = options.api ? options.api : new DigitalOcean(apiKey, options.pageSize || 100);

    this._defaultInstanceOptions = Object.assign({
      name: options.name || 'vps',
      region: 'tor1',
      size: '512mb',
      image: 'ubuntu-14-04-x64',
      //ssh_keys: [],
      backups: false,
      ipv6: false,
      private_networking: false,
      monitoring: false,
    }, options.instanceOptions || {});
  }

  async acquire(count = 1, options = {}) {
    const timeout = options.timeout || 15 * 60 * 1000; //15 minutes
    const interval = options.interval || 5000; //5 seconds

    const batchId = BATCH_PREFIX  + uuid.v4();
    const serverOptions = Object.assign({}, this._defaultInstanceOptions, options.instanceOptions || {});

    const name = options.name || serverOptions.name;

    const tags = serverOptions.tags || [];
    tags.push(batchId);
    tags.push(AUTO_CREATED_TAG);
    serverOptions.tags = tags;

    let names = [];
    if(count > 1) {
      for(let i = 1; i <= count; ++i) {
        names.push(name + '-' + i);
      }
    } else {
      names = [name]
    }

    delete serverOptions.name;
    serverOptions.names = names;

    let result;
    try {
      result = await this._api.dropletsCreate(serverOptions);

      await sleep(interval);

      await this._waitForTags(batchId, count, timeout, interval);

      return await this._waitForActiveStatus(batchId, timeout, interval);
    } catch(err) {
      if(result) {
        await this._tryDeleteDroplets(result);
      }
      throw err;
    }
  }

  async list(batchId) {
    const res = await this._api.tagsGetDroplets(AUTO_CREATED_TAG);
    const droplets = res.body.droplets;
    const servers = [];
    for(const droplet of droplets) {
      const server = {
        id: droplet.id,
        ip: droplet.networks.v4[0].ip_address
      };
      const dropletBatchId = this._findBatchId(droplet.tags);
      if(dropletBatchId) {
        server.batchId = dropletBatchId;
      }
      if(batchId) {
        if(dropletBatchId === batchId) {
          servers.push(server);
        }
      } else {
        servers.push(server);
      }
    }
    return servers;
  }

  async release(batchId) {
    const res = await this._api.tagsGetDroplets(batchId);
    const droplets = res.body.droplets;

    const servers = [];
    let errors = 0;
    for(const droplet of droplets) {
      try {
        if(!this._hasTag(droplet, batchId)) {
          throw new Error('The droplet does not belong to this batch');
        }

        await this._api.dropletsDelete(droplet.id);
        servers.push({id: droplet.id, success: true});
      } catch(err) {
        servers.push({id: droplet.id, success: false, error: err});
        ++errors;
      }
    }
    return {
      batchId,
      errors,
      servers
    }
  }

  async releaseOlderThan(minutes) {
    const res = await this._api.tagsGetDroplets(AUTO_CREATED_TAG);
    const droplets = res.body.droplets;

    const servers = [];
    let errors = 0;
    const time = minutes * 60 * 1000;
    const now = Date.now();
    for(const droplet of droplets) {
      try {
        const createdAt = Date.parse(droplet.created_at);
        if(now - createdAt > time) {
          if (!this._hasTag(droplet, AUTO_CREATED_TAG)) {
            throw new Error('The droplet doesn\'t have the auto creation tag');
          }
          await this._api.dropletsDelete(droplet.id);
          servers.push({id: droplet.id, success: true});
        }
      } catch (err) {
        servers.push({id: droplet.id, success: false, error: err});
        ++errors;
      }
    }
    return {
      servers,
      errors
    }
  }

  _hasTag(droplet, tag) {
    const tags = droplet.tags || [];
    for(const t of tags) {
      if(tag === t) {
        return true;
      }
    }
    return false;
  }

  _findBatchId(tags) {
    if(Array.isArray(tags)) {
      for(const tag of tags) {
        if(tag.startsWith(BATCH_PREFIX)) {
          return tag;
        }
      }
    }
  }

  async _waitForTags(tag, count, timeout = 15 * 60 * 1000, interval = 10000) {
    const start = Date.now();
    while(Date.now() - start <= timeout) {
      if(Date.now() - start > interval / 2) {
        await sleep(interval);
      }
      const result = await this._api.tagsGetDroplets(tag);
      const droplets = result.body.droplets;
      if(droplets.length >= count) {
        return result;
      }
    }
    throw new Error('Time out');
  }

  async _waitForActiveStatus(batchId, timeout = 15 * 60 * 1000, interval = 10000) {
    const start = Date.now();
    while(Date.now() - start <= timeout) {
      if(Date.now() - start > interval / 2) {
        await sleep(interval);
      }
      const result = await this._api.tagsGetDroplets(batchId);
      const droplets = result.body.droplets;
      const servers = [];
      for(const droplet of droplets) {
        if(droplet.status === 'active') {
          servers.push({
            id: droplet.id,
            ip: droplet.networks.v4[0].ip_address
          })
        }
      }
      if(droplets.length === servers.length) {
        return {
          batchId,
          servers,
          rawInfo: result.body
        }
      }
    }
    throw new Error('Time out');
  }

  async _tryDeleteDroplets(creationResult) {
    try {
      if(creationResult) {
        const droplets = creationResult.body.droplets;
        for(const droplet of droplets) {
          try {
            await this._api.dropletsDelete(droplet.id);
          } catch(err) {
            //we tried our best
          }
        }
      }
    } catch(err) {
      //we tried our best
    }
  }
}