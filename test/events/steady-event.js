'use strict'

const expect = require('expect.js');
const AWS = require('aws-sdk-mock');

const helpers = require('../helpers');

const SteadyEvent = require('../../lib/events/steady-event');

describe('Events:SteadyEvent', function() {
  afterEach(helpers.afterEach);

  var rawEvent = {
    message: '(service app) has reached a steady state.'
  }

  it('should detect a SteadyEvent event', function() {
    expect(SteadyEvent.test(rawEvent)).to.be.true;
  });
});
