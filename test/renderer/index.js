'use strict'

const expect = require('expect.js');
const _ = require('lodash');
const AWS = require('aws-sdk-mock');
const moment = require('moment');
const sinon = require('sinon');
const tk = require('timekeeper');

const helpers = require('../helpers');
const Renderer = require('../../lib/renderer');

describe('Renderer', function() {
  afterEach(helpers.afterEach);

  it('should render duration text', function() {
    let fakeDate = Date.now();
    tk.freeze(fakeDate);

    Renderer._setStateStartedAt(moment(fakeDate).subtract(3782, 'seconds'));
    expect(Renderer._getStateDurationText()).to.equal('1 hours 3 minutes 2 seconds');
  });
});
