'use strict';

var gulp = require('gulp');
var browserify = require('browserify');
var watchify = require('watchify');
var babel = require('babelify');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var uglify = require('gulp-uglify');
var compass = require('gulp-compass');
var autoprefixer = require('gulp-autoprefixer');
var notify = require('gulp-notify');
var concat = require('gulp-concat');

var paths = {
   SCRIPT_IN: './javascript/',
   SCRIPT_MAIN: 'init.js',
   SCRIPT_OUT: './assets/js/',
   STYLES_IN: './sass/*.scss',
   STYLES_OUT: './assets/css/',
   LIBS_IN: [
      'node_modules/jquery/dist/jquery.min.js',
      'node_modules/underscore/underscore-min.js',
      'node_modules/backbone/backbone-min.js'
   ],
   LIBS_OUT: 'libs.js'
};


// MAIN TASKS

gulp.task('default', ['watch-scripts', 'watch-styles']);
gulp.task('build', ['build-scripts', 'build-libs', 'build-styles']);
gulp.task('libs', ['build-libs']);


// OTHER TASKS

gulp.task('build-scripts', function() {
   var options = {
      entries: [paths.SCRIPT_IN + paths.SCRIPT_MAIN],
      paths: [paths.SCRIPT_IN]
   };

   var bundler = browserify(options).transform(babel);
   bundler.on('error', handleErrors);

   return bundler.bundle()
      .on('error', handleErrors)
      .pipe(source('script.js'))
      .pipe(buffer())
      .pipe(uglify())
      .pipe(gulp.dest(paths.SCRIPT_OUT));
});


gulp.task('watch-scripts', function() {
   gulp.start('build-libs');

   var options = {
      entries: [paths.SCRIPT_IN + paths.SCRIPT_MAIN],
      paths: [paths.SCRIPT_IN],
      insertGlobals: true,
      debug: true
   };

   var bundler = watchify(browserify(options).transform(babel));
   bundler.on('update', rebundle);
   bundler.on('error', handleErrors);

   function rebundle() {
      return bundler.bundle()
         .on('error', handleErrors)
         .pipe(source('script.js'))
         .pipe(gulp.dest(paths.SCRIPT_OUT))
         .pipe(notify('Compiled <%= file.relative %>'));
   }

   return rebundle();
});


gulp.task('watch-styles', function() {
   gulp.watch(paths.STYLES_IN, ['build-styles']);
});


gulp.task('build-styles', function() {
   gulp.src(paths.STYLES_IN)
      .on('error', handleErrors)
      .pipe(
         compass({
            css: 'assets/css',
            style: 'compact',
            comments: false,
            sourcemap: false
         })
         .on('error', handleErrors)
      )
      .pipe(autoprefixer('last 1 version'))
      .pipe(gulp.dest(paths.STYLES_OUT))
      .pipe(notify('Compiled <%= file.relative %>'));
});


gulp.task('build-libs', function() {
   return gulp.src(paths.LIBS_IN)
      .pipe(concat(paths.LIBS_OUT))
      .pipe(gulp.dest(paths.SCRIPT_OUT))
      .pipe(notify('Compiled <%= file.relative %>'));
});


// HELPER

function handleErrors() {
   var args = Array.prototype.slice.call(arguments);
   // Send error to notification center with gulp-notify
   notify.onError({
      title: 'Compile Error',
      message: '<%= error.message %>'
   }).apply(this, args);
   // Keep gulp from hanging on this task
   this.emit('end');
}
