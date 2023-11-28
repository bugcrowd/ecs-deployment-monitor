'use strict'

const expect = require('expect.js');
const async = require('async');
const sinon = require('sinon');
const EventEmitter = require('events');

const Deployment = require('../lib/deployment');
const events = require('../lib/events');

describe('Deployment', function () {
  let deployment = null;

  afterEach(() => {
    if (deployment) deployment.destroy();
  });

  it('should emit state change and set internal state', function (done) {
    const startTime = Date.now();
    const service = new EventEmitter();
    deployment = new Deployment({ service: service, taskDefinitionArn: 'bla' });

    deployment.on('state', (state) => {
      expect(state).to.equal('fake');
      expect(deployment.state).to.equal('fake');
      expect(deployment.history[0].state).to.equal('fake');
      expect(deployment.history[0].transitionedAt).to.greaterThan(startTime);
      done();
    });

    deployment.setState('fake');
  });

  it('should report deployment as failed when history includes failed states', function () {
    const service = new EventEmitter();
    deployment = new Deployment({ service: service, taskDefinitionArn: 'bla' });
    deployment.history.push({ state: 'Created' });
    deployment.history.push({ state: 'TasksStarted' });
    expect(deployment.isFailure()).to.equal(false);
    deployment.history.push({ state: 'TasksFailed' });
    expect(deployment.isFailure()).to.equal(true);
  });

  it('hasState should behave correctly', function () {
    const service = new EventEmitter();
    deployment = new Deployment({ service: service, taskDefinitionArn: 'bla' });
    expect(deployment.hasState('Created')).to.equal(false);
    deployment.history.push({ state: 'Created' });
    expect(deployment.hasState('Created')).to.equal(true);
  });

  it('should set raw deployment after service update', function (done) {
    const service = new EventEmitter();
    service.raw = {
      deployments: [{ taskDefinition: 'bla' }]
    };

    deployment = new Deployment({ service: service, taskDefinitionArn: 'bla' });
    deployment.stoppedTasks = () => true;
    deployment._serviceUpdated();

    expect(deployment.raw).to.eql({
      taskDefinition: 'bla'
    });
    done();
  });

  it('should not trigger NotFound state if it doesnt find the deployment on first attempt', function (done) {
    const service = new EventEmitter();
    service.raw = {
      deployments: [{ taskDefinition: 'yo' }]
    };

    deployment = new Deployment({ service: service, taskDefinitionArn: 'bla' });
    deployment.stoppedTasks = () => true;
    deployment._serviceUpdated();

    expect(deployment.raw).to.equal(undefined);
    expect(deployment.hasState('NotFound')).to.equal(false);
    done();
  });

  it('should set state as NotFound if deployment wasnt found after 3 attempts', function (done) {
    const service = new EventEmitter();
    service.raw = {
      deployments: [{ taskDefinition: 'yo' }]
    };

    deployment = new Deployment({ service: service, taskDefinitionArn: 'bla' });
    deployment.stoppedTasks = () => true;
    deployment._serviceUpdated();
    deployment._serviceUpdated();
    deployment._serviceUpdated();

    // Should set NotFound state
    deployment._serviceUpdated();

    expect(deployment.raw).to.equal(undefined);
    expect(deployment.hasState('NotFound')).to.equal(true);
    done();
  });

  it('should store failed tasks and emit updated on service update', function () {
    const service = new EventEmitter();
    service.raw = {
      deployments: [{ taskDefinition: 'bla' }]
    };

    deployment = new Deployment({ service: service, taskDefinitionArn: 'bla' });
    deployment.evaluate = () => true;
    deployment.stoppedTasks = (cb) => cb(null, [{ taskArn: 'arn::1' }, { taskArn: 'arn::2' }]);
    deployment.on('updated', () => {
      expect(deployment.tasksFailed).to.eql(['arn::1', 'arn::2']);
    });

    deployment._serviceUpdated();
  });

  describe('Constructor', function () {
    let serviceEventListenerStub = null;
    let serviceUpdatedStub = null;

    beforeEach(() => {
      serviceEventListenerStub = sinon.stub(Deployment.prototype, "_serviceEventListener");
      serviceUpdatedStub = sinon.stub(Deployment.prototype, "_serviceUpdated");
    });

    afterEach(() => {
      serviceEventListenerStub.restore()
      serviceUpdatedStub.restore()
    });

    it('should listen for events on a service object ', function (done) {
      const service = new EventEmitter();
      deployment = new Deployment({ service: service });

      service.emit('event', 'test');
      service.emit('updated');

      async.nextTick(() => {
        expect(serviceEventListenerStub.called).to.equal(true);
        expect(serviceUpdatedStub.called).to.equal(true);
        done();
      });
    });
  });

  describe('Evaluator', function () {
    const evaluatorSpyFactory = (name, result) => {
      return sinon.spy((d, cb) => {
        cb(null, result);
      });
    }

    it('should call evaluators', function (done) {
      const service = new EventEmitter();
      service.initiated = true;
      deployment = new Deployment({ service: service, taskDefinitionArn: 'arn' });

      var evaluatorStubs = {
        'Usurped': evaluatorSpyFactory('Usurped', false),
        'TasksStarted': evaluatorSpyFactory('TasksStarted', false),
        'TasksFailed': evaluatorSpyFactory('TasksFailed', false)
      };

      deployment.evaluate(evaluatorStubs, (err) => {
        expect(evaluatorStubs['Usurped'].calledOnce).to.equal(true);
        expect(evaluatorStubs['TasksStarted'].calledOnce).to.equal(true);
        expect(evaluatorStubs['TasksFailed'].calledOnce).to.equal(true);
        done();
      });
    });

    it('should call setState when evaluator returns true', function (done) {
      const setStateStub = sinon.stub(Deployment.prototype, "setState").callsFake(function (state) {
        expect(state).to.equal('Usurped');
        setStateStub.restore();
        done();
      });

      const service = new EventEmitter();
      service.initiated = true;
      deployment = new Deployment({ service: service, taskDefinitionArn: 'arn' });

      const evaluatorStubs = {
        'Usurped': evaluatorSpyFactory('Usurped', true),
        'TasksStarted': evaluatorSpyFactory('TasksStarted', false)
      };

      deployment.evaluate(evaluatorStubs, () => { });
    });

    it('should call evaluators only one if evaluator previouly returned true', function (done) {
      const service = new EventEmitter();
      service.initiated = true;
      deployment = new Deployment({ service: service, taskDefinitionArn: 'arn' });

      const evaluatorStubs = {
        'TasksStarted': evaluatorSpyFactory('TasksStarted', true)
      };

      deployment.evaluate(evaluatorStubs, (err) => {
        deployment.evaluate(evaluatorStubs, (err) => {
          expect(evaluatorStubs['TasksStarted'].calledOnce).to.equal(true);
          done();
        });
      });
    });
  });

  describe('Service Event Listener', function () {
    it('should process a TasksStartedEvent and retain tasks', function (done) {
      const taskArn = 'arn:task';
      const service = new EventEmitter();
      deployment = new Deployment({ service: service, taskDefinitionArn: taskArn });
      deployment.raw = {
        createdAt: Date.now() - 5
      }

      const event = new events.TasksStartedEvent(service, { message: 'msg' });
      event.tasks = [
        { taskArn: 1, taskDefinitionArn: taskArn, createdAt: Date.now() },
        { taskArn: 2, taskDefinitionArn: taskArn, createdAt: Date.now() }
      ];

      deployment._serviceEventListener(event);

      expect(deployment.tasksStarted).to.eql([1, 2]);
      done();
    });

    it('should process a SteadyEvent and mark deployment as steady', function (done) {
      const taskArn = 'arn:task';
      const service = new EventEmitter();
      deployment = new Deployment({ service: service, taskDefinitionArn: taskArn });

      const event = new events.SteadyEvent(service, { message: 'msg' });
      deployment._serviceEventListener(event);

      expect(deployment.steady).to.eql(true);
      done();
    });
  });
});
