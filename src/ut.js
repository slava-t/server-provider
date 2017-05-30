import crypto from 'crypto';

const ID_BIN_LEN = 16;
const ID_LEN = ID_BIN_LEN * 2;
const SERVICE_ID = '68a68fd3ccb7f4bf';

const idRegex = /^[0-9a-f]+$/;

const rb = crypto.randomBytes;

function generateId(len) {
  const id = rb(len);
  return id.toString('hex').toLowerCase();
}

function generateBatchId() {
  return generateId(ID_BIN_LEN);
}

function generateFullName(vpsName, batchId) {
  return [vpsName, batchId, SERVICE_ID].join('-');
}


function isId(src) {
  if(typeof src !== 'string' || src.length != ID_LEN) {
    return false;
  }
  return idRegex.test(src);
}

function parseVpsName(vpsName) {
  const components = vpsName.split('-');
  const length = components.length;

  let batchId;
  if(length > 1 && components[length - 1] === SERVICE_ID) {
    batchId = isId(components[length - 2], 12) ? components[length - 2] : null;
  }
  if(batchId) {
    const name = components.slice(0, length - 2).join('-');
    return {
      name,
      batchId
    };
  }
  return {
    name: vpsName
  }
}

export {
  SERVICE_ID,
  isId,
  generateId,
  generateBatchId,
  parseVpsName,
  generateFullName
}
