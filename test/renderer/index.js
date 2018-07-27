'use strict'

const expect = require('expect.js');
const _ = require('lodash');
const AWS = require('aws-sdk-mock');
const moment = require('moment');
const sinon = require('sinon');
const tk = require('timekeeper');
const streamBuffers = require('stream-buffers');
const EventEmitter = require('events');

const helpers = require('../helpers');
const Renderer = require('../../lib/renderer');
const Deployment = require('../../lib/deployment');
const states = require('../../lib/renderer/states');

describe('Renderer', function() {
  it('should watch deployment for state changes', function(done) {
    let service = new EventEmitter();
    let bufferStream = new streamBuffers.WritableStreamBuffer();
    let deployment = new Deployment({service: service, taskDefinitionArn: 'bla'});

    let _stateChangeOld = Renderer._stateChange;
    Renderer._stateChange = function(deployment2, output, state) {
      expect(deployment2).to.equal(deployment);
      expect(output).to.equal(bufferStream);
      expect(state).to.equal('newstate');
      Renderer._stateChange = _stateChangeOld;
      done();
    }

    Renderer.watch(deployment, bufferStream);
    deployment.emit('state', 'newstate');
  });

  it('should render duration text', function() {
    let fakeDate = Date.now();
    tk.freeze(fakeDate);

    Renderer._setStateStartedAt(moment(fakeDate).subtract(3782, 'seconds'));
    expect(Renderer._getStateDurationText()).to.equal('1 hours 3 minutes 2 seconds');
    tk.reset();
  });

  it('should process a state change', function(done) {
    let service = new EventEmitter();
    let bufferStream = new streamBuffers.WritableStreamBuffer();
    let deployment = new Deployment({service: service, taskDefinitionArn: 'bla'});

    let taskFailedFixture = {
      'done': `15 Tasks have failed`,
      'extra': 'Extra extra hear all about it!',
      'exitCode': 1
    };

    let oldTasksFailed = states['TasksFailed'];
    states['TasksFailed'] = () => taskFailedFixture;

    deployment.on('exitCode', (exitCode) => {
      let out = bufferStream.getContents().toString();
      expect(out).to.contain(taskFailedFixture.done);
      expect(out).to.contain(taskFailedFixture.extra);
      expect(exitCode).to.equal(taskFailedFixture.exitCode);
      states['TasksFailed'] = oldTasksFailed;
      done();
    });

    Renderer.watch(deployment, bufferStream);
    deployment.emit('state', 'TasksFailed');
  });
});
