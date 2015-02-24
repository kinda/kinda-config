"use strict";

var _ = require('lodash');

var generate = function(role) {
  var config;

  if (process.browser) {
    if (window.__kindaConfigCache__) {
      return window.__kindaConfigCache__;
    }
    try {
      config = require('browserified-config' + '');
    } catch(err) {
      // console.info('config not found');
      config = {};
    }
    window.__kindaConfigCache__ = config;
    return config;
  }

  var fs = require('fs' + '');
  var nodePath = require('path' + '');
  var argv = require('minimist' + '')(process.argv.slice(2));

  if (!role) role = argv.role;

  if (!global.__kindaConfigCache__) global.__kindaConfigCache__ = {};
  if (global.__kindaConfigCache__[role]) {
    return global.__kindaConfigCache__[role];
  }

  var env = argv.env || process.env.NODE_ENV || 'development';

  config = { env: env, role: role };

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
    input = parse(config, input);
    merge(config, input);
  });

  // merge(config, argv);

  global.__kindaConfigCache__[role] = config;

  return config;
};

var create = function(localConfig) {
  var config = generate();
  if (localConfig) {
    config = _.cloneDeep(config);
    localConfig = parse(config, localConfig);
    merge(config, localConfig);
  }
  return config;
};

var createForRole = function(role) {
  return generate(role);
};

var get = function(path, defaultConfig) {
  var config = create();
  if (path) {
    path.split('.').forEach(function(key) {
      config = config[key] || {};
    });
  }
  if (defaultConfig) {
    var newConfig = parse(config, defaultConfig);
    merge(newConfig, config);
    config = newConfig;
  }
  return config;
};

var parse = function(config, input) {
  var output;
  if (input == null)
    throw new Error('null or undefined value found in a config file');
  if (_.isString(input)) {
    output = parseString(config, input);
  } else if (_.isBoolean(input) || _.isDate(input) ||
    _.isNumber(input) || _.isRegExp(input)) {
    output = input;
  } else if (_.isFunction(input)) {
    output = input(config);
  } else if (_.isArray(input)) {
    output = parseArray(config, input);
  } else if (_.isObject(input)) {
    output = parseObject(config, input);
  } else
    throw new Error('unexpected type found in a config file');
  return output;
};

var parseString = function(config, input) {
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
    var value = parseExpression(config, expr);
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

var parseArray = function(config, input) {
  var output = [];
  input.forEach(function(value) {
    value = parse(config, value);
    output.push(value);
  });
  return output;
};

var parseObject = function(config, input) {
  var output = {};
  _.forOwn(input, function(value, key) {
    var expected = true;
    if (key.substr(0, 1) === '!') {
      key = key.substr(1);
      expected = false;
    }
    if (key.substr(0, 1) === '$') {
      var result = false;
      var condition = key.substr(1);
      if (
        condition === 'development' ||
        condition === 'test' ||
        condition === 'production'
      ) {
        if ((config.env === condition) === expected) {
          result = true;
        }
      } else if (condition === 'client' || condition === 'server') {
        if ((config.role === condition) === expected) {
          result = true;
        }
      } else throw new Error('invalid condition (' + condition + ')');
      if (result) {
        value = parse(config, value);
        merge(output, value);
      }
    } else { // the key doesn't start with '$'
      value = parse(config, value);
      output[key] = value;
    }
  });
  return output;
};

var parseExpression = function(config, expr) {
  var result = config;
  expr.split('.').forEach(function(key) {
    result = result[key];
  });
  return result;
};

var merge = function(object, source) {
  return _.merge(object, source, function(a, b) { // don't merge arrays
    return _.isArray(a) || _.isArray(b) ? b : undefined;
  });
};

var KindaConfig = {
  create: create,
  createForRole: createForRole,
  get: get
}

module.exports = KindaConfig;
