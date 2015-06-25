# node-devtools-telemetry

A node module that produces some summarization data about devtools usage from [Firefox telemetry](https://telemetry.mozilla.org). This utility is a bit odd, because it wraps Telemetry.js it needs to instantiate asynchronously.

## Example

      var DevtoolsTelemetry = require('').DevtoolsTelemetry;
      var dd = new DevtoolsTelemetry();
      dd.init(function() {
        var windows = dd.generateBuildWindows(40, 41);
        dd.getWeeklyToolUsage(windows, 'Toolbox', (result) => {
          debugger;
          console.log("result>", result);
        });
      });

