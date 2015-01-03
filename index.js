"use strict";

var _ = require('lodash');

var globalConfig, env;

var init = function() {
  if (process.browser) {
    globalConfig = require('browserified-config');
    env = globalConfig.env;
    return;
  }

  globalConfig = {};

  var fs = require('fs' + '');
  var nodePath = require('path' + '');
  var argv = require('minimist' + '')(process.argv.slice(2));

  globalConfig.env = env = argv.env || process.env.NODE_ENV || 'development';

  var paths = [];
  var dirname = nodePath.dirname(require.main.filename);
  var path;
  for (var i = 1; i <= 5; i++) {
    path = nodePath.join(dirname, 'config.js');
    if (fs.existsSync(path)) paths.unshift(path);
    if (dirname === '/') break;
    dirname = nodePath.resolve(dirname, '..');
  };

  paths.forEach(function(path) {
    var input = require(path);
    input = parse(input);
    merge(globalConfig, input);
  });

  merge(globalConfig, argv);
};

var create = function(localConfig) {
  init();
  var config = globalConfig;
  if (localConfig) {
    config = _.cloneDeep(config);
    localConfig = parse(localConfig);
    merge(config, localConfig);
  }
  return config;
};

var get = function(path, defaultConfig) {
  var config = create();
  if (path) {
    path.split('.').forEach(function(key) {
      config = config[key] || {};
    });
  }
  if (defaultConfig) {
    var newConfig = parse(defaultConfig);
    merge(newConfig, config);
    config = newConfig;
  }
  return config;
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
          merge(output, value);
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

var merge = function(object, source) {
  return _.merge(object, source, function(a, b) { // don't merge arrays
    return _.isArray(a) || _.isArray(b) ? b : undefined;
  });
};

var KindaConfig = {
  create: create,
  get: get
}

module.exports = KindaConfig;
