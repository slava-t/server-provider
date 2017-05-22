import sleep from 'sleep-promise';
let nextId = 1;
function getNextId() {
  return nextId++;
}

let nextIp = [192, 168, 2, 5];
function getNextIp() {
  const ip = nextIp[0] + '.' + nextIp[1] + '.' + nextIp[2] + '.' + nextIp[3];
  for(let i = 3; i >= 0; --i) {
    const v = ++nextIp[i];
    if(v < 256) {
      return ip;
    }
    nextIp[i] = 0;
  }
  nextIp[0] = 1;
  return ip;
}


class DoVpsStore {
  constructor() {
    this._droplets = new Map();
  }

  getDroplets(predicate) {
    if(!predicate) {
      return this._droplets;
    }
    const droplets = [];
    this.forEach(function(droplet) {
      if(predicate(droplet)) {
        droplets.push(droplet);
      }
    });
    return droplets;
  }

  getDropletsByTag(tag) {
    return this.getDroplets(function(droplet) {
      return new Set(droplet.tags).has(tag.toLocaleString());
    })
  }

  addDroplet(droplet) {
    this._droplets.set(droplet.id, droplet);
  }

  getDroplet(id) {
    return this._droplets.get(id);
  }

  deleteDroplet(id) {
    this._droplets.delete(id);
  }

  forEach(func) {
    for(const id of this._droplets.keys()) {
      func(this._droplets.get(id));
    }
  }

  getSize() {
    return this._droplets.size;
  }

  setCreationTime(tag, time) {
    const droplets = this.getDropletsByTag(tag);
    for(const droplet of droplets) {
      droplet.created_at = new Date(time).toISOString();
    }
  }

}

export default class DoVpsApiFake {
  constructor(store = new DoVpsStore(), options = {}) {
    this._store = store;
    this._defaultWait = [10, 100];
    this._waitMap = {
      beforeGettingTagDroplets: [2, 5],
      afterGettingTagDroplets: [2, 5]
    }
  }

  getStore() {
    return this._store;
  }

  async dropletsCreate(dropletOptions) {
    await this._wait('beforeCreating');
    const names = dropletOptions.names ? dropletOptions.names : [dropletOptions.name];
    const droplets = new Map();
    const result = [];
    for(const name of names) {
      const id = getNextId();
      const droplet = {
        id,
        name,
        status: 'new',
        networks: {v4: []},
        created_at: new Date().toISOString(),
        tags: [],
        _options: dropletOptions
      };
      this._store.addDroplet(droplet);
      droplets.set(id, droplet);
      result.push(droplet);
    }
    const self = this;
    setTimeout(async function() {
      await self._wait('beforeSettingTags');
      self._setTags(droplets);
      setTimeout(async function() {
        await self._wait('beforeSettingIps');
        self._setIps(droplets);
        setTimeout(async function(){
          await self._wait('beforeActivation');
          self._activate(droplets);
          await self._wait('afterActivation');
        });
      }) ;
    })
    return {body: {droplets: result}};
  }

  async tagsGetDroplets(tag) {
    await this._wait('beforeGettingTagDroplets');
    const droplets = this._store.getDropletsByTag(tag);
    await this._wait('afterGettingTagDroplets');
    return {
      body: {
        droplets
      }
    };
  }

  async dropletsDelete(id) {
    await this._wait('beforeDeleting');
    this._store.deleteDroplet(id);
    await this._wait('afterDeleting');
  }

  _setTags(droplets) {
    for(const dropletId of droplets.keys()) {
      const droplet = droplets.get(dropletId);
      if(Array.isArray(droplet._options.tags)) {
        const tags = [];
        for(const tag of droplet._options.tags) {
          if(typeof tag !== 'string') {
            throw new Error('Invalid tags');
          }
          if(typeof tag !== 'string' || !/^[a-zA-Z0-9:_\-.]+$/.test(tag) || tag.length > 255) {
            throw new Error('Invalid tags');
          }
          tags.push(tag);
        }
        droplet.tags = tags;
      }
    }
  }

  _setIps(droplets) {
    for(const dropletId of droplets.keys()) {
      const droplet = droplets.get(dropletId);
      droplet.networks.v4.push({
        ip_address: getNextIp()
      });
    }
  }

  _activate(droplets) {
    for(const dropletId of droplets.keys()) {
      droplets.get(dropletId).status = 'active';
    }
  }

  async _wait(waitId) {
    let min = this._defaultWait[0];
    let max = this._defaultWait[1];
    if(this._waitMap.hasOwnProperty(waitId)) {
      min = this._waitMap[waitId][0];
      max = this._waitMap[waitId][1];
    }
    const t = min + Math.floor(Math.random() * (max - min + 1));
    await sleep(t);
  }
}