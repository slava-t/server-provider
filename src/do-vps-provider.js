import DigitalOcean from 'do-wrapper';
import sleep from 'sleep-promise';
import {generateFullName, generateBatchId, parseVpsName} from './ut';

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
      tags: [],
      private_networking: false,
      monitoring: false,
    }, options.instanceOptions || {});
  }

  async acquire(count = 1, options = {}) {
    const timeout = options.timeout || 15 * 60 * 1000; //15 minutes
    const interval = options.interval || 5000; //5 seconds

    const batchId = generateBatchId();
    const serverOptions = Object.assign({}, this._defaultInstanceOptions, options.instanceOptions || {});

    const name = options.name || serverOptions.name;

    let names = [];
    if(count > 1) {
      for(let i = 1; i <= count; ++i) {
        names.push(generateFullName(name + '-' + i, batchId));
      }
    } else {
      names.push(generateFullName(name, batchId));
    }

    delete serverOptions.name;
    serverOptions.names = names;

    let result;
    try {
      result = await this._api.dropletsCreate(serverOptions);

      await sleep(interval);

      return await this._waitForActiveStatus(batchId, timeout, interval);
    } catch(err) {
      if(result) {
        await this._tryDeleteDroplets(result);
      }
      throw err;
    }
  }

  async list(batchId) {
    const droplets = await this._listDroplets(batchId);
    const servers = [];
    for(const d of droplets) {
      const droplet = d.droplet;
      const server = {
        id: droplet.id,
        ip: droplet.networks.v4[0].ip_address,
        batchId: d.batchId
      };
      if(batchId) {
        server.batchId = batchId;
      }
      servers.push(server);
    }
    return servers;
  }

  async release(batchId) {
    const droplets = await this._listDroplets(batchId);

    const servers = [];
    let errors = 0;
    for(const d of droplets) {
      const droplet = d.droplet;
      try {
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
    const droplets = await this._listDroplets();

    const servers = [];
    let errors = 0;
    const time = minutes * 60 * 1000;
    const now = Date.now();
    for(const d of droplets) {
      const droplet = d.droplet;
      try {
        const createdAt = Date.parse(droplet.created_at);
        if(now - createdAt > time) {
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

  async _listDroplets(batchId) {
    const res = await this._api.dropletsGetAll({});
    const droplets = res.body.droplets;
    const result = [];
    for(const droplet of droplets) {
      const nameComponents = parseVpsName(droplet.name);
      if(nameComponents.batchId) {
        if(!batchId || batchId === nameComponents.batchId) {
          result.push({droplet, batchId: nameComponents.batchId});
        }
      }
    }
    return result;
  }

  async _waitForActiveStatus(batchId, timeout = 15 * 60 * 1000, interval = 10000) {
    const start = Date.now();
    while(Date.now() - start <= timeout) {
      if(Date.now() - start > interval / 2) {
        await sleep(interval);
      }
      const rawDroplets = await this._listDroplets(batchId);
      const servers = [];
      const droplets = [];
      for(const d of rawDroplets) {
        const droplet = d.droplet;
        if(droplet.status === 'active') {
          droplets.push(droplet);
          servers.push({
            id: droplet.id,
            ip: droplet.networks.v4[0].ip_address
          })
        }
      }

      if(rawDroplets.length === servers.length) {
        return {
          batchId,
          servers,
          rawInfo: {droplets}
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