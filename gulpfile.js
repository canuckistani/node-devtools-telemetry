// npm install --save-dev gulp gulp-babel browserify babelify vinyl-source-stream

var fs = require("fs");
var gulp = require("gulp");
var babel = require("gulp-babel");
var browserify = require("browserify");
var babelify = require("babelify");
var source = require("vinyl-source-stream");

// metadata
var pkgInfo = require('./package.json');

gulp.task("browser", function() {
  browserify({
    debug: true
  })
  .transform(babelify)
  .require('./src/index.js', { entry: true })
  .bundle()
  .on("error", function (err) { console.log("Error: " + err.message); })
  .pipe(source('bundle.js'))
  .pipe(gulp.dest('./browser/'));
});

gulp.task("node", function () {
  return gulp.src(['./src/index.js'])
    .pipe(babel())
    .pipe(gulp.dest("./"));
});

gulp.task("watch", function() {
  return gulp.watch('./src/*.js', ['default']);
});

gulp.task("default", ["browser", "node"], function() {

  console.log("done.");
});