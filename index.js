'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var Telemetry = require('telemetry-js-node'),
    _ = require('lodash'),
    async = require('async');

var moment = require('moment');
require('moment-range');

// utilities
function formatDate(d) {
  return d.getMonth() + 1 + '/' + d.getDate() + '/' + (d.getYear() + 1900);
}

/*
* Questions I would want to ask of telemetry:
*   opening of the toolbox over time in a given channel, eg join channels in a series
*   compare data from beta vs release vs aurora vs nightly for a specific measure
*/

var DevtoolsTelemetry = (function () {
  function DevtoolsTelemetry() {
    _classCallCheck(this, DevtoolsTelemetry);

    this.telemetryInstance = Telemetry;
    this.DevtoolsMeasures = {};
    this.DevtoolsModel = {};
    this.versions = false;
    this.map = { devtools: {} };
  }

  _createClass(DevtoolsTelemetry, [{
    key: 'init',
    value: function init(callback) {
      var _this = this;

      var that = this;
      this.telemetryInstance.init(function () {
        _this.versions = _this.telemetryInstance.versions();
        callback(true);
      });
    }
  }, {
    key: 'getProbes',
    value: function getProbes(version, callback) {
      var _this2 = this;

      var devtools_measures = [];
      this.telemetryInstance.measures(version, function (measures) {
        var probe_names = Object.keys(measures);
        var devtools_keys = probe_names.filter(function (name) {
          return name.indexOf('DEVTOOLS_') !== -1;
        });
        var out = {};
        devtools_keys.forEach(function (key) {
          out[key] = measures[key];
        });
        _this2.DevtoolsMeasures = out;
        callback(out);
      });
    }
  }, {
    key: 'generateModel',

    // generate a model of the tools measures
    value: function generateModel(version, callback) {
      var _this3 = this;

      this.telemetryInstance.measures(version, function (measures) {
        var probe_names = Object.keys(measures);

        var devtools_keys = probe_names.filter(function (name) {
          return name.indexOf('DEVTOOLS_') !== -1;
        });

        var _measures = {};
        _.each(devtools_keys, function (key) {
          _measures[key] = measures[key];

          var parts = key.split('_', 2);var tool = parts[1].toLoweCase();
          if (!_this3.map.devtools[tool]) {
            _this3.map.devtools[tool] = [];
          }
          measure.name = name;
          _this3.map.devtools[tool].push(measure);
        });
        callback(_this3.map);
      });
    }
  }, {
    key: 'getMeasuresByChannel',
    value: function getMeasuresByChannel(measureName, channel, versions, callback) {
      var _this4 = this;

      var length = versions.length,
          results = [],
          count = 0;
      _.each(versions, function (item) {
        var target = channel + '/' + item;

        _this4.telemetryInstance.loadEvolutionOverBuilds(target, measureName, function (histogram) {
          count++;
          results.push(histogram);
          if (count === length) {
            callback(result);
          }
        });
      });
    }
  }, {
    key: 'getUsageGraph',
    value: function getUsageGraph(version, name, callback) {
      this.telemetryInstance.loadEvolutionOverBuilds(version, name, function (evolution) {
        var results = {
          yes: 0,
          no: 0,
          total: 0
        };
        var _i = 0;
        evolution.each(function (date, histogram, index) {
          _i++;

          histogram.each(function (count, start, end, index) {
            if (index === 0) {
              results.no += count;
              results.total += count;
            } else if (index === 1) {
              results.yes += count;
              results.total += count;
            }
          });
        });
        callback(null, results);
      });
    }
  }, {
    key: 'isInRange',
    value: function isInRange(range, start, end) {
      if (start >= range.start && end <= range.end) {
        return true;
      }
      return false;
    }
  }, {
    key: 'getBucketsForTool',
    value: function getBucketsForTool(measure, version, ranges, callback) {
      var results = _.map(_.range(ranges.length), function () {
        return 0;
      });
      var subs = 0;
      this.telemetryInstance.loadEvolutionOverBuilds(version, measure, function (evolution) {
        var result = {};
        evolution.each(function (date, histogram, index) {
          subs += histogram.submissions();
          histogram.each(function (count, start, end, index) {
            _.each(ranges, function (range, i) {
              if (isInRange(range, start, end)) {
                results[i] += count;
              }
            });
          });
        });
        callback({ results: results, submissions: subs });
      });
    }
  }, {
    key: 'getVersionRange',
    value: function getVersionRange(callback) {
      var telemetryVersions = _.compact(_.unique(_.map(this.versions, function (v) {
        var _v = parseInt(v.split('/').pop(), 10);
        if (/^[\d]+$/.test(_v) && _v >= 24) {
          return _v;
        }
      }))).sort();

      getCurrentVersions(function (err, versions) {
        if (err) throw err;
        var intNightly = parseInt(versions.nightly);
        var filtered = _.filter(telemetryVersions, function (v) {
          return v <= intNightly;
        });
        callback(null, filtered);
      });
    }
  }, {
    key: 'getDailyToolUsage',
    value: function getDailyToolUsage(windows, toolName, callback) {
      var collected = {};
      // in this case 'window' is an array with telemetry-friendly version strings eg aurora/29
      // loop through the windows
      var functions = _.map(windows, function (win) {
        var outer = _.map(win, function (version, channel) {
          var measures = this.Toolmap[toolName];
          var inner = _.map(measures, function (m) {
            return function (callback) {
              this.telemetryInstance.loadEvolutionOverTime(version, m, function (evolution) {
                var mapped = evolution.map(function (date, histogram, index) {
                  var _strDate = formatDate(date);
                  return histogram.map(function (count, start, end, index) {
                    // console.log(_strDate);
                    return {
                      strDate: _strDate,
                      count: count,
                      start: start,
                      end: end,
                      index: index,
                      date: date,
                      measure: m
                    };
                  });
                });
                // console.log(mapped);
                callback(null, mapped);
              });
            };
          });
          return inner;
        });
        return outer;
      });

      functions = _.flatten(functions);

      async.parallel(functions, function (err, results) {
        if (err) throw err;

        var flat_results = _.flatten(results);
        var dateGroups = {};
        var tplObject = _.object(_.pluck(ranges, 'desc'), [0, 0]);
        _.each(ranges, function (r) {
          _.each(flat_results, function (result) {
            if (isInRange(r, result.start, result.end) && result.count > 0) {
              if (!dateGroups[result.strDate]) {
                dateGroups[result.strDate] = _.object(_.pluck(ranges, 'desc'), [0, 0]);
                dateGroups[result.strDate].strDate = result.strDate;
                dateGroups[result.strDate].timestamp = moment(result.strDate, 'MM/DD/YYYY').unix();
              }
              dateGroups[result.strDate][r.desc] += result.count;
            }
          });
        });

        dateGroups = _.sortBy(dateGroups, 'timestamp');

        callback(dateGroups);
      });
    }
  }, {
    key: '_getFunctionsFromWindows',
    value: function _getFunctionsFromWindows(windows, toolName) {
      var that = this;
      var functions = _.map(windows, function (win) {
        var outer = _.map(win, function (version, channel) {
          var measures = that.Toolmap[toolName];
          var inner = _.map(measures, function (m) {
            return function (callback) {
              that.telemetryInstance.loadEvolutionOverTime(version, m, function (evolution) {
                var mapped = evolution.map(function (date, histogram, index) {
                  var _strDate = formatDate(date);
                  return histogram.map(function (count, start, end, index) {
                    return {
                      strDate: _strDate,
                      count: count,
                      start: start,
                      end: end,
                      index: index,
                      date: date,
                      measure: m,
                      channel: channel
                    };
                  });
                });
                callback(null, mapped);
              });
            };
          });
          return inner;
        });
        return outer;
      });
      var flat = _.flattenDeep(functions);
      return flat;
    }
  }, {
    key: 'getWeeklyToolUsage',
    value: function getWeeklyToolUsage(windows, toolName, callback) {
      var collected = {};
      // in this case 'window' is an array with telemetry-friendly version strings eg aurora/29
      // loop through the windows
      var functions = this._getFunctionsFromWindows(windows, toolName);

      async.parallel(functions, function (err, results) {
        if (err) throw err;

        var flat_results = _.flattenDeep(results);
        var dateGroups = {};
        _.each(flat_results, function (result) {
          if (!dateGroups[result.strDate]) {
            dateGroups[result.strDate] = [];
          }
          dateGroups[result.strDate].push(result);
        });

        var graph = {};
        // console.log();
        var tplObject = _.object(_.pluck(ranges, 'desc'), [{}, {}]);
        var mapped = {};

        _.each(dateGroups, function (counts) {
          var _m = moment(counts[0].date);
          var _year = _m.year();
          var _weeks = _m.weeks();

          var strWeek = _m.clone().startOf('week').format('MM/DD/YYYY');

          if (!dateGroups['strWeek']) {
            dateGroups['strWeek'] = tplObject;
          }

          _.each(ranges, function (r) {
            _.each(counts, function (count) {
              if (isInRange(r, count.start, count.end)) {
                var desc = r.desc;
                if (!mapped[desc]) {
                  mapped[desc] = {};
                }

                if (!mapped[desc][strWeek]) {
                  mapped[desc][strWeek] = {
                    count: count.count,
                    week: strWeek,
                    _intWeek: _weeks
                  };
                } else {
                  mapped[desc][strWeek].count += count.count;
                }
              }
            });
          });
        });
        var sorted = {};
        _.each(mapped, function (weeks, key) {
          var _sorted = _.sortBy(weeks, function (week, strDate) {
            return moment(strDate, 'MM/DD/YYYY').unix();
          });
          // we never want the current week.
          _sorted = _.initial(_sorted);
          sorted[key] = _sorted;
        });
        callback(sorted);
      });
    }
  }, {
    key: 'getWeeklyChannelUsage',
    value: function getWeeklyChannelUsage(windows, toolName, callback) {
      var functions = this._getFunctionsFromWindows(windows, toolName);

      async.parallel(functions, function (err, results) {
        if (err) throw err;

        var flat_results = _.flattenDeep(results);
        var dateGroups = {};
        _.each(flat_results, function (result) {
          if (!dateGroups[result.strDate]) {
            dateGroups[result.strDate] = [];
          }
          dateGroups[result.strDate].push(result);
        });

        var graph = {};
        // console.log();
        var tplObject = _.object(['beta', 'aurora', 'nightly'], [{}, {}, {}]);
        var mapped = {};

        // console.log(dateGroups);
        // callback(dateGroups);

        _.each(dateGroups, function (counts, date) {
          var _m = moment(counts[0].date);
          var _year = _m.year();
          var _weeks = _m.weeks();
          var strWeek = _m.clone().startOf('week').format('MM/DD/YYYY');

          if (!dateGroups['strWeek']) {
            dateGroups['strWeek'] = tplObject;
          }

          var overFiveRange = ranges[0];

          _.each(counts, function (count) {
            if (isInRange(overFiveRange, count.start, count.end)) {
              if (!mapped[count.channel]) {
                mapped[count.channel] = {};
              }

              if (!mapped[count.channel][strWeek]) {
                mapped[count.channel][strWeek] = {
                  count: count.count,
                  week: strWeek,
                  _intWeek: _weeks
                };
              } else {
                mapped[count.channel][strWeek].count += count.count;
              }
            }
          });
        });

        var sorted = {};
        _.each(mapped, function (weeks, key) {
          var _sorted = _.sortBy(weeks, function (week, strDate) {
            return moment(strDate, 'MM/DD/YYYY').unix();
          });
          // we never want the current week.
          _sorted = _.initial(_sorted);
          sorted[key] = _sorted;
        });
        callback(sorted);
      });
    }
  }, {
    key: 'fetchChannel',
    value: function fetchChannel(targetVersion, channel, finish) {
      var totals = [];
      var _i = 0,
          limit = _.size(tools);
      _.each(tools, function (tool, label) {
        var _version = channel + '/' + targetVersion;
        this.getUsageGraph(_version, tool, function (err, result) {
          if (err) throw err;
          _i++;
          var _r = {
            // tool: tool,
            label: label,
            yes: result.yes,
            no: result.no,
            total: result.total,
            version: targetVersion
          };
          totals.push(_r);
          if (_i === limit) {
            finish(_.sortBy(totals, 'yes').reverse());
          }
        });
      });
    }
  }, {
    key: 'generateBuildWindows',
    value: function generateBuildWindows(startNightly, endNightly) {
      var diff = endNightly - startNightly + 1;
      var versions = _.map(_.range(diff), function (i) {
        var n = startNightly + i,
            a = n - 1,
            b = n - 2,
            r = n - 3;
        var out = { nightly: 'nightly/' + n };
        if (b >= startNightly) {
          out.beta = 'beta/' + b;
        }
        if (a >= startNightly) {
          out.aurora = 'aurora/' + a;
        }
        if (r >= startNightly) {
          out['release'] = 'release/' + r;
        }
        return out;
      });
      return versions;
    }
  }, {
    key: 'Toolmap',
    get: function get() {
      return {
        'Toolbox': {
          'flag': 'DEVTOOLS_TOOLBOX_OPENED_PER_USER_FLAG',
          'time': 'DEVTOOLS_TOOLBOX_TIME_ACTIVE_SECONDS',
          'bool': 'DEVTOOLS_TOOLBOX_OPENED_BOOLEAN'
        },
        'Inspector': {
          'flag': 'DEVTOOLS_INSPECTOR_OPENED_PER_USER_FLAG',
          'time': 'DEVTOOLS_INSPECTOR_TIME_ACTIVE_SECONDS',
          'bool': 'DEVTOOLS_INSPECTOR_OPENED_BOOLEAN'
        },
        'Web Console': {
          'flag': 'DEVTOOLS_WEBCONSOLE_OPENED_PER_USER_FLAG',
          'time': 'DEVTOOLS_WEBCONSOLE_TIME_ACTIVE_SECONDS',
          'bool': 'DEVTOOLS_WEBCONSOLE_OPENED_BOOLEAN'
        },
        'Net Monitor': {
          'flag': 'DEVTOOLS_NETMONITOR_OPENED_PER_USER_FLAG',
          'time': 'DEVTOOLS_NETMONITOR_TIME_ACTIVE_SECONDS',
          'bool': 'DEVTOOLS_NETMONITOR_OPENED_BOOLEAN'
        },
        'Responsive Design': {
          'flag': 'DEVTOOLS_RESPONSIVE_OPENED_PER_USER_FLAG',
          'time': 'DEVTOOLS_RESPONSIVE_TIME_ACTIVE_SECONDS',
          'bool': 'DEVTOOLS_RESPONSIVE_OPENED_BOOLEAN'
        },
        'Style Editor': {
          'flag': 'DEVTOOLS_STYLEEDITOR_OPENED_PER_USER_FLAG',
          'time': 'DEVTOOLS_STYLEEDITOR_TIME_ACTIVE_SECONDS',
          'bool': 'DEVTOOLS_STYLEEDITOR_OPENED_BOOLEAN'
        },
        'Debugger': {
          'flag': 'DEVTOOLS_JSDEBUGGER_OPENED_PER_USER_FLAG',
          'time': 'DEVTOOLS_JSDEBUGGER_TIME_ACTIVE_SECONDS',
          'bool': 'DEVTOOLS_JSDEBUGGER_OPENED_BOOLEAN'
        },
        'Tilt': {
          'flag': 'DEVTOOLS_TILT_OPENED_PER_USER_FLAG',
          'time': 'DEVTOOLS_TILT_TIME_ACTIVE_SECONDS',
          'bool': 'DEVTOOLS_TILT_OPENED_BOOLEAN'
        },
        'Profiler': {
          'flag': 'DEVTOOLS_JSPROFILER_OPENED_PER_USER_FLAG',
          'time': 'DEVTOOLS_JSPROFILER_TIME_ACTIVE_SECONDS',
          'bool': 'DEVTOOLS_JSPROFILER_OPENED_BOOLEAN'
        },
        'Paint Flashing': {
          'flag': 'DEVTOOLS_PAINTFLASHING_OPENED_PER_USER_FLAG',
          'time': 'DEVTOOLS_PAINTFLASHING_TIME_ACTIVE_SECONDS',
          'bool': 'DEVTOOLS_PAINTFLASHING_OPENED_BOOLEAN'
        },
        'Scratchpad': {
          'flag': 'DEVTOOLS_SCRATCHPAD_OPENED_PER_USER_FLAG',
          'time': 'DEVTOOLS_SCRATCHPAD_TIME_ACTIVE_SECONDS',
          'bool': 'DEVTOOLS_SCRATCHPAD_OPENED_BOOLEAN'
        },
        'WebIDE': {
          'flag': 'DEVTOOLS_WEBIDE_OPENED_PER_USER_FLAG',
          'time': 'DEVTOOLS_WEBIDE_TIME_ACTIVE_SECONDS',
          'bool': 'DEVTOOLS_WEBIDE_OPENED_BOOLEAN'
        }
      };
    }
  }, {
    key: 'Toolnames',
    get: function get() {
      return _.keys(this.Toolmap);
    }
  }]);

  return DevtoolsTelemetry;
})();

;

function getCurrentVersions(callback) {
  // console.log($.getJSON);

  var data = {
    'firefox': '38.0.5',
    'beta': '39.0b6',
    'aurora': '40.0a2',
    'nightly': '41.0a1'
  };

  callback(null, data);

  // $.getJSON('http://fxver.paas.canuckistani.ca/', function(result) {
  //   callback(null, result);
  // });
}

function isInRange(range, start, end) {
  if (start >= range.start && end <= range.end) {
    return true;
  }
  return false;
}

var ranges = [{
  start: 300,
  end: Infinity,
  desc: 'More than 5 minutes.'
}, {
  start: 1800,
  end: Infinity,
  desc: 'More than 30 minutes'
}, {
  start: 30,
  end: Infinity,
  desc: 'More than 30 seconds.'
}];

exports.DevtoolsTelemetry = DevtoolsTelemetry;

if (!module.parent) {
  // this is the main module
  var dd = new DevtoolsTelemetry();
  dd.init(function () {
    var windows = dd.generateBuildWindows(40, 41);
    dd.getWeeklyChannelUsage(windows, 'Toolbox', function (result) {
      debugger;
      console.log('result>', result);
    });
  });
}