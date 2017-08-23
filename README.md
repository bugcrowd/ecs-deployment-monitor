ECS Deployment Monitor
==============================

ECS Deployment Monitor will help you monitor the status of a deployment of a new task definition to an ECS Service.

Its primary use case it to identify when a deploy fails. When containers in a task fail to start, ECS will terminate the task and start a new one. This is a great feature until you have a version of your application that will not start. In this scenario ECS will continue to start and stop tasks indefinitely, while leaving you none the wiser that your deploy has failed and an old version of your application is still running.

Installation
------------

Install package with NPM.

`npm install ecs-deployment-monitor --save`

Remove `--save` and add the `-g` flag to install globally if you wish to use the CLI version.

Possible Deployment States
-----------------

### NotFound
A deployment matching the TaskDefinition was not found

### Usurped
A newer deployment has been created. This deployment is no longer being deployed.

### Created
Deployment has been created but no other activity has occurred.

### TasksStarted
New tasks have been started but they are not healthy yet.

### TasksFailed
The number of tasks which failed to start exceeded the defined failure threshold. Default 25%.

### Live
All new tasks have a healthy status as reported by targets on the Application Load Balancer. Tasks running with an old task definition revision are still running.

### LiveExclusive
No new requests will go to old tasks. Old tasks are draining.

### Steady
ECS Service has reached a steady state

Module Usage
------------

```js
const monitor = require('ecs-deployment-monitor');

let deployment = monitor({
  serviceName: 'name',
  clusterArn: 'arn::cluster',
  taskDefinitionArn: 'arn::task-definition',
});

deployment.on('error', (error) => console.log(error));
deployment.on('state', (state) => console.log(state));
deployment.on('end', (state) => console.log('DONE'));

```

CLI Usage
---------

```
$ ecs-deployment-monitor \
    --cluster xxx \
    --service xxx \
    --task-definition xxx
```

### Example output

```
-> Created
-> TasksStarted
-> Live
-> Steady
```
