#!/usr/bin/env node

var tapSpec = require('../');
var args = process.argv;
var config = {};

args.forEach(function(val, index, array) {
  var opt = String(val).split('--');
  if (opt.length === 2) {
    opt = opt[1].split('=');
    if (opt.length === 2) {
      var k = opt[0];
      var v = opt[1] === 'true' ?
        true : opt[1] === 'false' ?
        false :
        opt[1]
      ;
      if (!isNaN(parseInt(v))) {
        v = parseInt(v);
      }
      config[k] = v;
    }
  }
});

tapSpec = tapSpec(config);

process.stdin
  .pipe(tapSpec)
  .pipe(process.stdout);

process.on('exit', function (status) {

  if (status === 1) {
    process.exit(1);
  }

  if (tapSpec.failed) {
    process.exit(1);
  }
});
