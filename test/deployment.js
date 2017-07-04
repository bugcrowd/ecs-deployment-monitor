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

  it('should emit state change and set internal state', function(done) {
    var startTime = Date.now();
    var service = new EventEmitter();
    var deployment = new Deployment({service: service, taskDefinitionArn: 'bla'});

    deployment.on('state', (state) => {
      expect(state).to.equal('fake');
      expect(deployment.state).to.equal('fake');
      expect(deployment.history[0].state).to.equal('fake');
      expect(deployment.history[0].transitionedAt).to.greaterThan(startTime);
      done();
    });

    deployment.setState('fake');
  });

  it('should report deployment as failed when history includes failed states', function() {
    var service = new EventEmitter();
    var deployment = new Deployment({service: service, taskDefinitionArn: 'bla'});
    deployment.history.push({state: 'Created'});
    deployment.history.push({state: 'StartingTasks'});
    expect(deployment.isFailure()).to.equal(false);
    deployment.history.push({state: 'Failed'});
    expect(deployment.isFailure()).to.equal(true);
  });

  it('hasState should behave correctly', function() {
    var service = new EventEmitter();
    var deployment = new Deployment({service: service, taskDefinitionArn: 'bla'});
    expect(deployment.hasState('Created')).to.equal(false);
    deployment.history.push({state: 'Created'});
    expect(deployment.hasState('Created')).to.equal(true);
  });

  describe('Constructor', function() {
    var eventListenerStub = sinon.stub(Deployment.prototype, "_serviceEventListener");
    afterEach(() => eventListenerStub.restore());

    it('should listen for events on a service object ', function(done) {
      var service = new EventEmitter();
      var deployment = new Deployment({service: service});

      service.emit('event', 'test');

      async.nextTick(() => {
        expect(eventListenerStub.called).to.equal(true);
        deployment.destroy();
        done();
      });
    });
  });

  describe('Evaluator', function() {
    var evaluatorSpyFactory = (name, result) => {
      return sinon.spy((d, cb) => {
        cb(null, result);
      });
    }

    it('should call evaluators', function(done) {
      var service = new EventEmitter();
      service.initiated = true;
      var deployment = new Deployment({service: service, taskDefinitionArn: 'arn'});

      var evaluatorStubs = {
        'NotFound': evaluatorSpyFactory('NotFound', false),
        'Usurped': evaluatorSpyFactory('Usurped', false),
        'StartingTasks': evaluatorSpyFactory('StartingTasks', false)
      };

      deployment.evaluate(evaluatorStubs, (err) => {
        expect(evaluatorStubs['NotFound'].calledOnce).to.equal(true);
        expect(evaluatorStubs['Usurped'].calledOnce).to.equal(true);
        expect(evaluatorStubs['StartingTasks'].calledOnce).to.equal(true);
        done();
      });
    });

    it('should call setState when evaluator returns true', function(done) {
      var setStateStub = sinon.stub(Deployment.prototype, "setState").callsFake(function(state) {
        expect(state).to.equal('Usurped');
        setStateStub.restore();
        done();
      });

      var service = new EventEmitter();
      service.initiated = true;
      var deployment = new Deployment({service: service, taskDefinitionArn: 'arn'});

      var evaluatorStubs = {
        'NotFound': evaluatorSpyFactory('NotFound', false),
        'Usurped': evaluatorSpyFactory('Usurped', true),
        'StartingTasks': evaluatorSpyFactory('StartingTasks', false)
      };

      deployment.evaluate(evaluatorStubs, _.noop);
    });

    it('should call evaluators only one if evaluator previouly returned true', function(done) {
      var service = new EventEmitter();
      service.initiated = true;
      var deployment = new Deployment({service: service, taskDefinitionArn: 'arn'});

      var evaluatorStubs = {
        'StartingTasks': evaluatorSpyFactory('StartingTasks', true)
      };

      deployment.evaluate(evaluatorStubs, (err) => {
        deployment.evaluate(evaluatorStubs, (err) => {
          expect(evaluatorStubs['StartingTasks'].calledOnce).to.equal(true);
          done();
        });
      });
    });
  });

  describe('Service Event Listener', function() {
    it('should process a TasksStartedEvent and retain tasks', function(done) {
      var taskArn = 'arn:task';
      var service = new EventEmitter();
      var deployment = new Deployment({service: service, taskDefinitionArn: taskArn});

      var event = new events.TasksStartedEvent(service, { message: 'msg' });
      event.tasks = [
        { taskArn: 1, taskDefinitionArn: taskArn },
        { taskArn: 2, taskDefinitionArn: taskArn }
      ];

      deployment._serviceEventListener(event);

      expect(deployment.tasks.length).to.equal(2);
      expect(deployment.tasksStarted).to.eql([1,2]);
      deployment.destroy();
      done();
    });

    it('should process a TasksStartedEvent and not retain tasks for a different deployment', function(done) {
      var taskArn = 'arn:task';
      var service = new EventEmitter();
      var deployment = new Deployment({service: service, taskDefinitionArn: 'arn:task'});

      var event = new events.TasksStartedEvent(service, { message: 'msg' });
      event.tasks = [
        { taskArn: 1, taskDefinitionArn: 'arn:wrong' },
        { taskArn: 2, taskDefinitionArn: 'arn:wrong' }
      ];

      deployment._serviceEventListener(event);

      expect(deployment.tasks.length).to.equal(0);
      deployment.destroy();
      done();
    });

    it('should process a TasksStoppedEvent and record the tasks failed', function(done) {
      var taskArn = 'arn:task';
      var service = new EventEmitter();
      var deployment = new Deployment({service: service, taskDefinitionArn: taskArn});

      var event = new events.TasksStoppedEvent(service, { message: 'msg' });
      event.tasks = [
        { taskArn: 1, taskDefinitionArn: taskArn },
        { taskArn: 2, taskDefinitionArn: taskArn }
      ];

      deployment._serviceEventListener(event);

      expect(deployment.tasksFailed).to.eql([1,2]);
      deployment.destroy();
      done();
    });
  });

});
