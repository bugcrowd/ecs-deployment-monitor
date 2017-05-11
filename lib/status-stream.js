'use strict'

const Readable = require('stream').Readable;
const AWS = require('aws-sdk');
const _ = require('lodash');

class StatusStream extends Readable {
  constructor(options) {
    super({ objectMode: true });

    this.options = _.defaults(options, {
      durationBetweenPolls: 1000
    });

    this.buffer = [];
    this.ended = false;
    this.destroyed = false;
    this.started = false;
    this.ended = false;
  }

  _read() {
    var active = true;
    while (active && this.buffer.length) active = this.push(this.buffer.shift());

    // Downstream buffers are full
    if (!active) return;

    if (this.ended) return this.push(null);
    if (!this.started) return this.pollForStatus();
  }

  pollForStatus() {
    if (this.ended && this.destroyed) return;

    this.started = true;

    this.requestDeploymentStatus((err, status) => {
      if (err) return this.emit('error', err);

      if (!status) {
        return this.emit('error', new Error("A deployment status was not returned"));
      }

      this.push(status);

      if (status.end) {
        this.ended = true;
      }
      else {
        setTimeout(() => this.pollForStatus(), this.options.durationBetweenPolls);
      }
    })
  }

  requestDeploymentStatus(cb) {
    var ecs = new AWS.ECS();

    var params = {
      services: [this.options.service],
      cluster: this.options.cluster
    };

    ecs.describeServices(params, (err, data) => {
      if (err) return cb(err);

      var service = data['services'][0];
      var status = this.determineStatus(service);
      cb(null, status);
    });
  }

  determineStatus(service) {
    var deployments = service['deployments'];
    var deployment = _.find(deployments, (deployment) => deployment.taskDefinition === this.options.taskDefinition);

    if (!deployment) {
      return { status: "DEPLOYMENT_NOT_FOUND", end: true };
    }

    var inProgress = deployment.desiredCount > deployment.runningCount;
    var deployed = deployment.desiredCount === deployment.runningCount;

    if (deployment.status !== "PRIMARY") {
      return { status: "DEPLOY_ABORTED", end: true};
    }

    if (inProgress && deployment.pendingCount === 0) {
      return { status: "IN_PROGRESS", started: false };
    }

    if (inProgress && deployment.pendingCount > 0) {
      return { status: "IN_PROGRESS", started: true };
    }

    if (deployed && deployments.length > 1) {
      return { status: "DEPLOYED", deprovisionedOldDeployment: false };
    }

    if (deployed && deployments.length === 1) {
      return { status: "DEPLOYED", deprovisionedOldDeployment: true, end: true };
    }
  }

  destroy() {
    this.destroyed = true;
  }
}

module.exports = StatusStream
