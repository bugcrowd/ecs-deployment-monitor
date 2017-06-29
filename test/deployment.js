'use strict'

const expect = require('expect.js');
const async = require('async');
const _ = require('lodash');
const AWS = require('aws-sdk-mock');
const sinon = require('sinon');
const EventEmitter = require('events');

const helpers = require('./helpers');

var Deployment = require('../lib/deployment');
var events = require('../lib/events');
var fixtures = require('./fixtures');

describe('Deployment', function() {
  afterEach(helpers.afterEach);

  describe('Constructor', function() {
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
  });

  describe('Service Event Listener', function() {
    var evaluateStub;

    beforeEach(() => evaluateStub = sinon.stub(Deployment.prototype, "evaluate"));
    afterEach(() => evaluateStub.restore());

    it('should process a TasksStartedEvent and retain tasks', function(done) {
      var taskArn = 'arn:task';
      var service = new EventEmitter();
      var deployment = new Deployment({service: service, taskDefinitionArn: taskArn});

      var event = new events.TasksStartedEvent(service, { message: 'msg' });
      event.tasks = [
        { id: 1, taskDefinitionArn: taskArn },
        { id: 2, taskDefinitionArn: taskArn }
      ];

      deployment._serviceEventListener(event);

      expect(deployment.tasks.length).to.equal(2);
      expect(deployment.tasksStarted).to.eql([1,2]);
      done();
    });

    it('should process a TasksStartedEvent and not retain tasks for a different deployment', function(done) {
      var taskArn = 'arn:task';
      var service = new EventEmitter();
      var deployment = new Deployment({service: service, taskDefinitionArn: 'arn:task'});

      var event = new events.TasksStartedEvent(service, { message: 'msg' });
      event.tasks = [
        { id: 1, taskDefinitionArn: 'arn:wrong' },
        { id: 2, taskDefinitionArn: 'arn:wrong' }
      ];

      deployment._serviceEventListener(event);

      expect(deployment.tasks.length).to.equal(0);
      done();
    });
  });

});
