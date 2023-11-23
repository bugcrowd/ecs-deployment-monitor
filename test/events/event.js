'use strict'

const expect = require('expect.js');

const Event = require('../../lib/events/event');
const resources = require('../../lib/resources');

describe('Events', function () {
  afterEach(helpers.afterEach);

  var rawEvent = {
    message: '(service app) has started 4 bananas: (banana 8ddca76b-3ca5-4166-9cbb-aebdb8631861) (banana 630213ae-e078-491e-8b67-4d3e2d1ce6fd) (banana ec6a21c0-1f75-49fc-bbcd-144e77bd97b0) (banana f61d518f-ef95-40a8-9ce9-afd6e1ada4a7).'
  }

  class BananaEvent extends Event {
    extractableTypes() {
      return ['banana'];
    }
  }

  it('should extract banana resource identifiers', function () {
    var event = new BananaEvent(null, rawEvent);
    expect(event.resources['bananas']).to.eql([
      '8ddca76b-3ca5-4166-9cbb-aebdb8631861',
      '630213ae-e078-491e-8b67-4d3e2d1ce6fd',
      'ec6a21c0-1f75-49fc-bbcd-144e77bd97b0',
      'f61d518f-ef95-40a8-9ce9-afd6e1ada4a7'
    ]);
  });

  it('should load banana resources', function (done) {
    var event = new BananaEvent('service', rawEvent);

    resources['bananas'] = function (service, ids, cb) {
      expect(service).to.equal('service');
      expect(ids).to.eql([
        '8ddca76b-3ca5-4166-9cbb-aebdb8631861',
        '630213ae-e078-491e-8b67-4d3e2d1ce6fd',
        'ec6a21c0-1f75-49fc-bbcd-144e77bd97b0',
        'f61d518f-ef95-40a8-9ce9-afd6e1ada4a7'
      ]);

      cb(null, [1, 2]);
    };

    event.loadResources((err) => {
      expect(event.bananas).to.eql([1, 2]);
      delete resources['bananas'];
      done();
    });
  });
});
