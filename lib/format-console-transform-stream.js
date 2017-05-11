'use strict'

var Transform = require('stream').Transform;

require("color");

class FormatConsoleTransformStream extends Transform {
  constructor(options) {
    super({ objectMode: true });

    this.lastEvent = null;
  }

  _transform(event, encoding, cb) {
    this.push(this.formatStatusUpdate(event));
    this.lastEvent = event;
    cb();
  }

  formatStatusUpdate(event, cb) {
    if (event.status === "DEPLOY_ABORTED") {
      return "\nDeploy aborted".red;
    }

    if (!this.lastEvent && event.status === "IN_PROGRESS") {
      return ">> Deploy in Progress\n   ".cyan;
    }

    if (event.status === "IN_PROGRESS") {
      return ".";
    }

    if (event.status === "DEPLOYED") {
      return ">> Deployment Complete".cyan;
    }

    return ""
  }
}

module.exports = FormatConsoleTransformStream;
