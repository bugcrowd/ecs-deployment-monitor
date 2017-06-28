'use strict'

const expect = require('expect.js');
const async = require('async');
const _ = require('lodash');
const AWS = require('aws-sdk-mock');
const sinon = require('sinon');
const EventEmitter = require('events');

const helpers = require('./helpers');

var Deployment = require('../lib/deployment');
var fixtures = require('./fixtures');

describe('Deployment', function() {
  afterEach(helpers.afterEach);

  describe('ServiceEvents', function() {
    var eventListenerStub = sinon.stub(Deployment.prototype, "_serviceEventListener");
    afterEach(() => eventListenerStub.restore());

    it('should listen for events on a service object ', function(done) {
      var service = new EventEmitter();
      var deployment = new Deployment({service: service});

      service.emit('event', 'test');

      async.nextTick(() => {
        expect(eventListenerStub.called).to.equal(true);
        done();
      });
    });

  })
});
