'use strict'

const expect = require('expect.js');
const streamBuffers = require('stream-buffers');
const EventEmitter = require('events');
const helpers = require('../../helpers');

const Deployment = require('../../../lib/deployment');
const NotFoundRenderState = require('../../../lib/renderer/states/not-found');

describe('Renderer:State:NotFound', function() {
  it('should include TaskDefinitionArn in done message', function() {
    let taskDefinitionArn = 'arn:taskdefinition:1';
    var service = new EventEmitter();
    let deployment = new Deployment({service: service, taskDefinitionArn: taskDefinitionArn});
    let bufferStream = new streamBuffers.WritableStreamBuffer();

    let stateInfo = NotFoundRenderState(deployment, bufferStream);
    expect(stateInfo.done).to.contain(taskDefinitionArn);
  });
});
