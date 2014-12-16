"use strict";

var _ = require('lodash');

var globalConfig;

if (process.browser) {
  globalConfig = require('browserified-config');
} else {
  globalConfig = {};

  var fs = require('fs' + '');
  var nodePath = require('path' + '');
  var argv = require('minimist' + '')(process.argv.slice(2));

  var env = argv.env || process.env.NODE_ENV || 'development';

  var paths = [];
  var dirname = nodePath.dirname(require.main.filename);
  var path;
  for (var i = 1; i <= 5; i++) {
    path = nodePath.join(dirname, 'config.js');
    if (fs.existsSync(path)) paths.unshift(path);
    if (dirname === '/') break;
    dirname = nodePath.resolve(dirname, '..');
  };

  var parse = function(input) {
    var output;
    if (input == null)
      throw new Error('null or undefined value found in a config file');
    if (_.isString(input)) {
      output = parseString(input);
    } else if (_.isBoolean(input) || _.isDate(input) ||
      _.isNumber(input) || _.isRegExp(input)) {
      output = input;
    } else if (_.isFunction(input)) {
      output = input(globalConfig);
    } else if (_.isArray(input)) {
      output = [];
      input.forEach(function(value) {
        value = parse(value);
        output.push(value);
      });
    } else if (_.isObject(input)) {
      output = {};
      _.forOwn(input, function(value, key) {
        if (key.substr(0, 1) === '$') {
          if (key === '$' + env) { // same env
            value = parse(value);
            _.merge(output, value);
          }
        } else { // the key doesn't start with '$'
          value = parse(value);
          output[key] = value;
        }
      });
    } else
      throw new Error('unexpected type found in a config file');
    return output;
  };

  var parseString = function(input) {
    var output = '';
    var index;
    while (input) {
      index = input.indexOf('{{');
      if (index === -1) {
        output += input;
        input = '';
        break;
      }
      output += input.slice(0, index);
      input = input.slice(index + 2);
      index = input.indexOf('}}');
      if (index === -1)
        throw new Error("closing '}}' is missing");
      var expr = input.slice(0, index);
      input = input.slice(index + 2);
      var value = parseExpression(expr);
      if (_.isString(value)) {
        output += value;
      } else { // parseExpression returned an object
        if (input || output)
          throw new Error('cannot concatenate a string and a non string object');
        output = value;
      }
    }
    return output;
  };

  var parseExpression = function(expr) {
    var config = globalConfig;
    expr.split('.').forEach(function(key) {
      config = config[key];
    });
    return config;
  };

  paths.forEach(function(path) {
    var input = require(path);
    input = parse(input);
    _.merge(globalConfig, input);
  });

  _.merge(globalConfig, argv);

  globalConfig.env = env;
}

var create = function(localConfig) {
  var config = globalConfig;
  if (localConfig) {
    config = _.cloneDeep(globalConfig);
    _.merge(config, localConfig);
  }
  return config;
}

var get = function(path) {
  var config = create();
  if (path) {
    path.split('.').forEach(function(key) {
      config = config[key];
    });
  }
  return config;
}

var KindaConfig = {
  create: create,
  get: get
}

module.exports = KindaConfig;
