'use strict'

const expect = require('expect.js');
const streamBuffers = require('stream-buffers');
const EventEmitter = require('events');
const helpers = require('../../helpers');

const Deployment = require('../../../lib/deployment');
const TasksStartedRenderState = require('../../../lib/renderer/states/tasks-started');

describe('Renderer:State:TasksStarted', function() {
  it('should include TaskDefinitionArn in done message', function() {
    let taskDefinitionArn = 'arn:taskdefinition:1';
    var service = new EventEmitter();
    let bufferStream = new streamBuffers.WritableStreamBuffer();
    let deployment = new Deployment({service: service, taskDefinitionArn: taskDefinitionArn});
    deployment.tasksStarted.push('task1');
    deployment.tasksStarted.push('task2');
    deployment.tasksStarted.push('task3');

    let stateInfo = TasksStartedRenderState(deployment, bufferStream);
    expect(stateInfo.done).to.contain(3);
  });
});
