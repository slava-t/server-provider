import chai from 'chai'
import {parseVpsName, generateFullName, generateBatchId, SERVICE_ID, isId} from '../dist/ut.js'

const expect = chai.expect;
describe('parseVpsName', function() {
  it('should parse a simple name', function() {
    expect(parseVpsName('test-name')).to.deep.equal({name: 'test-name'});
    expect(parseVpsName('')).to.deep.equal({name: ''});
    expect(parseVpsName('-')).to.deep.equal({name: '-'});
    expect(parseVpsName('--')).to.deep.equal({name: '--'});
  });

  function testParsingFullName(name) {
    const batchId = generateBatchId();
    const fullName = generateFullName(name, batchId);
    const components = fullName.split('-');
    const length = components.length;
    expect(length).to.equal(name.split('-').length + 2);
    expect(components[length - 1]).to.equal(SERVICE_ID);
    expect(components[length - 2]).to.equal(batchId);
    expect(isId(batchId)).to.equal(true);
    expect(fullName).to.equal(name + '-' + batchId + '-' + SERVICE_ID);
    expect(parseVpsName(fullName)).to.deep.equal({
      name,
      batchId
    });
  }

  it('should parse full names', function() {
    testParsingFullName('');
    testParsingFullName('-');
    testParsingFullName('--');
    testParsingFullName('test');
    testParsingFullName('-test');
    testParsingFullName('-test-');
    testParsingFullName('test-name');
    testParsingFullName('-test-name-');
    testParsingFullName('----test-name-----');
  });
})