var fs = require('fs');

var tapOut = require('tap-out');
var through = require('through2');
var duplexer = require('duplexer');
var format = require('chalk');
var prettyMs = require('pretty-ms');
var _ = require('lodash');
var repeat = require('repeat-string');
var symbols = require('figures');

var lTrimList = require('./lib/utils/l-trim-list');

module.exports = function (spec) {

  spec = spec || {};

  var NO_PRINT = '(anonymous)';
  var INDENT = spec.padding || '  ';
  var OUTPUT_PADDING = INDENT;
  var SPLITTER = ': ';

  var output = through();
  var parser = tapOut();
  var stream = duplexer(parser, output);
  var startTime = new Date().getTime();
  var prev = [];

  output.push('\n');

  parser.on('test', function (test) {

    if (test.name !== NO_PRINT) {

      // Split test name on given delimiter
      var splits = test.name.split(SPLITTER);
      splits.forEach(function(s, i) {

        // Line-break before level-0 headings
        if (!i) {
          output.push('\n');
        }
        // New context at level-i
        indent(i);
        if (prev[i] !== s) {
          // No match beyond this level so
          // trim prev array down to size
          prev = prev.slice(0, i);
          prev[i] = s;
          output.push(pad(format.bold(s)) + '\n');
        }
        outdent(i);
      });

      prev = splits;
    }
  });

  // Passing assertions
  parser.on('pass', function (assertion) {

    var glyph = format.green(symbols.tick);
    var name = format.grey(assertion.name);

    indent(prev.length);
    output.push(pad(glyph + ' ' + name + '\n'));
    outdent(prev.length);
  });

  // Failing assertions
  parser.on('fail', function (assertion) {

    var glyph = symbols.cross;
    var title =  glyph + ' ' + assertion.name;

    indent(prev.length);
    output.push(pad(format.red(title) + '\n'));
    outdent(prev.length);

    stream.failed = true;
  });

  parser.on('comment', function (comment) {

    indent(prev.length);
    output.push(pad(format.yellow(comment.raw)) + '\n');
    outdent(prev.length);
  });

  // All done
  parser.on('output', function (results) {

    output.push('\n\n');

    // Most likely a failure upstream
    if (results.plans.length < 1) {
      process.exit(1);
    }

    output.push(formatTotals(results));
    output.push('\n\n\n');

    if (results.fail.length > 0) {
      output.push(formatErrors(results));
      output.push('\n');
    }

    // Exit if no tests run. This is a result of 1 of 2 things:
    //  1. No tests were written
    //  2. There was some error before the TAP got to the parser
    if (results.tests.length === 0) {
      process.exit(1);
    }
  });

  // Utils

  function prettifyRawError (rawError) {

    return rawError.split('\n').map(function (line) {

      return pad(line);
    }).join('\n') + '\n\n';
  }

  function formatErrors (results) {

    var failCount = results.fail.length;
    var past = (failCount === 1) ? 'was' : 'were';
    var plural = (failCount === 1) ? 'failure' : 'failures';

    var out = '\n' + pad(format.red.bold('Failed Tests:') + ' There ' + past + ' ' + format.red.bold(failCount) + ' ' + plural + '\n');
    out += formatFailedAssertions(results);

    return out;
  }

  function formatTotals (results) {

    if (results.tests.length === 0) {
      return pad(format.red(symbols.cross + ' No tests found'));
    }

    var pass = format.green(results.pass.length + ' passing');
    var fail = format.red(results.fail.length + ' failing');
    var time = format.grey('(' + prettyMs(new Date().getTime() - startTime) + ')');

    return _.filter([
      pad(pass + ' ' + time),
      results.fail.length > 0 ? pad(fail) : undefined,
    ], _.identity).join('\n');
  }

  function formatFailedAssertions (results) {

    var out = '';

    var groupedAssertions = _.groupBy(results.fail, function (assertion) {
      return assertion.test;
    });

    _.each(groupedAssertions, function (assertions, testNumber) {

      // Wrie failed assertion's test name
      var test = _.find(results.tests, {number: parseInt(testNumber)});
      indent();
      out += '\n' + pad(test.name + '\n\n');

      // Write failed assertion
      _.each(assertions, function (assertion) {

        indent();
        out += pad(format.red(symbols.cross) + ' ' + format.red(assertion.name)) + '\n';
        out += format.cyan(prettifyRawError(assertion.error.raw));
        outdent();
      });

      outdent();
      out += '\n';
    });

    return out;
  }

  function pad (str) {

    return OUTPUT_PADDING + str;
  }

  function indent (i) {

    if (typeof i === 'undefined') {
      i = 1;
    }
    OUTPUT_PADDING += new Array(i + 1).join(INDENT);
  }

  function outdent (i) {

    if (typeof i === 'undefined') {
      i = 1;
    }
    var str = new Array(i + 1).join(INDENT);
    OUTPUT_PADDING = OUTPUT_PADDING.replace(str, '');
  }

  return stream;
};
