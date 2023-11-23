'use strict'

const expect = require('expect.js');

const SteadyEvent = require('../../lib/events/steady-event');

describe('Events:SteadyEvent', function () {
  const rawEvent = {
    message: '(service app) has reached a steady state.'
  }

  it('should detect a SteadyEvent event', function () {
    expect(SteadyEvent.test(rawEvent)).to.be.true;
  });
});
