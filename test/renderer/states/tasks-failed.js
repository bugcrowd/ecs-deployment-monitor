'use strict'

const expect = require('expect.js');
const streamBuffers = require('stream-buffers');
const EventEmitter = require('events');

const Deployment = require('../../../lib/deployment');
const TasksFailedRenderState = require('../../../lib/renderer/states/tasks-failed');
const containerFailedDeployment = require('../../fixtures/container-failed-deployment.json');

describe('Renderer:State:TasksFailed', function () {
  it('should include TaskDefinitionArn in done message', function () {
    let taskDefinitionArn = 'arn:taskdefinition:1';
    let service = new EventEmitter();
    let bufferStream = new streamBuffers.WritableStreamBuffer();
    let deployment = new Deployment({ service: service, taskDefinitionArn: taskDefinitionArn });

    let taskArn = 'arn:task:1';
    let stopReason = 'oh no! the sky is falling!';
    deployment.tasksFailed.push('arn:task:1');
    deployment.tasksFailedFull.push({
      taskArn: taskArn,
      stoppedReason: stopReason,
      containers: []
    });

    let stateInfo = TasksFailedRenderState(deployment, bufferStream);
    expect(stateInfo.extra).to.contain(`Task: ${taskArn}\nReason: ${stopReason}`);
  });

  it('should include container exit codes and reasons', function () {
    let taskDefinitionArn = 'arn:taskdefinition:1';
    let service = new EventEmitter();
    let bufferStream = new streamBuffers.WritableStreamBuffer();
    let deployment = new Deployment({ service: service, taskDefinitionArn: taskDefinitionArn });

    const failedTask = containerFailedDeployment.tasks[0];
    deployment.tasksFailed.push(failedTask.taskArn);
    deployment.tasksFailedFull.push(failedTask);

    let stateInfo = TasksFailedRenderState(deployment, bufferStream);

    const appContainer = failedTask.containers.find(c => c.name === 'app');

    expect(stateInfo.extra).to.contain(`Task: ${failedTask.taskArn}\nReason: ${failedTask.stoppedReason}`);
    expect(stateInfo.extra).to.contain(`Container: ${appContainer.name} (${appContainer.lastStatus})`);
    expect(stateInfo.extra).to.contain(`Exit code: ${appContainer.exitCode}`);
    expect(stateInfo.extra).to.contain(`Reason: ${appContainer.reason}`);
  });
});
