import DoVpsProvider from './do-vps-provider';

const vendorMap = {
  do_vps: DoVpsProvider
}

class ServerProvider {
  constructor(vendor, options) {
    const vendorMap = ServerProvider._getVendorMap();
    if(!vendorMap.hasOwnProperty(vendor)) {
      throw new Error('Unknown vendor');
    }
    this._provider = new vendorMap[vendor](options);
  }
  async acquire(count = 1, options = {}) {
    return this._provider.acquire(count, options);
  }

  async list(batchId) {
    return this._provider.list(batchId);
  }

  async release(batchId) {
    return this._provider.release(batchId);
  }

  async releaseOlderThan(minutes) {
    return this._provider.releaseOlderThan(minutes);
  }

  static _getVendorMap() {
    return vendorMap;
  }
}

export default ServerProvider

