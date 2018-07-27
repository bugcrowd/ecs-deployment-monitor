'use strict'

const expect = require('expect.js');
const streamBuffers = require('stream-buffers');
const EventEmitter = require('events');
const helpers = require('../../helpers');

const Deployment = require('../../../lib/deployment');
const TasksFailedRenderState = require('../../../lib/renderer/states/tasks-failed');

describe('Renderer:State:TasksFailed', function() {
  it('should include TaskDefinitionArn in done message', function() {
    let taskDefinitionArn = 'arn:taskdefinition:1';
    let service = new EventEmitter();
    let bufferStream = new streamBuffers.WritableStreamBuffer();
    let deployment = new Deployment({service: service, taskDefinitionArn: taskDefinitionArn});

    let taskArn='arn:task:1';
    let stopReason='oh no! the sky is falling!';
    deployment.tasksFailed.push('arn:task:1');
    deployment.tasksFailedFull.push({
      taskArn: taskArn,
      stoppedReason: stopReason
    });

    let stateInfo = TasksFailedRenderState(deployment, bufferStream);
    expect(stateInfo.extra).to.contain(`Task: ${taskArn}\nReason: ${stopReason}`);
  });
});
