'use strict'

const expect = require('expect.js');

const helpers = require('../helpers');

const Event = require('../../lib/events/event');

describe('Events', function() {
  afterEach(helpers.afterEach);

  var rawEvent = {
    message: '(service app) has started 4 tasks: (task 8ddca76b-3ca5-4166-9cbb-aebdb8631861) (task 630213ae-e078-491e-8b67-4d3e2d1ce6fd) (task ec6a21c0-1f75-49fc-bbcd-144e77bd97b0) (task f61d518f-ef95-40a8-9ce9-afd6e1ada4a7).'
  }

  it('should extract resource identifiers', function() {
    var event = new Event(null, rawEvent);
    expect(event._extractResources('task')).to.eql([
      '8ddca76b-3ca5-4166-9cbb-aebdb8631861',
      '630213ae-e078-491e-8b67-4d3e2d1ce6fd',
      'ec6a21c0-1f75-49fc-bbcd-144e77bd97b0',
      'f61d518f-ef95-40a8-9ce9-afd6e1ada4a7'
    ]);
  });

  // it('should load resources', function(done) {
  //
  // })
});
