var lib = require('../');
var DevtoolsTelemetry = lib.DevtoolsTelemetry;
var assert = require('assert');
var _ = require('lodash');

describe('Devtools telemetry basics', function() {
  var dd;

  before(function(done) {
    dd = new DevtoolsTelemetry();
    dd.init(function() {
      done();
    });
  });

  it('tests initialization', function() {
    assert.equal(dd.Toolmap.Toolbox.flag, 'DEVTOOLS_TOOLBOX_OPENED_PER_USER_FLAG');
    assert.equal(dd.Toolnames[0], 'Toolbox');
  });

  it('gets version range', function(done) {
    dd.getVersionRange(function(err, result) {
      if (err) throw err;
      // assert.equal( typeof result, 'object');
      assert.equal(_.isArray(result), true);
      done();
    });
  });

  it('tests generateBuildWindows', function() {
    var windows = dd.generateBuildWindows(36, 41);
    assert.equal(typeof windows, 'object');
  });

  it('tests getWeeklyToolUsage', function(done) {
    var windows = dd.generateBuildWindows(40, 41);
    dd.getWeeklyToolUsage(windows, 'Toolbox', function(result) {
      // assert.equal(_.isArray(result), true);
      var keys = _.keys(result);
      assert.equal(keys.length, 3);
      assert.equal(keys[0], 'More than 5 minutes.');
      done();
    })
  });

  it('tests getWeeklyChannelUsage', function(done) {
    var windows = dd.generateBuildWindows(40, 41);
    dd.getWeeklyChannelUsage(windows, 'Toolbox', function(result) {
      var keys = _.keys(result);
      assert.equal(keys[0], 'nightly');
      assert.equal(keys[1], 'aurora');

      var _dataKeys = _.keys(result.nightly[0]);
      assert.equal(_dataKeys[0], 'count');
      assert.equal(_dataKeys[1], 'week');
      assert.equal(_dataKeys[2], '_intWeek');
      done();
    });
  });
});
