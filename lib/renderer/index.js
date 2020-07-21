'use static'

const readline = require('readline');

const moment = require('moment');
const colors = require('colors/safe');
const indent = require('indent');

const states = require('./states');
const indentWidth = 4;

var _deployStartedAt;
var _stateStartedAt;
var _spinner;

// disable color output
colors.disable();

const Renderer = {
  /**
   * watch
   *
   * Watch a deployment and render information about state changes to output stream.
   *
   * @param {object} deployment A task object
   * @param {stream} output A stream. If process.stdout then tty is assumed and
   *   it will be sent decorative output
   */
  watch(deployment, output) {
    deployment.on('state', (state) => Renderer._stateChange(deployment, output, state));
    Renderer._setDeployStartedAt(Date.now());
  },

  _setDeployStartedAt(date) {
    _deployStartedAt = date;
  },

  _setStateStartedAt(date) {
    _stateStartedAt = date;
  },

  _getStateStartedAt(date) {
    return _stateStartedAt;
  },

  _getStateDuraton() {
    return (Date.now() - Renderer._getStateStartedAt())/1000;
  },

  /**
   * _getStateDurationText
   *
   * Get the duration the current state has been in progress for in
   * descriptive text form.
   *
   * @return {string}
   */
  _getStateDurationText() {
    let durationSeconds = Renderer._getStateDuraton();
    let duration = moment.duration(durationSeconds, 'seconds');
    let durationText = `${duration.seconds()} seconds`;

    if (duration.minutes()) {
      durationText = `${duration.minutes()} minutes ${durationText}`
    }

    if (duration.hours()) {
      durationText = `${duration.hours()} hours ${durationText}`
    }

    return durationText;
  },

  /**
   * _showWaitingMessage
   *
   * Show a temporary waiting message while state is in progress.
   *
   * @param {stream} output A stream
   */
  _showWaitingMessage(output, msg) {
    // Only shown if output is a tty (process.stdout).
    if (!(output instanceof require('tty').WriteStream)) return;

    let spinnerSymbols = ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'];
    let i = 0;
    _spinner = setInterval(function() {
      readline.clearLine(output);
      readline.cursorTo(output, indentWidth-2);
      output.write(colors.cyan(spinnerSymbols[i%spinnerSymbols.length]));
      output.write(' '+colors.gray(msg));
      i++;
    }, 1000);
  },

  /**
   * _removeWaitingMessage
   *
   * Remove the waiting message
   *
   * @param {stream} output A stream
   */
  _removeWaitingMessage(output) {
    clearInterval(_spinner);
    readline.clearLine(output);
    readline.cursorTo(output, 0);
  },

  /**
   * _stateChange
   *
   * Process a state change on a deployment
   *
   * @param {object} deployment A task object
   * @param {stream} output A stream
   * @param {string} state The state change
   */
  _stateChange(deployment, output, state) {
    // Finish render of last state
    Renderer._removeWaitingMessage(output);
    if (Renderer._getStateStartedAt()) {
      output.write(indent(colors.gray(`Step took ${Renderer._getStateDurationText()} to complete`), indentWidth)+"\n");
    }

    // Render new State
    let stateInfo = states[state](deployment);
    Renderer._setStateStartedAt(Date.now());
    output.write(colors.cyan(`-> ${state}\n`));

    let outputColor = 'gray';
    if (deployment.isSteady()) outputColor = 'green';
    if (deployment.isFailure()) outputColor = 'red';

    output.write(indent(colors[outputColor](stateInfo.done), indentWidth)+"\n");

    // Display waiting message
    if (stateInfo.waiting) {
      Renderer._showWaitingMessage(output, stateInfo.waiting);
    }

    if (stateInfo.extra && stateInfo.extra.length > 0) {
      output.write(indent(colors[outputColor](stateInfo.extra), indentWidth)+"\n");
    }

    if (stateInfo.exitCode !== undefined) {
      deployment.emit('exitCode', stateInfo.exitCode? stateInfo.exitCode : 0)
    }
  }
}

module.exports = Renderer;
