(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
/*eslint key-spacing:0 no-multi-spaces:0*/
'use strict';

Object.defineProperty(exports, '__esModule', {
   value: true
});

var _modelsXnatModel = require('models/XnatModel');

exports['default'] = function (host) {

   var templates = {};
   templates.project = host + '/REST/projects/<%= project %>';
   templates.subject = templates.project + '/subjects/<%= subject %>';
   templates.session = templates.subject + '/experiments/<%= session %>';
   templates.scan = templates.session + '/scans/<%= scan %>';
   templates.resource = templates.scan + '/resources/<%= resource %>';

   templates.create = {
      subject: templates.subject + '?group=<%= diagnose %>&src=<%= investigator %>',
      session: templates.session + '?snet01:SleepResearchSessionData/date=<%= date %>',
      scan: templates.scan + '?xsiType=snet01:psgScanData',
      resource: templates.resource + '?format=<%= format %>',
      file: templates.resource + '/files/<%= name %>_<%= timestamp %>.edf'
   };

   var projects;
   var timestamp = ~ ~(Date.now() / 1000);

   // see https://wiki.xnat.org/pages/viewpage.action?pageId=6226264
   // GET instead of POST because … yeah … otherwise it doesn't work
   var login = function login(username, password, success, fail) {
      $.ajax({
         url: host + '/data/JSESSION',
         type: 'GET',
         beforeSend: function beforeSend(xhr) {
            xhr.setRequestHeader('Authorization', 'Basic ' + btoa(username + ':' + password));
         }
      }).done(success).fail(fail);
   };

   var fetchProjects = function fetchProjects(options) {
      if (!projects) {
         projects = new _modelsXnatModel.Collection({ host: host, url: host + '/REST/projects' });
      }
      return projects.fetch(options);
   };

   var getProjects = function getProjects(options) {
      return projects || fetchProjects(options);
   };

   var fetch = function fetch(name, data, options) {
      console.log('XnatAPI - fetch', name, data, options);

      var template = _.template(templates[name])(data);

      var collection = new _modelsXnatModel.Collection({ host: host, url: template });

      collection.fetch(options);

      return collection;
   };

   // ----------------------------------------------------

   var createSubject = function createSubject(name, model, callback) {
      console.log('createSubject', name, 'in project', model.get('projectid'));

      var data = {
         project: model.get('projectid'),
         subject: encodeURI(name),
         diagnose: encodeURI(model.get('diagnose')),
         investigator: encodeURI(model.get('investigator'))
      };

      $.ajax({
         url: _.template(templates.create.subject)(data),
         type: 'PUT'
      }).done(function (subjectid) {
         console.log('subject_created', subjectid);
         app.vent.trigger('XNAT:subject_created', subjectid);
         callback(subjectid);
      }).fail(function (error) {
         console.log('subject_failed', error);
      });
   };

   var createSession = function createSession(name, model, callback) {
      var date = new Date();
      var day = (date.getDate() < 10 ? '0' : '') + date.getDate();
      var month = (date.getMonth() < 9 ? '0' : '') + (date.getMonth() + 1);
      var year = date.getYear() - 100;
      // Format dd/mm/yy, e.g. 01/01/14
      date = day + '/' + month + '/' + year;

      var data = {
         project: model.get('projectid'),
         subject: model.get('subjectid'),
         session: name + '_' + timestamp,
         date: date
      };

      $.ajax({
         url: _.template(templates.create.session)(data),
         type: 'PUT'
      }).done(function (sessionid) {
         console.log('session_created', sessionid);
         app.vent.trigger('XNAT:session_created', sessionid);
         callback(sessionid);
      }).fail(function (error) {
         console.log('session_failed', error);
      });
   };

   var createScan = function createScan(name, model, callback) {
      var data = {
         project: model.get('projectid'),
         subject: model.get('subjectid'),
         session: model.get('sessionid'),
         scan: name
      };

      $.ajax({
         url: _.template(templates.create.scan)(data),
         type: 'PUT'
      }).done(function () {
         console.log('scan_created', name);
         app.vent.trigger('XNAT:scan_created', name);
         callback(name);
      }).fail(function (error) {
         console.log('scan_failed', error);
      });
   };

   var createResource = function createResource(name, model, callback) {
      var data = {
         project: model.get('projectid'),
         subject: model.get('subjectid'),
         session: model.get('sessionid'),
         scan: model.get('scanid'),
         resource: name,
         format: 'EDF'
      };

      $.ajax({
         url: _.template(templates.create.resource)(data),
         type: 'PUT'
      }).done(function () {
         console.log('resource_created');
         app.vent.trigger('XNAT:resource_created', name);
         callback(name);
      }).fail(function (error) {
         console.log('resource_failed', error);
      });
   };

   //TODO
   var upload = function upload(model, progress, callback) {

      var file = model.get('content');

      if (file instanceof Int8Array) {
         file = new Blob([file], { type: model.get('type') });
      }
      if (file instanceof Blob) {
         var formdata = new FormData();
         formdata.append('file', file, model.get('name'));
         file = formdata;
      }

      var data = {
         project: model.get('projectid'),
         subject: model.get('subjectid'),
         session: model.get('sessionid'),
         scan: model.get('scanid'),
         resource: model.get('resourceid'),
         name: model.get('name'),
         timestamp: timestamp
      };

      $.ajax({
         url: _.template(templates.create.file)(data),
         type: 'PUT',
         data: file,
         processData: false,
         contentType: false,
         progressUpload: function progressUpload(event) {
            if (event.lengthComputable) {
               progress.update(event.loaded / event.total * 100);
            }
         }
      }).done(function () {
         console.log('Upload completed.', data);
         app.vent.trigger('XNAT:file_uploaded', model.get('name'));
         callback();
      }).fail(function () {
         console.log('upload failed', model.get('name'));
      });
   };

   var startPipeline = function startPipeline(model, callback) {
      var template = function template(data) {
         return ('param[0].name=scanids\n            &param[0][0].value=' + data.pseudonym + '\n            &param[0].name.rowcount=1\n            &param[1].name=project\n            &param[1][0].value=' + data.projectid + '\n            &param[1].name.rowcount=1\n            &param[2].name=subject\n            &param[2][0].value=' + data.subjectid + '\n            &param[2].name.rowcount=1\n            &param[3].name=xnat_id\n            &param[3][0].value=' + data.sessionid + '\n            &param[3].name.rowcount=1\n            &param[4].name=sessionId\n            &param[4][0].value=' + data.name + '\n            &param[4].name.rowcount=1\n            &param[5].name=notify\n            &param[5][0].value=0\n            &param[5].name.rowcount=1\n            &eventSubmit_doLaunchpipeline=Submit\n            &schema_type=snet01%3AsleepResearchSessionData\n            &param_cnt=6\n            &pipeline_path=%2Fopt%2Fxnat%2Fpipeline%2Fcatalog%2Fsomnonetz_pipelines%2FedfMetadataExtractor.xml\n            &search_element=snet01%3AsleepResearchSessionData\n            &search_field=snet01%3AsleepResearchSessionData.ID\n            &search_value=' + data.sessionid + '\n            &project=somnonetz').replace(/\s/g, '');
      };

      $.ajax({
         url: host + '/app/action/ManagePipeline',
         type: 'POST',
         data: decodeURI(template(model.attributes))
      }).done(function () {
         console.log('Pipeline started.');
         app.vent.trigger('XNAT:pipeline_started', model.get('name'));
         callback();
      }).fail(function () {
         console.log('upload failed', model.get('name'));
      });
   };

   // Interface
   return {
      login: login,
      getProjects: getProjects,
      fetch: fetch,
      createSubject: createSubject,
      createSession: createSession,
      createScan: createScan,
      createResource: createResource,
      upload: upload,
      startPipeline: startPipeline
   };
};

module.exports = exports['default'];
/*data*/ /*data*/

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/javascript/XnatAPI.js","/javascript")

},{"_process":25,"buffer":21,"models/XnatModel":6}],2:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

Object.defineProperty(exports, '__esModule', {
   value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _transformersEDF = require('transformers/EDF');

var _transformersEDF2 = _interopRequireDefault(_transformersEDF);

var _transformersXML = require('transformers/XML');

var _transformersXML2 = _interopRequireDefault(_transformersXML);

exports['default'] = {

   XNAT_URL: 'https://xnat.f4.htw-berlin.de/xnat',

   defaultUser: 'somnonetz',

   users: {
      somnonetz: {
         username: 'sncommon',
         password: 'GlasIT-sec02LEGO',
         project: 'somnonetz'
      },
      unknown: {
         username: 'unknown',
         password: 'password',
         project: 'project'
      }
   },

   transformers: [{
      name: 'EDF',
      description: 'European Data Format',
      extensions: ['edf', 'rml'],
      mixin: _transformersEDF2['default']
   }, {
      name: 'XML',
      description: 'Extensible Markup Language',
      extensions: ['xml'],
      mixin: _transformersXML2['default']
   }]

};
module.exports = exports['default'];

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/javascript/config.js","/javascript")

},{"_process":25,"buffer":21,"transformers/EDF":7,"transformers/XML":8}],3:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _viewsFileReaderView = require('views/FileReaderView');

var _viewsFileReaderView2 = _interopRequireDefault(_viewsFileReaderView);

var _viewsUploaderView = require('views/UploaderView');

var _viewsUploaderView2 = _interopRequireDefault(_viewsUploaderView);

var _viewsPseudonymView = require('views/PseudonymView');

var _viewsPseudonymView2 = _interopRequireDefault(_viewsPseudonymView);

var _viewsFileManagerView = require('views/FileManagerView');

var _viewsFileManagerView2 = _interopRequireDefault(_viewsFileManagerView);

require('util/jquery.ajax.progress');

$(function () {
   window.app = {};
   app.vent = _.extend({}, Backbone.Events);

   app.reader = new _viewsFileReaderView2['default']({
      el: $('.file-reader')
   });

   app.vent.once('File:loaded', function (model) {

      var collection = model.collection;

      app.pseudonyms = new _viewsPseudonymView2['default']({
         collection: collection,
         el: $('.pseudonym-list'),
         tableContainer: $('.pseudonym-row')
      });

      app.files = new _viewsFileManagerView2['default']({
         collection: collection,
         el: $('.file-manager')
      });

      // TODO meh … should have its own view
      collection.on('change:state', function () {
         var hasActiveItems = !!collection.filter(function (m) {
            return m.get('state') === 1;
         }).length;
         $('.btn-use-files').attr('disabled', !hasActiveItems);
      });

      $('.btn-use-files').on('click', function () {
         app.uploader = new _viewsUploaderView2['default']({
            collection: collection,
            el: $('.uploader')
         });

         $('.uploader').removeClass('hidden');
         $('.files-to-upload .panel-footer').addClass('hidden');
      });

      // slide to the side animation
      app.reader.$el.removeClass('col-md-offset-4');
      _.delay(function () {
         return $('.main-column').removeClass('hidden');
      }, 500);
   });

   // app.vent.once('XNAT:file_uploaded', (/*name*/) => {
   //    $('.overlay').removeClass('hidden');
   // });
});

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/javascript/init.js","/javascript")

},{"_process":25,"buffer":21,"util/jquery.ajax.progress":12,"views/FileManagerView":17,"views/FileReaderView":18,"views/PseudonymView":19,"views/UploaderView":20}],4:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

Object.defineProperty(exports, '__esModule', {
   value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _modelsFileModel = require('models/FileModel');

var _modelsFileModel2 = _interopRequireDefault(_modelsFileModel);

exports['default'] = Backbone.Collection.extend({
   model: _modelsFileModel2['default'] /*,
                                       comparator: 'size'*/
});
module.exports = exports['default'];

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/javascript/models/FileCollection.js","/javascript/models")

},{"_process":25,"buffer":21,"models/FileModel":5}],5:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

Object.defineProperty(exports, '__esModule', {
   value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _config = require('config');

var _config2 = _interopRequireDefault(_config);

var _utilFileSaver = require('util/FileSaver');

var _utilFileSaver2 = _interopRequireDefault(_utilFileSaver);

var _utilSizeFormatter = require('util/sizeFormatter');

var _utilSizeFormatter2 = _interopRequireDefault(_utilSizeFormatter);

exports['default'] = Backbone.Model.extend({

   defaults: {
      updated_at: Date.now(),
      name: '',
      size: 0,
      formatted_size: '',
      type: '',
      patientName: '',
      pseudonym: '',
      content: null, // Int8Array
      state: 1 // { done: -1, inactive: 0, active: 1, current: 2 }
   },

   initialize: function initialize() {
      var _this = this;

      this.on('change:name', function () {
         return _this.setTransformer();
      });
      this.on('change:pseudonym', function () {
         return _this.pseudonymize();
      });
      this.on('change:size', function () {
         return _this.updateFormattedSize();
      });

      this.setTransformer();
      this.updateFormattedSize();
   },

   download: function download() {
      var blob = new Blob([this.get('content')], { type: this.get('type') });
      _utilFileSaver2['default'].saveAs(blob, this.get('name'));
   },

   pseudonymize: function pseudonymize() {
      console.warn('Abstract Method `pseudonymize` should be overriden');
   },

   setPatientName: function setPatientName() {
      console.warn('Abstract Method `setPatientName` should be overriden');
   },

   setTransformer: function setTransformer() {
      var _this2 = this;

      var name = this.get('name');
      var pattern = undefined;

      var transformer = _.find(_config2['default'].transformers, function (tf) {
         return _.find(tf.extensions, function (extension) {
            pattern = new RegExp('.' + extension + '$', 'i');
            return pattern.test(name);
         });
      });

      if (transformer) {
         _.each(transformer.mixin, function (value, key) {
            return _this2[key] = value;
         });
      }
   },

   updateFormattedSize: function updateFormattedSize() {
      var formattedSize = (0, _utilSizeFormatter2['default'])(this.get('size'));
      this.set('formatted_size', formattedSize);
   },

   // no sync needed
   sync: function sync() {
      return null;
   },
   fetch: function fetch() {
      return null;
   },
   save: function save() {
      return null;
   }

});
module.exports = exports['default'];
/*attributes*/

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/javascript/models/FileModel.js","/javascript/models")

},{"_process":25,"buffer":21,"config":2,"util/FileSaver":9,"util/sizeFormatter":13}],6:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

Object.defineProperty(exports, '__esModule', {
   value: true
});
var Model = Backbone.Model.extend({

   defaults: {
      updated_at: Date.now()
   },

   initialize: function initialize() {
      this.set('id', this.get('ID'));
   },

   url: function url() {
      return collection.get('host') + this.get('URI');
   },

   getChildren: function getChildren(name, options) {
      if (!this.get(name)) {
         this.fetchChildren(name, options);
      } else if (options && options.success) {
         options.success(this.get(name));
      }
      return this.get(name);
   },

   fetchChildren: function fetchChildren(name, options) {
      if (!this.get(name)) {
         this.set(name, new Collection({
            url: this.url() + '/' + name
         }));
      }
      this.get(name).fetch(options);

      return this.get(name);
   }
});

exports.Model = Model;
var Collection = Backbone.Collection.extend({

   model: Model,

   initialize: function initialize(options) {
      this.url = options.url || this.url;
      this.host = options.host || '';
   },

   parse: function parse(response) {
      return response.ResultSet.Result;
   }

});
exports.Collection = Collection;
/*options*/

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/javascript/models/XnatModel.js","/javascript/models")

},{"_process":25,"buffer":21}],7:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

Object.defineProperty(exports, '__esModule', {
   value: true
});
exports['default'] = {

   /**
    * Removes the 80 bytes of user data and optionally replaces them by a given pseudonym
    */
   pseudonymize: function pseudonymize() {
      console.log('pseudonymize', this.get('name'));
      var buffer = this.get('content');
      var pseudonym = this.get('pseudonym');

      for (var i = 0; i < 80; i++) {
         buffer[i + 8] = (pseudonym[i] || ' ').charCodeAt();
      }
   },

   setPatientName: function setPatientName() {
      console.log('setPatientName for', this.get('name'));
      var rawChars = this.get('content').subarray(8, 88);
      var patientName = String.fromCharCode.apply(null, rawChars).trim();
      this.set('patientName', patientName);
   },

   setFileName: function setFileName() {
      console.log('setFileName for', this.get('name'));
      var name = this.get('patientName') + '_' + Date.now();
      this.set('name', name);
   }

};
module.exports = exports['default'];

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/javascript/transformers/EDF.js","/javascript/transformers")

},{"_process":25,"buffer":21}],8:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

Object.defineProperty(exports, '__esModule', {
   value: true
});
exports['default'] = {

   pseudonymize: function pseudonymize() {
      console.log('XML - pseudonymize', this.get('name'));
   },

   setPatientName: function setPatientName() {
      console.log('XML - setPatientName for', this.get('name'));
   },

   setFileName: function setFileName() {
      console.log('XML - setFileName for', this.get('name'));
   }

};
module.exports = exports['default'];

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/javascript/transformers/XML.js","/javascript/transformers")

},{"_process":25,"buffer":21}],9:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
/* FileSaver.js
 * A saveAs() FileSaver implementation.
 * 2015-01-04
 *
 * By Eli Grey, http://eligrey.com
 * License: X11/MIT
 *   See https://github.com/eligrey/FileSaver.js/blob/master/LICENSE.md
 */

/*global self */
/*jslint bitwise: true, indent: 4, laxbreak: true, laxcomma: true, smarttabs: true, plusplus: true */

/*! @source http://purl.eligrey.com/github/FileSaver.js/blob/master/FileSaver.js */

"use strict";

var saveAs = saveAs
// IE 10+ (native saveAs)
 || typeof navigator !== "undefined" && navigator.msSaveOrOpenBlob && navigator.msSaveOrOpenBlob.bind(navigator)
// Everyone else
 || (function (view) {
	"use strict";
	// IE <10 is explicitly unsupported
	if (typeof navigator !== "undefined" && /MSIE [1-9]\./.test(navigator.userAgent)) {
		return;
	}
	var doc = view.document
	// only get URL when necessary in case Blob.js hasn't overridden it yet
	,
	    get_URL = function get_URL() {
		return view.URL || view.webkitURL || view;
	},
	    save_link = doc.createElementNS("http://www.w3.org/1999/xhtml", "a"),
	    can_use_save_link = ("download" in save_link),
	    click = function click(node) {
		var event = doc.createEvent("MouseEvents");
		event.initMouseEvent("click", true, false, view, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
		node.dispatchEvent(event);
	},
	    webkit_req_fs = view.webkitRequestFileSystem,
	    req_fs = view.requestFileSystem || webkit_req_fs || view.mozRequestFileSystem,
	    throw_outside = function throw_outside(ex) {
		(view.setImmediate || view.setTimeout)(function () {
			throw ex;
		}, 0);
	},
	    force_saveable_type = "application/octet-stream",
	    fs_min_size = 0
	// See https://code.google.com/p/chromium/issues/detail?id=375297#c7 and
	// https://github.com/eligrey/FileSaver.js/commit/485930a#commitcomment-8768047
	// for the reasoning behind the timeout and revocation flow
	,
	    arbitrary_revoke_timeout = 500 // in ms
	,
	    revoke = function revoke(file) {
		var revoker = function revoker() {
			if (typeof file === "string") {
				// file is an object URL
				get_URL().revokeObjectURL(file);
			} else {
				// file is a File
				file.remove();
			}
		};
		if (view.chrome) {
			revoker();
		} else {
			setTimeout(revoker, arbitrary_revoke_timeout);
		}
	},
	    dispatch = function dispatch(filesaver, event_types, event) {
		event_types = [].concat(event_types);
		var i = event_types.length;
		while (i--) {
			var listener = filesaver["on" + event_types[i]];
			if (typeof listener === "function") {
				try {
					listener.call(filesaver, event || filesaver);
				} catch (ex) {
					throw_outside(ex);
				}
			}
		}
	},
	    FileSaver = function FileSaver(blob, name) {
		// First try a.download, then web filesystem, then object URLs
		var filesaver = this,
		    type = blob.type,
		    blob_changed = false,
		    object_url,
		    target_view,
		    dispatch_all = function dispatch_all() {
			dispatch(filesaver, "writestart progress write writeend".split(" "));
		}
		// on any filesys errors revert to saving with object URLs
		,
		    fs_error = function fs_error() {
			// don't create more object URLs than needed
			if (blob_changed || !object_url) {
				object_url = get_URL().createObjectURL(blob);
			}
			if (target_view) {
				target_view.location.href = object_url;
			} else {
				var new_tab = view.open(object_url, "_blank");
				if (new_tab == undefined && typeof safari !== "undefined") {
					//Apple do not allow window.open, see http://bit.ly/1kZffRI
					view.location.href = object_url;
				}
			}
			filesaver.readyState = filesaver.DONE;
			dispatch_all();
			revoke(object_url);
		},
		    abortable = function abortable(func) {
			return function () {
				if (filesaver.readyState !== filesaver.DONE) {
					return func.apply(this, arguments);
				}
			};
		},
		    create_if_not_found = { create: true, exclusive: false },
		    slice;
		filesaver.readyState = filesaver.INIT;
		if (!name) {
			name = "download";
		}
		if (can_use_save_link) {
			object_url = get_URL().createObjectURL(blob);
			save_link.href = object_url;
			save_link.download = name;
			click(save_link);
			filesaver.readyState = filesaver.DONE;
			dispatch_all();
			revoke(object_url);
			return;
		}
		// Object and web filesystem URLs have a problem saving in Google Chrome when
		// viewed in a tab, so I force save with application/octet-stream
		// http://code.google.com/p/chromium/issues/detail?id=91158
		// Update: Google errantly closed 91158, I submitted it again:
		// https://code.google.com/p/chromium/issues/detail?id=389642
		if (view.chrome && type && type !== force_saveable_type) {
			slice = blob.slice || blob.webkitSlice;
			blob = slice.call(blob, 0, blob.size, force_saveable_type);
			blob_changed = true;
		}
		// Since I can't be sure that the guessed media type will trigger a download
		// in WebKit, I append .download to the filename.
		// https://bugs.webkit.org/show_bug.cgi?id=65440
		if (webkit_req_fs && name !== "download") {
			name += ".download";
		}
		if (type === force_saveable_type || webkit_req_fs) {
			target_view = view;
		}
		if (!req_fs) {
			fs_error();
			return;
		}
		fs_min_size += blob.size;
		req_fs(view.TEMPORARY, fs_min_size, abortable(function (fs) {
			fs.root.getDirectory("saved", create_if_not_found, abortable(function (dir) {
				var save = function save() {
					dir.getFile(name, create_if_not_found, abortable(function (file) {
						file.createWriter(abortable(function (writer) {
							writer.onwriteend = function (event) {
								target_view.location.href = file.toURL();
								filesaver.readyState = filesaver.DONE;
								dispatch(filesaver, "writeend", event);
								revoke(file);
							};
							writer.onerror = function () {
								var error = writer.error;
								if (error.code !== error.ABORT_ERR) {
									fs_error();
								}
							};
							"writestart progress write abort".split(" ").forEach(function (event) {
								writer["on" + event] = filesaver["on" + event];
							});
							writer.write(blob);
							filesaver.abort = function () {
								writer.abort();
								filesaver.readyState = filesaver.DONE;
							};
							filesaver.readyState = filesaver.WRITING;
						}), fs_error);
					}), fs_error);
				};
				dir.getFile(name, { create: false }, abortable(function (file) {
					// delete file if it already exists
					file.remove();
					save();
				}), abortable(function (ex) {
					if (ex.code === ex.NOT_FOUND_ERR) {
						save();
					} else {
						fs_error();
					}
				}));
			}), fs_error);
		}), fs_error);
	},
	    FS_proto = FileSaver.prototype,
	    saveAs = function saveAs(blob, name) {
		return new FileSaver(blob, name);
	};
	FS_proto.abort = function () {
		var filesaver = this;
		filesaver.readyState = filesaver.DONE;
		dispatch(filesaver, "abort");
	};
	FS_proto.readyState = FS_proto.INIT = 0;
	FS_proto.WRITING = 1;
	FS_proto.DONE = 2;

	FS_proto.error = FS_proto.onwritestart = FS_proto.onprogress = FS_proto.onwrite = FS_proto.onabort = FS_proto.onerror = FS_proto.onwriteend = null;

	return saveAs;
})(typeof self !== "undefined" && self || typeof window !== "undefined" && window || undefined.content);
// `self` is undefined in Firefox for Android content script context
// while `this` is nsIContentFrameMessageManager
// with an attribute `content` that corresponds to the window

if (typeof module !== "undefined" && module.exports) {
	module.exports.saveAs = saveAs;
} else if (typeof define !== "undefined" && define !== null && define.amd != null) {
	define([], function () {
		return saveAs;
	});
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/javascript/util/FileSaver.js","/javascript/util")

},{"_process":25,"buffer":21}],10:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

Object.defineProperty(exports, '__esModule', {
   value: true
});
exports['default'] = Backbone.View.extend({

   tagName: 'div',
   className: 'progress',

   progress: 0,

   template: _.template('<div class="progress-bar" style="width: <%= progress %>%;"><%= progress %>%</div>'),

   initialize: function initialize() {
      this.render();
   },

   render: function render() {
      this.$el.html(this.template({ progress: Math.ceil(this.progress) }));
      return this;
   },

   update: function update(value) {
      this.progress = value;
      this.render();
      return this;
   }

});
module.exports = exports['default'];

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/javascript/util/Progress.js","/javascript/util")

},{"_process":25,"buffer":21}],11:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

exports['default'] = function (variable) {

    var query = window.location.search.substring(1);
    var vars = query.split('&');
    for (var i = 0; i < vars.length; i++) {
        var pair = vars[i].split('=');
        if (decodeURIComponent(pair[0]) === variable) {
            return decodeURIComponent(pair[1]);
        }
    }
};

module.exports = exports['default'];

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/javascript/util/getQueryVariable.js","/javascript/util")

},{"_process":25,"buffer":21}],12:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
// Add XHR2 upload and download progress events to jQuery.ajax
// From https://gist.github.com/nebirhos/3892018
'use strict';

var originalXhr = $.ajaxSettings.xhr;
$.ajaxSetup({
   xhr: function xhr() {
      var _this = this;

      var request = originalXhr();
      if (request) {
         if (typeof request.addEventListener === 'function' && this.progress !== undefined) {
            request.addEventListener('progress', function (evt) {
               return _this.progress(evt);
            }, false);
         }
         if (typeof request.upload === 'object' && this.progressUpload !== undefined) {
            request.upload.addEventListener('progress', function (evt) {
               return _this.progressUpload(evt);
            }, false);
         }
      }
      return request;
   }
});

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/javascript/util/jquery.ajax.progress.js","/javascript/util")

},{"_process":25,"buffer":21}],13:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

Object.defineProperty(exports, '__esModule', {
   value: true
});

exports['default'] = function (bytes) {

   if (bytes >= 1000000000) {
      return (bytes / 1000000000).toFixed(2) + ' GB';
   }
   if (bytes >= 1000000) {
      return (bytes / 1000000).toFixed(2) + ' MB';
   }
   return (bytes / 1000).toFixed(2) + ' KB';
};

module.exports = exports['default'];

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/javascript/util/sizeFormatter.js","/javascript/util")

},{"_process":25,"buffer":21}],14:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
/*
 Copyright (c) 2013 Gildas Lormeau. All rights reserved.

 Redistribution and use in source and binary forms, with or without
 modification, are permitted provided that the following conditions are met:

 1. Redistributions of source code must retain the above copyright notice,
 this list of conditions and the following disclaimer.

 2. Redistributions in binary form must reproduce the above copyright
 notice, this list of conditions and the following disclaimer in
 the documentation and/or other materials provided with the distribution.

 3. The names of the authors may not be used to endorse or promote products
 derived from this software without specific prior written permission.

 THIS SOFTWARE IS PROVIDED ``AS IS'' AND ANY EXPRESSED OR IMPLIED WARRANTIES,
 INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
 FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL JCRAFT,
 INC. OR ANY CONTRIBUTORS TO THIS SOFTWARE BE LIABLE FOR ANY DIRECT, INDIRECT,
 INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA,
 OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
 LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
 EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

"use strict";

(function () {
	"use strict";

	var ERR_HTTP_RANGE = "HTTP Range not supported.";

	var Reader = zip.Reader;
	var Writer = zip.Writer;

	var ZipDirectoryEntry;

	var appendABViewSupported;
	try {
		appendABViewSupported = new Blob([new DataView(new ArrayBuffer(0))]).size === 0;
	} catch (e) {}

	function HttpReader(url) {
		var that = this;

		function getData(callback, onerror) {
			var request;
			if (!that.data) {
				request = new XMLHttpRequest();
				request.addEventListener("load", function () {
					if (!that.size) that.size = Number(request.getResponseHeader("Content-Length"));
					that.data = new Uint8Array(request.response);
					callback();
				}, false);
				request.addEventListener("error", onerror, false);
				request.open("GET", url);
				request.responseType = "arraybuffer";
				request.send();
			} else callback();
		}

		function init(callback, onerror) {
			var request = new XMLHttpRequest();
			request.addEventListener("load", function () {
				that.size = Number(request.getResponseHeader("Content-Length"));
				callback();
			}, false);
			request.addEventListener("error", onerror, false);
			request.open("HEAD", url);
			request.send();
		}

		function readUint8Array(index, length, callback, onerror) {
			getData(function () {
				callback(new Uint8Array(that.data.subarray(index, index + length)));
			}, onerror);
		}

		that.size = 0;
		that.init = init;
		that.readUint8Array = readUint8Array;
	}
	HttpReader.prototype = new Reader();
	HttpReader.prototype.constructor = HttpReader;

	function HttpRangeReader(url) {
		var that = this;

		function init(callback, onerror) {
			var request = new XMLHttpRequest();
			request.addEventListener("load", function () {
				that.size = Number(request.getResponseHeader("Content-Length"));
				if (request.getResponseHeader("Accept-Ranges") == "bytes") callback();else onerror(ERR_HTTP_RANGE);
			}, false);
			request.addEventListener("error", onerror, false);
			request.open("HEAD", url);
			request.send();
		}

		function readArrayBuffer(index, length, callback, onerror) {
			var request = new XMLHttpRequest();
			request.open("GET", url);
			request.responseType = "arraybuffer";
			request.setRequestHeader("Range", "bytes=" + index + "-" + (index + length - 1));
			request.addEventListener("load", function () {
				callback(request.response);
			}, false);
			request.addEventListener("error", onerror, false);
			request.send();
		}

		function readUint8Array(index, length, callback, onerror) {
			readArrayBuffer(index, length, function (arraybuffer) {
				callback(new Uint8Array(arraybuffer));
			}, onerror);
		}

		that.size = 0;
		that.init = init;
		that.readUint8Array = readUint8Array;
	}
	HttpRangeReader.prototype = new Reader();
	HttpRangeReader.prototype.constructor = HttpRangeReader;

	function ArrayBufferReader(arrayBuffer) {
		var that = this;

		function init(callback, onerror) {
			that.size = arrayBuffer.byteLength;
			callback();
		}

		function readUint8Array(index, length, callback, onerror) {
			callback(new Uint8Array(arrayBuffer.slice(index, index + length)));
		}

		that.size = 0;
		that.init = init;
		that.readUint8Array = readUint8Array;
	}
	ArrayBufferReader.prototype = new Reader();
	ArrayBufferReader.prototype.constructor = ArrayBufferReader;

	function ArrayBufferWriter() {
		var array,
		    that = this;

		function init(callback, onerror) {
			array = new Uint8Array();
			callback();
		}

		function writeUint8Array(arr, callback, onerror) {
			var tmpArray = new Uint8Array(array.length + arr.length);
			tmpArray.set(array);
			tmpArray.set(arr, array.length);
			array = tmpArray;
			callback();
		}

		function getData(callback) {
			callback(array.buffer);
		}

		that.init = init;
		that.writeUint8Array = writeUint8Array;
		that.getData = getData;
	}
	ArrayBufferWriter.prototype = new Writer();
	ArrayBufferWriter.prototype.constructor = ArrayBufferWriter;

	function FileWriter(fileEntry, contentType) {
		var writer,
		    that = this;

		function init(callback, onerror) {
			fileEntry.createWriter(function (fileWriter) {
				writer = fileWriter;
				callback();
			}, onerror);
		}

		function writeUint8Array(array, callback, onerror) {
			var blob = new Blob([appendABViewSupported ? array : array.buffer], {
				type: contentType
			});
			writer.onwrite = function () {
				writer.onwrite = null;
				callback();
			};
			writer.onerror = onerror;
			writer.write(blob);
		}

		function getData(callback) {
			fileEntry.file(callback);
		}

		that.init = init;
		that.writeUint8Array = writeUint8Array;
		that.getData = getData;
	}
	FileWriter.prototype = new Writer();
	FileWriter.prototype.constructor = FileWriter;

	zip.FileWriter = FileWriter;
	zip.HttpReader = HttpReader;
	zip.HttpRangeReader = HttpRangeReader;
	zip.ArrayBufferReader = ArrayBufferReader;
	zip.ArrayBufferWriter = ArrayBufferWriter;

	if (zip.fs) {
		ZipDirectoryEntry = zip.fs.ZipDirectoryEntry;
		ZipDirectoryEntry.prototype.addHttpContent = function (name, URL, useRangeHeader) {
			function addChild(parent, name, params, directory) {
				if (parent.directory) return directory ? new ZipDirectoryEntry(parent.fs, name, params, parent) : new zip.fs.ZipFileEntry(parent.fs, name, params, parent);else throw "Parent entry is not a directory.";
			}

			return addChild(this, name, {
				data: URL,
				Reader: useRangeHeader ? HttpRangeReader : HttpReader
			});
		};
		ZipDirectoryEntry.prototype.importHttpContent = function (URL, useRangeHeader, onend, onerror) {
			this.importZip(useRangeHeader ? new HttpRangeReader(URL) : new HttpReader(URL), onend, onerror);
		};
		zip.fs.FS.prototype.importHttpContent = function (URL, useRangeHeader, onend, onerror) {
			this.entries = [];
			this.root = new ZipDirectoryEntry(this);
			this.root.importHttpContent(URL, useRangeHeader, onend, onerror);
		};
	}
})();

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/javascript/util/zip-ext.js","/javascript/util")

},{"_process":25,"buffer":21}],15:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
/*
 Copyright (c) 2013 Gildas Lormeau. All rights reserved.

 Redistribution and use in source and binary forms, with or without
 modification, are permitted provided that the following conditions are met:

 1. Redistributions of source code must retain the above copyright notice,
 this list of conditions and the following disclaimer.

 2. Redistributions in binary form must reproduce the above copyright
 notice, this list of conditions and the following disclaimer in
 the documentation and/or other materials provided with the distribution.

 3. The names of the authors may not be used to endorse or promote products
 derived from this software without specific prior written permission.

 THIS SOFTWARE IS PROVIDED ``AS IS'' AND ANY EXPRESSED OR IMPLIED WARRANTIES,
 INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
 FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL JCRAFT,
 INC. OR ANY CONTRIBUTORS TO THIS SOFTWARE BE LIABLE FOR ANY DIRECT, INDIRECT,
 INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA,
 OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
 LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
 EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

"use strict";

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports["default"] = (function (obj) {
	"use strict";

	var ERR_BAD_FORMAT = "File format is not recognized.";
	var ERR_CRC = "CRC failed.";
	var ERR_ENCRYPTED = "File contains encrypted entry.";
	var ERR_ZIP64 = "File is using Zip64 (4gb+ file size).";
	var ERR_READ = "Error while reading zip file.";
	var ERR_WRITE = "Error while writing zip file.";
	var ERR_WRITE_DATA = "Error while writing file data.";
	var ERR_READ_DATA = "Error while reading file data.";
	var ERR_DUPLICATED_NAME = "File already exists.";
	var CHUNK_SIZE = 512 * 1024;

	var TEXT_PLAIN = "text/plain";

	var appendABViewSupported;
	try {
		appendABViewSupported = new Blob([new DataView(new ArrayBuffer(0))]).size === 0;
	} catch (e) {}

	function Crc32() {
		this.crc = -1;
	}
	Crc32.prototype.append = function append(data) {
		var crc = this.crc | 0,
		    table = this.table;
		for (var offset = 0, len = data.length | 0; offset < len; offset++) crc = crc >>> 8 ^ table[(crc ^ data[offset]) & 0xFF];
		this.crc = crc;
	};
	Crc32.prototype.get = function get() {
		return ~this.crc;
	};
	Crc32.prototype.table = (function () {
		var i,
		    j,
		    t,
		    table = []; // Uint32Array is actually slower than []
		for (i = 0; i < 256; i++) {
			t = i;
			for (j = 0; j < 8; j++) if (t & 1) t = t >>> 1 ^ 0xEDB88320;else t = t >>> 1;
			table[i] = t;
		}
		return table;
	})();

	// "no-op" codec
	function NOOP() {}
	NOOP.prototype.append = function append(bytes, onprogress) {
		return bytes;
	};
	NOOP.prototype.flush = function flush() {};

	function blobSlice(blob, index, length) {
		if (index < 0 || length < 0 || index + length > blob.size) throw new RangeError("offset:" + index + ", length:" + length + ", size:" + blob.size);
		if (blob.slice) return blob.slice(index, index + length);else if (blob.webkitSlice) return blob.webkitSlice(index, index + length);else if (blob.mozSlice) return blob.mozSlice(index, index + length);else if (blob.msSlice) return blob.msSlice(index, index + length);
	}

	function getDataHelper(byteLength, bytes) {
		var dataBuffer, dataArray;
		dataBuffer = new ArrayBuffer(byteLength);
		dataArray = new Uint8Array(dataBuffer);
		if (bytes) dataArray.set(bytes, 0);
		return {
			buffer: dataBuffer,
			array: dataArray,
			view: new DataView(dataBuffer)
		};
	}

	// Readers
	function Reader() {}

	function TextReader(text) {
		var that = this,
		    blobReader;

		function init(callback, onerror) {
			var blob = new Blob([text], {
				type: TEXT_PLAIN
			});
			blobReader = new BlobReader(blob);
			blobReader.init(function () {
				that.size = blobReader.size;
				callback();
			}, onerror);
		}

		function readUint8Array(index, length, callback, onerror) {
			blobReader.readUint8Array(index, length, callback, onerror);
		}

		that.size = 0;
		that.init = init;
		that.readUint8Array = readUint8Array;
	}
	TextReader.prototype = new Reader();
	TextReader.prototype.constructor = TextReader;

	function Data64URIReader(dataURI) {
		var that = this,
		    dataStart;

		function init(callback) {
			var dataEnd = dataURI.length;
			while (dataURI.charAt(dataEnd - 1) == "=") dataEnd--;
			dataStart = dataURI.indexOf(",") + 1;
			that.size = Math.floor((dataEnd - dataStart) * 0.75);
			callback();
		}

		function readUint8Array(index, length, callback) {
			var i,
			    data = getDataHelper(length);
			var start = Math.floor(index / 3) * 4;
			var end = Math.ceil((index + length) / 3) * 4;
			var bytes = obj.atob(dataURI.substring(start + dataStart, end + dataStart));
			var delta = index - Math.floor(start / 4) * 3;
			for (i = delta; i < delta + length; i++) data.array[i - delta] = bytes.charCodeAt(i);
			callback(data.array);
		}

		that.size = 0;
		that.init = init;
		that.readUint8Array = readUint8Array;
	}
	Data64URIReader.prototype = new Reader();
	Data64URIReader.prototype.constructor = Data64URIReader;

	function BlobReader(blob) {
		var that = this;

		function init(callback) {
			that.size = blob.size;
			callback();
		}

		function readUint8Array(index, length, callback, onerror) {
			var reader = new FileReader();
			reader.onload = function (e) {
				callback(new Uint8Array(e.target.result));
			};
			reader.onerror = onerror;
			try {
				reader.readAsArrayBuffer(blobSlice(blob, index, length));
			} catch (e) {
				onerror(e);
			}
		}

		that.size = 0;
		that.init = init;
		that.readUint8Array = readUint8Array;
	}
	BlobReader.prototype = new Reader();
	BlobReader.prototype.constructor = BlobReader;

	// Writers

	function Writer() {}
	Writer.prototype.getData = function (callback) {
		callback(this.data);
	};

	function TextWriter(encoding) {
		var that = this,
		    blob;

		function init(callback) {
			blob = new Blob([], {
				type: TEXT_PLAIN
			});
			callback();
		}

		function writeUint8Array(array, callback) {
			blob = new Blob([blob, appendABViewSupported ? array : array.buffer], {
				type: TEXT_PLAIN
			});
			callback();
		}

		function getData(callback, onerror) {
			var reader = new FileReader();
			reader.onload = function (e) {
				callback(e.target.result);
			};
			reader.onerror = onerror;
			reader.readAsText(blob, encoding);
		}

		that.init = init;
		that.writeUint8Array = writeUint8Array;
		that.getData = getData;
	}
	TextWriter.prototype = new Writer();
	TextWriter.prototype.constructor = TextWriter;

	function Data64URIWriter(contentType) {
		var that = this,
		    data = "",
		    pending = "";

		function init(callback) {
			data += "data:" + (contentType || "") + ";base64,";
			callback();
		}

		function writeUint8Array(array, callback) {
			var i,
			    delta = pending.length,
			    dataString = pending;
			pending = "";
			for (i = 0; i < Math.floor((delta + array.length) / 3) * 3 - delta; i++) dataString += String.fromCharCode(array[i]);
			for (; i < array.length; i++) pending += String.fromCharCode(array[i]);
			if (dataString.length > 2) data += obj.btoa(dataString);else pending = dataString;
			callback();
		}

		function getData(callback) {
			callback(data + obj.btoa(pending));
		}

		that.init = init;
		that.writeUint8Array = writeUint8Array;
		that.getData = getData;
	}
	Data64URIWriter.prototype = new Writer();
	Data64URIWriter.prototype.constructor = Data64URIWriter;

	function BlobWriter(contentType) {
		var blob,
		    that = this;

		function init(callback) {
			blob = new Blob([], {
				type: contentType
			});
			callback();
		}

		function writeUint8Array(array, callback) {
			blob = new Blob([blob, appendABViewSupported ? array : array.buffer], {
				type: contentType
			});
			callback();
		}

		function getData(callback) {
			callback(blob);
		}

		that.init = init;
		that.writeUint8Array = writeUint8Array;
		that.getData = getData;
	}
	BlobWriter.prototype = new Writer();
	BlobWriter.prototype.constructor = BlobWriter;

	/**
  * inflate/deflate core functions
  * @param worker {Worker} web worker for the task.
  * @param initialMessage {Object} initial message to be sent to the worker. should contain
  *   sn(serial number for distinguishing multiple tasks sent to the worker), and codecClass.
  *   This function may add more properties before sending.
  */
	function launchWorkerProcess(worker, initialMessage, reader, writer, offset, size, onprogress, onend, onreaderror, onwriteerror) {
		var chunkIndex = 0,
		    index,
		    outputSize,
		    sn = initialMessage.sn,
		    crc;

		function onflush() {
			worker.removeEventListener("message", onmessage, false);
			onend(outputSize, crc);
		}

		function onmessage(event) {
			var message = event.data,
			    data = message.data,
			    err = message.error;
			if (err) {
				err.toString = function () {
					return "Error: " + this.message;
				};
				onreaderror(err);
				return;
			}
			if (message.sn !== sn) return;
			if (typeof message.codecTime === "number") worker.codecTime += message.codecTime; // should be before onflush()
			if (typeof message.crcTime === "number") worker.crcTime += message.crcTime;

			switch (message.type) {
				case "append":
					if (data) {
						outputSize += data.length;
						writer.writeUint8Array(data, function () {
							step();
						}, onwriteerror);
					} else step();
					break;
				case "flush":
					crc = message.crc;
					if (data) {
						outputSize += data.length;
						writer.writeUint8Array(data, function () {
							onflush();
						}, onwriteerror);
					} else onflush();
					break;
				case "progress":
					if (onprogress) onprogress(index + message.loaded, size);
					break;
				case "importScripts": //no need to handle here
				case "newTask":
				case "echo":
					break;
				default:
					console.warn("zip.js:launchWorkerProcess: unknown message: ", message);
			}
		}

		function step() {
			index = chunkIndex * CHUNK_SIZE;
			// use `<=` instead of `<`, because `size` may be 0.
			if (index <= size) {
				reader.readUint8Array(offset + index, Math.min(CHUNK_SIZE, size - index), function (array) {
					if (onprogress) onprogress(index, size);
					var msg = index === 0 ? initialMessage : { sn: sn };
					msg.type = "append";
					msg.data = array;

					// posting a message with transferables will fail on IE10
					try {
						worker.postMessage(msg, [array.buffer]);
					} catch (ex) {
						worker.postMessage(msg); // retry without transferables
					}
					chunkIndex++;
				}, onreaderror);
			} else {
				worker.postMessage({
					sn: sn,
					type: "flush"
				});
			}
		}

		outputSize = 0;
		worker.addEventListener("message", onmessage, false);
		step();
	}

	function launchProcess(process, reader, writer, offset, size, crcType, onprogress, onend, onreaderror, onwriteerror) {
		var chunkIndex = 0,
		    index,
		    outputSize = 0,
		    crcInput = crcType === "input",
		    crcOutput = crcType === "output",
		    crc = new Crc32();
		function step() {
			var outputData;
			index = chunkIndex * CHUNK_SIZE;
			if (index < size) reader.readUint8Array(offset + index, Math.min(CHUNK_SIZE, size - index), function (inputData) {
				var outputData;
				try {
					outputData = process.append(inputData, function (loaded) {
						if (onprogress) onprogress(index + loaded, size);
					});
				} catch (e) {
					onreaderror(e);
					return;
				}
				if (outputData) {
					outputSize += outputData.length;
					writer.writeUint8Array(outputData, function () {
						chunkIndex++;
						setTimeout(step, 1);
					}, onwriteerror);
					if (crcOutput) crc.append(outputData);
				} else {
					chunkIndex++;
					setTimeout(step, 1);
				}
				if (crcInput) crc.append(inputData);
				if (onprogress) onprogress(index, size);
			}, onreaderror);else {
				try {
					outputData = process.flush();
				} catch (e) {
					onreaderror(e);
					return;
				}
				if (outputData) {
					if (crcOutput) crc.append(outputData);
					outputSize += outputData.length;
					writer.writeUint8Array(outputData, function () {
						onend(outputSize, crc.get());
					}, onwriteerror);
				} else onend(outputSize, crc.get());
			}
		}

		step();
	}

	function inflate(worker, sn, reader, writer, offset, size, computeCrc32, onend, onprogress, onreaderror, onwriteerror) {
		var crcType = computeCrc32 ? "output" : "none";
		if (obj.zip.useWebWorkers) {
			var initialMessage = {
				sn: sn,
				codecClass: "Inflater",
				crcType: crcType
			};
			launchWorkerProcess(worker, initialMessage, reader, writer, offset, size, onprogress, onend, onreaderror, onwriteerror);
		} else launchProcess(new obj.zip.Inflater(), reader, writer, offset, size, crcType, onprogress, onend, onreaderror, onwriteerror);
	}

	function deflate(worker, sn, reader, writer, level, onend, onprogress, onreaderror, onwriteerror) {
		var crcType = "input";
		if (obj.zip.useWebWorkers) {
			var initialMessage = {
				sn: sn,
				options: { level: level },
				codecClass: "Deflater",
				crcType: crcType
			};
			launchWorkerProcess(worker, initialMessage, reader, writer, 0, reader.size, onprogress, onend, onreaderror, onwriteerror);
		} else launchProcess(new obj.zip.Deflater(), reader, writer, 0, reader.size, crcType, onprogress, onend, onreaderror, onwriteerror);
	}

	function copy(worker, sn, reader, writer, offset, size, computeCrc32, onend, onprogress, onreaderror, onwriteerror) {
		var crcType = "input";
		if (obj.zip.useWebWorkers && computeCrc32) {
			var initialMessage = {
				sn: sn,
				codecClass: "NOOP",
				crcType: crcType
			};
			launchWorkerProcess(worker, initialMessage, reader, writer, offset, size, onprogress, onend, onreaderror, onwriteerror);
		} else launchProcess(new NOOP(), reader, writer, offset, size, crcType, onprogress, onend, onreaderror, onwriteerror);
	}

	// ZipReader

	function decodeASCII(str) {
		var i,
		    out = "",
		    charCode,
		    extendedASCII = ["Ç", "ü", "é", "â", "ä", "à", "å", "ç", "ê", "ë", "è", "ï", "î", "ì", "Ä", "Å", "É", "æ", "Æ", "ô", "ö", "ò", "û", "ù", "ÿ", "Ö", "Ü", "ø", "£", "Ø", "×", "ƒ", "á", "í", "ó", "ú", "ñ", "Ñ", "ª", "º", "¿", "®", "¬", "½", "¼", "¡", "«", "»", "_", "_", "_", "¦", "¦", "Á", "Â", "À", "©", "¦", "¦", "+", "+", "¢", "¥", "+", "+", "-", "-", "+", "-", "+", "ã", "Ã", "+", "+", "-", "-", "¦", "-", "+", "¤", "ð", "Ð", "Ê", "Ë", "È", "i", "Í", "Î", "Ï", "+", "+", "_", "_", "¦", "Ì", "_", "Ó", "ß", "Ô", "Ò", "õ", "Õ", "µ", "þ", "Þ", "Ú", "Û", "Ù", "ý", "Ý", "¯", "´", "­", "±", "_", "¾", "¶", "§", "÷", "¸", "°", "¨", "·", "¹", "³", "²", "_", " "];
		for (i = 0; i < str.length; i++) {
			charCode = str.charCodeAt(i) & 0xFF;
			if (charCode > 127) out += extendedASCII[charCode - 128];else out += String.fromCharCode(charCode);
		}
		return out;
	}

	function decodeUTF8(string) {
		return decodeURIComponent(escape(string));
	}

	function getString(bytes) {
		var i,
		    str = "";
		for (i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
		return str;
	}

	function getDate(timeRaw) {
		var date = (timeRaw & 0xffff0000) >> 16,
		    time = timeRaw & 0x0000ffff;
		try {
			return new Date(1980 + ((date & 0xFE00) >> 9), ((date & 0x01E0) >> 5) - 1, date & 0x001F, (time & 0xF800) >> 11, (time & 0x07E0) >> 5, (time & 0x001F) * 2, 0);
		} catch (e) {}
	}

	function readCommonHeader(entry, data, index, centralDirectory, onerror) {
		entry.version = data.view.getUint16(index, true);
		entry.bitFlag = data.view.getUint16(index + 2, true);
		entry.compressionMethod = data.view.getUint16(index + 4, true);
		entry.lastModDateRaw = data.view.getUint32(index + 6, true);
		entry.lastModDate = getDate(entry.lastModDateRaw);
		if ((entry.bitFlag & 0x01) === 0x01) {
			onerror(ERR_ENCRYPTED);
			return;
		}
		if (centralDirectory || (entry.bitFlag & 0x0008) != 0x0008) {
			entry.crc32 = data.view.getUint32(index + 10, true);
			entry.compressedSize = data.view.getUint32(index + 14, true);
			entry.uncompressedSize = data.view.getUint32(index + 18, true);
		}
		if (entry.compressedSize === 0xFFFFFFFF || entry.uncompressedSize === 0xFFFFFFFF) {
			onerror(ERR_ZIP64);
			return;
		}
		entry.filenameLength = data.view.getUint16(index + 22, true);
		entry.extraFieldLength = data.view.getUint16(index + 24, true);
	}

	function createZipReader(reader, callback, onerror) {
		var inflateSN = 0;

		function Entry() {}

		Entry.prototype.getData = function (writer, onend, onprogress, checkCrc32) {
			var that = this;

			function testCrc32(crc32) {
				var dataCrc32 = getDataHelper(4);
				dataCrc32.view.setUint32(0, crc32);
				return that.crc32 == dataCrc32.view.getUint32(0);
			}

			function getWriterData(uncompressedSize, crc32) {
				if (checkCrc32 && !testCrc32(crc32)) onerror(ERR_CRC);else writer.getData(function (data) {
					onend(data);
				});
			}

			function onreaderror(err) {
				onerror(err || ERR_READ_DATA);
			}

			function onwriteerror(err) {
				onerror(err || ERR_WRITE_DATA);
			}

			reader.readUint8Array(that.offset, 30, function (bytes) {
				var data = getDataHelper(bytes.length, bytes),
				    dataOffset;
				if (data.view.getUint32(0) != 0x504b0304) {
					onerror(ERR_BAD_FORMAT);
					return;
				}
				readCommonHeader(that, data, 4, false, onerror);
				dataOffset = that.offset + 30 + that.filenameLength + that.extraFieldLength;
				writer.init(function () {
					if (that.compressionMethod === 0) copy(that._worker, inflateSN++, reader, writer, dataOffset, that.compressedSize, checkCrc32, getWriterData, onprogress, onreaderror, onwriteerror);else inflate(that._worker, inflateSN++, reader, writer, dataOffset, that.compressedSize, checkCrc32, getWriterData, onprogress, onreaderror, onwriteerror);
				}, onwriteerror);
			}, onreaderror);
		};

		function seekEOCDR(eocdrCallback) {
			// "End of central directory record" is the last part of a zip archive, and is at least 22 bytes long.
			// Zip file comment is the last part of EOCDR and has max length of 64KB,
			// so we only have to search the last 64K + 22 bytes of a archive for EOCDR signature (0x06054b50).
			var EOCDR_MIN = 22;
			if (reader.size < EOCDR_MIN) {
				onerror(ERR_BAD_FORMAT);
				return;
			}
			var ZIP_COMMENT_MAX = 256 * 256,
			    EOCDR_MAX = EOCDR_MIN + ZIP_COMMENT_MAX;

			// In most cases, the EOCDR is EOCDR_MIN bytes long
			doSeek(EOCDR_MIN, function () {
				// If not found, try within EOCDR_MAX bytes
				doSeek(Math.min(EOCDR_MAX, reader.size), function () {
					onerror(ERR_BAD_FORMAT);
				});
			});

			// seek last length bytes of file for EOCDR
			function doSeek(length, eocdrNotFoundCallback) {
				reader.readUint8Array(reader.size - length, length, function (bytes) {
					for (var i = bytes.length - EOCDR_MIN; i >= 0; i--) {
						if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) {
							eocdrCallback(new DataView(bytes.buffer, i, EOCDR_MIN));
							return;
						}
					}
					eocdrNotFoundCallback();
				}, function () {
					onerror(ERR_READ);
				});
			}
		}

		var zipReader = {
			getEntries: function getEntries(callback) {
				var worker = this._worker;
				// look for End of central directory record
				seekEOCDR(function (dataView) {
					var datalength, fileslength;
					datalength = dataView.getUint32(16, true);
					fileslength = dataView.getUint16(8, true);
					if (datalength < 0 || datalength >= reader.size) {
						onerror(ERR_BAD_FORMAT);
						return;
					}
					reader.readUint8Array(datalength, reader.size - datalength, function (bytes) {
						var i,
						    index = 0,
						    entries = [],
						    entry,
						    filename,
						    comment,
						    data = getDataHelper(bytes.length, bytes);
						for (i = 0; i < fileslength; i++) {
							entry = new Entry();
							entry._worker = worker;
							if (data.view.getUint32(index) != 0x504b0102) {
								onerror(ERR_BAD_FORMAT);
								return;
							}
							readCommonHeader(entry, data, index + 6, true, onerror);
							entry.commentLength = data.view.getUint16(index + 32, true);
							entry.directory = (data.view.getUint8(index + 38) & 0x10) == 0x10;
							entry.offset = data.view.getUint32(index + 42, true);
							filename = getString(data.array.subarray(index + 46, index + 46 + entry.filenameLength));
							entry.filename = (entry.bitFlag & 0x0800) === 0x0800 ? decodeUTF8(filename) : decodeASCII(filename);
							if (!entry.directory && entry.filename.charAt(entry.filename.length - 1) == "/") entry.directory = true;
							comment = getString(data.array.subarray(index + 46 + entry.filenameLength + entry.extraFieldLength, index + 46 + entry.filenameLength + entry.extraFieldLength + entry.commentLength));
							entry.comment = (entry.bitFlag & 0x0800) === 0x0800 ? decodeUTF8(comment) : decodeASCII(comment);
							entries.push(entry);
							index += 46 + entry.filenameLength + entry.extraFieldLength + entry.commentLength;
						}
						callback(entries);
					}, function () {
						onerror(ERR_READ);
					});
				});
			},
			close: function close(callback) {
				if (this._worker) {
					this._worker.terminate();
					this._worker = null;
				}
				if (callback) callback();
			},
			_worker: null
		};

		if (!obj.zip.useWebWorkers) callback(zipReader);else {
			createWorker("inflater", function (worker) {
				zipReader._worker = worker;
				callback(zipReader);
			}, function (err) {
				onerror(err);
			});
		}
	}

	// ZipWriter

	function encodeUTF8(string) {
		return unescape(encodeURIComponent(string));
	}

	function getBytes(str) {
		var i,
		    array = [];
		for (i = 0; i < str.length; i++) array.push(str.charCodeAt(i));
		return array;
	}

	function createZipWriter(writer, callback, onerror, dontDeflate) {
		var files = {},
		    filenames = [],
		    datalength = 0;
		var deflateSN = 0;

		function onwriteerror(err) {
			onerror(err || ERR_WRITE);
		}

		function onreaderror(err) {
			onerror(err || ERR_READ_DATA);
		}

		var zipWriter = {
			add: function add(name, reader, onend, onprogress, options) {
				var header, filename, date;
				var worker = this._worker;

				function writeHeader(callback) {
					var data;
					date = options.lastModDate || new Date();
					header = getDataHelper(26);
					files[name] = {
						headerArray: header.array,
						directory: options.directory,
						filename: filename,
						offset: datalength,
						comment: getBytes(encodeUTF8(options.comment || ""))
					};
					header.view.setUint32(0, 0x14000808);
					if (options.version) header.view.setUint8(0, options.version);
					if (!dontDeflate && options.level !== 0 && !options.directory) header.view.setUint16(4, 0x0800);
					header.view.setUint16(6, (date.getHours() << 6 | date.getMinutes()) << 5 | date.getSeconds() / 2, true);
					header.view.setUint16(8, (date.getFullYear() - 1980 << 4 | date.getMonth() + 1) << 5 | date.getDate(), true);
					header.view.setUint16(22, filename.length, true);
					data = getDataHelper(30 + filename.length);
					data.view.setUint32(0, 0x504b0304);
					data.array.set(header.array, 4);
					data.array.set(filename, 30);
					datalength += data.array.length;
					writer.writeUint8Array(data.array, callback, onwriteerror);
				}

				function writeFooter(compressedLength, crc32) {
					var footer = getDataHelper(16);
					datalength += compressedLength || 0;
					footer.view.setUint32(0, 0x504b0708);
					if (typeof crc32 != "undefined") {
						header.view.setUint32(10, crc32, true);
						footer.view.setUint32(4, crc32, true);
					}
					if (reader) {
						footer.view.setUint32(8, compressedLength, true);
						header.view.setUint32(14, compressedLength, true);
						footer.view.setUint32(12, reader.size, true);
						header.view.setUint32(18, reader.size, true);
					}
					writer.writeUint8Array(footer.array, function () {
						datalength += 16;
						onend();
					}, onwriteerror);
				}

				function writeFile() {
					options = options || {};
					name = name.trim();
					if (options.directory && name.charAt(name.length - 1) != "/") name += "/";
					if (files.hasOwnProperty(name)) {
						onerror(ERR_DUPLICATED_NAME);
						return;
					}
					filename = getBytes(encodeUTF8(name));
					filenames.push(name);
					writeHeader(function () {
						if (reader) if (dontDeflate || options.level === 0) copy(worker, deflateSN++, reader, writer, 0, reader.size, true, writeFooter, onprogress, onreaderror, onwriteerror);else deflate(worker, deflateSN++, reader, writer, options.level, writeFooter, onprogress, onreaderror, onwriteerror);else writeFooter();
					}, onwriteerror);
				}

				if (reader) reader.init(writeFile, onreaderror);else writeFile();
			},
			close: function close(callback) {
				if (this._worker) {
					this._worker.terminate();
					this._worker = null;
				}

				var data,
				    length = 0,
				    index = 0,
				    indexFilename,
				    file;
				for (indexFilename = 0; indexFilename < filenames.length; indexFilename++) {
					file = files[filenames[indexFilename]];
					length += 46 + file.filename.length + file.comment.length;
				}
				data = getDataHelper(length + 22);
				for (indexFilename = 0; indexFilename < filenames.length; indexFilename++) {
					file = files[filenames[indexFilename]];
					data.view.setUint32(index, 0x504b0102);
					data.view.setUint16(index + 4, 0x1400);
					data.array.set(file.headerArray, index + 6);
					data.view.setUint16(index + 32, file.comment.length, true);
					if (file.directory) data.view.setUint8(index + 38, 0x10);
					data.view.setUint32(index + 42, file.offset, true);
					data.array.set(file.filename, index + 46);
					data.array.set(file.comment, index + 46 + file.filename.length);
					index += 46 + file.filename.length + file.comment.length;
				}
				data.view.setUint32(index, 0x504b0506);
				data.view.setUint16(index + 8, filenames.length, true);
				data.view.setUint16(index + 10, filenames.length, true);
				data.view.setUint32(index + 12, length, true);
				data.view.setUint32(index + 16, datalength, true);
				writer.writeUint8Array(data.array, function () {
					writer.getData(callback);
				}, onwriteerror);
			},
			_worker: null
		};

		if (!obj.zip.useWebWorkers) callback(zipWriter);else {
			createWorker("deflater", function (worker) {
				zipWriter._worker = worker;
				callback(zipWriter);
			}, function (err) {
				onerror(err);
			});
		}
	}

	function resolveURLs(urls) {
		var a = document.createElement("a");
		return urls.map(function (url) {
			a.href = url;
			return a.href;
		});
	}

	var DEFAULT_WORKER_SCRIPTS = {
		deflater: ["z-worker.js", "deflate.js"],
		inflater: ["z-worker.js", "inflate.js"]
	};
	function createWorker(type, callback, onerror) {
		if (obj.zip.workerScripts !== null && obj.zip.workerScriptsPath !== null) {
			onerror(new Error("Either zip.workerScripts or zip.workerScriptsPath may be set, not both."));
			return;
		}
		var scripts;
		if (obj.zip.workerScripts) {
			scripts = obj.zip.workerScripts[type];
			if (!Array.isArray(scripts)) {
				onerror(new Error("zip.workerScripts." + type + " is not an array!"));
				return;
			}
			scripts = resolveURLs(scripts);
		} else {
			scripts = DEFAULT_WORKER_SCRIPTS[type].slice(0);
			scripts[0] = (obj.zip.workerScriptsPath || "") + scripts[0];
		}
		var worker = new Worker(scripts[0]);
		// record total consumed time by inflater/deflater/crc32 in this worker
		worker.codecTime = worker.crcTime = 0;
		worker.postMessage({ type: "importScripts", scripts: scripts.slice(1) });
		worker.addEventListener("message", onmessage);
		function onmessage(ev) {
			var msg = ev.data;
			if (msg.error) {
				worker.terminate(); // should before onerror(), because onerror() may throw.
				onerror(msg.error);
				return;
			}
			if (msg.type === "importScripts") {
				worker.removeEventListener("message", onmessage);
				worker.removeEventListener("error", errorHandler);
				callback(worker);
			}
		}
		// catch entry script loading error and other unhandled errors
		worker.addEventListener("error", errorHandler);
		function errorHandler(err) {
			worker.terminate();
			onerror(err);
		}
	}

	function onerror_default(error) {
		console.error(error);
	}
	obj.zip = {
		Reader: Reader,
		Writer: Writer,
		BlobReader: BlobReader,
		Data64URIReader: Data64URIReader,
		TextReader: TextReader,
		BlobWriter: BlobWriter,
		Data64URIWriter: Data64URIWriter,
		TextWriter: TextWriter,
		createReader: function createReader(reader, callback, onerror) {
			onerror = onerror || onerror_default;

			reader.init(function () {
				createZipReader(reader, callback, onerror);
			}, onerror);
		},
		createWriter: function createWriter(writer, callback, onerror, dontDeflate) {
			onerror = onerror || onerror_default;
			dontDeflate = !!dontDeflate;

			writer.init(function () {
				createZipWriter(writer, callback, onerror, dontDeflate);
			}, onerror);
		},
		useWebWorkers: true,
		/**
   * Directory containing the default worker scripts (z-worker.js, deflate.js, and inflate.js), relative to current base url.
   * E.g.: zip.workerScripts = './';
   */
		workerScriptsPath: null,
		/**
   * Advanced option to control which scripts are loaded in the Web worker. If this option is specified, then workerScriptsPath must not be set.
   * workerScripts.deflater/workerScripts.inflater should be arrays of urls to scripts for deflater/inflater, respectively.
   * Scripts in the array are executed in order, and the first one should be z-worker.js, which is used to start the worker.
   * All urls are relative to current base url.
   * E.g.:
   * zip.workerScripts = {
   *   deflater: ['z-worker.js', 'deflate.js'],
   *   inflater: ['z-worker.js', 'inflate.js']
   * };
   */
		workerScripts: null
	};
})(window);

module.exports = exports["default"];

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/javascript/util/zip.js","/javascript/util")

},{"_process":25,"buffer":21}],16:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

Object.defineProperty(exports, '__esModule', {
   value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _config = require('config');

var _config2 = _interopRequireDefault(_config);

exports['default'] = Backbone.View.extend({

   template: _.template('<label class="flexitem flexitem-half">\n         <input class="item-check" type="checkbox" <%= state > 0 ? \'checked\' : \'\' %> <%= (state < 0 || state > 1) ? \'disabled\' : \'\' %>>\n      </label>\n      <div class="flexitem flexitem-double">\n         <span><%= name %></span>\n      </div>\n      <div class="flexitem flexitem">\n         <select class="item-transformer">' + _config2['default'].transformers.map(function (tf) {
      return '<option value="' + tf.name + '">' + tf.name + '</option>';
   }).join('') + '</select>\n      </div>\n      <div class="flexitem flexitem-right">\n         <span><%= formatted_size %></span>\n      </div>\n      <div class="flexitem flexitem-half">\n         <div class="btn btn-link"><i class="item-download fa fa-download"></i></div>\n      </div>'),

   tagName: 'div',
   className: 'flexrow',

   events: {
      // 'change .item-name': 'changeFilename',
      'change .item-transformer': 'changeTransformer',
      'change .item-check': 'toggleState',
      'click .item-download': 'download'
   },

   initialize: function initialize() {
      _.bindAll(this, 'render', 'download', 'toggleState');
      this.listenTo(this.model, 'change', this.render);
      // this.listenTo(this.model, 'destroy', this.remove);
   },

   render: function render() {
      this.$el.html(this.template(this.model.toJSON())).attr('data-state', this.model.get('state'));
      return this;
   },

   download: function download() {
      this.model.download();
   },

   // changeFilename(event) {
   //    this.model.set('name', event.target.value);
   // },

   changeTransformer: function changeTransformer(event) {
      console.warn('changeTransformer', 'Feature noch nicht implementiert', event.target.value);
      // this.model.set('name', event.target.value);
   },

   toggleState: function toggleState(event) {
      var currentState = this.model.get('state');
      if (currentState < 0 || currentState > 1) {
         event.preventDefault();
      } else {
         this.model.set('state', +event.target.checked);
      }
   }

});
module.exports = exports['default'];

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/javascript/views/FileManagerItemView.js","/javascript/views")

},{"_process":25,"buffer":21,"config":2}],17:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

Object.defineProperty(exports, '__esModule', {
   value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _viewsFileManagerItemView = require('views/FileManagerItemView');

var _viewsFileManagerItemView2 = _interopRequireDefault(_viewsFileManagerItemView);

exports['default'] = Backbone.View.extend({

   className: 'flextable flexcol',

   template: _.template('<div class="flexheader flexrow">\n         <div class="flexitem flexitem-half">Use</div>\n         <div class="flexitem flexitem-double">Name</div>\n         <div class="flexitem flexitem">Format</div>\n         <div class="flexitem">Size</div>\n         <div class="flexitem flexitem-half"><i class="fa fa-wrench"></i></div>\n      </div>\n      <div class="flexbody"></div>\n   '),

   views: {},

   initialize: function initialize() {
      _.bindAll(this, 'render', 'renderItem');
      this.render();
      this.listenTo(this.collection, 'add', this.renderItem);
      // this.listenTo(this.collection, 'destroy', this.removeItem);
   },

   render: function render() {
      this.$el.html(this.template()).addClass(this.className);

      this.$tableBody = this.$('.flexbody');

      _.each(this.collection.models, this.renderItem);
   },

   renderItem: function renderItem(model) {
      var view = new _viewsFileManagerItemView2['default']({ model: model });
      this.views[model.id] = view;
      this.$tableBody.append(view.render().el);
      return view;
   }

});
module.exports = exports['default'];

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/javascript/views/FileManagerView.js","/javascript/views")

},{"_process":25,"buffer":21,"views/FileManagerItemView":16}],18:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

Object.defineProperty(exports, '__esModule', {
   value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _modelsFileCollection = require('models/FileCollection');

var _modelsFileCollection2 = _interopRequireDefault(_modelsFileCollection);

var _utilProgress = require('util/Progress');

var _utilProgress2 = _interopRequireDefault(_utilProgress);

require('util/zip');

// http://gildas-lormeau.github.io/zip.js/core-api.html

require('util/zip-ext');

window.zip.workerScriptsPath = 'assets/js/zip/';

exports['default'] = Backbone.View.extend({

   collection: new _modelsFileCollection2['default'](),

   events: {
      'drop': 'handleFiles',
      'change input[type="file"]': 'handleFiles',
      'click .droparea button': 'delegateClick',
      'change .panel-body input': 'changePseudonym',
      'click .btn-download': 'download'
   },

   initialize: function initialize() {
      _.bindAll(this, 'handleFiles', 'loadItems', 'readFile', 'bufferToModel', 'handleZipFile');
      this.$fileInput = this.$('input[type="file"]');

      // this.model.on('change:pseudonym', (model, newPseudonym) => {
      //    this.$('.panel-footer').toggleClass('hidden', !newPseudonym.length);
      // });

      // Prevent the default action when a file is dropped
      // on the window i.e. redirecting to that file
      $(document).on('drop dragover', function (event) {
         event.preventDefault();
      });
   },

   delegateClick: function delegateClick(event) {
      event.preventDefault();
      this.$fileInput.click().blur();
   },

   handleFiles: function handleFiles($event) {
      var oe = $event.originalEvent;
      var items = oe.dataTransfer.items || oe.dataTransfer.files;
      this.loadItems(items);
   },

   loadItems: function loadItems(items) {
      var _this = this;

      var entry = {};
      _.each(items, function (item) {
         if (item.type === 'application/zip' && _.isFunction(item.getAsFile)) {
            return _this.handleZipFile(item.getAsFile());
         } else if (item.isFile || item.isDirectory) {
            entry = item;
         } else if (item.getAsEntry) {
            entry = item.getAsEntry();
         } else if (item.webkitGetAsEntry) {
            entry = item.webkitGetAsEntry();
         } else if (_.isFunction(item.getAsFile)) {
            return _this.readFile(item.getAsFile());
         } else if (File && item instanceof File) {
            return _this.readFile(item);
         } else {
            return null;
         }

         if (entry.isFile) {
            entry.file(function (file) {
               return _this.readFile(file);
            }, function (err) {
               return console.warn(err);
            });
         } else if (entry.isDirectory) {
            entry.createReader().readEntries(function (entries) {
               return _this.loadItems(entries);
            }, function (err) {
               return console.warn(err);
            });
         }
      });
   },

   // From: http://www.html5rocks.com/en/tutorials/file/dndfiles/
   // TODO: Error handling (see link above)
   readFile: function readFile(file) {
      var _this2 = this;

      var reader = new FileReader();
      var progress = new _utilProgress2['default']();
      this.$el.append(progress.el);

      reader.onprogress = function (event) {
         if (!event.lengthComputable) {
            return;
         } // if event is not a ProgressEvent
         progress.update(event.loaded / event.total * 100);
      };

      reader.onload = function () {
         _this2.bufferToModel(reader.result, file);
         progress.remove();
      };

      reader.onerror = function () {
         return console.log('reader - onerror');
      };
      reader.onabort = function () {
         return console.log('reader - onabort');
      };
      reader.onloadstart = function () {
         return console.log('reader - onloadstart');
      };

      reader.readAsArrayBuffer(file);
   },

   bufferToModel: function bufferToModel(buffer, metaData) {
      var model = this.collection.create({
         updated_at: metaData.lastModified,
         name: metaData.name,
         size: metaData.size,
         type: metaData.type,
         content: new Int8Array(buffer)
      });
      model.setPatientName();
      app.vent.trigger('File:loaded', model);
   },

   handleZipFile: function handleZipFile(file) {
      var _this3 = this;

      var zipBuffer = new window.zip.ArrayBufferWriter();
      var blobReader = new window.zip.BlobReader(file);
      window.zip.createReader(blobReader,
      // success
      function (zipReader) {
         return zipReader.getEntries(function () {
            var entries = arguments.length <= 0 || arguments[0] === undefined ? [] : arguments[0];
            return entries.forEach(function (entry) {
               if (entry.directory) {
                  return;
               }
               entry.getData(zipBuffer, function (buffer) {
                  var metaData = {
                     lastModified: entry.lastModDateRaw,
                     name: entry.filename,
                     size: entry.uncompressedSize,
                     type: 'unknown'
                  };
                  _this3.bufferToModel(buffer, metaData);
               });
            });
         });
      },
      // error
      function (message) {
         return console.error('Error reading zip:', message);
      });
   }

});
module.exports = exports['default'];
/*event*/

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/javascript/views/FileReaderView.js","/javascript/views")

},{"_process":25,"buffer":21,"models/FileCollection":4,"util/Progress":10,"util/zip":15,"util/zip-ext":14}],19:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

Object.defineProperty(exports, '__esModule', {
   value: true
});

var _slicedToArray = (function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i['return']) _i['return'](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError('Invalid attempt to destructure non-iterable instance'); } }; })();

exports['default'] = Backbone.View.extend({

   events: {
      'change input[name="pseudonym"]': 'changePseudonym',
      'click .btn-pseudo-history': 'renderTable'
   },

   mainRow: $('.main-row'),

   initialize: function initialize() {
      var _this = this;

      var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

      _.bindAll(this, 'renderTable', 'setInitialPatientName', 'changePseudonym', 'close', 'print');

      this.$pseudonym = this.$('input[name="pseudonym"]');
      this.usedPseudonyms = JSON.parse(localStorage.getItem('pseudonyms')) || {};

      // Zu diesem bestimmten Zeitpunkt ist nur ein Model vorhanden, darum kurz warten
      _.defer(function () {
         _this.setInitialPatientName();
         _this.setInitialPseudonym();
         _this.changePseudonym();
         _this.collection.on('add', function (model) {
            return model.set('pseudonym', _this.pseudonym);
         });
      });

      this.tableContainer = options.tableContainer;
      this.tableContainer.find('.btn-close').on('click', this.close);
      this.tableContainer.find('.btn-print').on('click', this.print);
   },

   renderTable: function renderTable() {
      var html = _.pairs(this.usedPseudonyms).map(function (_ref) {
         var _ref2 = _slicedToArray(_ref, 2);

         var name = _ref2[0];
         var pseudo = _ref2[1];
         return '<tr><td>' + name + '</td><td>' + pseudo + '</tr>';
      }).join('');
      this.mainRow.addClass('hidden');
      this.tableContainer.removeClass('hidden').find('.pseudonym-table').html(html);
   },

   setInitialPatientName: function setInitialPatientName() {
      var names = this.collection.pluck('patientName');
      var rankedNames = _.chain(names).countBy().pairs().value();

      if (rankedNames.length > 1) {
         window.alert('Found different patient names. The most common name "' + rankedNames[0][0] + '" was selected.'); // eslint-disable-line no-alert
      }

      this.patientName = rankedNames[0][0];
   },

   setInitialPseudonym: function setInitialPseudonym() {
      this.pseudonym = this.usedPseudonyms[this.patientName] || btoa(Math.random()).substr(3, 16);
      this.$pseudonym.val(this.pseudonym);
   },

   changePseudonym: function changePseudonym() {
      var newPseudonym = this.$pseudonym.val();
      this.collection.models.forEach(function (model) {
         return model.set('pseudonym', newPseudonym);
      });
      this.usedPseudonyms[this.patientName] = newPseudonym;
      localStorage.setItem('pseudonyms', JSON.stringify(this.usedPseudonyms));
   },

   close: function close() {
      this.mainRow.removeClass('hidden');
      this.tableContainer.addClass('hidden');
   },

   print: function print() {
      window.print();
   }

});
module.exports = exports['default'];

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/javascript/views/PseudonymView.js","/javascript/views")

},{"_process":25,"buffer":21}],20:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

Object.defineProperty(exports, '__esModule', {
   value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _config = require('config');

var _config2 = _interopRequireDefault(_config);

var _XnatAPI = require('XnatAPI');

var _XnatAPI2 = _interopRequireDefault(_XnatAPI);

var _utilProgress = require('util/Progress');

var _utilProgress2 = _interopRequireDefault(_utilProgress);

var _utilGetQueryVariable = require('util/getQueryVariable');

var _utilGetQueryVariable2 = _interopRequireDefault(_utilGetQueryVariable);

exports['default'] = Backbone.View.extend({

   template_projects: _.template('<% _.each(models, function(m) { %> <option value="<%= m.id %>"><%= m.name %></option> <% }); %>'),
   template_users: _.template('<% _.each(users, function(user, key) { %> <option value="<%= key %>"><%= key %></option> <% }); %>'),

   events: {
      'change select[name="user"]': 'changeUser',
      'click .btn-show-settings': 'showSettings',
      'click .btn-login': 'login',
      'click .btn-check': 'check',
      'click .btn-upload': 'initUpload'
   },

   initialize: function initialize() {
      _.bindAll(this, 'setCurrentModel', 'login', 'check', 'initUpload', 'createSubject', 'createSession', 'createScan', 'upload', 'startPipeline');
      this.xnat = (0, _XnatAPI2['default'])(_config2['default'].XNAT_URL);

      this.$btn_create_session = this.$('.btn-create-session');
      this.$btn_create_scan = this.$('.btn-create-scan');
      this.$btn_login = this.$('.btn-login');
      this.$btn_upload = this.$('.btn-upload');
      this.$btn_check = this.$('.btn-check');
      this.$panel_footer = this.$('.panel-footer');
      this.$select_project = this.$('.uploader-projects select');
      this.$select_user = this.$('select[name="user"]');

      this.collection.on('add', this.login);

      this.setCurrentModel();

      this.$select_user.append(this.template_users({ users: _config2['default'].users }));

      var user = (0, _utilGetQueryVariable2['default'])('user');
      if (!user || !_config2['default'].users[user]) user = localStorage.getItem('user'); // eslint-disable-line curly
      if (!user || !_config2['default'].users[user]) user = _config2['default'].defaultUser; // eslint-disable-line curly

      this.$select_user.val(user);
      this.changeUser(user);
   },

   setCurrentModel: function setCurrentModel() {
      var _this = this;

      if (this.currentModel) {
         this.currentModel.set({
            content: null,
            state: -1 // done
         });
         var projectid = this.currentModel.get('projectid');
         var subjectid = this.currentModel.get('subjectid');
         var sessionid = this.currentModel.get('sessionid');
      }

      var onPseudonymChange = function onPseudonymChange(model, newValue) {
         var timestamped = newValue + '_' + Date.now();
         _this.$('.uploader-session-scan input[name="file"]').val(timestamped);
         _this.$('.uploader-session-scan input[name="session"]').val(newValue);
         _this.$('.uploader-session-scan input[name="scan"]').val(timestamped);
      };

      var newCurrentModel = this.collection.filter(function (model) {
         return model.get('state') === 1;
      })[0];
      if (!newCurrentModel) {
         return false;
      }
      newCurrentModel.set({
         state: 2, // current
         projectid: projectid,
         subjectid: subjectid,
         sessionid: sessionid
      });
      newCurrentModel.on('change:pseudonym', onPseudonymChange);
      onPseudonymChange(newCurrentModel, newCurrentModel.get('pseudonym'));
      this.currentModel = newCurrentModel;
      return true;
   },

   changeUser: function changeUser() {
      var userName = this.$select_user.val();
      var userData = _config2['default'].users[userName];
      localStorage.setItem('user', userName);
      this.setCredentials(userData);
      this.currentModel.set('projectid', userData.project);
      this.login();
   },

   setCredentials: function setCredentials(user) {
      this.$('.uploader-login input[name="username"]').val(user.username);
      this.$('.uploader-login input[name="password"]').val(user.password);
   },

   showSettings: function showSettings() {
      this.$('.upload-details').removeClass('hidden');
      this.$('.btn-show-settings').parent().remove();
   },

   login: function login() {
      var _this2 = this;

      this.$btn_login.html('<i class="fa fa-spinner"></i>');

      var username = this.$('.uploader-login input[name="username"]').val();
      var password = this.$('.uploader-login input[name="password"]').val();

      var successCallback = function successCallback() {
         _this2.$btn_login.html('<i class="fa fa-check"></i>').addClass('btn-success');
         _this2.showProjects();
         _this2.$btn_upload.prop('disabled', false);
      };

      var errorCallback = function errorCallback() {
         _this2.showSettings(); // show details
         _this2.$btn_login.html('<i class="fa fa-warning"></i>').addClass('btn-danger');
         _.delay(function () {
            _this2.$btn_login.html('Login').removeClass('btn-danger btn-success');
         }, 2000);
         _this2.$select_project.empty();
      };

      this.xnat.login(username, password, successCallback, errorCallback);
   },

   check: function check() {
      var _this3 = this;

      var projectid = $('.uploader-projects select').val();
      var project = this.xnat.getProjects().get(projectid);

      this.currentModel.set('projectid', project.get('id'));

      var data = this.last_checked_data = {
         project: projectid,
         subject: '',
         session: '',
         scan: ''
      };

      var queue = [{
         name: 'subject',
         condition: {
            label: $('input[name="pseudonym"]').val()
         }
      }, {
         name: 'session',
         condition: {
            label: this.$('.uploader-session-scan input[name="session"]').val()
         }
      }, {
         name: 'scan',
         condition: {
            id: this.$('.uploader-session-scan input[name="scan"]').val()
         }
      }];

      var final = function final() {
         console.log('final');
         var html = _.map(data, function (value, key) {
            var msg = data[key] ? 'already exists (' + value + ')' : 'has to be created';
            return '<p class="lead"><strong>' + key + '</strong> ' + msg + '</p>';
         }).join('');

         $('.uploader-check').find('.uploader-check-output').removeClass('hidden').html(html);
      };

      var fetch = function fetch() {
         var currentStep = queue.shift();
         console.log('fetch', currentStep);
         _this3.xnat.fetch(currentStep.name, data, {
            success: function success(collection) {
               console.log('success', currentStep.name);
               var model = collection.findWhere(currentStep.condition);
               console.log('model', model);
               if (model) {
                  // eslint-disable-line curly
                  data[currentStep.name] = model.get('id');
                  if (queue.length) fetch(queue); // eslint-disable-line curly
                  else final();
               } else final();
            }
         });
      };

      fetch();
   },

   initUpload: function initUpload() {
      var _this4 = this;

      this.currentModel.set('investigator', $('.uploader input[name="investigator"]').val());
      this.currentModel.set('diagnose', $('.uploader input[name="diagnose"]').val());

      if (this.currentModel.get('state') === -1 && !this.setCurrentModel()) {
         return null;
      }

      this.createSubject().then(this.createSession).then(this.createScan).then(this.upload).then(this.startPipeline)['catch'](function (err) {
         return console.error(err);
      }).then(this.setCurrentModel).then(function (hasModel) {
         return hasModel ? _this4.initUpload() : console.log('Upload finished');
      });
   },

   // --- HELPER ---

   showProjects: function showProjects() {
      var _this5 = this;

      var success = function success(collection) {
         console.log('SUCCESS');
         _this5.$select_project.html(_this5.template_projects({
            models: collection.toJSON()
         }));
         _this5.$('.uploader-projects, .uploader-session-scan').removeClass('hidden');
         _this5.$select_project.val(_this5.currentModel.get('projectid')); // select current project
         _this5.$panel_footer.removeClass('hidden');
      };

      var error = function error() {
         return _this5.$select_project.empty();
      };

      this.xnat.getProjects({ success: success, error: error });
   },

   // TODO unused -> remove
   getSubjects: function getSubjects() {},

   createSubject: function createSubject() {
      var _this6 = this;

      return new Promise(function (resolve) {
         if (_this6.currentModel.has('subjectid')) {
            resolve();
         } else {
            var subject_name = $('input[name="pseudonym"]').val();
            _this6.xnat.createSubject(subject_name, _this6.currentModel, function (subjectid) {
               _this6.currentModel.set('subjectid', subjectid);
               resolve();
            });
         }
      });
   },

   createSession: function createSession() {
      var _this7 = this;

      return new Promise(function (resolve) {
         if (_this7.currentModel.has('sessionid')) {
            resolve();
         } else {
            var session_name = _this7.$('.uploader-session-scan input[name="session"]').val();
            _this7.xnat.createSession(session_name, _this7.currentModel, function (sessionid) {
               _this7.currentModel.set('sessionid', sessionid);
               resolve();
            });
         }
      });
   },

   createScan: function createScan() {
      var _this8 = this;

      return new Promise(function (resolve) {
         if (_this8.currentModel.has('scanid')) {
            resolve();
         } else {
            (function () {
               var scan_name = _this8.$('.uploader-session-scan input[name="scan"]').val();

               _this8.xnat.createScan(scan_name, _this8.currentModel, function () {
                  _this8.currentModel.set('scanid', scan_name);

                  _this8.xnat.createResource('EDF', _this8.currentModel, function () {
                     _this8.currentModel.set('resourceid', 'EDF');
                     resolve();
                  });
               });
            })();
         }
      });
   },

   upload: function upload() {
      var _this9 = this;

      console.log('upload', this.currentModel.get('content').byteLength);

      var filename = this.$('.uploader-session-scan input[name="file"]').val();
      if (filename) {
         this.currentModel.set('name', filename);
      }

      var progress = new _utilProgress2['default']();
      $('.uploader-check').addClass('hidden');
      this.$panel_footer.append(progress.el);
      this.$btn_check.html('<i class="fa fa-spinner"></i>');

      return new Promise(function (resolve) {
         _this9.xnat.upload(_this9.currentModel, progress, function () {
            _this9.$btn_check.html('<i class="fa fa-check"></i>');
            _this9.$btn_upload.prop('disabled', true);
            progress.remove();
            resolve();
         });
      });
   },

   startPipeline: function startPipeline() {
      var _this10 = this;

      return new Promise(function (resolve) {
         _this10.xnat.startPipeline(_this10.currentModel, resolve);
      });
   }

});
module.exports = exports['default'];
/*sessionid*/

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/javascript/views/UploaderView.js","/javascript/views")

},{"XnatAPI":1,"_process":25,"buffer":21,"config":2,"util/Progress":10,"util/getQueryVariable":11}],21:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */

var base64 = require('base64-js')
var ieee754 = require('ieee754')
var isArray = require('is-array')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192 // not used by this implementation

var rootParent = {}

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Note:
 *
 * - Implementation must support adding new properties to `Uint8Array` instances.
 *   Firefox 4-29 lacked support, fixed in Firefox 30+.
 *   See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *  - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *  - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *    incorrect length in some situations.
 *
 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they will
 * get the Object implementation, which is slower but will work correctly.
 */
Buffer.TYPED_ARRAY_SUPPORT = (function () {
  function Foo () {}
  try {
    var buf = new ArrayBuffer(0)
    var arr = new Uint8Array(buf)
    arr.foo = function () { return 42 }
    arr.constructor = Foo
    return arr.foo() === 42 && // typed array instances can be augmented
        arr.constructor === Foo && // constructor can be set
        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
        new Uint8Array(1).subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
  } catch (e) {
    return false
  }
})()

function kMaxLength () {
  return Buffer.TYPED_ARRAY_SUPPORT
    ? 0x7fffffff
    : 0x3fffffff
}

/**
 * Class: Buffer
 * =============
 *
 * The Buffer constructor returns instances of `Uint8Array` that are augmented
 * with function properties for all the node `Buffer` API functions. We use
 * `Uint8Array` so that square bracket notation works as expected -- it returns
 * a single octet.
 *
 * By augmenting the instances, we can avoid modifying the `Uint8Array`
 * prototype.
 */
function Buffer (arg) {
  if (!(this instanceof Buffer)) {
    // Avoid going through an ArgumentsAdaptorTrampoline in the common case.
    if (arguments.length > 1) return new Buffer(arg, arguments[1])
    return new Buffer(arg)
  }

  this.length = 0
  this.parent = undefined

  // Common case.
  if (typeof arg === 'number') {
    return fromNumber(this, arg)
  }

  // Slightly less common case.
  if (typeof arg === 'string') {
    return fromString(this, arg, arguments.length > 1 ? arguments[1] : 'utf8')
  }

  // Unusual.
  return fromObject(this, arg)
}

function fromNumber (that, length) {
  that = allocate(that, length < 0 ? 0 : checked(length) | 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < length; i++) {
      that[i] = 0
    }
  }
  return that
}

function fromString (that, string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') encoding = 'utf8'

  // Assumption: byteLength() return value is always < kMaxLength.
  var length = byteLength(string, encoding) | 0
  that = allocate(that, length)

  that.write(string, encoding)
  return that
}

function fromObject (that, object) {
  if (Buffer.isBuffer(object)) return fromBuffer(that, object)

  if (isArray(object)) return fromArray(that, object)

  if (object == null) {
    throw new TypeError('must start with number, buffer, array or string')
  }

  if (typeof ArrayBuffer !== 'undefined' && object.buffer instanceof ArrayBuffer) {
    return fromTypedArray(that, object)
  }

  if (object.length) return fromArrayLike(that, object)

  return fromJsonObject(that, object)
}

function fromBuffer (that, buffer) {
  var length = checked(buffer.length) | 0
  that = allocate(that, length)
  buffer.copy(that, 0, 0, length)
  return that
}

function fromArray (that, array) {
  var length = checked(array.length) | 0
  that = allocate(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

// Duplicate of fromArray() to keep fromArray() monomorphic.
function fromTypedArray (that, array) {
  var length = checked(array.length) | 0
  that = allocate(that, length)
  // Truncating the elements is probably not what people expect from typed
  // arrays with BYTES_PER_ELEMENT > 1 but it's compatible with the behavior
  // of the old Buffer constructor.
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

function fromArrayLike (that, array) {
  var length = checked(array.length) | 0
  that = allocate(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

// Deserialize { type: 'Buffer', data: [1,2,3,...] } into a Buffer object.
// Returns a zero-length buffer for inputs that don't conform to the spec.
function fromJsonObject (that, object) {
  var array
  var length = 0

  if (object.type === 'Buffer' && isArray(object.data)) {
    array = object.data
    length = checked(array.length) | 0
  }
  that = allocate(that, length)

  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

function allocate (that, length) {
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = Buffer._augment(new Uint8Array(length))
  } else {
    // Fallback: Return an object instance of the Buffer class
    that.length = length
    that._isBuffer = true
  }

  var fromPool = length !== 0 && length <= Buffer.poolSize >>> 1
  if (fromPool) that.parent = rootParent

  return that
}

function checked (length) {
  // Note: cannot use `length < kMaxLength` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= kMaxLength()) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + kMaxLength().toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (subject, encoding) {
  if (!(this instanceof SlowBuffer)) return new SlowBuffer(subject, encoding)

  var buf = new Buffer(subject, encoding)
  delete buf.parent
  return buf
}

Buffer.isBuffer = function isBuffer (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function compare (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError('Arguments must be Buffers')
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  var i = 0
  var len = Math.min(x, y)
  while (i < len) {
    if (a[i] !== b[i]) break

    ++i
  }

  if (i !== len) {
    x = a[i]
    y = b[i]
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!isArray(list)) throw new TypeError('list argument must be an Array of Buffers.')

  if (list.length === 0) {
    return new Buffer(0)
  } else if (list.length === 1) {
    return list[0]
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; i++) {
      length += list[i].length
    }
  }

  var buf = new Buffer(length)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var item = list[i]
    item.copy(buf, pos)
    pos += item.length
  }
  return buf
}

function byteLength (string, encoding) {
  if (typeof string !== 'string') string = '' + string

  var len = string.length
  if (len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'binary':
      // Deprecated
      case 'raw':
      case 'raws':
        return len
      case 'utf8':
      case 'utf-8':
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) return utf8ToBytes(string).length // assume utf8
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

// pre-set for values that may exist in the future
Buffer.prototype.length = undefined
Buffer.prototype.parent = undefined

function slowToString (encoding, start, end) {
  var loweredCase = false

  start = start | 0
  end = end === undefined || end === Infinity ? this.length : end | 0

  if (!encoding) encoding = 'utf8'
  if (start < 0) start = 0
  if (end > this.length) end = this.length
  if (end <= start) return ''

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'binary':
        return binarySlice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toString = function toString () {
  var length = this.length | 0
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max) str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return 0
  return Buffer.compare(this, b)
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset) {
  if (byteOffset > 0x7fffffff) byteOffset = 0x7fffffff
  else if (byteOffset < -0x80000000) byteOffset = -0x80000000
  byteOffset >>= 0

  if (this.length === 0) return -1
  if (byteOffset >= this.length) return -1

  // Negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = Math.max(this.length + byteOffset, 0)

  if (typeof val === 'string') {
    if (val.length === 0) return -1 // special case: looking for empty string always fails
    return String.prototype.indexOf.call(this, val, byteOffset)
  }
  if (Buffer.isBuffer(val)) {
    return arrayIndexOf(this, val, byteOffset)
  }
  if (typeof val === 'number') {
    if (Buffer.TYPED_ARRAY_SUPPORT && Uint8Array.prototype.indexOf === 'function') {
      return Uint8Array.prototype.indexOf.call(this, val, byteOffset)
    }
    return arrayIndexOf(this, [ val ], byteOffset)
  }

  function arrayIndexOf (arr, val, byteOffset) {
    var foundIndex = -1
    for (var i = 0; byteOffset + i < arr.length; i++) {
      if (arr[byteOffset + i] === val[foundIndex === -1 ? 0 : i - foundIndex]) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === val.length) return byteOffset + foundIndex
      } else {
        foundIndex = -1
      }
    }
    return -1
  }

  throw new TypeError('val must be string, number or Buffer')
}

// `get` will be removed in Node 0.13+
Buffer.prototype.get = function get (offset) {
  console.log('.get() is deprecated. Access using array indexes instead.')
  return this.readUInt8(offset)
}

// `set` will be removed in Node 0.13+
Buffer.prototype.set = function set (v, offset) {
  console.log('.set() is deprecated. Access using array indexes instead.')
  return this.writeUInt8(v, offset)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new Error('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (isNaN(parsed)) throw new Error('Invalid hex string')
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function binaryWrite (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset | 0
    if (isFinite(length)) {
      length = length | 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  // legacy write(string, encoding, offset, length) - remove in v0.13
  } else {
    var swap = encoding
    encoding = offset
    offset = length | 0
    length = swap
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'binary':
        return binaryWrite(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  var res = ''
  var tmp = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    if (buf[i] <= 0x7F) {
      res += decodeUtf8Char(tmp) + String.fromCharCode(buf[i])
      tmp = ''
    } else {
      tmp += '%' + buf[i].toString(16)
    }
  }

  return res + decodeUtf8Char(tmp)
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function binarySlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    newBuf = Buffer._augment(this.subarray(start, end))
  } else {
    var sliceLen = end - start
    newBuf = new Buffer(sliceLen, undefined)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
  }

  if (newBuf.length) newBuf.parent = this.parent || this

  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('buffer must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('value is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkInt(this, value, offset, byteLength, Math.pow(2, 8 * byteLength), 0)

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkInt(this, value, offset, byteLength, Math.pow(2, 8 * byteLength), 0)

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  this[offset] = value
  return offset + 1
}

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; i++) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = value
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; i++) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24)
    this[offset + 2] = (value >>> 16)
    this[offset + 1] = (value >>> 8)
    this[offset] = value
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = value
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = value < 0 ? 1 : 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = value < 0 ? 1 : 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  if (value < 0) value = 0xff + value + 1
  this[offset] = value
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = value
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
    this[offset + 2] = (value >>> 16)
    this[offset + 3] = (value >>> 24)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = value
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (value > max || value < min) throw new RangeError('value is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('index out of range')
  if (offset < 0) throw new RangeError('index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start

  if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < len; i++) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    target._set(this.subarray(start, start + len), targetStart)
  }

  return len
}

// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function fill (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  if (end < start) throw new RangeError('end < start')

  // Fill 0 bytes; we're done
  if (end === start) return
  if (this.length === 0) return

  if (start < 0 || start >= this.length) throw new RangeError('start out of bounds')
  if (end < 0 || end > this.length) throw new RangeError('end out of bounds')

  var i
  if (typeof value === 'number') {
    for (i = start; i < end; i++) {
      this[i] = value
    }
  } else {
    var bytes = utf8ToBytes(value.toString())
    var len = bytes.length
    for (i = start; i < end; i++) {
      this[i] = bytes[i % len]
    }
  }

  return this
}

/**
 * Creates a new `ArrayBuffer` with the *copied* memory of the buffer instance.
 * Added in Node 0.12. Only available in browsers that support ArrayBuffer.
 */
Buffer.prototype.toArrayBuffer = function toArrayBuffer () {
  if (typeof Uint8Array !== 'undefined') {
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      return (new Buffer(this)).buffer
    } else {
      var buf = new Uint8Array(this.length)
      for (var i = 0, len = buf.length; i < len; i += 1) {
        buf[i] = this[i]
      }
      return buf.buffer
    }
  } else {
    throw new TypeError('Buffer.toArrayBuffer not supported in this browser')
  }
}

// HELPER FUNCTIONS
// ================

var BP = Buffer.prototype

/**
 * Augment a Uint8Array *instance* (not the Uint8Array class!) with Buffer methods
 */
Buffer._augment = function _augment (arr) {
  arr.constructor = Buffer
  arr._isBuffer = true

  // save reference to original Uint8Array set method before overwriting
  arr._set = arr.set

  // deprecated, will be removed in node 0.13+
  arr.get = BP.get
  arr.set = BP.set

  arr.write = BP.write
  arr.toString = BP.toString
  arr.toLocaleString = BP.toString
  arr.toJSON = BP.toJSON
  arr.equals = BP.equals
  arr.compare = BP.compare
  arr.indexOf = BP.indexOf
  arr.copy = BP.copy
  arr.slice = BP.slice
  arr.readUIntLE = BP.readUIntLE
  arr.readUIntBE = BP.readUIntBE
  arr.readUInt8 = BP.readUInt8
  arr.readUInt16LE = BP.readUInt16LE
  arr.readUInt16BE = BP.readUInt16BE
  arr.readUInt32LE = BP.readUInt32LE
  arr.readUInt32BE = BP.readUInt32BE
  arr.readIntLE = BP.readIntLE
  arr.readIntBE = BP.readIntBE
  arr.readInt8 = BP.readInt8
  arr.readInt16LE = BP.readInt16LE
  arr.readInt16BE = BP.readInt16BE
  arr.readInt32LE = BP.readInt32LE
  arr.readInt32BE = BP.readInt32BE
  arr.readFloatLE = BP.readFloatLE
  arr.readFloatBE = BP.readFloatBE
  arr.readDoubleLE = BP.readDoubleLE
  arr.readDoubleBE = BP.readDoubleBE
  arr.writeUInt8 = BP.writeUInt8
  arr.writeUIntLE = BP.writeUIntLE
  arr.writeUIntBE = BP.writeUIntBE
  arr.writeUInt16LE = BP.writeUInt16LE
  arr.writeUInt16BE = BP.writeUInt16BE
  arr.writeUInt32LE = BP.writeUInt32LE
  arr.writeUInt32BE = BP.writeUInt32BE
  arr.writeIntLE = BP.writeIntLE
  arr.writeIntBE = BP.writeIntBE
  arr.writeInt8 = BP.writeInt8
  arr.writeInt16LE = BP.writeInt16LE
  arr.writeInt16BE = BP.writeInt16BE
  arr.writeInt32LE = BP.writeInt32LE
  arr.writeInt32BE = BP.writeInt32BE
  arr.writeFloatLE = BP.writeFloatLE
  arr.writeFloatBE = BP.writeFloatBE
  arr.writeDoubleLE = BP.writeDoubleLE
  arr.writeDoubleBE = BP.writeDoubleBE
  arr.fill = BP.fill
  arr.inspect = BP.inspect
  arr.toArrayBuffer = BP.toArrayBuffer

  return arr
}

var INVALID_BASE64_RE = /[^+\/0-9A-z\-]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []
  var i = 0

  for (; i < length; i++) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (leadSurrogate) {
        // 2 leads in a row
        if (codePoint < 0xDC00) {
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          leadSurrogate = codePoint
          continue
        } else {
          // valid surrogate pair
          codePoint = leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00 | 0x10000
          leadSurrogate = null
        }
      } else {
        // no lead yet

        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else {
          // valid lead
          leadSurrogate = codePoint
          continue
        }
      }
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
      leadSurrogate = null
    }

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x200000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

function decodeUtf8Char (str) {
  try {
    return decodeURIComponent(str)
  } catch (err) {
    return String.fromCharCode(0xFFFD) // UTF 8 invalid char
  }
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/node_modules/browserify/node_modules/buffer/index.js","/node_modules/browserify/node_modules/buffer")

},{"_process":25,"base64-js":22,"buffer":21,"ieee754":23,"is-array":24}],22:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

;(function (exports) {
	'use strict';

  var Arr = (typeof Uint8Array !== 'undefined')
    ? Uint8Array
    : Array

	var PLUS   = '+'.charCodeAt(0)
	var SLASH  = '/'.charCodeAt(0)
	var NUMBER = '0'.charCodeAt(0)
	var LOWER  = 'a'.charCodeAt(0)
	var UPPER  = 'A'.charCodeAt(0)
	var PLUS_URL_SAFE = '-'.charCodeAt(0)
	var SLASH_URL_SAFE = '_'.charCodeAt(0)

	function decode (elt) {
		var code = elt.charCodeAt(0)
		if (code === PLUS ||
		    code === PLUS_URL_SAFE)
			return 62 // '+'
		if (code === SLASH ||
		    code === SLASH_URL_SAFE)
			return 63 // '/'
		if (code < NUMBER)
			return -1 //no match
		if (code < NUMBER + 10)
			return code - NUMBER + 26 + 26
		if (code < UPPER + 26)
			return code - UPPER
		if (code < LOWER + 26)
			return code - LOWER + 26
	}

	function b64ToByteArray (b64) {
		var i, j, l, tmp, placeHolders, arr

		if (b64.length % 4 > 0) {
			throw new Error('Invalid string. Length must be a multiple of 4')
		}

		// the number of equal signs (place holders)
		// if there are two placeholders, than the two characters before it
		// represent one byte
		// if there is only one, then the three characters before it represent 2 bytes
		// this is just a cheap hack to not do indexOf twice
		var len = b64.length
		placeHolders = '=' === b64.charAt(len - 2) ? 2 : '=' === b64.charAt(len - 1) ? 1 : 0

		// base64 is 4/3 + up to two characters of the original data
		arr = new Arr(b64.length * 3 / 4 - placeHolders)

		// if there are placeholders, only get up to the last complete 4 chars
		l = placeHolders > 0 ? b64.length - 4 : b64.length

		var L = 0

		function push (v) {
			arr[L++] = v
		}

		for (i = 0, j = 0; i < l; i += 4, j += 3) {
			tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
			push((tmp & 0xFF0000) >> 16)
			push((tmp & 0xFF00) >> 8)
			push(tmp & 0xFF)
		}

		if (placeHolders === 2) {
			tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
			push(tmp & 0xFF)
		} else if (placeHolders === 1) {
			tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
			push((tmp >> 8) & 0xFF)
			push(tmp & 0xFF)
		}

		return arr
	}

	function uint8ToBase64 (uint8) {
		var i,
			extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
			output = "",
			temp, length

		function encode (num) {
			return lookup.charAt(num)
		}

		function tripletToBase64 (num) {
			return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
		}

		// go through the array every three bytes, we'll deal with trailing stuff later
		for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
			temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
			output += tripletToBase64(temp)
		}

		// pad the end with zeros, but make sure to not forget the extra bytes
		switch (extraBytes) {
			case 1:
				temp = uint8[uint8.length - 1]
				output += encode(temp >> 2)
				output += encode((temp << 4) & 0x3F)
				output += '=='
				break
			case 2:
				temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
				output += encode(temp >> 10)
				output += encode((temp >> 4) & 0x3F)
				output += encode((temp << 2) & 0x3F)
				output += '='
				break
		}

		return output
	}

	exports.toByteArray = b64ToByteArray
	exports.fromByteArray = uint8ToBase64
}(typeof exports === 'undefined' ? (this.base64js = {}) : exports))

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/node_modules/browserify/node_modules/buffer/node_modules/base64-js/lib/b64.js","/node_modules/browserify/node_modules/buffer/node_modules/base64-js/lib")

},{"_process":25,"buffer":21}],23:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/node_modules/browserify/node_modules/buffer/node_modules/ieee754/index.js","/node_modules/browserify/node_modules/buffer/node_modules/ieee754")

},{"_process":25,"buffer":21}],24:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){

/**
 * isArray
 */

var isArray = Array.isArray;

/**
 * toString
 */

var str = Object.prototype.toString;

/**
 * Whether or not the given `val`
 * is an array.
 *
 * example:
 *
 *        isArray([]);
 *        // > true
 *        isArray(arguments);
 *        // > false
 *        isArray('');
 *        // > false
 *
 * @param {mixed} val
 * @return {bool}
 */

module.exports = isArray || function (val) {
  return !! val && '[object Array]' == str.call(val);
};

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/node_modules/browserify/node_modules/buffer/node_modules/is-array/index.js","/node_modules/browserify/node_modules/buffer/node_modules/is-array")

},{"_process":25,"buffer":21}],25:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = setTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            currentQueue[queueIndex].run();
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    clearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        setTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/node_modules/browserify/node_modules/process/browser.js","/node_modules/browserify/node_modules/process")

},{"_process":25,"buffer":21}]},{},[3])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvbWF4YmVpZXIvU2l0ZXMvRURGLVVwbG9hZGVyL2phdmFzY3JpcHQvWG5hdEFQSS5qcyIsIi9Vc2Vycy9tYXhiZWllci9TaXRlcy9FREYtVXBsb2FkZXIvamF2YXNjcmlwdC9jb25maWcuanMiLCIvVXNlcnMvbWF4YmVpZXIvU2l0ZXMvRURGLVVwbG9hZGVyL2phdmFzY3JpcHQvaW5pdC5qcyIsIi9Vc2Vycy9tYXhiZWllci9TaXRlcy9FREYtVXBsb2FkZXIvamF2YXNjcmlwdC9tb2RlbHMvRmlsZUNvbGxlY3Rpb24uanMiLCIvVXNlcnMvbWF4YmVpZXIvU2l0ZXMvRURGLVVwbG9hZGVyL2phdmFzY3JpcHQvbW9kZWxzL0ZpbGVNb2RlbC5qcyIsIi9Vc2Vycy9tYXhiZWllci9TaXRlcy9FREYtVXBsb2FkZXIvamF2YXNjcmlwdC9tb2RlbHMvWG5hdE1vZGVsLmpzIiwiL1VzZXJzL21heGJlaWVyL1NpdGVzL0VERi1VcGxvYWRlci9qYXZhc2NyaXB0L3RyYW5zZm9ybWVycy9FREYuanMiLCIvVXNlcnMvbWF4YmVpZXIvU2l0ZXMvRURGLVVwbG9hZGVyL2phdmFzY3JpcHQvdHJhbnNmb3JtZXJzL1hNTC5qcyIsIi9Vc2Vycy9tYXhiZWllci9TaXRlcy9FREYtVXBsb2FkZXIvamF2YXNjcmlwdC91dGlsL0ZpbGVTYXZlci5qcyIsIi9Vc2Vycy9tYXhiZWllci9TaXRlcy9FREYtVXBsb2FkZXIvamF2YXNjcmlwdC91dGlsL1Byb2dyZXNzLmpzIiwiL1VzZXJzL21heGJlaWVyL1NpdGVzL0VERi1VcGxvYWRlci9qYXZhc2NyaXB0L3V0aWwvZ2V0UXVlcnlWYXJpYWJsZS5qcyIsIi9Vc2Vycy9tYXhiZWllci9TaXRlcy9FREYtVXBsb2FkZXIvamF2YXNjcmlwdC91dGlsL2pxdWVyeS5hamF4LnByb2dyZXNzLmpzIiwiL1VzZXJzL21heGJlaWVyL1NpdGVzL0VERi1VcGxvYWRlci9qYXZhc2NyaXB0L3V0aWwvc2l6ZUZvcm1hdHRlci5qcyIsIi9Vc2Vycy9tYXhiZWllci9TaXRlcy9FREYtVXBsb2FkZXIvamF2YXNjcmlwdC91dGlsL3ppcC1leHQuanMiLCIvVXNlcnMvbWF4YmVpZXIvU2l0ZXMvRURGLVVwbG9hZGVyL2phdmFzY3JpcHQvdXRpbC96aXAuanMiLCIvVXNlcnMvbWF4YmVpZXIvU2l0ZXMvRURGLVVwbG9hZGVyL2phdmFzY3JpcHQvdmlld3MvRmlsZU1hbmFnZXJJdGVtVmlldy5qcyIsIi9Vc2Vycy9tYXhiZWllci9TaXRlcy9FREYtVXBsb2FkZXIvamF2YXNjcmlwdC92aWV3cy9GaWxlTWFuYWdlclZpZXcuanMiLCIvVXNlcnMvbWF4YmVpZXIvU2l0ZXMvRURGLVVwbG9hZGVyL2phdmFzY3JpcHQvdmlld3MvRmlsZVJlYWRlclZpZXcuanMiLCIvVXNlcnMvbWF4YmVpZXIvU2l0ZXMvRURGLVVwbG9hZGVyL2phdmFzY3JpcHQvdmlld3MvUHNldWRvbnltVmlldy5qcyIsIi9Vc2Vycy9tYXhiZWllci9TaXRlcy9FREYtVXBsb2FkZXIvamF2YXNjcmlwdC92aWV3cy9VcGxvYWRlclZpZXcuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2J1ZmZlci9ub2RlX21vZHVsZXMvYmFzZTY0LWpzL2xpYi9iNjQuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9pZWVlNzU0L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2J1ZmZlci9ub2RlX21vZHVsZXMvaXMtYXJyYXkvaW5kZXguanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvcHJvY2Vzcy9icm93c2VyLmpzIl0sIm5hbWVzIjpb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QUFFLEdBQVEsRUFBRSxHQUFRLEVBQUUsR0FBUSxFQUFFLEdBQVEsRUFBRSxHQUFRLEVBQUUsR0FBUSxFQUFFLEdBQVEsRUFBRSxHQUFRLEVBQzFJLEdBQVEsRUFBRSxHQUFRLEVBQUUsR0FBUSxFQUFFLEdBQVEsRUFBRSxHQUFRLEVBQUUsR0FBUSxFQUFFLEdBQVEsRUFBRSxHQUFRLEVBQUUsR0FBUSxFQUFFLEdBQVEsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFRLEVBQUUsR0FBUSxFQUNySSxHQUFRLEVBQUUsR0FBUSxFQUFFLEdBQVEsRUFBRSxHQUFRLEVBQUUsR0FBUSxFQUFFLEdBQVEsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQVEsRUFBRSxHQUFRLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQVEsRUFDckksR0FBUSxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFRLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFRLEVBQUUsR0FBUSxFQUFFLEdBQVEsRUFBRSxHQUFRLEVBQUUsR0FBUSxFQUFFLEdBQVEsRUFBRSxHQUFHLEVBQUUsR0FBUSxFQUFFLEdBQVEsRUFDckksR0FBUSxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFRLEVBQUUsR0FBUSxFQUFFLEdBQUcsRUFBRSxHQUFRLEVBQUUsR0FBUSxFQUFFLEdBQVEsRUFBRSxHQUFRLEVBQUUsR0FBUSxFQUFFLEdBQVEsRUFBRSxHQUFRLEVBQUUsR0FBUSxFQUNySSxHQUFRLEVBQUUsR0FBUSxFQUFFLEdBQVEsRUFBRSxHQUFRLEVBQUUsR0FBUSxFQUFFLEdBQVEsRUFBRSxHQUFRLEVBQUUsR0FBUSxFQUFFLEdBQVEsRUFBRSxHQUFRLEVBQUUsR0FBRyxFQUFFLEdBQVEsRUFBRSxHQUFRLEVBQUUsR0FBUSxFQUNySSxHQUFRLEVBQUUs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QUFDLENBQUM7TUFDckQsQ0FBQztBQUNGLFdBQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxVQUFVLENBQUMsQ0FBQztBQUNyQyxTQUFJLE9BQU8sQ0FBQyxPQUFPLEVBQ2xCLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUM7QUFDMUMsU0FBSSxDQUFDLFdBQVcsSUFBSSxPQUFPLENBQUMsS0FBSyxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQzVELE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsQ0FBQztBQUNsQyxXQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsQUFBQyxDQUFDLEFBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsR0FBSSxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUEsSUFBSyxDQUFDLEdBQUksSUFBSSxDQUFDLFVBQVUsRUFBRSxHQUFHLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztBQUM1RyxXQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsQUFBQyxDQUFDLEFBQUMsQUFBQyxJQUFJLENBQUMsV0FBVyxFQUFFLEdBQUcsSUFBSSxJQUFLLENBQUMsR0FBSyxJQUFJLENBQUMsUUFBUSxFQUFFLEdBQUcsQ0FBQyxDQUFDLElBQUssQ0FBQyxHQUFJLElBQUksQ0FBQyxPQUFPLEVBQUUsRUFBRSxJQUFJLENBQUMsQ0FBQztBQUNySCxXQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFLEVBQUUsUUFBUSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQztBQUNqRCxTQUFJLEdBQUcsYUFBYSxDQUFDLEVBQUUsR0FBRyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDM0MsU0FBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLFVBQVUsQ0FBQyxD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Q0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssR0FBRyxDQUFDLEVBQUUsTUFBTSxDQUFDLENBQUM7QUFDdkMsU0FBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDNUMsU0FBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxHQUFHLEVBQUUsRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQztBQUMzRCxTQUFJLElBQUksQ0FBQyxTQUFTLEVBQ2pCLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssR0FBRyxFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDdEMsU0FBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxHQUFHLEVBQUUsRUFBRSxJQUFJLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQ25ELFNBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsS0FBSyxHQUFHLEVBQUUsQ0FBQyxDQUFDO0FBQzFDLFNBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsS0FBSyxHQUFHLEVBQUUsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQ2hFLFVBQUssSUFBSSxFQUFFLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUM7S0FDekQ7QUFDRCxRQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsVUFBVSxDQUFDLENBQUM7QUFDdkMsUUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxHQUFHLENBQUMsRUFBRSxTQUFTLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQ3ZELFFBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFD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RUQsZ0JBQWEsRUFBQSx5QkFBRzs7O0FBQ2IsYUFBTyxJQUFJLE9BQU8sQ0FBQyxVQUFBLE9BQU8sRUFBSTtBQUMzQixpQkFBSyxJQUFJLENBQUMsYUFBYSxDQUFDLFFBQUssWUFBWSxFQUFFLE9BQU8sQ0FBQyxDQUFDO09BQ3RELENBQUMsQ0FBQztJQUNMOztDQUVILENBQUM7Ozs7Ozs7O0FDeFVGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQzc1Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUM1SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDcEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQ2pDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvKmVzbGludCBrZXktc3BhY2luZzowIG5vLW11bHRpLXNwYWNlczowKi9cbmltcG9ydCB7IENvbGxlY3Rpb24gfSBmcm9tICdtb2RlbHMvWG5hdE1vZGVsJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24oaG9zdCkge1xuXG4gICB2YXIgdGVtcGxhdGVzID0ge307XG4gICB0ZW1wbGF0ZXMucHJvamVjdCAgPSBob3N0ICAgICAgICAgICAgICArICcvUkVTVC9wcm9qZWN0cy88JT0gcHJvamVjdCAlPic7XG4gICB0ZW1wbGF0ZXMuc3ViamVjdCAgPSB0ZW1wbGF0ZXMucHJvamVjdCArICcvc3ViamVjdHMvPCU9IHN1YmplY3QgJT4nO1xuICAgdGVtcGxhdGVzLnNlc3Npb24gID0gdGVtcGxhdGVzLnN1YmplY3QgKyAnL2V4cGVyaW1lbnRzLzwlPSBzZXNzaW9uICU+JztcbiAgIHRlbXBsYXRlcy5zY2FuICAgICA9IHRlbXBsYXRlcy5zZXNzaW9uICsgJy9zY2Fucy88JT0gc2NhbiAlPic7XG4gICB0ZW1wbGF0ZXMucmVzb3VyY2UgPSB0ZW1wbGF0ZXMuc2NhbiAgICArICcvcmVzb3VyY2VzLzwlPSByZXNvdXJjZSAlPic7XG5cbiAgIHRlbXBsYXRlcy5jcmVhdGUgPSB7XG4gICAgICBzdWJqZWN0OiAgdGVtcGxhdGVzLnN1YmplY3QgICsgJz9ncm91cD08JT0gZGlhZ25vc2UgJT4mc3JjPTwlPSBpbnZlc3RpZ2F0b3IgJT4nLFxuICAgICAgc2Vzc2lvbjogIHRlbXBsYXRlcy5zZXNzaW9uICArICc/c25ldDAxOlNsZWVwUmVzZWFyY2hTZXNzaW9uRGF0YS9kYXRlPTwlPSBkYXRlICU+JyxcbiAgICAgIHNjYW46ICAgICB0ZW1wbGF0ZXMuc2NhbiAgICAgKyAnP3hzaVR5cGU9c25ldDAxOnBzZ1NjYW5EYXRhJyxcbiAgICAgIHJlc291cmNlOiB0ZW1wbGF0ZXMucmVzb3VyY2UgKyAnP2Zvcm1hdD08JT0gZm9ybWF0ICU+JyxcbiAgICAgIGZpbGU6ICAgICB0ZW1wbGF0ZXMucmVzb3VyY2UgKyAnL2ZpbGVzLzwlPSBuYW1lICU+XzwlPSB0aW1lc3RhbXAgJT4uZWRmJ1xuICAgfTtcblxuICAgdmFyIHByb2plY3RzO1xuICAgdmFyIHRpbWVzdGFtcCA9IH5+KERhdGUubm93KCkgLyAxMDAwKTtcblxuICAgLy8gc2VlIGh0dHBzOi8vd2lraS54bmF0Lm9yZy9wYWdlcy92aWV3cGFnZS5hY3Rpb24/cGFnZUlkPTYyMjYyNjRcbiAgIC8vIEdFVCBpbnN0ZWFkIG9mIFBPU1QgYmVjYXVzZSDigKYgeWVhaCDigKYgb3RoZXJ3aXNlIGl0IGRvZXNuJ3Qgd29ya1xuICAgdmFyIGxvZ2luID0gZnVuY3Rpb24odXNlcm5hbWUsIHBhc3N3b3JkLCBzdWNjZXNzLCBmYWlsKSB7XG4gICAgICAkLmFqYXgoe1xuICAgICAgICAgdXJsOiBob3N0ICsgJy9kYXRhL0pTRVNTSU9OJyxcbiAgICAgICAgIHR5cGU6ICdHRVQnLFxuICAgICAgICAgYmVmb3JlU2VuZDogZnVuY3Rpb24oeGhyKSB7XG4gICAgICAgICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcignQXV0aG9yaXphdGlvbicsICdCYXNpYyAnICsgYnRvYSh1c2VybmFtZSArICc6JyArIHBhc3N3b3JkKSk7XG4gICAgICAgICB9XG4gICAgICB9KS5kb25lKHN1Y2Nlc3MpLmZhaWwoZmFpbCk7XG4gICB9O1xuXG4gICB2YXIgZmV0Y2hQcm9qZWN0cyA9IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICAgIGlmICghcHJvamVjdHMpIHtcbiAgICAgICAgIHByb2plY3RzID0gbmV3IENvbGxlY3Rpb24oeyBob3N0LCB1cmw6IGhvc3QgKyAnL1JFU1QvcHJvamVjdHMnfSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gcHJvamVjdHMuZmV0Y2gob3B0aW9ucyk7XG4gICB9O1xuXG4gICB2YXIgZ2V0UHJvamVjdHMgPSBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgICByZXR1cm4gcHJvamVjdHMgfHwgZmV0Y2hQcm9qZWN0cyhvcHRpb25zKTtcbiAgIH07XG5cbiAgIHZhciBmZXRjaCA9IGZ1bmN0aW9uKG5hbWUsIGRhdGEsIG9wdGlvbnMpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdYbmF0QVBJIC0gZmV0Y2gnLCBuYW1lLCBkYXRhLCBvcHRpb25zKTtcblxuICAgICAgdmFyIHRlbXBsYXRlID0gXy50ZW1wbGF0ZSh0ZW1wbGF0ZXNbbmFtZV0pKGRhdGEpO1xuXG4gICAgICB2YXIgY29sbGVjdGlvbiA9IG5ldyBDb2xsZWN0aW9uKHsgaG9zdCwgdXJsOiB0ZW1wbGF0ZSB9KTtcblxuICAgICAgY29sbGVjdGlvbi5mZXRjaChvcHRpb25zKTtcblxuICAgICAgcmV0dXJuIGNvbGxlY3Rpb247XG4gICB9O1xuXG4gICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbiAgIHZhciBjcmVhdGVTdWJqZWN0ID0gZnVuY3Rpb24obmFtZSwgbW9kZWwsIGNhbGxiYWNrKSB7XG4gICAgICBjb25zb2xlLmxvZygnY3JlYXRlU3ViamVjdCcsIG5hbWUsICdpbiBwcm9qZWN0JywgbW9kZWwuZ2V0KCdwcm9qZWN0aWQnKSk7XG5cbiAgICAgIHZhciBkYXRhID0ge1xuICAgICAgICAgcHJvamVjdDogbW9kZWwuZ2V0KCdwcm9qZWN0aWQnKSxcbiAgICAgICAgIHN1YmplY3Q6IGVuY29kZVVSSShuYW1lKSxcbiAgICAgICAgIGRpYWdub3NlOiBlbmNvZGVVUkkobW9kZWwuZ2V0KCdkaWFnbm9zZScpKSxcbiAgICAgICAgIGludmVzdGlnYXRvcjogZW5jb2RlVVJJKG1vZGVsLmdldCgnaW52ZXN0aWdhdG9yJykpXG4gICAgICB9O1xuXG4gICAgICAkLmFqYXgoe1xuICAgICAgICAgdXJsOiBfLnRlbXBsYXRlKHRlbXBsYXRlcy5jcmVhdGUuc3ViamVjdCkoZGF0YSksXG4gICAgICAgICB0eXBlOiAnUFVUJ1xuICAgICAgfSkuZG9uZShmdW5jdGlvbihzdWJqZWN0aWQpIHtcbiAgICAgICAgIGNvbnNvbGUubG9nKCdzdWJqZWN0X2NyZWF0ZWQnLCBzdWJqZWN0aWQpO1xuICAgICAgICAgYXBwLnZlbnQudHJpZ2dlcignWE5BVDpzdWJqZWN0X2NyZWF0ZWQnLCBzdWJqZWN0aWQpO1xuICAgICAgICAgY2FsbGJhY2soc3ViamVjdGlkKTtcbiAgICAgIH0pLmZhaWwoZnVuY3Rpb24oZXJyb3IpIHtcbiAgICAgICAgIGNvbnNvbGUubG9nKCdzdWJqZWN0X2ZhaWxlZCcsIGVycm9yKTtcbiAgICAgIH0pO1xuICAgfTtcblxuICAgdmFyIGNyZWF0ZVNlc3Npb24gPSBmdW5jdGlvbihuYW1lLCBtb2RlbCwgY2FsbGJhY2spIHtcbiAgICAgIHZhciBkYXRlID0gbmV3IERhdGUoKTtcbiAgICAgIHZhciBkYXkgPSAoZGF0ZS5nZXREYXRlKCkgPCAxMCA/ICcwJyA6ICcnKSArIGRhdGUuZ2V0RGF0ZSgpO1xuICAgICAgdmFyIG1vbnRoID0gKGRhdGUuZ2V0TW9udGgoKSA8IDkgPyAnMCcgOiAnJykgKyAoZGF0ZS5nZXRNb250aCgpICsgMSk7XG4gICAgICB2YXIgeWVhciA9IGRhdGUuZ2V0WWVhcigpIC0gMTAwO1xuICAgICAgLy8gRm9ybWF0IGRkL21tL3l5LCBlLmcuIDAxLzAxLzE0XG4gICAgICBkYXRlID0gZGF5ICsgJy8nICsgbW9udGggKyAnLycgKyB5ZWFyO1xuXG4gICAgICB2YXIgZGF0YSA9IHtcbiAgICAgICAgIHByb2plY3Q6IG1vZGVsLmdldCgncHJvamVjdGlkJyksXG4gICAgICAgICBzdWJqZWN0OiBtb2RlbC5nZXQoJ3N1YmplY3RpZCcpLFxuICAgICAgICAgc2Vzc2lvbjogbmFtZSArICdfJyArIHRpbWVzdGFtcCxcbiAgICAgICAgIGRhdGU6IGRhdGVcbiAgICAgIH07XG5cbiAgICAgICQuYWpheCh7XG4gICAgICAgICB1cmw6IF8udGVtcGxhdGUodGVtcGxhdGVzLmNyZWF0ZS5zZXNzaW9uKShkYXRhKSxcbiAgICAgICAgIHR5cGU6ICdQVVQnXG4gICAgICB9KS5kb25lKGZ1bmN0aW9uKHNlc3Npb25pZCkge1xuICAgICAgICAgY29uc29sZS5sb2coJ3Nlc3Npb25fY3JlYXRlZCcsIHNlc3Npb25pZCk7XG4gICAgICAgICBhcHAudmVudC50cmlnZ2VyKCdYTkFUOnNlc3Npb25fY3JlYXRlZCcsIHNlc3Npb25pZCk7XG4gICAgICAgICBjYWxsYmFjayhzZXNzaW9uaWQpO1xuICAgICAgfSkuZmFpbChmdW5jdGlvbihlcnJvcikge1xuICAgICAgICAgY29uc29sZS5sb2coJ3Nlc3Npb25fZmFpbGVkJywgZXJyb3IpO1xuICAgICAgfSk7XG4gICB9O1xuXG4gICB2YXIgY3JlYXRlU2NhbiA9IGZ1bmN0aW9uKG5hbWUsIG1vZGVsLCBjYWxsYmFjaykge1xuICAgICAgdmFyIGRhdGEgPSB7XG4gICAgICAgICBwcm9qZWN0OiBtb2RlbC5nZXQoJ3Byb2plY3RpZCcpLFxuICAgICAgICAgc3ViamVjdDogbW9kZWwuZ2V0KCdzdWJqZWN0aWQnKSxcbiAgICAgICAgIHNlc3Npb246IG1vZGVsLmdldCgnc2Vzc2lvbmlkJyksXG4gICAgICAgICBzY2FuOiBuYW1lXG4gICAgICB9O1xuXG4gICAgICAkLmFqYXgoe1xuICAgICAgICAgdXJsOiBfLnRlbXBsYXRlKHRlbXBsYXRlcy5jcmVhdGUuc2NhbikoZGF0YSksXG4gICAgICAgICB0eXBlOiAnUFVUJ1xuICAgICAgfSkuZG9uZShmdW5jdGlvbigpIHtcbiAgICAgICAgIGNvbnNvbGUubG9nKCdzY2FuX2NyZWF0ZWQnLCBuYW1lKTtcbiAgICAgICAgIGFwcC52ZW50LnRyaWdnZXIoJ1hOQVQ6c2Nhbl9jcmVhdGVkJywgbmFtZSk7XG4gICAgICAgICBjYWxsYmFjayhuYW1lKTtcbiAgICAgIH0pLmZhaWwoZnVuY3Rpb24oZXJyb3IpIHtcbiAgICAgICAgIGNvbnNvbGUubG9nKCdzY2FuX2ZhaWxlZCcsIGVycm9yKTtcbiAgICAgIH0pO1xuICAgfTtcblxuICAgdmFyIGNyZWF0ZVJlc291cmNlID0gZnVuY3Rpb24obmFtZSwgbW9kZWwsIGNhbGxiYWNrKSB7XG4gICAgICB2YXIgZGF0YSA9IHtcbiAgICAgICAgIHByb2plY3Q6IG1vZGVsLmdldCgncHJvamVjdGlkJyksXG4gICAgICAgICBzdWJqZWN0OiBtb2RlbC5nZXQoJ3N1YmplY3RpZCcpLFxuICAgICAgICAgc2Vzc2lvbjogbW9kZWwuZ2V0KCdzZXNzaW9uaWQnKSxcbiAgICAgICAgIHNjYW46IG1vZGVsLmdldCgnc2NhbmlkJyksXG4gICAgICAgICByZXNvdXJjZTogbmFtZSxcbiAgICAgICAgIGZvcm1hdDogJ0VERidcbiAgICAgIH07XG5cbiAgICAgICQuYWpheCh7XG4gICAgICAgICB1cmw6IF8udGVtcGxhdGUodGVtcGxhdGVzLmNyZWF0ZS5yZXNvdXJjZSkoZGF0YSksXG4gICAgICAgICB0eXBlOiAnUFVUJ1xuICAgICAgfSkuZG9uZShmdW5jdGlvbigpIHtcbiAgICAgICAgIGNvbnNvbGUubG9nKCdyZXNvdXJjZV9jcmVhdGVkJyk7XG4gICAgICAgICBhcHAudmVudC50cmlnZ2VyKCdYTkFUOnJlc291cmNlX2NyZWF0ZWQnLCBuYW1lKTtcbiAgICAgICAgIGNhbGxiYWNrKG5hbWUpO1xuICAgICAgfSkuZmFpbChmdW5jdGlvbihlcnJvcikge1xuICAgICAgICAgY29uc29sZS5sb2coJ3Jlc291cmNlX2ZhaWxlZCcsIGVycm9yKTtcbiAgICAgIH0pO1xuICAgfTtcblxuICAgLy9UT0RPXG4gICB2YXIgdXBsb2FkID0gZnVuY3Rpb24obW9kZWwsIHByb2dyZXNzLCBjYWxsYmFjaykge1xuXG4gICAgICB2YXIgZmlsZSA9IG1vZGVsLmdldCgnY29udGVudCcpO1xuXG4gICAgICBpZiAoZmlsZSBpbnN0YW5jZW9mIEludDhBcnJheSkge1xuICAgICAgICAgZmlsZSA9IG5ldyBCbG9iKFtmaWxlXSwgeyB0eXBlOiBtb2RlbC5nZXQoJ3R5cGUnKSB9KTtcbiAgICAgIH1cbiAgICAgIGlmIChmaWxlIGluc3RhbmNlb2YgQmxvYikge1xuICAgICAgICAgdmFyIGZvcm1kYXRhID0gbmV3IEZvcm1EYXRhKCk7XG4gICAgICAgICBmb3JtZGF0YS5hcHBlbmQoJ2ZpbGUnLCBmaWxlLCBtb2RlbC5nZXQoJ25hbWUnKSk7XG4gICAgICAgICBmaWxlID0gZm9ybWRhdGE7XG4gICAgICB9XG5cbiAgICAgIHZhciBkYXRhID0ge1xuICAgICAgICAgcHJvamVjdDogbW9kZWwuZ2V0KCdwcm9qZWN0aWQnKSxcbiAgICAgICAgIHN1YmplY3Q6IG1vZGVsLmdldCgnc3ViamVjdGlkJyksXG4gICAgICAgICBzZXNzaW9uOiBtb2RlbC5nZXQoJ3Nlc3Npb25pZCcpLFxuICAgICAgICAgc2NhbjogbW9kZWwuZ2V0KCdzY2FuaWQnKSxcbiAgICAgICAgIHJlc291cmNlOiBtb2RlbC5nZXQoJ3Jlc291cmNlaWQnKSxcbiAgICAgICAgIG5hbWU6IG1vZGVsLmdldCgnbmFtZScpLFxuICAgICAgICAgdGltZXN0YW1wOiB0aW1lc3RhbXBcbiAgICAgIH07XG5cbiAgICAgICQuYWpheCh7XG4gICAgICAgICB1cmw6IF8udGVtcGxhdGUodGVtcGxhdGVzLmNyZWF0ZS5maWxlKShkYXRhKSxcbiAgICAgICAgIHR5cGU6ICdQVVQnLFxuICAgICAgICAgZGF0YTogZmlsZSxcbiAgICAgICAgIHByb2Nlc3NEYXRhOiBmYWxzZSxcbiAgICAgICAgIGNvbnRlbnRUeXBlOiBmYWxzZSxcbiAgICAgICAgIHByb2dyZXNzVXBsb2FkOiBmdW5jdGlvbihldmVudCkge1xuICAgICAgICAgICAgaWYgKGV2ZW50Lmxlbmd0aENvbXB1dGFibGUpIHtcbiAgICAgICAgICAgICAgIHByb2dyZXNzLnVwZGF0ZShldmVudC5sb2FkZWQgLyBldmVudC50b3RhbCAqIDEwMCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICB9XG4gICAgICB9KS5kb25lKGZ1bmN0aW9uKCkge1xuICAgICAgICAgY29uc29sZS5sb2coJ1VwbG9hZCBjb21wbGV0ZWQuJywgZGF0YSk7XG4gICAgICAgICBhcHAudmVudC50cmlnZ2VyKCdYTkFUOmZpbGVfdXBsb2FkZWQnLCBtb2RlbC5nZXQoJ25hbWUnKSk7XG4gICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgfSkuZmFpbChmdW5jdGlvbigvKmRhdGEqLykge1xuICAgICAgICAgY29uc29sZS5sb2coJ3VwbG9hZCBmYWlsZWQnLCBtb2RlbC5nZXQoJ25hbWUnKSk7XG4gICAgICB9KTtcbiAgIH07XG5cbiAgIHZhciBzdGFydFBpcGVsaW5lID0gKG1vZGVsLCBjYWxsYmFjaykgPT4ge1xuICAgICAgdmFyIHRlbXBsYXRlID0gKGRhdGEpID0+IHtcbiAgICAgICAgIHJldHVybiBgcGFyYW1bMF0ubmFtZT1zY2FuaWRzXG4gICAgICAgICAgICAmcGFyYW1bMF1bMF0udmFsdWU9JHtkYXRhLnBzZXVkb255bX1cbiAgICAgICAgICAgICZwYXJhbVswXS5uYW1lLnJvd2NvdW50PTFcbiAgICAgICAgICAgICZwYXJhbVsxXS5uYW1lPXByb2plY3RcbiAgICAgICAgICAgICZwYXJhbVsxXVswXS52YWx1ZT0ke2RhdGEucHJvamVjdGlkfVxuICAgICAgICAgICAgJnBhcmFtWzFdLm5hbWUucm93Y291bnQ9MVxuICAgICAgICAgICAgJnBhcmFtWzJdLm5hbWU9c3ViamVjdFxuICAgICAgICAgICAgJnBhcmFtWzJdWzBdLnZhbHVlPSR7ZGF0YS5zdWJqZWN0aWR9XG4gICAgICAgICAgICAmcGFyYW1bMl0ubmFtZS5yb3djb3VudD0xXG4gICAgICAgICAgICAmcGFyYW1bM10ubmFtZT14bmF0X2lkXG4gICAgICAgICAgICAmcGFyYW1bM11bMF0udmFsdWU9JHtkYXRhLnNlc3Npb25pZH1cbiAgICAgICAgICAgICZwYXJhbVszXS5uYW1lLnJvd2NvdW50PTFcbiAgICAgICAgICAgICZwYXJhbVs0XS5uYW1lPXNlc3Npb25JZFxuICAgICAgICAgICAgJnBhcmFtWzRdWzBdLnZhbHVlPSR7ZGF0YS5uYW1lfVxuICAgICAgICAgICAgJnBhcmFtWzRdLm5hbWUucm93Y291bnQ9MVxuICAgICAgICAgICAgJnBhcmFtWzVdLm5hbWU9bm90aWZ5XG4gICAgICAgICAgICAmcGFyYW1bNV1bMF0udmFsdWU9MFxuICAgICAgICAgICAgJnBhcmFtWzVdLm5hbWUucm93Y291bnQ9MVxuICAgICAgICAgICAgJmV2ZW50U3VibWl0X2RvTGF1bmNocGlwZWxpbmU9U3VibWl0XG4gICAgICAgICAgICAmc2NoZW1hX3R5cGU9c25ldDAxJTNBc2xlZXBSZXNlYXJjaFNlc3Npb25EYXRhXG4gICAgICAgICAgICAmcGFyYW1fY250PTZcbiAgICAgICAgICAgICZwaXBlbGluZV9wYXRoPSUyRm9wdCUyRnhuYXQlMkZwaXBlbGluZSUyRmNhdGFsb2clMkZzb21ub25ldHpfcGlwZWxpbmVzJTJGZWRmTWV0YWRhdGFFeHRyYWN0b3IueG1sXG4gICAgICAgICAgICAmc2VhcmNoX2VsZW1lbnQ9c25ldDAxJTNBc2xlZXBSZXNlYXJjaFNlc3Npb25EYXRhXG4gICAgICAgICAgICAmc2VhcmNoX2ZpZWxkPXNuZXQwMSUzQXNsZWVwUmVzZWFyY2hTZXNzaW9uRGF0YS5JRFxuICAgICAgICAgICAgJnNlYXJjaF92YWx1ZT0ke2RhdGEuc2Vzc2lvbmlkfVxuICAgICAgICAgICAgJnByb2plY3Q9c29tbm9uZXR6YC5yZXBsYWNlKC9cXHMvZywgJycpO1xuICAgICAgfTtcblxuICAgICAgJC5hamF4KHtcbiAgICAgICAgIHVybDogYCR7aG9zdH0vYXBwL2FjdGlvbi9NYW5hZ2VQaXBlbGluZWAsXG4gICAgICAgICB0eXBlOiAnUE9TVCcsXG4gICAgICAgICBkYXRhOiBkZWNvZGVVUkkodGVtcGxhdGUobW9kZWwuYXR0cmlidXRlcykpXG4gICAgICB9KS5kb25lKGZ1bmN0aW9uKCkge1xuICAgICAgICAgY29uc29sZS5sb2coJ1BpcGVsaW5lIHN0YXJ0ZWQuJyk7XG4gICAgICAgICBhcHAudmVudC50cmlnZ2VyKCdYTkFUOnBpcGVsaW5lX3N0YXJ0ZWQnLCBtb2RlbC5nZXQoJ25hbWUnKSk7XG4gICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgfSkuZmFpbChmdW5jdGlvbigvKmRhdGEqLykge1xuICAgICAgICAgY29uc29sZS5sb2coJ3VwbG9hZCBmYWlsZWQnLCBtb2RlbC5nZXQoJ25hbWUnKSk7XG4gICAgICB9KTtcbiAgIH07XG5cbiAgIC8vIEludGVyZmFjZVxuICAgcmV0dXJuIHtcbiAgICAgIGxvZ2luLFxuICAgICAgZ2V0UHJvamVjdHMsXG4gICAgICBmZXRjaCxcbiAgICAgIGNyZWF0ZVN1YmplY3QsXG4gICAgICBjcmVhdGVTZXNzaW9uLFxuICAgICAgY3JlYXRlU2NhbixcbiAgICAgIGNyZWF0ZVJlc291cmNlLFxuICAgICAgdXBsb2FkLFxuICAgICAgc3RhcnRQaXBlbGluZVxuICAgfTtcblxufVxuIiwiaW1wb3J0IEVERiBmcm9tICd0cmFuc2Zvcm1lcnMvRURGJztcbmltcG9ydCBYTUwgZnJvbSAndHJhbnNmb3JtZXJzL1hNTCc7XG5cbmV4cG9ydCBkZWZhdWx0IHtcblxuICAgWE5BVF9VUkw6ICdodHRwczovL3huYXQuZjQuaHR3LWJlcmxpbi5kZS94bmF0JyxcblxuICAgZGVmYXVsdFVzZXI6ICdzb21ub25ldHonLFxuXG4gICB1c2Vyczoge1xuICAgICAgc29tbm9uZXR6OiB7XG4gICAgICAgICB1c2VybmFtZTogJ3NuY29tbW9uJyxcbiAgICAgICAgIHBhc3N3b3JkOiAnR2xhc0lULXNlYzAyTEVHTycsXG4gICAgICAgICBwcm9qZWN0OiAnc29tbm9uZXR6J1xuICAgICAgfSxcbiAgICAgIHVua25vd246IHtcbiAgICAgICAgIHVzZXJuYW1lOiAndW5rbm93bicsXG4gICAgICAgICBwYXNzd29yZDogJ3Bhc3N3b3JkJyxcbiAgICAgICAgIHByb2plY3Q6ICdwcm9qZWN0J1xuICAgICAgfVxuICAgfSxcblxuICAgdHJhbnNmb3JtZXJzOiBbXG4gICAgICB7XG4gICAgICAgICBuYW1lOiAnRURGJyxcbiAgICAgICAgIGRlc2NyaXB0aW9uOiAnRXVyb3BlYW4gRGF0YSBGb3JtYXQnLFxuICAgICAgICAgZXh0ZW5zaW9uczogWydlZGYnLCAncm1sJ10sXG4gICAgICAgICBtaXhpbjogRURGXG4gICAgICB9LCB7XG4gICAgICAgICBuYW1lOiAnWE1MJyxcbiAgICAgICAgIGRlc2NyaXB0aW9uOiAnRXh0ZW5zaWJsZSBNYXJrdXAgTGFuZ3VhZ2UnLFxuICAgICAgICAgZXh0ZW5zaW9uczogWyd4bWwnXSxcbiAgICAgICAgIG1peGluOiBYTUxcbiAgICAgIH1cbiAgIF1cblxufTtcbiIsImltcG9ydCBSZWFkZXIgZnJvbSAndmlld3MvRmlsZVJlYWRlclZpZXcnO1xuaW1wb3J0IFVwbG9hZGVyIGZyb20gJ3ZpZXdzL1VwbG9hZGVyVmlldyc7XG5pbXBvcnQgUHNldWRvbnltVmlldyBmcm9tICd2aWV3cy9Qc2V1ZG9ueW1WaWV3JztcbmltcG9ydCBGaWxlTWFuYWdlclZpZXcgZnJvbSAndmlld3MvRmlsZU1hbmFnZXJWaWV3JztcbmltcG9ydCAndXRpbC9qcXVlcnkuYWpheC5wcm9ncmVzcyc7XG5cbiQoZnVuY3Rpb24oKSB7XG4gICB3aW5kb3cuYXBwID0ge307XG4gICBhcHAudmVudCA9IF8uZXh0ZW5kKHt9LCBCYWNrYm9uZS5FdmVudHMpO1xuXG4gICBhcHAucmVhZGVyID0gbmV3IFJlYWRlcih7XG4gICAgICBlbDogJCgnLmZpbGUtcmVhZGVyJylcbiAgIH0pO1xuXG4gICBhcHAudmVudC5vbmNlKCdGaWxlOmxvYWRlZCcsIChtb2RlbCkgPT4ge1xuXG4gICAgICBsZXQgY29sbGVjdGlvbiA9IG1vZGVsLmNvbGxlY3Rpb247XG5cbiAgICAgIGFwcC5wc2V1ZG9ueW1zID0gbmV3IFBzZXVkb255bVZpZXcoe1xuICAgICAgICAgY29sbGVjdGlvbixcbiAgICAgICAgIGVsOiAkKCcucHNldWRvbnltLWxpc3QnKSxcbiAgICAgICAgIHRhYmxlQ29udGFpbmVyOiAkKCcucHNldWRvbnltLXJvdycpXG4gICAgICB9KTtcblxuICAgICAgYXBwLmZpbGVzID0gbmV3IEZpbGVNYW5hZ2VyVmlldyh7XG4gICAgICAgICBjb2xsZWN0aW9uLFxuICAgICAgICAgZWw6ICQoJy5maWxlLW1hbmFnZXInKVxuICAgICAgfSk7XG5cbiAgICAgIC8vIFRPRE8gbWVoIOKApiBzaG91bGQgaGF2ZSBpdHMgb3duIHZpZXdcbiAgICAgIGNvbGxlY3Rpb24ub24oJ2NoYW5nZTpzdGF0ZScsICgpID0+IHtcbiAgICAgICAgIGxldCBoYXNBY3RpdmVJdGVtcyA9ICEhY29sbGVjdGlvbi5maWx0ZXIobSA9PiBtLmdldCgnc3RhdGUnKSA9PT0gMSkubGVuZ3RoO1xuICAgICAgICAgJCgnLmJ0bi11c2UtZmlsZXMnKS5hdHRyKCdkaXNhYmxlZCcsICFoYXNBY3RpdmVJdGVtcyk7XG4gICAgICB9KTtcblxuICAgICAgJCgnLmJ0bi11c2UtZmlsZXMnKS5vbignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgICBhcHAudXBsb2FkZXIgPSBuZXcgVXBsb2FkZXIoe1xuICAgICAgICAgICAgY29sbGVjdGlvbixcbiAgICAgICAgICAgIGVsOiAkKCcudXBsb2FkZXInKVxuICAgICAgICAgfSk7XG5cbiAgICAgICAgICQoJy51cGxvYWRlcicpLnJlbW92ZUNsYXNzKCdoaWRkZW4nKTtcbiAgICAgICAgICQoJy5maWxlcy10by11cGxvYWQgLnBhbmVsLWZvb3RlcicpLmFkZENsYXNzKCdoaWRkZW4nKTtcbiAgICAgIH0pO1xuXG4gICAgICAvLyBzbGlkZSB0byB0aGUgc2lkZSBhbmltYXRpb25cbiAgICAgIGFwcC5yZWFkZXIuJGVsLnJlbW92ZUNsYXNzKCdjb2wtbWQtb2Zmc2V0LTQnKTtcbiAgICAgIF8uZGVsYXkoKCkgPT4gJCgnLm1haW4tY29sdW1uJykucmVtb3ZlQ2xhc3MoJ2hpZGRlbicpLCA1MDApO1xuXG4gICB9KTtcblxuICAgLy8gYXBwLnZlbnQub25jZSgnWE5BVDpmaWxlX3VwbG9hZGVkJywgKC8qbmFtZSovKSA9PiB7XG4gICAvLyAgICAkKCcub3ZlcmxheScpLnJlbW92ZUNsYXNzKCdoaWRkZW4nKTtcbiAgIC8vIH0pO1xuXG59KTtcbiIsImltcG9ydCBGaWxlTW9kZWwgZnJvbSAnbW9kZWxzL0ZpbGVNb2RlbCc7XG5cbmV4cG9ydCBkZWZhdWx0IEJhY2tib25lLkNvbGxlY3Rpb24uZXh0ZW5kKHtcbiAgIG1vZGVsOiBGaWxlTW9kZWwvKixcbiAgIGNvbXBhcmF0b3I6ICdzaXplJyovXG59KTtcbiIsImltcG9ydCBjb25maWcgZnJvbSAnY29uZmlnJztcbmltcG9ydCBGaWxlU2F2ZXIgZnJvbSAndXRpbC9GaWxlU2F2ZXInO1xuaW1wb3J0IHNpemVGb3JtYXR0ZXIgZnJvbSAndXRpbC9zaXplRm9ybWF0dGVyJztcblxuZXhwb3J0IGRlZmF1bHQgQmFja2JvbmUuTW9kZWwuZXh0ZW5kKHtcblxuICAgZGVmYXVsdHM6IHtcbiAgICAgIHVwZGF0ZWRfYXQ6IERhdGUubm93KCksXG4gICAgICBuYW1lOiAnJyxcbiAgICAgIHNpemU6IDAsXG4gICAgICBmb3JtYXR0ZWRfc2l6ZTogJycsXG4gICAgICB0eXBlOiAnJyxcbiAgICAgIHBhdGllbnROYW1lOiAnJyxcbiAgICAgIHBzZXVkb255bTogJycsXG4gICAgICBjb250ZW50OiBudWxsLCAvLyBJbnQ4QXJyYXlcbiAgICAgIHN0YXRlOiAxIC8vIHsgZG9uZTogLTEsIGluYWN0aXZlOiAwLCBhY3RpdmU6IDEsIGN1cnJlbnQ6IDIgfVxuICAgfSxcblxuICAgaW5pdGlhbGl6ZSgvKmF0dHJpYnV0ZXMqLykge1xuICAgICAgdGhpcy5vbignY2hhbmdlOm5hbWUnLCAoKSA9PiB0aGlzLnNldFRyYW5zZm9ybWVyKCkpO1xuICAgICAgdGhpcy5vbignY2hhbmdlOnBzZXVkb255bScsICgpID0+IHRoaXMucHNldWRvbnltaXplKCkpO1xuICAgICAgdGhpcy5vbignY2hhbmdlOnNpemUnLCAoKSA9PiB0aGlzLnVwZGF0ZUZvcm1hdHRlZFNpemUoKSk7XG5cbiAgICAgIHRoaXMuc2V0VHJhbnNmb3JtZXIoKTtcbiAgICAgIHRoaXMudXBkYXRlRm9ybWF0dGVkU2l6ZSgpO1xuICAgfSxcblxuICAgZG93bmxvYWQoKSB7XG4gICAgICBsZXQgYmxvYiA9IG5ldyBCbG9iKFt0aGlzLmdldCgnY29udGVudCcpXSwgeyB0eXBlOiB0aGlzLmdldCgndHlwZScpIH0pO1xuICAgICAgRmlsZVNhdmVyLnNhdmVBcyhibG9iLCB0aGlzLmdldCgnbmFtZScpKTtcbiAgIH0sXG5cbiAgIHBzZXVkb255bWl6ZSgpIHtcbiAgICAgIGNvbnNvbGUud2FybignQWJzdHJhY3QgTWV0aG9kIGBwc2V1ZG9ueW1pemVgIHNob3VsZCBiZSBvdmVycmlkZW4nKTtcbiAgIH0sXG5cbiAgIHNldFBhdGllbnROYW1lKCkge1xuICAgICAgY29uc29sZS53YXJuKCdBYnN0cmFjdCBNZXRob2QgYHNldFBhdGllbnROYW1lYCBzaG91bGQgYmUgb3ZlcnJpZGVuJyk7XG4gICB9LFxuXG4gICBzZXRUcmFuc2Zvcm1lcigpIHtcbiAgICAgIGxldCBuYW1lID0gdGhpcy5nZXQoJ25hbWUnKTtcbiAgICAgIGxldCBwYXR0ZXJuO1xuXG4gICAgICBsZXQgdHJhbnNmb3JtZXIgPSBfLmZpbmQoY29uZmlnLnRyYW5zZm9ybWVycywgKHRmKSA9PiB7XG4gICAgICAgICByZXR1cm4gXy5maW5kKHRmLmV4dGVuc2lvbnMsIChleHRlbnNpb24pID0+IHtcbiAgICAgICAgICAgIHBhdHRlcm4gPSBuZXcgUmVnRXhwKCdcXC4nICsgZXh0ZW5zaW9uICsgJyQnLCAnaScpO1xuICAgICAgICAgICAgcmV0dXJuIHBhdHRlcm4udGVzdChuYW1lKTtcbiAgICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICAgIGlmICh0cmFuc2Zvcm1lcikge1xuICAgICAgICAgXy5lYWNoKHRyYW5zZm9ybWVyLm1peGluLCAodmFsdWUsIGtleSkgPT4gdGhpc1trZXldID0gdmFsdWUpO1xuICAgICAgfVxuICAgfSxcblxuICAgdXBkYXRlRm9ybWF0dGVkU2l6ZSgpIHtcbiAgICAgIGxldCBmb3JtYXR0ZWRTaXplID0gc2l6ZUZvcm1hdHRlcih0aGlzLmdldCgnc2l6ZScpKTtcbiAgICAgIHRoaXMuc2V0KCdmb3JtYXR0ZWRfc2l6ZScsIGZvcm1hdHRlZFNpemUpO1xuICAgfSxcblxuICAgLy8gbm8gc3luYyBuZWVkZWRcbiAgIHN5bmMoKSB7IHJldHVybiBudWxsOyB9LFxuICAgZmV0Y2goKSB7IHJldHVybiBudWxsOyB9LFxuICAgc2F2ZSgpIHsgcmV0dXJuIG51bGw7IH1cblxufSk7XG4iLCJleHBvcnQgdmFyIE1vZGVsID0gQmFja2JvbmUuTW9kZWwuZXh0ZW5kKHtcblxuICAgZGVmYXVsdHM6IHtcbiAgICAgIHVwZGF0ZWRfYXQ6IERhdGUubm93KClcbiAgIH0sXG5cbiAgIGluaXRpYWxpemUoIC8qb3B0aW9ucyovICkge1xuICAgICAgdGhpcy5zZXQoJ2lkJywgdGhpcy5nZXQoJ0lEJykpO1xuICAgfSxcblxuICAgdXJsKCkge1xuICAgICAgcmV0dXJuIGNvbGxlY3Rpb24uZ2V0KCdob3N0JykgKyB0aGlzLmdldCgnVVJJJyk7XG4gICB9LFxuXG4gICBnZXRDaGlsZHJlbihuYW1lLCBvcHRpb25zKSB7XG4gICAgICBpZiAoIXRoaXMuZ2V0KG5hbWUpKSB7XG4gICAgICAgICB0aGlzLmZldGNoQ2hpbGRyZW4obmFtZSwgb3B0aW9ucyk7XG4gICAgICB9XG4gICAgICBlbHNlIGlmIChvcHRpb25zICYmIG9wdGlvbnMuc3VjY2Vzcykge1xuICAgICAgICAgb3B0aW9ucy5zdWNjZXNzKHRoaXMuZ2V0KG5hbWUpKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLmdldChuYW1lKTtcbiAgIH0sXG5cbiAgIGZldGNoQ2hpbGRyZW4obmFtZSwgb3B0aW9ucykge1xuICAgICAgaWYgKCF0aGlzLmdldChuYW1lKSkge1xuICAgICAgICAgdGhpcy5zZXQobmFtZSwgbmV3IENvbGxlY3Rpb24oe1xuICAgICAgICAgICAgdXJsOiB0aGlzLnVybCgpICsgJy8nICsgbmFtZVxuICAgICAgICAgfSkpO1xuICAgICAgfVxuICAgICAgdGhpcy5nZXQobmFtZSkuZmV0Y2gob3B0aW9ucyk7XG5cbiAgICAgIHJldHVybiB0aGlzLmdldChuYW1lKTtcbiAgIH1cbn0pO1xuXG5leHBvcnQgdmFyIENvbGxlY3Rpb24gPSBCYWNrYm9uZS5Db2xsZWN0aW9uLmV4dGVuZCh7XG5cbiAgIG1vZGVsOiBNb2RlbCxcblxuICAgaW5pdGlhbGl6ZShvcHRpb25zKSB7XG4gICAgICB0aGlzLnVybCA9IG9wdGlvbnMudXJsIHx8IHRoaXMudXJsO1xuICAgICAgdGhpcy5ob3N0ID0gb3B0aW9ucy5ob3N0IHx8ICcnO1xuICAgfSxcblxuICAgcGFyc2UocmVzcG9uc2UpIHtcbiAgICAgIHJldHVybiByZXNwb25zZS5SZXN1bHRTZXQuUmVzdWx0O1xuICAgfVxuXG59KTtcbiIsImV4cG9ydCBkZWZhdWx0IHtcblxuICAgLyoqXG4gICAgKiBSZW1vdmVzIHRoZSA4MCBieXRlcyBvZiB1c2VyIGRhdGEgYW5kIG9wdGlvbmFsbHkgcmVwbGFjZXMgdGhlbSBieSBhIGdpdmVuIHBzZXVkb255bVxuICAgICovXG4gICBwc2V1ZG9ueW1pemUoKSB7XG4gICAgICBjb25zb2xlLmxvZygncHNldWRvbnltaXplJywgdGhpcy5nZXQoJ25hbWUnKSk7XG4gICAgICBsZXQgYnVmZmVyID0gdGhpcy5nZXQoJ2NvbnRlbnQnKTtcbiAgICAgIGxldCBwc2V1ZG9ueW0gPSB0aGlzLmdldCgncHNldWRvbnltJyk7XG5cbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgODA7IGkrKykge1xuICAgICAgICAgYnVmZmVyW2kgKyA4XSA9IChwc2V1ZG9ueW1baV0gfHwgJyAnKS5jaGFyQ29kZUF0KCk7XG4gICAgICB9XG4gICB9LFxuXG4gICBzZXRQYXRpZW50TmFtZSgpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdzZXRQYXRpZW50TmFtZSBmb3InLCB0aGlzLmdldCgnbmFtZScpKTtcbiAgICAgIGxldCByYXdDaGFycyA9IHRoaXMuZ2V0KCdjb250ZW50Jykuc3ViYXJyYXkoOCwgODgpO1xuICAgICAgbGV0IHBhdGllbnROYW1lID0gU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLCByYXdDaGFycykudHJpbSgpO1xuICAgICAgdGhpcy5zZXQoJ3BhdGllbnROYW1lJywgcGF0aWVudE5hbWUpO1xuICAgfSxcblxuICAgc2V0RmlsZU5hbWUoKSB7XG4gICAgICBjb25zb2xlLmxvZygnc2V0RmlsZU5hbWUgZm9yJywgdGhpcy5nZXQoJ25hbWUnKSk7XG4gICAgICBsZXQgbmFtZSA9IHRoaXMuZ2V0KCdwYXRpZW50TmFtZScpICsgJ18nICsgRGF0ZS5ub3coKTtcbiAgICAgIHRoaXMuc2V0KCduYW1lJywgbmFtZSk7XG4gICB9XG5cbn07XG4iLCJleHBvcnQgZGVmYXVsdCB7XG5cbiAgIHBzZXVkb255bWl6ZSgpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdYTUwgLSBwc2V1ZG9ueW1pemUnLCB0aGlzLmdldCgnbmFtZScpKTtcbiAgIH0sXG5cbiAgIHNldFBhdGllbnROYW1lKCkge1xuICAgICAgY29uc29sZS5sb2coJ1hNTCAtIHNldFBhdGllbnROYW1lIGZvcicsIHRoaXMuZ2V0KCduYW1lJykpO1xuICAgfSxcblxuICAgc2V0RmlsZU5hbWUoKSB7XG4gICAgICBjb25zb2xlLmxvZygnWE1MIC0gc2V0RmlsZU5hbWUgZm9yJywgdGhpcy5nZXQoJ25hbWUnKSk7XG4gICB9XG5cbn07XG4iLCIvKiBGaWxlU2F2ZXIuanNcbiAqIEEgc2F2ZUFzKCkgRmlsZVNhdmVyIGltcGxlbWVudGF0aW9uLlxuICogMjAxNS0wMS0wNFxuICpcbiAqIEJ5IEVsaSBHcmV5LCBodHRwOi8vZWxpZ3JleS5jb21cbiAqIExpY2Vuc2U6IFgxMS9NSVRcbiAqICAgU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9lbGlncmV5L0ZpbGVTYXZlci5qcy9ibG9iL21hc3Rlci9MSUNFTlNFLm1kXG4gKi9cblxuLypnbG9iYWwgc2VsZiAqL1xuLypqc2xpbnQgYml0d2lzZTogdHJ1ZSwgaW5kZW50OiA0LCBsYXhicmVhazogdHJ1ZSwgbGF4Y29tbWE6IHRydWUsIHNtYXJ0dGFiczogdHJ1ZSwgcGx1c3BsdXM6IHRydWUgKi9cblxuLyohIEBzb3VyY2UgaHR0cDovL3B1cmwuZWxpZ3JleS5jb20vZ2l0aHViL0ZpbGVTYXZlci5qcy9ibG9iL21hc3Rlci9GaWxlU2F2ZXIuanMgKi9cblxudmFyIHNhdmVBcyA9IHNhdmVBc1xuICAvLyBJRSAxMCsgKG5hdGl2ZSBzYXZlQXMpXG4gIHx8ICh0eXBlb2YgbmF2aWdhdG9yICE9PSBcInVuZGVmaW5lZFwiICYmXG4gICAgICBuYXZpZ2F0b3IubXNTYXZlT3JPcGVuQmxvYiAmJiBuYXZpZ2F0b3IubXNTYXZlT3JPcGVuQmxvYi5iaW5kKG5hdmlnYXRvcikpXG4gIC8vIEV2ZXJ5b25lIGVsc2VcbiAgfHwgKGZ1bmN0aW9uKHZpZXcpIHtcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cdC8vIElFIDwxMCBpcyBleHBsaWNpdGx5IHVuc3VwcG9ydGVkXG5cdGlmICh0eXBlb2YgbmF2aWdhdG9yICE9PSBcInVuZGVmaW5lZFwiICYmXG5cdCAgICAvTVNJRSBbMS05XVxcLi8udGVzdChuYXZpZ2F0b3IudXNlckFnZW50KSkge1xuXHRcdHJldHVybjtcblx0fVxuXHR2YXJcblx0XHQgIGRvYyA9IHZpZXcuZG9jdW1lbnRcblx0XHQgIC8vIG9ubHkgZ2V0IFVSTCB3aGVuIG5lY2Vzc2FyeSBpbiBjYXNlIEJsb2IuanMgaGFzbid0IG92ZXJyaWRkZW4gaXQgeWV0XG5cdFx0LCBnZXRfVVJMID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRyZXR1cm4gdmlldy5VUkwgfHwgdmlldy53ZWJraXRVUkwgfHwgdmlldztcblx0XHR9XG5cdFx0LCBzYXZlX2xpbmsgPSBkb2MuY3JlYXRlRWxlbWVudE5TKFwiaHR0cDovL3d3dy53My5vcmcvMTk5OS94aHRtbFwiLCBcImFcIilcblx0XHQsIGNhbl91c2Vfc2F2ZV9saW5rID0gXCJkb3dubG9hZFwiIGluIHNhdmVfbGlua1xuXHRcdCwgY2xpY2sgPSBmdW5jdGlvbihub2RlKSB7XG5cdFx0XHR2YXIgZXZlbnQgPSBkb2MuY3JlYXRlRXZlbnQoXCJNb3VzZUV2ZW50c1wiKTtcblx0XHRcdGV2ZW50LmluaXRNb3VzZUV2ZW50KFxuXHRcdFx0XHRcImNsaWNrXCIsIHRydWUsIGZhbHNlLCB2aWV3LCAwLCAwLCAwLCAwLCAwXG5cdFx0XHRcdCwgZmFsc2UsIGZhbHNlLCBmYWxzZSwgZmFsc2UsIDAsIG51bGxcblx0XHRcdCk7XG5cdFx0XHRub2RlLmRpc3BhdGNoRXZlbnQoZXZlbnQpO1xuXHRcdH1cblx0XHQsIHdlYmtpdF9yZXFfZnMgPSB2aWV3LndlYmtpdFJlcXVlc3RGaWxlU3lzdGVtXG5cdFx0LCByZXFfZnMgPSB2aWV3LnJlcXVlc3RGaWxlU3lzdGVtIHx8IHdlYmtpdF9yZXFfZnMgfHwgdmlldy5tb3pSZXF1ZXN0RmlsZVN5c3RlbVxuXHRcdCwgdGhyb3dfb3V0c2lkZSA9IGZ1bmN0aW9uKGV4KSB7XG5cdFx0XHQodmlldy5zZXRJbW1lZGlhdGUgfHwgdmlldy5zZXRUaW1lb3V0KShmdW5jdGlvbigpIHtcblx0XHRcdFx0dGhyb3cgZXg7XG5cdFx0XHR9LCAwKTtcblx0XHR9XG5cdFx0LCBmb3JjZV9zYXZlYWJsZV90eXBlID0gXCJhcHBsaWNhdGlvbi9vY3RldC1zdHJlYW1cIlxuXHRcdCwgZnNfbWluX3NpemUgPSAwXG5cdFx0Ly8gU2VlIGh0dHBzOi8vY29kZS5nb29nbGUuY29tL3AvY2hyb21pdW0vaXNzdWVzL2RldGFpbD9pZD0zNzUyOTcjYzcgYW5kXG5cdFx0Ly8gaHR0cHM6Ly9naXRodWIuY29tL2VsaWdyZXkvRmlsZVNhdmVyLmpzL2NvbW1pdC80ODU5MzBhI2NvbW1pdGNvbW1lbnQtODc2ODA0N1xuXHRcdC8vIGZvciB0aGUgcmVhc29uaW5nIGJlaGluZCB0aGUgdGltZW91dCBhbmQgcmV2b2NhdGlvbiBmbG93XG5cdFx0LCBhcmJpdHJhcnlfcmV2b2tlX3RpbWVvdXQgPSA1MDAgLy8gaW4gbXNcblx0XHQsIHJldm9rZSA9IGZ1bmN0aW9uKGZpbGUpIHtcblx0XHRcdHZhciByZXZva2VyID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGlmICh0eXBlb2YgZmlsZSA9PT0gXCJzdHJpbmdcIikgeyAvLyBmaWxlIGlzIGFuIG9iamVjdCBVUkxcblx0XHRcdFx0XHRnZXRfVVJMKCkucmV2b2tlT2JqZWN0VVJMKGZpbGUpO1xuXHRcdFx0XHR9IGVsc2UgeyAvLyBmaWxlIGlzIGEgRmlsZVxuXHRcdFx0XHRcdGZpbGUucmVtb3ZlKCk7XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0XHRpZiAodmlldy5jaHJvbWUpIHtcblx0XHRcdFx0cmV2b2tlcigpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0c2V0VGltZW91dChyZXZva2VyLCBhcmJpdHJhcnlfcmV2b2tlX3RpbWVvdXQpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHQsIGRpc3BhdGNoID0gZnVuY3Rpb24oZmlsZXNhdmVyLCBldmVudF90eXBlcywgZXZlbnQpIHtcblx0XHRcdGV2ZW50X3R5cGVzID0gW10uY29uY2F0KGV2ZW50X3R5cGVzKTtcblx0XHRcdHZhciBpID0gZXZlbnRfdHlwZXMubGVuZ3RoO1xuXHRcdFx0d2hpbGUgKGktLSkge1xuXHRcdFx0XHR2YXIgbGlzdGVuZXIgPSBmaWxlc2F2ZXJbXCJvblwiICsgZXZlbnRfdHlwZXNbaV1dO1xuXHRcdFx0XHRpZiAodHlwZW9mIGxpc3RlbmVyID09PSBcImZ1bmN0aW9uXCIpIHtcblx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0bGlzdGVuZXIuY2FsbChmaWxlc2F2ZXIsIGV2ZW50IHx8IGZpbGVzYXZlcik7XG5cdFx0XHRcdFx0fSBjYXRjaCAoZXgpIHtcblx0XHRcdFx0XHRcdHRocm93X291dHNpZGUoZXgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHQsIEZpbGVTYXZlciA9IGZ1bmN0aW9uKGJsb2IsIG5hbWUpIHtcblx0XHRcdC8vIEZpcnN0IHRyeSBhLmRvd25sb2FkLCB0aGVuIHdlYiBmaWxlc3lzdGVtLCB0aGVuIG9iamVjdCBVUkxzXG5cdFx0XHR2YXJcblx0XHRcdFx0ICBmaWxlc2F2ZXIgPSB0aGlzXG5cdFx0XHRcdCwgdHlwZSA9IGJsb2IudHlwZVxuXHRcdFx0XHQsIGJsb2JfY2hhbmdlZCA9IGZhbHNlXG5cdFx0XHRcdCwgb2JqZWN0X3VybFxuXHRcdFx0XHQsIHRhcmdldF92aWV3XG5cdFx0XHRcdCwgZGlzcGF0Y2hfYWxsID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0ZGlzcGF0Y2goZmlsZXNhdmVyLCBcIndyaXRlc3RhcnQgcHJvZ3Jlc3Mgd3JpdGUgd3JpdGVlbmRcIi5zcGxpdChcIiBcIikpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdC8vIG9uIGFueSBmaWxlc3lzIGVycm9ycyByZXZlcnQgdG8gc2F2aW5nIHdpdGggb2JqZWN0IFVSTHNcblx0XHRcdFx0LCBmc19lcnJvciA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdC8vIGRvbid0IGNyZWF0ZSBtb3JlIG9iamVjdCBVUkxzIHRoYW4gbmVlZGVkXG5cdFx0XHRcdFx0aWYgKGJsb2JfY2hhbmdlZCB8fCAhb2JqZWN0X3VybCkge1xuXHRcdFx0XHRcdFx0b2JqZWN0X3VybCA9IGdldF9VUkwoKS5jcmVhdGVPYmplY3RVUkwoYmxvYik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmICh0YXJnZXRfdmlldykge1xuXHRcdFx0XHRcdFx0dGFyZ2V0X3ZpZXcubG9jYXRpb24uaHJlZiA9IG9iamVjdF91cmw7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHZhciBuZXdfdGFiID0gdmlldy5vcGVuKG9iamVjdF91cmwsIFwiX2JsYW5rXCIpO1xuXHRcdFx0XHRcdFx0aWYgKG5ld190YWIgPT0gdW5kZWZpbmVkICYmIHR5cGVvZiBzYWZhcmkgIT09IFwidW5kZWZpbmVkXCIpIHtcblx0XHRcdFx0XHRcdFx0Ly9BcHBsZSBkbyBub3QgYWxsb3cgd2luZG93Lm9wZW4sIHNlZSBodHRwOi8vYml0Lmx5LzFrWmZmUklcblx0XHRcdFx0XHRcdFx0dmlldy5sb2NhdGlvbi5ocmVmID0gb2JqZWN0X3VybFxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRmaWxlc2F2ZXIucmVhZHlTdGF0ZSA9IGZpbGVzYXZlci5ET05FO1xuXHRcdFx0XHRcdGRpc3BhdGNoX2FsbCgpO1xuXHRcdFx0XHRcdHJldm9rZShvYmplY3RfdXJsKTtcblx0XHRcdFx0fVxuXHRcdFx0XHQsIGFib3J0YWJsZSA9IGZ1bmN0aW9uKGZ1bmMpIHtcblx0XHRcdFx0XHRyZXR1cm4gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHRpZiAoZmlsZXNhdmVyLnJlYWR5U3RhdGUgIT09IGZpbGVzYXZlci5ET05FKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBmdW5jLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fVxuXHRcdFx0XHQsIGNyZWF0ZV9pZl9ub3RfZm91bmQgPSB7Y3JlYXRlOiB0cnVlLCBleGNsdXNpdmU6IGZhbHNlfVxuXHRcdFx0XHQsIHNsaWNlXG5cdFx0XHQ7XG5cdFx0XHRmaWxlc2F2ZXIucmVhZHlTdGF0ZSA9IGZpbGVzYXZlci5JTklUO1xuXHRcdFx0aWYgKCFuYW1lKSB7XG5cdFx0XHRcdG5hbWUgPSBcImRvd25sb2FkXCI7XG5cdFx0XHR9XG5cdFx0XHRpZiAoY2FuX3VzZV9zYXZlX2xpbmspIHtcblx0XHRcdFx0b2JqZWN0X3VybCA9IGdldF9VUkwoKS5jcmVhdGVPYmplY3RVUkwoYmxvYik7XG5cdFx0XHRcdHNhdmVfbGluay5ocmVmID0gb2JqZWN0X3VybDtcblx0XHRcdFx0c2F2ZV9saW5rLmRvd25sb2FkID0gbmFtZTtcblx0XHRcdFx0Y2xpY2soc2F2ZV9saW5rKTtcblx0XHRcdFx0ZmlsZXNhdmVyLnJlYWR5U3RhdGUgPSBmaWxlc2F2ZXIuRE9ORTtcblx0XHRcdFx0ZGlzcGF0Y2hfYWxsKCk7XG5cdFx0XHRcdHJldm9rZShvYmplY3RfdXJsKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Ly8gT2JqZWN0IGFuZCB3ZWIgZmlsZXN5c3RlbSBVUkxzIGhhdmUgYSBwcm9ibGVtIHNhdmluZyBpbiBHb29nbGUgQ2hyb21lIHdoZW5cblx0XHRcdC8vIHZpZXdlZCBpbiBhIHRhYiwgc28gSSBmb3JjZSBzYXZlIHdpdGggYXBwbGljYXRpb24vb2N0ZXQtc3RyZWFtXG5cdFx0XHQvLyBodHRwOi8vY29kZS5nb29nbGUuY29tL3AvY2hyb21pdW0vaXNzdWVzL2RldGFpbD9pZD05MTE1OFxuXHRcdFx0Ly8gVXBkYXRlOiBHb29nbGUgZXJyYW50bHkgY2xvc2VkIDkxMTU4LCBJIHN1Ym1pdHRlZCBpdCBhZ2Fpbjpcblx0XHRcdC8vIGh0dHBzOi8vY29kZS5nb29nbGUuY29tL3AvY2hyb21pdW0vaXNzdWVzL2RldGFpbD9pZD0zODk2NDJcblx0XHRcdGlmICh2aWV3LmNocm9tZSAmJiB0eXBlICYmIHR5cGUgIT09IGZvcmNlX3NhdmVhYmxlX3R5cGUpIHtcblx0XHRcdFx0c2xpY2UgPSBibG9iLnNsaWNlIHx8IGJsb2Iud2Via2l0U2xpY2U7XG5cdFx0XHRcdGJsb2IgPSBzbGljZS5jYWxsKGJsb2IsIDAsIGJsb2Iuc2l6ZSwgZm9yY2Vfc2F2ZWFibGVfdHlwZSk7XG5cdFx0XHRcdGJsb2JfY2hhbmdlZCA9IHRydWU7XG5cdFx0XHR9XG5cdFx0XHQvLyBTaW5jZSBJIGNhbid0IGJlIHN1cmUgdGhhdCB0aGUgZ3Vlc3NlZCBtZWRpYSB0eXBlIHdpbGwgdHJpZ2dlciBhIGRvd25sb2FkXG5cdFx0XHQvLyBpbiBXZWJLaXQsIEkgYXBwZW5kIC5kb3dubG9hZCB0byB0aGUgZmlsZW5hbWUuXG5cdFx0XHQvLyBodHRwczovL2J1Z3Mud2Via2l0Lm9yZy9zaG93X2J1Zy5jZ2k/aWQ9NjU0NDBcblx0XHRcdGlmICh3ZWJraXRfcmVxX2ZzICYmIG5hbWUgIT09IFwiZG93bmxvYWRcIikge1xuXHRcdFx0XHRuYW1lICs9IFwiLmRvd25sb2FkXCI7XG5cdFx0XHR9XG5cdFx0XHRpZiAodHlwZSA9PT0gZm9yY2Vfc2F2ZWFibGVfdHlwZSB8fCB3ZWJraXRfcmVxX2ZzKSB7XG5cdFx0XHRcdHRhcmdldF92aWV3ID0gdmlldztcblx0XHRcdH1cblx0XHRcdGlmICghcmVxX2ZzKSB7XG5cdFx0XHRcdGZzX2Vycm9yKCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGZzX21pbl9zaXplICs9IGJsb2Iuc2l6ZTtcblx0XHRcdHJlcV9mcyh2aWV3LlRFTVBPUkFSWSwgZnNfbWluX3NpemUsIGFib3J0YWJsZShmdW5jdGlvbihmcykge1xuXHRcdFx0XHRmcy5yb290LmdldERpcmVjdG9yeShcInNhdmVkXCIsIGNyZWF0ZV9pZl9ub3RfZm91bmQsIGFib3J0YWJsZShmdW5jdGlvbihkaXIpIHtcblx0XHRcdFx0XHR2YXIgc2F2ZSA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdFx0ZGlyLmdldEZpbGUobmFtZSwgY3JlYXRlX2lmX25vdF9mb3VuZCwgYWJvcnRhYmxlKGZ1bmN0aW9uKGZpbGUpIHtcblx0XHRcdFx0XHRcdFx0ZmlsZS5jcmVhdGVXcml0ZXIoYWJvcnRhYmxlKGZ1bmN0aW9uKHdyaXRlcikge1xuXHRcdFx0XHRcdFx0XHRcdHdyaXRlci5vbndyaXRlZW5kID0gZnVuY3Rpb24oZXZlbnQpIHtcblx0XHRcdFx0XHRcdFx0XHRcdHRhcmdldF92aWV3LmxvY2F0aW9uLmhyZWYgPSBmaWxlLnRvVVJMKCk7XG5cdFx0XHRcdFx0XHRcdFx0XHRmaWxlc2F2ZXIucmVhZHlTdGF0ZSA9IGZpbGVzYXZlci5ET05FO1xuXHRcdFx0XHRcdFx0XHRcdFx0ZGlzcGF0Y2goZmlsZXNhdmVyLCBcIndyaXRlZW5kXCIsIGV2ZW50KTtcblx0XHRcdFx0XHRcdFx0XHRcdHJldm9rZShmaWxlKTtcblx0XHRcdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdFx0XHRcdHdyaXRlci5vbmVycm9yID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHR2YXIgZXJyb3IgPSB3cml0ZXIuZXJyb3I7XG5cdFx0XHRcdFx0XHRcdFx0XHRpZiAoZXJyb3IuY29kZSAhPT0gZXJyb3IuQUJPUlRfRVJSKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdGZzX2Vycm9yKCk7XG5cdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRcdFx0XHRcIndyaXRlc3RhcnQgcHJvZ3Jlc3Mgd3JpdGUgYWJvcnRcIi5zcGxpdChcIiBcIikuZm9yRWFjaChmdW5jdGlvbihldmVudCkge1xuXHRcdFx0XHRcdFx0XHRcdFx0d3JpdGVyW1wib25cIiArIGV2ZW50XSA9IGZpbGVzYXZlcltcIm9uXCIgKyBldmVudF07XG5cdFx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHRcdFx0d3JpdGVyLndyaXRlKGJsb2IpO1xuXHRcdFx0XHRcdFx0XHRcdGZpbGVzYXZlci5hYm9ydCA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdFx0XHRcdFx0d3JpdGVyLmFib3J0KCk7XG5cdFx0XHRcdFx0XHRcdFx0XHRmaWxlc2F2ZXIucmVhZHlTdGF0ZSA9IGZpbGVzYXZlci5ET05FO1xuXHRcdFx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0XHRcdFx0ZmlsZXNhdmVyLnJlYWR5U3RhdGUgPSBmaWxlc2F2ZXIuV1JJVElORztcblx0XHRcdFx0XHRcdFx0fSksIGZzX2Vycm9yKTtcblx0XHRcdFx0XHRcdH0pLCBmc19lcnJvcik7XG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRkaXIuZ2V0RmlsZShuYW1lLCB7Y3JlYXRlOiBmYWxzZX0sIGFib3J0YWJsZShmdW5jdGlvbihmaWxlKSB7XG5cdFx0XHRcdFx0XHQvLyBkZWxldGUgZmlsZSBpZiBpdCBhbHJlYWR5IGV4aXN0c1xuXHRcdFx0XHRcdFx0ZmlsZS5yZW1vdmUoKTtcblx0XHRcdFx0XHRcdHNhdmUoKTtcblx0XHRcdFx0XHR9KSwgYWJvcnRhYmxlKGZ1bmN0aW9uKGV4KSB7XG5cdFx0XHRcdFx0XHRpZiAoZXguY29kZSA9PT0gZXguTk9UX0ZPVU5EX0VSUikge1xuXHRcdFx0XHRcdFx0XHRzYXZlKCk7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRmc19lcnJvcigpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0pKTtcblx0XHRcdFx0fSksIGZzX2Vycm9yKTtcblx0XHRcdH0pLCBmc19lcnJvcik7XG5cdFx0fVxuXHRcdCwgRlNfcHJvdG8gPSBGaWxlU2F2ZXIucHJvdG90eXBlXG5cdFx0LCBzYXZlQXMgPSBmdW5jdGlvbihibG9iLCBuYW1lKSB7XG5cdFx0XHRyZXR1cm4gbmV3IEZpbGVTYXZlcihibG9iLCBuYW1lKTtcblx0XHR9XG5cdDtcblx0RlNfcHJvdG8uYWJvcnQgPSBmdW5jdGlvbigpIHtcblx0XHR2YXIgZmlsZXNhdmVyID0gdGhpcztcblx0XHRmaWxlc2F2ZXIucmVhZHlTdGF0ZSA9IGZpbGVzYXZlci5ET05FO1xuXHRcdGRpc3BhdGNoKGZpbGVzYXZlciwgXCJhYm9ydFwiKTtcblx0fTtcblx0RlNfcHJvdG8ucmVhZHlTdGF0ZSA9IEZTX3Byb3RvLklOSVQgPSAwO1xuXHRGU19wcm90by5XUklUSU5HID0gMTtcblx0RlNfcHJvdG8uRE9ORSA9IDI7XG5cblx0RlNfcHJvdG8uZXJyb3IgPVxuXHRGU19wcm90by5vbndyaXRlc3RhcnQgPVxuXHRGU19wcm90by5vbnByb2dyZXNzID1cblx0RlNfcHJvdG8ub253cml0ZSA9XG5cdEZTX3Byb3RvLm9uYWJvcnQgPVxuXHRGU19wcm90by5vbmVycm9yID1cblx0RlNfcHJvdG8ub253cml0ZWVuZCA9XG5cdFx0bnVsbDtcblxuXHRyZXR1cm4gc2F2ZUFzO1xufShcblx0ICAgdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgJiYgc2VsZlxuXHR8fCB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiICYmIHdpbmRvd1xuXHR8fCB0aGlzLmNvbnRlbnRcbikpO1xuLy8gYHNlbGZgIGlzIHVuZGVmaW5lZCBpbiBGaXJlZm94IGZvciBBbmRyb2lkIGNvbnRlbnQgc2NyaXB0IGNvbnRleHRcbi8vIHdoaWxlIGB0aGlzYCBpcyBuc0lDb250ZW50RnJhbWVNZXNzYWdlTWFuYWdlclxuLy8gd2l0aCBhbiBhdHRyaWJ1dGUgYGNvbnRlbnRgIHRoYXQgY29ycmVzcG9uZHMgdG8gdGhlIHdpbmRvd1xuXG5pZiAodHlwZW9mIG1vZHVsZSAhPT0gXCJ1bmRlZmluZWRcIiAmJiBtb2R1bGUuZXhwb3J0cykge1xuICBtb2R1bGUuZXhwb3J0cy5zYXZlQXMgPSBzYXZlQXM7XG59IGVsc2UgaWYgKCh0eXBlb2YgZGVmaW5lICE9PSBcInVuZGVmaW5lZFwiICYmIGRlZmluZSAhPT0gbnVsbCkgJiYgKGRlZmluZS5hbWQgIT0gbnVsbCkpIHtcbiAgZGVmaW5lKFtdLCBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gc2F2ZUFzO1xuICB9KTtcbn0iLCJleHBvcnQgZGVmYXVsdCBCYWNrYm9uZS5WaWV3LmV4dGVuZCh7XG5cbiAgIHRhZ05hbWU6ICdkaXYnLFxuICAgY2xhc3NOYW1lOiAncHJvZ3Jlc3MnLFxuXG4gICBwcm9ncmVzczogMCxcblxuICAgdGVtcGxhdGU6IF8udGVtcGxhdGUoXG4gICAgICAnPGRpdiBjbGFzcz1cInByb2dyZXNzLWJhclwiIHN0eWxlPVwid2lkdGg6IDwlPSBwcm9ncmVzcyAlPiU7XCI+PCU9IHByb2dyZXNzICU+JTwvZGl2PicpLFxuXG4gICBpbml0aWFsaXplOiBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMucmVuZGVyKCk7XG4gICB9LFxuXG4gICByZW5kZXI6IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy4kZWwuaHRtbCh0aGlzLnRlbXBsYXRlKHsgcHJvZ3Jlc3M6IE1hdGguY2VpbCh0aGlzLnByb2dyZXNzKSB9KSk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgIH0sXG5cbiAgIHVwZGF0ZTogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgIHRoaXMucHJvZ3Jlc3MgPSB2YWx1ZTtcbiAgICAgIHRoaXMucmVuZGVyKCk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgIH1cblxufSk7XG4iLCJleHBvcnQgZGVmYXVsdCBmdW5jdGlvbih2YXJpYWJsZSkge1xuXG4gICAgdmFyIHF1ZXJ5ID0gd2luZG93LmxvY2F0aW9uLnNlYXJjaC5zdWJzdHJpbmcoMSk7XG4gICAgdmFyIHZhcnMgPSBxdWVyeS5zcGxpdCgnJicpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdmFycy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgcGFpciA9IHZhcnNbaV0uc3BsaXQoJz0nKTtcbiAgICAgICAgaWYgKGRlY29kZVVSSUNvbXBvbmVudChwYWlyWzBdKSA9PT0gdmFyaWFibGUpIHtcbiAgICAgICAgICAgIHJldHVybiBkZWNvZGVVUklDb21wb25lbnQocGFpclsxXSk7XG4gICAgICAgIH1cbiAgICB9XG5cbn1cbiIsIi8vIEFkZCBYSFIyIHVwbG9hZCBhbmQgZG93bmxvYWQgcHJvZ3Jlc3MgZXZlbnRzIHRvIGpRdWVyeS5hamF4XG4vLyBGcm9tIGh0dHBzOi8vZ2lzdC5naXRodWIuY29tL25lYmlyaG9zLzM4OTIwMThcbnZhciBvcmlnaW5hbFhociA9ICQuYWpheFNldHRpbmdzLnhocjtcbiQuYWpheFNldHVwKHtcbiAgIHhocigpIHtcbiAgICAgIHZhciByZXF1ZXN0ID0gb3JpZ2luYWxYaHIoKTtcbiAgICAgIGlmIChyZXF1ZXN0KSB7XG4gICAgICAgICBpZiAodHlwZW9mIHJlcXVlc3QuYWRkRXZlbnRMaXN0ZW5lciA9PT0gJ2Z1bmN0aW9uJyAmJiB0aGlzLnByb2dyZXNzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHJlcXVlc3QuYWRkRXZlbnRMaXN0ZW5lcigncHJvZ3Jlc3MnLCAoZXZ0KSA9PiB0aGlzLnByb2dyZXNzKGV2dCksIGZhbHNlKTtcbiAgICAgICAgIH1cbiAgICAgICAgIGlmICh0eXBlb2YgcmVxdWVzdC51cGxvYWQgPT09ICdvYmplY3QnICYmIHRoaXMucHJvZ3Jlc3NVcGxvYWQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgcmVxdWVzdC51cGxvYWQuYWRkRXZlbnRMaXN0ZW5lcigncHJvZ3Jlc3MnLCAoZXZ0KSA9PiB0aGlzLnByb2dyZXNzVXBsb2FkKGV2dCksIGZhbHNlKTtcbiAgICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiByZXF1ZXN0O1xuICAgfVxufSk7XG4iLCJleHBvcnQgZGVmYXVsdCBmdW5jdGlvbihieXRlcykge1xuXG4gICBpZiAoYnl0ZXMgPj0gMTAwMDAwMDAwMCkge1xuICAgICAgcmV0dXJuIChieXRlcyAvIDEwMDAwMDAwMDApLnRvRml4ZWQoMikgKyAnIEdCJztcbiAgIH1cbiAgIGlmIChieXRlcyA+PSAxMDAwMDAwKSB7XG4gICAgICByZXR1cm4gKGJ5dGVzIC8gMTAwMDAwMCkudG9GaXhlZCgyKSArICcgTUInO1xuICAgfVxuICAgcmV0dXJuIChieXRlcyAvIDEwMDApLnRvRml4ZWQoMikgKyAnIEtCJztcblxufVxuIiwiLypcbiBDb3B5cmlnaHQgKGMpIDIwMTMgR2lsZGFzIExvcm1lYXUuIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG5cbiBSZWRpc3RyaWJ1dGlvbiBhbmQgdXNlIGluIHNvdXJjZSBhbmQgYmluYXJ5IGZvcm1zLCB3aXRoIG9yIHdpdGhvdXRcbiBtb2RpZmljYXRpb24sIGFyZSBwZXJtaXR0ZWQgcHJvdmlkZWQgdGhhdCB0aGUgZm9sbG93aW5nIGNvbmRpdGlvbnMgYXJlIG1ldDpcblxuIDEuIFJlZGlzdHJpYnV0aW9ucyBvZiBzb3VyY2UgY29kZSBtdXN0IHJldGFpbiB0aGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSxcbiB0aGlzIGxpc3Qgb2YgY29uZGl0aW9ucyBhbmQgdGhlIGZvbGxvd2luZyBkaXNjbGFpbWVyLlxuXG4gMi4gUmVkaXN0cmlidXRpb25zIGluIGJpbmFyeSBmb3JtIG11c3QgcmVwcm9kdWNlIHRoZSBhYm92ZSBjb3B5cmlnaHRcbiBub3RpY2UsIHRoaXMgbGlzdCBvZiBjb25kaXRpb25zIGFuZCB0aGUgZm9sbG93aW5nIGRpc2NsYWltZXIgaW5cbiB0aGUgZG9jdW1lbnRhdGlvbiBhbmQvb3Igb3RoZXIgbWF0ZXJpYWxzIHByb3ZpZGVkIHdpdGggdGhlIGRpc3RyaWJ1dGlvbi5cblxuIDMuIFRoZSBuYW1lcyBvZiB0aGUgYXV0aG9ycyBtYXkgbm90IGJlIHVzZWQgdG8gZW5kb3JzZSBvciBwcm9tb3RlIHByb2R1Y3RzXG4gZGVyaXZlZCBmcm9tIHRoaXMgc29mdHdhcmUgd2l0aG91dCBzcGVjaWZpYyBwcmlvciB3cml0dGVuIHBlcm1pc3Npb24uXG5cbiBUSElTIFNPRlRXQVJFIElTIFBST1ZJREVEIGBgQVMgSVMnJyBBTkQgQU5ZIEVYUFJFU1NFRCBPUiBJTVBMSUVEIFdBUlJBTlRJRVMsXG4gSU5DTFVESU5HLCBCVVQgTk9UIExJTUlURUQgVE8sIFRIRSBJTVBMSUVEIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZIEFORFxuIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFSRSBESVNDTEFJTUVELiBJTiBOTyBFVkVOVCBTSEFMTCBKQ1JBRlQsXG4gSU5DLiBPUiBBTlkgQ09OVFJJQlVUT1JTIFRPIFRISVMgU09GVFdBUkUgQkUgTElBQkxFIEZPUiBBTlkgRElSRUNULCBJTkRJUkVDVCxcbiBJTkNJREVOVEFMLCBTUEVDSUFMLCBFWEVNUExBUlksIE9SIENPTlNFUVVFTlRJQUwgREFNQUdFUyAoSU5DTFVESU5HLCBCVVQgTk9UXG4gTElNSVRFRCBUTywgUFJPQ1VSRU1FTlQgT0YgU1VCU1RJVFVURSBHT09EUyBPUiBTRVJWSUNFUzsgTE9TUyBPRiBVU0UsIERBVEEsXG4gT1IgUFJPRklUUzsgT1IgQlVTSU5FU1MgSU5URVJSVVBUSU9OKSBIT1dFVkVSIENBVVNFRCBBTkQgT04gQU5ZIFRIRU9SWSBPRlxuIExJQUJJTElUWSwgV0hFVEhFUiBJTiBDT05UUkFDVCwgU1RSSUNUIExJQUJJTElUWSwgT1IgVE9SVCAoSU5DTFVESU5HXG4gTkVHTElHRU5DRSBPUiBPVEhFUldJU0UpIEFSSVNJTkcgSU4gQU5ZIFdBWSBPVVQgT0YgVEhFIFVTRSBPRiBUSElTIFNPRlRXQVJFLFxuIEVWRU4gSUYgQURWSVNFRCBPRiBUSEUgUE9TU0lCSUxJVFkgT0YgU1VDSCBEQU1BR0UuXG4gKi9cblxuKGZ1bmN0aW9uKCkge1xuXHRcInVzZSBzdHJpY3RcIjtcblxuXHR2YXIgRVJSX0hUVFBfUkFOR0UgPSBcIkhUVFAgUmFuZ2Ugbm90IHN1cHBvcnRlZC5cIjtcblxuXHR2YXIgUmVhZGVyID0gemlwLlJlYWRlcjtcblx0dmFyIFdyaXRlciA9IHppcC5Xcml0ZXI7XG5cdFxuXHR2YXIgWmlwRGlyZWN0b3J5RW50cnk7XG5cblx0dmFyIGFwcGVuZEFCVmlld1N1cHBvcnRlZDtcblx0dHJ5IHtcblx0XHRhcHBlbmRBQlZpZXdTdXBwb3J0ZWQgPSBuZXcgQmxvYihbIG5ldyBEYXRhVmlldyhuZXcgQXJyYXlCdWZmZXIoMCkpIF0pLnNpemUgPT09IDA7XG5cdH0gY2F0Y2ggKGUpIHtcblx0fVxuXG5cdGZ1bmN0aW9uIEh0dHBSZWFkZXIodXJsKSB7XG5cdFx0dmFyIHRoYXQgPSB0aGlzO1xuXG5cdFx0ZnVuY3Rpb24gZ2V0RGF0YShjYWxsYmFjaywgb25lcnJvcikge1xuXHRcdFx0dmFyIHJlcXVlc3Q7XG5cdFx0XHRpZiAoIXRoYXQuZGF0YSkge1xuXHRcdFx0XHRyZXF1ZXN0ID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG5cdFx0XHRcdHJlcXVlc3QuYWRkRXZlbnRMaXN0ZW5lcihcImxvYWRcIiwgZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0aWYgKCF0aGF0LnNpemUpXG5cdFx0XHRcdFx0XHR0aGF0LnNpemUgPSBOdW1iZXIocmVxdWVzdC5nZXRSZXNwb25zZUhlYWRlcihcIkNvbnRlbnQtTGVuZ3RoXCIpKTtcblx0XHRcdFx0XHR0aGF0LmRhdGEgPSBuZXcgVWludDhBcnJheShyZXF1ZXN0LnJlc3BvbnNlKTtcblx0XHRcdFx0XHRjYWxsYmFjaygpO1xuXHRcdFx0XHR9LCBmYWxzZSk7XG5cdFx0XHRcdHJlcXVlc3QuYWRkRXZlbnRMaXN0ZW5lcihcImVycm9yXCIsIG9uZXJyb3IsIGZhbHNlKTtcblx0XHRcdFx0cmVxdWVzdC5vcGVuKFwiR0VUXCIsIHVybCk7XG5cdFx0XHRcdHJlcXVlc3QucmVzcG9uc2VUeXBlID0gXCJhcnJheWJ1ZmZlclwiO1xuXHRcdFx0XHRyZXF1ZXN0LnNlbmQoKTtcblx0XHRcdH0gZWxzZVxuXHRcdFx0XHRjYWxsYmFjaygpO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGluaXQoY2FsbGJhY2ssIG9uZXJyb3IpIHtcblx0XHRcdHZhciByZXF1ZXN0ID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG5cdFx0XHRyZXF1ZXN0LmFkZEV2ZW50TGlzdGVuZXIoXCJsb2FkXCIsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR0aGF0LnNpemUgPSBOdW1iZXIocmVxdWVzdC5nZXRSZXNwb25zZUhlYWRlcihcIkNvbnRlbnQtTGVuZ3RoXCIpKTtcblx0XHRcdFx0Y2FsbGJhY2soKTtcblx0XHRcdH0sIGZhbHNlKTtcblx0XHRcdHJlcXVlc3QuYWRkRXZlbnRMaXN0ZW5lcihcImVycm9yXCIsIG9uZXJyb3IsIGZhbHNlKTtcblx0XHRcdHJlcXVlc3Qub3BlbihcIkhFQURcIiwgdXJsKTtcblx0XHRcdHJlcXVlc3Quc2VuZCgpO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIHJlYWRVaW50OEFycmF5KGluZGV4LCBsZW5ndGgsIGNhbGxiYWNrLCBvbmVycm9yKSB7XG5cdFx0XHRnZXREYXRhKGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRjYWxsYmFjayhuZXcgVWludDhBcnJheSh0aGF0LmRhdGEuc3ViYXJyYXkoaW5kZXgsIGluZGV4ICsgbGVuZ3RoKSkpO1xuXHRcdFx0fSwgb25lcnJvcik7XG5cdFx0fVxuXG5cdFx0dGhhdC5zaXplID0gMDtcblx0XHR0aGF0LmluaXQgPSBpbml0O1xuXHRcdHRoYXQucmVhZFVpbnQ4QXJyYXkgPSByZWFkVWludDhBcnJheTtcblx0fVxuXHRIdHRwUmVhZGVyLnByb3RvdHlwZSA9IG5ldyBSZWFkZXIoKTtcblx0SHR0cFJlYWRlci5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBIdHRwUmVhZGVyO1xuXG5cdGZ1bmN0aW9uIEh0dHBSYW5nZVJlYWRlcih1cmwpIHtcblx0XHR2YXIgdGhhdCA9IHRoaXM7XG5cblx0XHRmdW5jdGlvbiBpbml0KGNhbGxiYWNrLCBvbmVycm9yKSB7XG5cdFx0XHR2YXIgcmVxdWVzdCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuXHRcdFx0cmVxdWVzdC5hZGRFdmVudExpc3RlbmVyKFwibG9hZFwiLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0dGhhdC5zaXplID0gTnVtYmVyKHJlcXVlc3QuZ2V0UmVzcG9uc2VIZWFkZXIoXCJDb250ZW50LUxlbmd0aFwiKSk7XG5cdFx0XHRcdGlmIChyZXF1ZXN0LmdldFJlc3BvbnNlSGVhZGVyKFwiQWNjZXB0LVJhbmdlc1wiKSA9PSBcImJ5dGVzXCIpXG5cdFx0XHRcdFx0Y2FsbGJhY2soKTtcblx0XHRcdFx0ZWxzZVxuXHRcdFx0XHRcdG9uZXJyb3IoRVJSX0hUVFBfUkFOR0UpO1xuXHRcdFx0fSwgZmFsc2UpO1xuXHRcdFx0cmVxdWVzdC5hZGRFdmVudExpc3RlbmVyKFwiZXJyb3JcIiwgb25lcnJvciwgZmFsc2UpO1xuXHRcdFx0cmVxdWVzdC5vcGVuKFwiSEVBRFwiLCB1cmwpO1xuXHRcdFx0cmVxdWVzdC5zZW5kKCk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gcmVhZEFycmF5QnVmZmVyKGluZGV4LCBsZW5ndGgsIGNhbGxiYWNrLCBvbmVycm9yKSB7XG5cdFx0XHR2YXIgcmVxdWVzdCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuXHRcdFx0cmVxdWVzdC5vcGVuKFwiR0VUXCIsIHVybCk7XG5cdFx0XHRyZXF1ZXN0LnJlc3BvbnNlVHlwZSA9IFwiYXJyYXlidWZmZXJcIjtcblx0XHRcdHJlcXVlc3Quc2V0UmVxdWVzdEhlYWRlcihcIlJhbmdlXCIsIFwiYnl0ZXM9XCIgKyBpbmRleCArIFwiLVwiICsgKGluZGV4ICsgbGVuZ3RoIC0gMSkpO1xuXHRcdFx0cmVxdWVzdC5hZGRFdmVudExpc3RlbmVyKFwibG9hZFwiLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0Y2FsbGJhY2socmVxdWVzdC5yZXNwb25zZSk7XG5cdFx0XHR9LCBmYWxzZSk7XG5cdFx0XHRyZXF1ZXN0LmFkZEV2ZW50TGlzdGVuZXIoXCJlcnJvclwiLCBvbmVycm9yLCBmYWxzZSk7XG5cdFx0XHRyZXF1ZXN0LnNlbmQoKTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiByZWFkVWludDhBcnJheShpbmRleCwgbGVuZ3RoLCBjYWxsYmFjaywgb25lcnJvcikge1xuXHRcdFx0cmVhZEFycmF5QnVmZmVyKGluZGV4LCBsZW5ndGgsIGZ1bmN0aW9uKGFycmF5YnVmZmVyKSB7XG5cdFx0XHRcdGNhbGxiYWNrKG5ldyBVaW50OEFycmF5KGFycmF5YnVmZmVyKSk7XG5cdFx0XHR9LCBvbmVycm9yKTtcblx0XHR9XG5cblx0XHR0aGF0LnNpemUgPSAwO1xuXHRcdHRoYXQuaW5pdCA9IGluaXQ7XG5cdFx0dGhhdC5yZWFkVWludDhBcnJheSA9IHJlYWRVaW50OEFycmF5O1xuXHR9XG5cdEh0dHBSYW5nZVJlYWRlci5wcm90b3R5cGUgPSBuZXcgUmVhZGVyKCk7XG5cdEh0dHBSYW5nZVJlYWRlci5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBIdHRwUmFuZ2VSZWFkZXI7XG5cblx0ZnVuY3Rpb24gQXJyYXlCdWZmZXJSZWFkZXIoYXJyYXlCdWZmZXIpIHtcblx0XHR2YXIgdGhhdCA9IHRoaXM7XG5cblx0XHRmdW5jdGlvbiBpbml0KGNhbGxiYWNrLCBvbmVycm9yKSB7XG5cdFx0XHR0aGF0LnNpemUgPSBhcnJheUJ1ZmZlci5ieXRlTGVuZ3RoO1xuXHRcdFx0Y2FsbGJhY2soKTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiByZWFkVWludDhBcnJheShpbmRleCwgbGVuZ3RoLCBjYWxsYmFjaywgb25lcnJvcikge1xuXHRcdFx0Y2FsbGJhY2sobmV3IFVpbnQ4QXJyYXkoYXJyYXlCdWZmZXIuc2xpY2UoaW5kZXgsIGluZGV4ICsgbGVuZ3RoKSkpO1xuXHRcdH1cblxuXHRcdHRoYXQuc2l6ZSA9IDA7XG5cdFx0dGhhdC5pbml0ID0gaW5pdDtcblx0XHR0aGF0LnJlYWRVaW50OEFycmF5ID0gcmVhZFVpbnQ4QXJyYXk7XG5cdH1cblx0QXJyYXlCdWZmZXJSZWFkZXIucHJvdG90eXBlID0gbmV3IFJlYWRlcigpO1xuXHRBcnJheUJ1ZmZlclJlYWRlci5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBBcnJheUJ1ZmZlclJlYWRlcjtcblxuXHRmdW5jdGlvbiBBcnJheUJ1ZmZlcldyaXRlcigpIHtcblx0XHR2YXIgYXJyYXksIHRoYXQgPSB0aGlzO1xuXG5cdFx0ZnVuY3Rpb24gaW5pdChjYWxsYmFjaywgb25lcnJvcikge1xuXHRcdFx0YXJyYXkgPSBuZXcgVWludDhBcnJheSgpO1xuXHRcdFx0Y2FsbGJhY2soKTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiB3cml0ZVVpbnQ4QXJyYXkoYXJyLCBjYWxsYmFjaywgb25lcnJvcikge1xuXHRcdFx0dmFyIHRtcEFycmF5ID0gbmV3IFVpbnQ4QXJyYXkoYXJyYXkubGVuZ3RoICsgYXJyLmxlbmd0aCk7XG5cdFx0XHR0bXBBcnJheS5zZXQoYXJyYXkpO1xuXHRcdFx0dG1wQXJyYXkuc2V0KGFyciwgYXJyYXkubGVuZ3RoKTtcblx0XHRcdGFycmF5ID0gdG1wQXJyYXk7XG5cdFx0XHRjYWxsYmFjaygpO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGdldERhdGEoY2FsbGJhY2spIHtcblx0XHRcdGNhbGxiYWNrKGFycmF5LmJ1ZmZlcik7XG5cdFx0fVxuXG5cdFx0dGhhdC5pbml0ID0gaW5pdDtcblx0XHR0aGF0LndyaXRlVWludDhBcnJheSA9IHdyaXRlVWludDhBcnJheTtcblx0XHR0aGF0LmdldERhdGEgPSBnZXREYXRhO1xuXHR9XG5cdEFycmF5QnVmZmVyV3JpdGVyLnByb3RvdHlwZSA9IG5ldyBXcml0ZXIoKTtcblx0QXJyYXlCdWZmZXJXcml0ZXIucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gQXJyYXlCdWZmZXJXcml0ZXI7XG5cblx0ZnVuY3Rpb24gRmlsZVdyaXRlcihmaWxlRW50cnksIGNvbnRlbnRUeXBlKSB7XG5cdFx0dmFyIHdyaXRlciwgdGhhdCA9IHRoaXM7XG5cblx0XHRmdW5jdGlvbiBpbml0KGNhbGxiYWNrLCBvbmVycm9yKSB7XG5cdFx0XHRmaWxlRW50cnkuY3JlYXRlV3JpdGVyKGZ1bmN0aW9uKGZpbGVXcml0ZXIpIHtcblx0XHRcdFx0d3JpdGVyID0gZmlsZVdyaXRlcjtcblx0XHRcdFx0Y2FsbGJhY2soKTtcblx0XHRcdH0sIG9uZXJyb3IpO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIHdyaXRlVWludDhBcnJheShhcnJheSwgY2FsbGJhY2ssIG9uZXJyb3IpIHtcblx0XHRcdHZhciBibG9iID0gbmV3IEJsb2IoWyBhcHBlbmRBQlZpZXdTdXBwb3J0ZWQgPyBhcnJheSA6IGFycmF5LmJ1ZmZlciBdLCB7XG5cdFx0XHRcdHR5cGUgOiBjb250ZW50VHlwZVxuXHRcdFx0fSk7XG5cdFx0XHR3cml0ZXIub253cml0ZSA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR3cml0ZXIub253cml0ZSA9IG51bGw7XG5cdFx0XHRcdGNhbGxiYWNrKCk7XG5cdFx0XHR9O1xuXHRcdFx0d3JpdGVyLm9uZXJyb3IgPSBvbmVycm9yO1xuXHRcdFx0d3JpdGVyLndyaXRlKGJsb2IpO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGdldERhdGEoY2FsbGJhY2spIHtcblx0XHRcdGZpbGVFbnRyeS5maWxlKGNhbGxiYWNrKTtcblx0XHR9XG5cblx0XHR0aGF0LmluaXQgPSBpbml0O1xuXHRcdHRoYXQud3JpdGVVaW50OEFycmF5ID0gd3JpdGVVaW50OEFycmF5O1xuXHRcdHRoYXQuZ2V0RGF0YSA9IGdldERhdGE7XG5cdH1cblx0RmlsZVdyaXRlci5wcm90b3R5cGUgPSBuZXcgV3JpdGVyKCk7XG5cdEZpbGVXcml0ZXIucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gRmlsZVdyaXRlcjtcblxuXHR6aXAuRmlsZVdyaXRlciA9IEZpbGVXcml0ZXI7XG5cdHppcC5IdHRwUmVhZGVyID0gSHR0cFJlYWRlcjtcblx0emlwLkh0dHBSYW5nZVJlYWRlciA9IEh0dHBSYW5nZVJlYWRlcjtcblx0emlwLkFycmF5QnVmZmVyUmVhZGVyID0gQXJyYXlCdWZmZXJSZWFkZXI7XG5cdHppcC5BcnJheUJ1ZmZlcldyaXRlciA9IEFycmF5QnVmZmVyV3JpdGVyO1xuXG5cdGlmICh6aXAuZnMpIHtcblx0XHRaaXBEaXJlY3RvcnlFbnRyeSA9IHppcC5mcy5aaXBEaXJlY3RvcnlFbnRyeTtcblx0XHRaaXBEaXJlY3RvcnlFbnRyeS5wcm90b3R5cGUuYWRkSHR0cENvbnRlbnQgPSBmdW5jdGlvbihuYW1lLCBVUkwsIHVzZVJhbmdlSGVhZGVyKSB7XG5cdFx0XHRmdW5jdGlvbiBhZGRDaGlsZChwYXJlbnQsIG5hbWUsIHBhcmFtcywgZGlyZWN0b3J5KSB7XG5cdFx0XHRcdGlmIChwYXJlbnQuZGlyZWN0b3J5KVxuXHRcdFx0XHRcdHJldHVybiBkaXJlY3RvcnkgPyBuZXcgWmlwRGlyZWN0b3J5RW50cnkocGFyZW50LmZzLCBuYW1lLCBwYXJhbXMsIHBhcmVudCkgOiBuZXcgemlwLmZzLlppcEZpbGVFbnRyeShwYXJlbnQuZnMsIG5hbWUsIHBhcmFtcywgcGFyZW50KTtcblx0XHRcdFx0ZWxzZVxuXHRcdFx0XHRcdHRocm93IFwiUGFyZW50IGVudHJ5IGlzIG5vdCBhIGRpcmVjdG9yeS5cIjtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIGFkZENoaWxkKHRoaXMsIG5hbWUsIHtcblx0XHRcdFx0ZGF0YSA6IFVSTCxcblx0XHRcdFx0UmVhZGVyIDogdXNlUmFuZ2VIZWFkZXIgPyBIdHRwUmFuZ2VSZWFkZXIgOiBIdHRwUmVhZGVyXG5cdFx0XHR9KTtcblx0XHR9O1xuXHRcdFppcERpcmVjdG9yeUVudHJ5LnByb3RvdHlwZS5pbXBvcnRIdHRwQ29udGVudCA9IGZ1bmN0aW9uKFVSTCwgdXNlUmFuZ2VIZWFkZXIsIG9uZW5kLCBvbmVycm9yKSB7XG5cdFx0XHR0aGlzLmltcG9ydFppcCh1c2VSYW5nZUhlYWRlciA/IG5ldyBIdHRwUmFuZ2VSZWFkZXIoVVJMKSA6IG5ldyBIdHRwUmVhZGVyKFVSTCksIG9uZW5kLCBvbmVycm9yKTtcblx0XHR9O1xuXHRcdHppcC5mcy5GUy5wcm90b3R5cGUuaW1wb3J0SHR0cENvbnRlbnQgPSBmdW5jdGlvbihVUkwsIHVzZVJhbmdlSGVhZGVyLCBvbmVuZCwgb25lcnJvcikge1xuXHRcdFx0dGhpcy5lbnRyaWVzID0gW107XG5cdFx0XHR0aGlzLnJvb3QgPSBuZXcgWmlwRGlyZWN0b3J5RW50cnkodGhpcyk7XG5cdFx0XHR0aGlzLnJvb3QuaW1wb3J0SHR0cENvbnRlbnQoVVJMLCB1c2VSYW5nZUhlYWRlciwgb25lbmQsIG9uZXJyb3IpO1xuXHRcdH07XG5cdH1cblxufSkoKTtcbiIsIi8qXG4gQ29weXJpZ2h0IChjKSAyMDEzIEdpbGRhcyBMb3JtZWF1LiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuXG4gUmVkaXN0cmlidXRpb24gYW5kIHVzZSBpbiBzb3VyY2UgYW5kIGJpbmFyeSBmb3Jtcywgd2l0aCBvciB3aXRob3V0XG4gbW9kaWZpY2F0aW9uLCBhcmUgcGVybWl0dGVkIHByb3ZpZGVkIHRoYXQgdGhlIGZvbGxvd2luZyBjb25kaXRpb25zIGFyZSBtZXQ6XG5cbiAxLiBSZWRpc3RyaWJ1dGlvbnMgb2Ygc291cmNlIGNvZGUgbXVzdCByZXRhaW4gdGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UsXG4gdGhpcyBsaXN0IG9mIGNvbmRpdGlvbnMgYW5kIHRoZSBmb2xsb3dpbmcgZGlzY2xhaW1lci5cblxuIDIuIFJlZGlzdHJpYnV0aW9ucyBpbiBiaW5hcnkgZm9ybSBtdXN0IHJlcHJvZHVjZSB0aGUgYWJvdmUgY29weXJpZ2h0XG4gbm90aWNlLCB0aGlzIGxpc3Qgb2YgY29uZGl0aW9ucyBhbmQgdGhlIGZvbGxvd2luZyBkaXNjbGFpbWVyIGluXG4gdGhlIGRvY3VtZW50YXRpb24gYW5kL29yIG90aGVyIG1hdGVyaWFscyBwcm92aWRlZCB3aXRoIHRoZSBkaXN0cmlidXRpb24uXG5cbiAzLiBUaGUgbmFtZXMgb2YgdGhlIGF1dGhvcnMgbWF5IG5vdCBiZSB1c2VkIHRvIGVuZG9yc2Ugb3IgcHJvbW90ZSBwcm9kdWN0c1xuIGRlcml2ZWQgZnJvbSB0aGlzIHNvZnR3YXJlIHdpdGhvdXQgc3BlY2lmaWMgcHJpb3Igd3JpdHRlbiBwZXJtaXNzaW9uLlxuXG4gVEhJUyBTT0ZUV0FSRSBJUyBQUk9WSURFRCBgYEFTIElTJycgQU5EIEFOWSBFWFBSRVNTRUQgT1IgSU1QTElFRCBXQVJSQU5USUVTLFxuIElOQ0xVRElORywgQlVUIE5PVCBMSU1JVEVEIFRPLCBUSEUgSU1QTElFRCBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWSBBTkRcbiBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBUkUgRElTQ0xBSU1FRC4gSU4gTk8gRVZFTlQgU0hBTEwgSkNSQUZULFxuIElOQy4gT1IgQU5ZIENPTlRSSUJVVE9SUyBUTyBUSElTIFNPRlRXQVJFIEJFIExJQUJMRSBGT1IgQU5ZIERJUkVDVCwgSU5ESVJFQ1QsXG4gSU5DSURFTlRBTCwgU1BFQ0lBTCwgRVhFTVBMQVJZLCBPUiBDT05TRVFVRU5USUFMIERBTUFHRVMgKElOQ0xVRElORywgQlVUIE5PVFxuIExJTUlURUQgVE8sIFBST0NVUkVNRU5UIE9GIFNVQlNUSVRVVEUgR09PRFMgT1IgU0VSVklDRVM7IExPU1MgT0YgVVNFLCBEQVRBLFxuIE9SIFBST0ZJVFM7IE9SIEJVU0lORVNTIElOVEVSUlVQVElPTikgSE9XRVZFUiBDQVVTRUQgQU5EIE9OIEFOWSBUSEVPUlkgT0ZcbiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQ09OVFJBQ1QsIFNUUklDVCBMSUFCSUxJVFksIE9SIFRPUlQgKElOQ0xVRElOR1xuIE5FR0xJR0VOQ0UgT1IgT1RIRVJXSVNFKSBBUklTSU5HIElOIEFOWSBXQVkgT1VUIE9GIFRIRSBVU0UgT0YgVEhJUyBTT0ZUV0FSRSxcbiBFVkVOIElGIEFEVklTRUQgT0YgVEhFIFBPU1NJQklMSVRZIE9GIFNVQ0ggREFNQUdFLlxuICovXG5cbmV4cG9ydCBkZWZhdWx0IChmdW5jdGlvbihvYmopIHtcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0dmFyIEVSUl9CQURfRk9STUFUID0gXCJGaWxlIGZvcm1hdCBpcyBub3QgcmVjb2duaXplZC5cIjtcblx0dmFyIEVSUl9DUkMgPSBcIkNSQyBmYWlsZWQuXCI7XG5cdHZhciBFUlJfRU5DUllQVEVEID0gXCJGaWxlIGNvbnRhaW5zIGVuY3J5cHRlZCBlbnRyeS5cIjtcblx0dmFyIEVSUl9aSVA2NCA9IFwiRmlsZSBpcyB1c2luZyBaaXA2NCAoNGdiKyBmaWxlIHNpemUpLlwiO1xuXHR2YXIgRVJSX1JFQUQgPSBcIkVycm9yIHdoaWxlIHJlYWRpbmcgemlwIGZpbGUuXCI7XG5cdHZhciBFUlJfV1JJVEUgPSBcIkVycm9yIHdoaWxlIHdyaXRpbmcgemlwIGZpbGUuXCI7XG5cdHZhciBFUlJfV1JJVEVfREFUQSA9IFwiRXJyb3Igd2hpbGUgd3JpdGluZyBmaWxlIGRhdGEuXCI7XG5cdHZhciBFUlJfUkVBRF9EQVRBID0gXCJFcnJvciB3aGlsZSByZWFkaW5nIGZpbGUgZGF0YS5cIjtcblx0dmFyIEVSUl9EVVBMSUNBVEVEX05BTUUgPSBcIkZpbGUgYWxyZWFkeSBleGlzdHMuXCI7XG5cdHZhciBDSFVOS19TSVpFID0gNTEyICogMTAyNDtcblxuXHR2YXIgVEVYVF9QTEFJTiA9IFwidGV4dC9wbGFpblwiO1xuXG5cdHZhciBhcHBlbmRBQlZpZXdTdXBwb3J0ZWQ7XG5cdHRyeSB7XG5cdFx0YXBwZW5kQUJWaWV3U3VwcG9ydGVkID0gbmV3IEJsb2IoWyBuZXcgRGF0YVZpZXcobmV3IEFycmF5QnVmZmVyKDApKSBdKS5zaXplID09PSAwO1xuXHR9IGNhdGNoIChlKSB7XG5cdH1cblxuXHRmdW5jdGlvbiBDcmMzMigpIHtcblx0XHR0aGlzLmNyYyA9IC0xO1xuXHR9XG5cdENyYzMyLnByb3RvdHlwZS5hcHBlbmQgPSBmdW5jdGlvbiBhcHBlbmQoZGF0YSkge1xuXHRcdHZhciBjcmMgPSB0aGlzLmNyYyB8IDAsIHRhYmxlID0gdGhpcy50YWJsZTtcblx0XHRmb3IgKHZhciBvZmZzZXQgPSAwLCBsZW4gPSBkYXRhLmxlbmd0aCB8IDA7IG9mZnNldCA8IGxlbjsgb2Zmc2V0KyspXG5cdFx0XHRjcmMgPSAoY3JjID4+PiA4KSBeIHRhYmxlWyhjcmMgXiBkYXRhW29mZnNldF0pICYgMHhGRl07XG5cdFx0dGhpcy5jcmMgPSBjcmM7XG5cdH07XG5cdENyYzMyLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbiBnZXQoKSB7XG5cdFx0cmV0dXJuIH50aGlzLmNyYztcblx0fTtcblx0Q3JjMzIucHJvdG90eXBlLnRhYmxlID0gKGZ1bmN0aW9uKCkge1xuXHRcdHZhciBpLCBqLCB0LCB0YWJsZSA9IFtdOyAvLyBVaW50MzJBcnJheSBpcyBhY3R1YWxseSBzbG93ZXIgdGhhbiBbXVxuXHRcdGZvciAoaSA9IDA7IGkgPCAyNTY7IGkrKykge1xuXHRcdFx0dCA9IGk7XG5cdFx0XHRmb3IgKGogPSAwOyBqIDwgODsgaisrKVxuXHRcdFx0XHRpZiAodCAmIDEpXG5cdFx0XHRcdFx0dCA9ICh0ID4+PiAxKSBeIDB4RURCODgzMjA7XG5cdFx0XHRcdGVsc2Vcblx0XHRcdFx0XHR0ID0gdCA+Pj4gMTtcblx0XHRcdHRhYmxlW2ldID0gdDtcblx0XHR9XG5cdFx0cmV0dXJuIHRhYmxlO1xuXHR9KSgpO1xuXG5cdC8vIFwibm8tb3BcIiBjb2RlY1xuXHRmdW5jdGlvbiBOT09QKCkge31cblx0Tk9PUC5wcm90b3R5cGUuYXBwZW5kID0gZnVuY3Rpb24gYXBwZW5kKGJ5dGVzLCBvbnByb2dyZXNzKSB7XG5cdFx0cmV0dXJuIGJ5dGVzO1xuXHR9O1xuXHROT09QLnByb3RvdHlwZS5mbHVzaCA9IGZ1bmN0aW9uIGZsdXNoKCkge307XG5cblx0ZnVuY3Rpb24gYmxvYlNsaWNlKGJsb2IsIGluZGV4LCBsZW5ndGgpIHtcblx0XHRpZiAoaW5kZXggPCAwIHx8IGxlbmd0aCA8IDAgfHwgaW5kZXggKyBsZW5ndGggPiBibG9iLnNpemUpXG5cdFx0XHR0aHJvdyBuZXcgUmFuZ2VFcnJvcignb2Zmc2V0OicgKyBpbmRleCArICcsIGxlbmd0aDonICsgbGVuZ3RoICsgJywgc2l6ZTonICsgYmxvYi5zaXplKTtcblx0XHRpZiAoYmxvYi5zbGljZSlcblx0XHRcdHJldHVybiBibG9iLnNsaWNlKGluZGV4LCBpbmRleCArIGxlbmd0aCk7XG5cdFx0ZWxzZSBpZiAoYmxvYi53ZWJraXRTbGljZSlcblx0XHRcdHJldHVybiBibG9iLndlYmtpdFNsaWNlKGluZGV4LCBpbmRleCArIGxlbmd0aCk7XG5cdFx0ZWxzZSBpZiAoYmxvYi5tb3pTbGljZSlcblx0XHRcdHJldHVybiBibG9iLm1velNsaWNlKGluZGV4LCBpbmRleCArIGxlbmd0aCk7XG5cdFx0ZWxzZSBpZiAoYmxvYi5tc1NsaWNlKVxuXHRcdFx0cmV0dXJuIGJsb2IubXNTbGljZShpbmRleCwgaW5kZXggKyBsZW5ndGgpO1xuXHR9XG5cblx0ZnVuY3Rpb24gZ2V0RGF0YUhlbHBlcihieXRlTGVuZ3RoLCBieXRlcykge1xuXHRcdHZhciBkYXRhQnVmZmVyLCBkYXRhQXJyYXk7XG5cdFx0ZGF0YUJ1ZmZlciA9IG5ldyBBcnJheUJ1ZmZlcihieXRlTGVuZ3RoKTtcblx0XHRkYXRhQXJyYXkgPSBuZXcgVWludDhBcnJheShkYXRhQnVmZmVyKTtcblx0XHRpZiAoYnl0ZXMpXG5cdFx0XHRkYXRhQXJyYXkuc2V0KGJ5dGVzLCAwKTtcblx0XHRyZXR1cm4ge1xuXHRcdFx0YnVmZmVyIDogZGF0YUJ1ZmZlcixcblx0XHRcdGFycmF5IDogZGF0YUFycmF5LFxuXHRcdFx0dmlldyA6IG5ldyBEYXRhVmlldyhkYXRhQnVmZmVyKVxuXHRcdH07XG5cdH1cblxuXHQvLyBSZWFkZXJzXG5cdGZ1bmN0aW9uIFJlYWRlcigpIHtcblx0fVxuXG5cdGZ1bmN0aW9uIFRleHRSZWFkZXIodGV4dCkge1xuXHRcdHZhciB0aGF0ID0gdGhpcywgYmxvYlJlYWRlcjtcblxuXHRcdGZ1bmN0aW9uIGluaXQoY2FsbGJhY2ssIG9uZXJyb3IpIHtcblx0XHRcdHZhciBibG9iID0gbmV3IEJsb2IoWyB0ZXh0IF0sIHtcblx0XHRcdFx0dHlwZSA6IFRFWFRfUExBSU5cblx0XHRcdH0pO1xuXHRcdFx0YmxvYlJlYWRlciA9IG5ldyBCbG9iUmVhZGVyKGJsb2IpO1xuXHRcdFx0YmxvYlJlYWRlci5pbml0KGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR0aGF0LnNpemUgPSBibG9iUmVhZGVyLnNpemU7XG5cdFx0XHRcdGNhbGxiYWNrKCk7XG5cdFx0XHR9LCBvbmVycm9yKTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiByZWFkVWludDhBcnJheShpbmRleCwgbGVuZ3RoLCBjYWxsYmFjaywgb25lcnJvcikge1xuXHRcdFx0YmxvYlJlYWRlci5yZWFkVWludDhBcnJheShpbmRleCwgbGVuZ3RoLCBjYWxsYmFjaywgb25lcnJvcik7XG5cdFx0fVxuXG5cdFx0dGhhdC5zaXplID0gMDtcblx0XHR0aGF0LmluaXQgPSBpbml0O1xuXHRcdHRoYXQucmVhZFVpbnQ4QXJyYXkgPSByZWFkVWludDhBcnJheTtcblx0fVxuXHRUZXh0UmVhZGVyLnByb3RvdHlwZSA9IG5ldyBSZWFkZXIoKTtcblx0VGV4dFJlYWRlci5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBUZXh0UmVhZGVyO1xuXG5cdGZ1bmN0aW9uIERhdGE2NFVSSVJlYWRlcihkYXRhVVJJKSB7XG5cdFx0dmFyIHRoYXQgPSB0aGlzLCBkYXRhU3RhcnQ7XG5cblx0XHRmdW5jdGlvbiBpbml0KGNhbGxiYWNrKSB7XG5cdFx0XHR2YXIgZGF0YUVuZCA9IGRhdGFVUkkubGVuZ3RoO1xuXHRcdFx0d2hpbGUgKGRhdGFVUkkuY2hhckF0KGRhdGFFbmQgLSAxKSA9PSBcIj1cIilcblx0XHRcdFx0ZGF0YUVuZC0tO1xuXHRcdFx0ZGF0YVN0YXJ0ID0gZGF0YVVSSS5pbmRleE9mKFwiLFwiKSArIDE7XG5cdFx0XHR0aGF0LnNpemUgPSBNYXRoLmZsb29yKChkYXRhRW5kIC0gZGF0YVN0YXJ0KSAqIDAuNzUpO1xuXHRcdFx0Y2FsbGJhY2soKTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiByZWFkVWludDhBcnJheShpbmRleCwgbGVuZ3RoLCBjYWxsYmFjaykge1xuXHRcdFx0dmFyIGksIGRhdGEgPSBnZXREYXRhSGVscGVyKGxlbmd0aCk7XG5cdFx0XHR2YXIgc3RhcnQgPSBNYXRoLmZsb29yKGluZGV4IC8gMykgKiA0O1xuXHRcdFx0dmFyIGVuZCA9IE1hdGguY2VpbCgoaW5kZXggKyBsZW5ndGgpIC8gMykgKiA0O1xuXHRcdFx0dmFyIGJ5dGVzID0gb2JqLmF0b2IoZGF0YVVSSS5zdWJzdHJpbmcoc3RhcnQgKyBkYXRhU3RhcnQsIGVuZCArIGRhdGFTdGFydCkpO1xuXHRcdFx0dmFyIGRlbHRhID0gaW5kZXggLSBNYXRoLmZsb29yKHN0YXJ0IC8gNCkgKiAzO1xuXHRcdFx0Zm9yIChpID0gZGVsdGE7IGkgPCBkZWx0YSArIGxlbmd0aDsgaSsrKVxuXHRcdFx0XHRkYXRhLmFycmF5W2kgLSBkZWx0YV0gPSBieXRlcy5jaGFyQ29kZUF0KGkpO1xuXHRcdFx0Y2FsbGJhY2soZGF0YS5hcnJheSk7XG5cdFx0fVxuXG5cdFx0dGhhdC5zaXplID0gMDtcblx0XHR0aGF0LmluaXQgPSBpbml0O1xuXHRcdHRoYXQucmVhZFVpbnQ4QXJyYXkgPSByZWFkVWludDhBcnJheTtcblx0fVxuXHREYXRhNjRVUklSZWFkZXIucHJvdG90eXBlID0gbmV3IFJlYWRlcigpO1xuXHREYXRhNjRVUklSZWFkZXIucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gRGF0YTY0VVJJUmVhZGVyO1xuXG5cdGZ1bmN0aW9uIEJsb2JSZWFkZXIoYmxvYikge1xuXHRcdHZhciB0aGF0ID0gdGhpcztcblxuXHRcdGZ1bmN0aW9uIGluaXQoY2FsbGJhY2spIHtcblx0XHRcdHRoYXQuc2l6ZSA9IGJsb2Iuc2l6ZTtcblx0XHRcdGNhbGxiYWNrKCk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gcmVhZFVpbnQ4QXJyYXkoaW5kZXgsIGxlbmd0aCwgY2FsbGJhY2ssIG9uZXJyb3IpIHtcblx0XHRcdHZhciByZWFkZXIgPSBuZXcgRmlsZVJlYWRlcigpO1xuXHRcdFx0cmVhZGVyLm9ubG9hZCA9IGZ1bmN0aW9uKGUpIHtcblx0XHRcdFx0Y2FsbGJhY2sobmV3IFVpbnQ4QXJyYXkoZS50YXJnZXQucmVzdWx0KSk7XG5cdFx0XHR9O1xuXHRcdFx0cmVhZGVyLm9uZXJyb3IgPSBvbmVycm9yO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0cmVhZGVyLnJlYWRBc0FycmF5QnVmZmVyKGJsb2JTbGljZShibG9iLCBpbmRleCwgbGVuZ3RoKSk7XG5cdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdG9uZXJyb3IoZSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhhdC5zaXplID0gMDtcblx0XHR0aGF0LmluaXQgPSBpbml0O1xuXHRcdHRoYXQucmVhZFVpbnQ4QXJyYXkgPSByZWFkVWludDhBcnJheTtcblx0fVxuXHRCbG9iUmVhZGVyLnByb3RvdHlwZSA9IG5ldyBSZWFkZXIoKTtcblx0QmxvYlJlYWRlci5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBCbG9iUmVhZGVyO1xuXG5cdC8vIFdyaXRlcnNcblxuXHRmdW5jdGlvbiBXcml0ZXIoKSB7XG5cdH1cblx0V3JpdGVyLnByb3RvdHlwZS5nZXREYXRhID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcblx0XHRjYWxsYmFjayh0aGlzLmRhdGEpO1xuXHR9O1xuXG5cdGZ1bmN0aW9uIFRleHRXcml0ZXIoZW5jb2RpbmcpIHtcblx0XHR2YXIgdGhhdCA9IHRoaXMsIGJsb2I7XG5cblx0XHRmdW5jdGlvbiBpbml0KGNhbGxiYWNrKSB7XG5cdFx0XHRibG9iID0gbmV3IEJsb2IoW10sIHtcblx0XHRcdFx0dHlwZSA6IFRFWFRfUExBSU5cblx0XHRcdH0pO1xuXHRcdFx0Y2FsbGJhY2soKTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiB3cml0ZVVpbnQ4QXJyYXkoYXJyYXksIGNhbGxiYWNrKSB7XG5cdFx0XHRibG9iID0gbmV3IEJsb2IoWyBibG9iLCBhcHBlbmRBQlZpZXdTdXBwb3J0ZWQgPyBhcnJheSA6IGFycmF5LmJ1ZmZlciBdLCB7XG5cdFx0XHRcdHR5cGUgOiBURVhUX1BMQUlOXG5cdFx0XHR9KTtcblx0XHRcdGNhbGxiYWNrKCk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gZ2V0RGF0YShjYWxsYmFjaywgb25lcnJvcikge1xuXHRcdFx0dmFyIHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKCk7XG5cdFx0XHRyZWFkZXIub25sb2FkID0gZnVuY3Rpb24oZSkge1xuXHRcdFx0XHRjYWxsYmFjayhlLnRhcmdldC5yZXN1bHQpO1xuXHRcdFx0fTtcblx0XHRcdHJlYWRlci5vbmVycm9yID0gb25lcnJvcjtcblx0XHRcdHJlYWRlci5yZWFkQXNUZXh0KGJsb2IsIGVuY29kaW5nKTtcblx0XHR9XG5cblx0XHR0aGF0LmluaXQgPSBpbml0O1xuXHRcdHRoYXQud3JpdGVVaW50OEFycmF5ID0gd3JpdGVVaW50OEFycmF5O1xuXHRcdHRoYXQuZ2V0RGF0YSA9IGdldERhdGE7XG5cdH1cblx0VGV4dFdyaXRlci5wcm90b3R5cGUgPSBuZXcgV3JpdGVyKCk7XG5cdFRleHRXcml0ZXIucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gVGV4dFdyaXRlcjtcblxuXHRmdW5jdGlvbiBEYXRhNjRVUklXcml0ZXIoY29udGVudFR5cGUpIHtcblx0XHR2YXIgdGhhdCA9IHRoaXMsIGRhdGEgPSBcIlwiLCBwZW5kaW5nID0gXCJcIjtcblxuXHRcdGZ1bmN0aW9uIGluaXQoY2FsbGJhY2spIHtcblx0XHRcdGRhdGEgKz0gXCJkYXRhOlwiICsgKGNvbnRlbnRUeXBlIHx8IFwiXCIpICsgXCI7YmFzZTY0LFwiO1xuXHRcdFx0Y2FsbGJhY2soKTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiB3cml0ZVVpbnQ4QXJyYXkoYXJyYXksIGNhbGxiYWNrKSB7XG5cdFx0XHR2YXIgaSwgZGVsdGEgPSBwZW5kaW5nLmxlbmd0aCwgZGF0YVN0cmluZyA9IHBlbmRpbmc7XG5cdFx0XHRwZW5kaW5nID0gXCJcIjtcblx0XHRcdGZvciAoaSA9IDA7IGkgPCAoTWF0aC5mbG9vcigoZGVsdGEgKyBhcnJheS5sZW5ndGgpIC8gMykgKiAzKSAtIGRlbHRhOyBpKyspXG5cdFx0XHRcdGRhdGFTdHJpbmcgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShhcnJheVtpXSk7XG5cdFx0XHRmb3IgKDsgaSA8IGFycmF5Lmxlbmd0aDsgaSsrKVxuXHRcdFx0XHRwZW5kaW5nICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYXJyYXlbaV0pO1xuXHRcdFx0aWYgKGRhdGFTdHJpbmcubGVuZ3RoID4gMilcblx0XHRcdFx0ZGF0YSArPSBvYmouYnRvYShkYXRhU3RyaW5nKTtcblx0XHRcdGVsc2Vcblx0XHRcdFx0cGVuZGluZyA9IGRhdGFTdHJpbmc7XG5cdFx0XHRjYWxsYmFjaygpO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGdldERhdGEoY2FsbGJhY2spIHtcblx0XHRcdGNhbGxiYWNrKGRhdGEgKyBvYmouYnRvYShwZW5kaW5nKSk7XG5cdFx0fVxuXG5cdFx0dGhhdC5pbml0ID0gaW5pdDtcblx0XHR0aGF0LndyaXRlVWludDhBcnJheSA9IHdyaXRlVWludDhBcnJheTtcblx0XHR0aGF0LmdldERhdGEgPSBnZXREYXRhO1xuXHR9XG5cdERhdGE2NFVSSVdyaXRlci5wcm90b3R5cGUgPSBuZXcgV3JpdGVyKCk7XG5cdERhdGE2NFVSSVdyaXRlci5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBEYXRhNjRVUklXcml0ZXI7XG5cblx0ZnVuY3Rpb24gQmxvYldyaXRlcihjb250ZW50VHlwZSkge1xuXHRcdHZhciBibG9iLCB0aGF0ID0gdGhpcztcblxuXHRcdGZ1bmN0aW9uIGluaXQoY2FsbGJhY2spIHtcblx0XHRcdGJsb2IgPSBuZXcgQmxvYihbXSwge1xuXHRcdFx0XHR0eXBlIDogY29udGVudFR5cGVcblx0XHRcdH0pO1xuXHRcdFx0Y2FsbGJhY2soKTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiB3cml0ZVVpbnQ4QXJyYXkoYXJyYXksIGNhbGxiYWNrKSB7XG5cdFx0XHRibG9iID0gbmV3IEJsb2IoWyBibG9iLCBhcHBlbmRBQlZpZXdTdXBwb3J0ZWQgPyBhcnJheSA6IGFycmF5LmJ1ZmZlciBdLCB7XG5cdFx0XHRcdHR5cGUgOiBjb250ZW50VHlwZVxuXHRcdFx0fSk7XG5cdFx0XHRjYWxsYmFjaygpO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGdldERhdGEoY2FsbGJhY2spIHtcblx0XHRcdGNhbGxiYWNrKGJsb2IpO1xuXHRcdH1cblxuXHRcdHRoYXQuaW5pdCA9IGluaXQ7XG5cdFx0dGhhdC53cml0ZVVpbnQ4QXJyYXkgPSB3cml0ZVVpbnQ4QXJyYXk7XG5cdFx0dGhhdC5nZXREYXRhID0gZ2V0RGF0YTtcblx0fVxuXHRCbG9iV3JpdGVyLnByb3RvdHlwZSA9IG5ldyBXcml0ZXIoKTtcblx0QmxvYldyaXRlci5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBCbG9iV3JpdGVyO1xuXG5cdC8qKlxuXHQgKiBpbmZsYXRlL2RlZmxhdGUgY29yZSBmdW5jdGlvbnNcblx0ICogQHBhcmFtIHdvcmtlciB7V29ya2VyfSB3ZWIgd29ya2VyIGZvciB0aGUgdGFzay5cblx0ICogQHBhcmFtIGluaXRpYWxNZXNzYWdlIHtPYmplY3R9IGluaXRpYWwgbWVzc2FnZSB0byBiZSBzZW50IHRvIHRoZSB3b3JrZXIuIHNob3VsZCBjb250YWluXG5cdCAqICAgc24oc2VyaWFsIG51bWJlciBmb3IgZGlzdGluZ3Vpc2hpbmcgbXVsdGlwbGUgdGFza3Mgc2VudCB0byB0aGUgd29ya2VyKSwgYW5kIGNvZGVjQ2xhc3MuXG5cdCAqICAgVGhpcyBmdW5jdGlvbiBtYXkgYWRkIG1vcmUgcHJvcGVydGllcyBiZWZvcmUgc2VuZGluZy5cblx0ICovXG5cdGZ1bmN0aW9uIGxhdW5jaFdvcmtlclByb2Nlc3Mod29ya2VyLCBpbml0aWFsTWVzc2FnZSwgcmVhZGVyLCB3cml0ZXIsIG9mZnNldCwgc2l6ZSwgb25wcm9ncmVzcywgb25lbmQsIG9ucmVhZGVycm9yLCBvbndyaXRlZXJyb3IpIHtcblx0XHR2YXIgY2h1bmtJbmRleCA9IDAsIGluZGV4LCBvdXRwdXRTaXplLCBzbiA9IGluaXRpYWxNZXNzYWdlLnNuLCBjcmM7XG5cblx0XHRmdW5jdGlvbiBvbmZsdXNoKCkge1xuXHRcdFx0d29ya2VyLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBvbm1lc3NhZ2UsIGZhbHNlKTtcblx0XHRcdG9uZW5kKG91dHB1dFNpemUsIGNyYyk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gb25tZXNzYWdlKGV2ZW50KSB7XG5cdFx0XHR2YXIgbWVzc2FnZSA9IGV2ZW50LmRhdGEsIGRhdGEgPSBtZXNzYWdlLmRhdGEsIGVyciA9IG1lc3NhZ2UuZXJyb3I7XG5cdFx0XHRpZiAoZXJyKSB7XG5cdFx0XHRcdGVyci50b1N0cmluZyA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuICdFcnJvcjogJyArIHRoaXMubWVzc2FnZTsgfTtcblx0XHRcdFx0b25yZWFkZXJyb3IoZXJyKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKG1lc3NhZ2Uuc24gIT09IHNuKVxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHRpZiAodHlwZW9mIG1lc3NhZ2UuY29kZWNUaW1lID09PSAnbnVtYmVyJylcblx0XHRcdFx0d29ya2VyLmNvZGVjVGltZSArPSBtZXNzYWdlLmNvZGVjVGltZTsgLy8gc2hvdWxkIGJlIGJlZm9yZSBvbmZsdXNoKClcblx0XHRcdGlmICh0eXBlb2YgbWVzc2FnZS5jcmNUaW1lID09PSAnbnVtYmVyJylcblx0XHRcdFx0d29ya2VyLmNyY1RpbWUgKz0gbWVzc2FnZS5jcmNUaW1lO1xuXG5cdFx0XHRzd2l0Y2ggKG1lc3NhZ2UudHlwZSkge1xuXHRcdFx0XHRjYXNlICdhcHBlbmQnOlxuXHRcdFx0XHRcdGlmIChkYXRhKSB7XG5cdFx0XHRcdFx0XHRvdXRwdXRTaXplICs9IGRhdGEubGVuZ3RoO1xuXHRcdFx0XHRcdFx0d3JpdGVyLndyaXRlVWludDhBcnJheShkYXRhLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdFx0c3RlcCgpO1xuXHRcdFx0XHRcdFx0fSwgb253cml0ZWVycm9yKTtcblx0XHRcdFx0XHR9IGVsc2Vcblx0XHRcdFx0XHRcdHN0ZXAoKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSAnZmx1c2gnOlxuXHRcdFx0XHRcdGNyYyA9IG1lc3NhZ2UuY3JjO1xuXHRcdFx0XHRcdGlmIChkYXRhKSB7XG5cdFx0XHRcdFx0XHRvdXRwdXRTaXplICs9IGRhdGEubGVuZ3RoO1xuXHRcdFx0XHRcdFx0d3JpdGVyLndyaXRlVWludDhBcnJheShkYXRhLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdFx0b25mbHVzaCgpO1xuXHRcdFx0XHRcdFx0fSwgb253cml0ZWVycm9yKTtcblx0XHRcdFx0XHR9IGVsc2Vcblx0XHRcdFx0XHRcdG9uZmx1c2goKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSAncHJvZ3Jlc3MnOlxuXHRcdFx0XHRcdGlmIChvbnByb2dyZXNzKVxuXHRcdFx0XHRcdFx0b25wcm9ncmVzcyhpbmRleCArIG1lc3NhZ2UubG9hZGVkLCBzaXplKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSAnaW1wb3J0U2NyaXB0cyc6IC8vbm8gbmVlZCB0byBoYW5kbGUgaGVyZVxuXHRcdFx0XHRjYXNlICduZXdUYXNrJzpcblx0XHRcdFx0Y2FzZSAnZWNobyc6XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdFx0Y29uc29sZS53YXJuKCd6aXAuanM6bGF1bmNoV29ya2VyUHJvY2VzczogdW5rbm93biBtZXNzYWdlOiAnLCBtZXNzYWdlKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRmdW5jdGlvbiBzdGVwKCkge1xuXHRcdFx0aW5kZXggPSBjaHVua0luZGV4ICogQ0hVTktfU0laRTtcblx0XHRcdC8vIHVzZSBgPD1gIGluc3RlYWQgb2YgYDxgLCBiZWNhdXNlIGBzaXplYCBtYXkgYmUgMC5cblx0XHRcdGlmIChpbmRleCA8PSBzaXplKSB7XG5cdFx0XHRcdHJlYWRlci5yZWFkVWludDhBcnJheShvZmZzZXQgKyBpbmRleCwgTWF0aC5taW4oQ0hVTktfU0laRSwgc2l6ZSAtIGluZGV4KSwgZnVuY3Rpb24oYXJyYXkpIHtcblx0XHRcdFx0XHRpZiAob25wcm9ncmVzcylcblx0XHRcdFx0XHRcdG9ucHJvZ3Jlc3MoaW5kZXgsIHNpemUpO1xuXHRcdFx0XHRcdHZhciBtc2cgPSBpbmRleCA9PT0gMCA/IGluaXRpYWxNZXNzYWdlIDoge3NuIDogc259O1xuXHRcdFx0XHRcdG1zZy50eXBlID0gJ2FwcGVuZCc7XG5cdFx0XHRcdFx0bXNnLmRhdGEgPSBhcnJheTtcblxuXHRcdFx0XHRcdC8vIHBvc3RpbmcgYSBtZXNzYWdlIHdpdGggdHJhbnNmZXJhYmxlcyB3aWxsIGZhaWwgb24gSUUxMFxuXHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHR3b3JrZXIucG9zdE1lc3NhZ2UobXNnLCBbYXJyYXkuYnVmZmVyXSk7XG5cdFx0XHRcdFx0fSBjYXRjaChleCkge1xuXHRcdFx0XHRcdFx0d29ya2VyLnBvc3RNZXNzYWdlKG1zZyk7IC8vIHJldHJ5IHdpdGhvdXQgdHJhbnNmZXJhYmxlc1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRjaHVua0luZGV4Kys7XG5cdFx0XHRcdH0sIG9ucmVhZGVycm9yKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHdvcmtlci5wb3N0TWVzc2FnZSh7XG5cdFx0XHRcdFx0c246IHNuLFxuXHRcdFx0XHRcdHR5cGU6ICdmbHVzaCdcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0b3V0cHV0U2l6ZSA9IDA7XG5cdFx0d29ya2VyLmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBvbm1lc3NhZ2UsIGZhbHNlKTtcblx0XHRzdGVwKCk7XG5cdH1cblxuXHRmdW5jdGlvbiBsYXVuY2hQcm9jZXNzKHByb2Nlc3MsIHJlYWRlciwgd3JpdGVyLCBvZmZzZXQsIHNpemUsIGNyY1R5cGUsIG9ucHJvZ3Jlc3MsIG9uZW5kLCBvbnJlYWRlcnJvciwgb253cml0ZWVycm9yKSB7XG5cdFx0dmFyIGNodW5rSW5kZXggPSAwLCBpbmRleCwgb3V0cHV0U2l6ZSA9IDAsXG5cdFx0XHRjcmNJbnB1dCA9IGNyY1R5cGUgPT09ICdpbnB1dCcsXG5cdFx0XHRjcmNPdXRwdXQgPSBjcmNUeXBlID09PSAnb3V0cHV0Jyxcblx0XHRcdGNyYyA9IG5ldyBDcmMzMigpO1xuXHRcdGZ1bmN0aW9uIHN0ZXAoKSB7XG5cdFx0XHR2YXIgb3V0cHV0RGF0YTtcblx0XHRcdGluZGV4ID0gY2h1bmtJbmRleCAqIENIVU5LX1NJWkU7XG5cdFx0XHRpZiAoaW5kZXggPCBzaXplKVxuXHRcdFx0XHRyZWFkZXIucmVhZFVpbnQ4QXJyYXkob2Zmc2V0ICsgaW5kZXgsIE1hdGgubWluKENIVU5LX1NJWkUsIHNpemUgLSBpbmRleCksIGZ1bmN0aW9uKGlucHV0RGF0YSkge1xuXHRcdFx0XHRcdHZhciBvdXRwdXREYXRhO1xuXHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRvdXRwdXREYXRhID0gcHJvY2Vzcy5hcHBlbmQoaW5wdXREYXRhLCBmdW5jdGlvbihsb2FkZWQpIHtcblx0XHRcdFx0XHRcdFx0aWYgKG9ucHJvZ3Jlc3MpXG5cdFx0XHRcdFx0XHRcdFx0b25wcm9ncmVzcyhpbmRleCArIGxvYWRlZCwgc2l6ZSk7XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdFx0XHRvbnJlYWRlcnJvcihlKTtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKG91dHB1dERhdGEpIHtcblx0XHRcdFx0XHRcdG91dHB1dFNpemUgKz0gb3V0cHV0RGF0YS5sZW5ndGg7XG5cdFx0XHRcdFx0XHR3cml0ZXIud3JpdGVVaW50OEFycmF5KG91dHB1dERhdGEsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdFx0XHRjaHVua0luZGV4Kys7XG5cdFx0XHRcdFx0XHRcdHNldFRpbWVvdXQoc3RlcCwgMSk7XG5cdFx0XHRcdFx0XHR9LCBvbndyaXRlZXJyb3IpO1xuXHRcdFx0XHRcdFx0aWYgKGNyY091dHB1dClcblx0XHRcdFx0XHRcdFx0Y3JjLmFwcGVuZChvdXRwdXREYXRhKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0Y2h1bmtJbmRleCsrO1xuXHRcdFx0XHRcdFx0c2V0VGltZW91dChzdGVwLCAxKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKGNyY0lucHV0KVxuXHRcdFx0XHRcdFx0Y3JjLmFwcGVuZChpbnB1dERhdGEpO1xuXHRcdFx0XHRcdGlmIChvbnByb2dyZXNzKVxuXHRcdFx0XHRcdFx0b25wcm9ncmVzcyhpbmRleCwgc2l6ZSk7XG5cdFx0XHRcdH0sIG9ucmVhZGVycm9yKTtcblx0XHRcdGVsc2Uge1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdG91dHB1dERhdGEgPSBwcm9jZXNzLmZsdXNoKCk7XG5cdFx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0XHRvbnJlYWRlcnJvcihlKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKG91dHB1dERhdGEpIHtcblx0XHRcdFx0XHRpZiAoY3JjT3V0cHV0KVxuXHRcdFx0XHRcdFx0Y3JjLmFwcGVuZChvdXRwdXREYXRhKTtcblx0XHRcdFx0XHRvdXRwdXRTaXplICs9IG91dHB1dERhdGEubGVuZ3RoO1xuXHRcdFx0XHRcdHdyaXRlci53cml0ZVVpbnQ4QXJyYXkob3V0cHV0RGF0YSwgZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHRvbmVuZChvdXRwdXRTaXplLCBjcmMuZ2V0KCkpO1xuXHRcdFx0XHRcdH0sIG9ud3JpdGVlcnJvcik7XG5cdFx0XHRcdH0gZWxzZVxuXHRcdFx0XHRcdG9uZW5kKG91dHB1dFNpemUsIGNyYy5nZXQoKSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0c3RlcCgpO1xuXHR9XG5cblx0ZnVuY3Rpb24gaW5mbGF0ZSh3b3JrZXIsIHNuLCByZWFkZXIsIHdyaXRlciwgb2Zmc2V0LCBzaXplLCBjb21wdXRlQ3JjMzIsIG9uZW5kLCBvbnByb2dyZXNzLCBvbnJlYWRlcnJvciwgb253cml0ZWVycm9yKSB7XG5cdFx0dmFyIGNyY1R5cGUgPSBjb21wdXRlQ3JjMzIgPyAnb3V0cHV0JyA6ICdub25lJztcblx0XHRpZiAob2JqLnppcC51c2VXZWJXb3JrZXJzKSB7XG5cdFx0XHR2YXIgaW5pdGlhbE1lc3NhZ2UgPSB7XG5cdFx0XHRcdHNuOiBzbixcblx0XHRcdFx0Y29kZWNDbGFzczogJ0luZmxhdGVyJyxcblx0XHRcdFx0Y3JjVHlwZTogY3JjVHlwZSxcblx0XHRcdH07XG5cdFx0XHRsYXVuY2hXb3JrZXJQcm9jZXNzKHdvcmtlciwgaW5pdGlhbE1lc3NhZ2UsIHJlYWRlciwgd3JpdGVyLCBvZmZzZXQsIHNpemUsIG9ucHJvZ3Jlc3MsIG9uZW5kLCBvbnJlYWRlcnJvciwgb253cml0ZWVycm9yKTtcblx0XHR9IGVsc2Vcblx0XHRcdGxhdW5jaFByb2Nlc3MobmV3IG9iai56aXAuSW5mbGF0ZXIoKSwgcmVhZGVyLCB3cml0ZXIsIG9mZnNldCwgc2l6ZSwgY3JjVHlwZSwgb25wcm9ncmVzcywgb25lbmQsIG9ucmVhZGVycm9yLCBvbndyaXRlZXJyb3IpO1xuXHR9XG5cblx0ZnVuY3Rpb24gZGVmbGF0ZSh3b3JrZXIsIHNuLCByZWFkZXIsIHdyaXRlciwgbGV2ZWwsIG9uZW5kLCBvbnByb2dyZXNzLCBvbnJlYWRlcnJvciwgb253cml0ZWVycm9yKSB7XG5cdFx0dmFyIGNyY1R5cGUgPSAnaW5wdXQnO1xuXHRcdGlmIChvYmouemlwLnVzZVdlYldvcmtlcnMpIHtcblx0XHRcdHZhciBpbml0aWFsTWVzc2FnZSA9IHtcblx0XHRcdFx0c246IHNuLFxuXHRcdFx0XHRvcHRpb25zOiB7bGV2ZWw6IGxldmVsfSxcblx0XHRcdFx0Y29kZWNDbGFzczogJ0RlZmxhdGVyJyxcblx0XHRcdFx0Y3JjVHlwZTogY3JjVHlwZSxcblx0XHRcdH07XG5cdFx0XHRsYXVuY2hXb3JrZXJQcm9jZXNzKHdvcmtlciwgaW5pdGlhbE1lc3NhZ2UsIHJlYWRlciwgd3JpdGVyLCAwLCByZWFkZXIuc2l6ZSwgb25wcm9ncmVzcywgb25lbmQsIG9ucmVhZGVycm9yLCBvbndyaXRlZXJyb3IpO1xuXHRcdH0gZWxzZVxuXHRcdFx0bGF1bmNoUHJvY2VzcyhuZXcgb2JqLnppcC5EZWZsYXRlcigpLCByZWFkZXIsIHdyaXRlciwgMCwgcmVhZGVyLnNpemUsIGNyY1R5cGUsIG9ucHJvZ3Jlc3MsIG9uZW5kLCBvbnJlYWRlcnJvciwgb253cml0ZWVycm9yKTtcblx0fVxuXG5cdGZ1bmN0aW9uIGNvcHkod29ya2VyLCBzbiwgcmVhZGVyLCB3cml0ZXIsIG9mZnNldCwgc2l6ZSwgY29tcHV0ZUNyYzMyLCBvbmVuZCwgb25wcm9ncmVzcywgb25yZWFkZXJyb3IsIG9ud3JpdGVlcnJvcikge1xuXHRcdHZhciBjcmNUeXBlID0gJ2lucHV0Jztcblx0XHRpZiAob2JqLnppcC51c2VXZWJXb3JrZXJzICYmIGNvbXB1dGVDcmMzMikge1xuXHRcdFx0dmFyIGluaXRpYWxNZXNzYWdlID0ge1xuXHRcdFx0XHRzbjogc24sXG5cdFx0XHRcdGNvZGVjQ2xhc3M6ICdOT09QJyxcblx0XHRcdFx0Y3JjVHlwZTogY3JjVHlwZSxcblx0XHRcdH07XG5cdFx0XHRsYXVuY2hXb3JrZXJQcm9jZXNzKHdvcmtlciwgaW5pdGlhbE1lc3NhZ2UsIHJlYWRlciwgd3JpdGVyLCBvZmZzZXQsIHNpemUsIG9ucHJvZ3Jlc3MsIG9uZW5kLCBvbnJlYWRlcnJvciwgb253cml0ZWVycm9yKTtcblx0XHR9IGVsc2Vcblx0XHRcdGxhdW5jaFByb2Nlc3MobmV3IE5PT1AoKSwgcmVhZGVyLCB3cml0ZXIsIG9mZnNldCwgc2l6ZSwgY3JjVHlwZSwgb25wcm9ncmVzcywgb25lbmQsIG9ucmVhZGVycm9yLCBvbndyaXRlZXJyb3IpO1xuXHR9XG5cblx0Ly8gWmlwUmVhZGVyXG5cblx0ZnVuY3Rpb24gZGVjb2RlQVNDSUkoc3RyKSB7XG5cdFx0dmFyIGksIG91dCA9IFwiXCIsIGNoYXJDb2RlLCBleHRlbmRlZEFTQ0lJID0gWyAnXFx1MDBDNycsICdcXHUwMEZDJywgJ1xcdTAwRTknLCAnXFx1MDBFMicsICdcXHUwMEU0JywgJ1xcdTAwRTAnLCAnXFx1MDBFNScsICdcXHUwMEU3JywgJ1xcdTAwRUEnLCAnXFx1MDBFQicsXG5cdFx0XHRcdCdcXHUwMEU4JywgJ1xcdTAwRUYnLCAnXFx1MDBFRScsICdcXHUwMEVDJywgJ1xcdTAwQzQnLCAnXFx1MDBDNScsICdcXHUwMEM5JywgJ1xcdTAwRTYnLCAnXFx1MDBDNicsICdcXHUwMEY0JywgJ1xcdTAwRjYnLCAnXFx1MDBGMicsICdcXHUwMEZCJywgJ1xcdTAwRjknLFxuXHRcdFx0XHQnXFx1MDBGRicsICdcXHUwMEQ2JywgJ1xcdTAwREMnLCAnXFx1MDBGOCcsICdcXHUwMEEzJywgJ1xcdTAwRDgnLCAnXFx1MDBENycsICdcXHUwMTkyJywgJ1xcdTAwRTEnLCAnXFx1MDBFRCcsICdcXHUwMEYzJywgJ1xcdTAwRkEnLCAnXFx1MDBGMScsICdcXHUwMEQxJyxcblx0XHRcdFx0J1xcdTAwQUEnLCAnXFx1MDBCQScsICdcXHUwMEJGJywgJ1xcdTAwQUUnLCAnXFx1MDBBQycsICdcXHUwMEJEJywgJ1xcdTAwQkMnLCAnXFx1MDBBMScsICdcXHUwMEFCJywgJ1xcdTAwQkInLCAnXycsICdfJywgJ18nLCAnXFx1MDBBNicsICdcXHUwMEE2Jyxcblx0XHRcdFx0J1xcdTAwQzEnLCAnXFx1MDBDMicsICdcXHUwMEMwJywgJ1xcdTAwQTknLCAnXFx1MDBBNicsICdcXHUwMEE2JywgJysnLCAnKycsICdcXHUwMEEyJywgJ1xcdTAwQTUnLCAnKycsICcrJywgJy0nLCAnLScsICcrJywgJy0nLCAnKycsICdcXHUwMEUzJyxcblx0XHRcdFx0J1xcdTAwQzMnLCAnKycsICcrJywgJy0nLCAnLScsICdcXHUwMEE2JywgJy0nLCAnKycsICdcXHUwMEE0JywgJ1xcdTAwRjAnLCAnXFx1MDBEMCcsICdcXHUwMENBJywgJ1xcdTAwQ0InLCAnXFx1MDBDOCcsICdpJywgJ1xcdTAwQ0QnLCAnXFx1MDBDRScsXG5cdFx0XHRcdCdcXHUwMENGJywgJysnLCAnKycsICdfJywgJ18nLCAnXFx1MDBBNicsICdcXHUwMENDJywgJ18nLCAnXFx1MDBEMycsICdcXHUwMERGJywgJ1xcdTAwRDQnLCAnXFx1MDBEMicsICdcXHUwMEY1JywgJ1xcdTAwRDUnLCAnXFx1MDBCNScsICdcXHUwMEZFJyxcblx0XHRcdFx0J1xcdTAwREUnLCAnXFx1MDBEQScsICdcXHUwMERCJywgJ1xcdTAwRDknLCAnXFx1MDBGRCcsICdcXHUwMEREJywgJ1xcdTAwQUYnLCAnXFx1MDBCNCcsICdcXHUwMEFEJywgJ1xcdTAwQjEnLCAnXycsICdcXHUwMEJFJywgJ1xcdTAwQjYnLCAnXFx1MDBBNycsXG5cdFx0XHRcdCdcXHUwMEY3JywgJ1xcdTAwQjgnLCAnXFx1MDBCMCcsICdcXHUwMEE4JywgJ1xcdTAwQjcnLCAnXFx1MDBCOScsICdcXHUwMEIzJywgJ1xcdTAwQjInLCAnXycsICcgJyBdO1xuXHRcdGZvciAoaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyBpKyspIHtcblx0XHRcdGNoYXJDb2RlID0gc3RyLmNoYXJDb2RlQXQoaSkgJiAweEZGO1xuXHRcdFx0aWYgKGNoYXJDb2RlID4gMTI3KVxuXHRcdFx0XHRvdXQgKz0gZXh0ZW5kZWRBU0NJSVtjaGFyQ29kZSAtIDEyOF07XG5cdFx0XHRlbHNlXG5cdFx0XHRcdG91dCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGNoYXJDb2RlKTtcblx0XHR9XG5cdFx0cmV0dXJuIG91dDtcblx0fVxuXG5cdGZ1bmN0aW9uIGRlY29kZVVURjgoc3RyaW5nKSB7XG5cdFx0cmV0dXJuIGRlY29kZVVSSUNvbXBvbmVudChlc2NhcGUoc3RyaW5nKSk7XG5cdH1cblxuXHRmdW5jdGlvbiBnZXRTdHJpbmcoYnl0ZXMpIHtcblx0XHR2YXIgaSwgc3RyID0gXCJcIjtcblx0XHRmb3IgKGkgPSAwOyBpIDwgYnl0ZXMubGVuZ3RoOyBpKyspXG5cdFx0XHRzdHIgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShieXRlc1tpXSk7XG5cdFx0cmV0dXJuIHN0cjtcblx0fVxuXG5cdGZ1bmN0aW9uIGdldERhdGUodGltZVJhdykge1xuXHRcdHZhciBkYXRlID0gKHRpbWVSYXcgJiAweGZmZmYwMDAwKSA+PiAxNiwgdGltZSA9IHRpbWVSYXcgJiAweDAwMDBmZmZmO1xuXHRcdHRyeSB7XG5cdFx0XHRyZXR1cm4gbmV3IERhdGUoMTk4MCArICgoZGF0ZSAmIDB4RkUwMCkgPj4gOSksICgoZGF0ZSAmIDB4MDFFMCkgPj4gNSkgLSAxLCBkYXRlICYgMHgwMDFGLCAodGltZSAmIDB4RjgwMCkgPj4gMTEsICh0aW1lICYgMHgwN0UwKSA+PiA1LFxuXHRcdFx0XHRcdCh0aW1lICYgMHgwMDFGKSAqIDIsIDApO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiByZWFkQ29tbW9uSGVhZGVyKGVudHJ5LCBkYXRhLCBpbmRleCwgY2VudHJhbERpcmVjdG9yeSwgb25lcnJvcikge1xuXHRcdGVudHJ5LnZlcnNpb24gPSBkYXRhLnZpZXcuZ2V0VWludDE2KGluZGV4LCB0cnVlKTtcblx0XHRlbnRyeS5iaXRGbGFnID0gZGF0YS52aWV3LmdldFVpbnQxNihpbmRleCArIDIsIHRydWUpO1xuXHRcdGVudHJ5LmNvbXByZXNzaW9uTWV0aG9kID0gZGF0YS52aWV3LmdldFVpbnQxNihpbmRleCArIDQsIHRydWUpO1xuXHRcdGVudHJ5Lmxhc3RNb2REYXRlUmF3ID0gZGF0YS52aWV3LmdldFVpbnQzMihpbmRleCArIDYsIHRydWUpO1xuXHRcdGVudHJ5Lmxhc3RNb2REYXRlID0gZ2V0RGF0ZShlbnRyeS5sYXN0TW9kRGF0ZVJhdyk7XG5cdFx0aWYgKChlbnRyeS5iaXRGbGFnICYgMHgwMSkgPT09IDB4MDEpIHtcblx0XHRcdG9uZXJyb3IoRVJSX0VOQ1JZUFRFRCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmIChjZW50cmFsRGlyZWN0b3J5IHx8IChlbnRyeS5iaXRGbGFnICYgMHgwMDA4KSAhPSAweDAwMDgpIHtcblx0XHRcdGVudHJ5LmNyYzMyID0gZGF0YS52aWV3LmdldFVpbnQzMihpbmRleCArIDEwLCB0cnVlKTtcblx0XHRcdGVudHJ5LmNvbXByZXNzZWRTaXplID0gZGF0YS52aWV3LmdldFVpbnQzMihpbmRleCArIDE0LCB0cnVlKTtcblx0XHRcdGVudHJ5LnVuY29tcHJlc3NlZFNpemUgPSBkYXRhLnZpZXcuZ2V0VWludDMyKGluZGV4ICsgMTgsIHRydWUpO1xuXHRcdH1cblx0XHRpZiAoZW50cnkuY29tcHJlc3NlZFNpemUgPT09IDB4RkZGRkZGRkYgfHwgZW50cnkudW5jb21wcmVzc2VkU2l6ZSA9PT0gMHhGRkZGRkZGRikge1xuXHRcdFx0b25lcnJvcihFUlJfWklQNjQpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRlbnRyeS5maWxlbmFtZUxlbmd0aCA9IGRhdGEudmlldy5nZXRVaW50MTYoaW5kZXggKyAyMiwgdHJ1ZSk7XG5cdFx0ZW50cnkuZXh0cmFGaWVsZExlbmd0aCA9IGRhdGEudmlldy5nZXRVaW50MTYoaW5kZXggKyAyNCwgdHJ1ZSk7XG5cdH1cblxuXHRmdW5jdGlvbiBjcmVhdGVaaXBSZWFkZXIocmVhZGVyLCBjYWxsYmFjaywgb25lcnJvcikge1xuXHRcdHZhciBpbmZsYXRlU04gPSAwO1xuXG5cdFx0ZnVuY3Rpb24gRW50cnkoKSB7XG5cdFx0fVxuXG5cdFx0RW50cnkucHJvdG90eXBlLmdldERhdGEgPSBmdW5jdGlvbih3cml0ZXIsIG9uZW5kLCBvbnByb2dyZXNzLCBjaGVja0NyYzMyKSB7XG5cdFx0XHR2YXIgdGhhdCA9IHRoaXM7XG5cblx0XHRcdGZ1bmN0aW9uIHRlc3RDcmMzMihjcmMzMikge1xuXHRcdFx0XHR2YXIgZGF0YUNyYzMyID0gZ2V0RGF0YUhlbHBlcig0KTtcblx0XHRcdFx0ZGF0YUNyYzMyLnZpZXcuc2V0VWludDMyKDAsIGNyYzMyKTtcblx0XHRcdFx0cmV0dXJuIHRoYXQuY3JjMzIgPT0gZGF0YUNyYzMyLnZpZXcuZ2V0VWludDMyKDApO1xuXHRcdFx0fVxuXG5cdFx0XHRmdW5jdGlvbiBnZXRXcml0ZXJEYXRhKHVuY29tcHJlc3NlZFNpemUsIGNyYzMyKSB7XG5cdFx0XHRcdGlmIChjaGVja0NyYzMyICYmICF0ZXN0Q3JjMzIoY3JjMzIpKVxuXHRcdFx0XHRcdG9uZXJyb3IoRVJSX0NSQyk7XG5cdFx0XHRcdGVsc2Vcblx0XHRcdFx0XHR3cml0ZXIuZ2V0RGF0YShmdW5jdGlvbihkYXRhKSB7XG5cdFx0XHRcdFx0XHRvbmVuZChkYXRhKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdH1cblxuXHRcdFx0ZnVuY3Rpb24gb25yZWFkZXJyb3IoZXJyKSB7XG5cdFx0XHRcdG9uZXJyb3IoZXJyIHx8IEVSUl9SRUFEX0RBVEEpO1xuXHRcdFx0fVxuXG5cdFx0XHRmdW5jdGlvbiBvbndyaXRlZXJyb3IoZXJyKSB7XG5cdFx0XHRcdG9uZXJyb3IoZXJyIHx8IEVSUl9XUklURV9EQVRBKTtcblx0XHRcdH1cblxuXHRcdFx0cmVhZGVyLnJlYWRVaW50OEFycmF5KHRoYXQub2Zmc2V0LCAzMCwgZnVuY3Rpb24oYnl0ZXMpIHtcblx0XHRcdFx0dmFyIGRhdGEgPSBnZXREYXRhSGVscGVyKGJ5dGVzLmxlbmd0aCwgYnl0ZXMpLCBkYXRhT2Zmc2V0O1xuXHRcdFx0XHRpZiAoZGF0YS52aWV3LmdldFVpbnQzMigwKSAhPSAweDUwNGIwMzA0KSB7XG5cdFx0XHRcdFx0b25lcnJvcihFUlJfQkFEX0ZPUk1BVCk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJlYWRDb21tb25IZWFkZXIodGhhdCwgZGF0YSwgNCwgZmFsc2UsIG9uZXJyb3IpO1xuXHRcdFx0XHRkYXRhT2Zmc2V0ID0gdGhhdC5vZmZzZXQgKyAzMCArIHRoYXQuZmlsZW5hbWVMZW5ndGggKyB0aGF0LmV4dHJhRmllbGRMZW5ndGg7XG5cdFx0XHRcdHdyaXRlci5pbml0KGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdGlmICh0aGF0LmNvbXByZXNzaW9uTWV0aG9kID09PSAwKVxuXHRcdFx0XHRcdFx0Y29weSh0aGF0Ll93b3JrZXIsIGluZmxhdGVTTisrLCByZWFkZXIsIHdyaXRlciwgZGF0YU9mZnNldCwgdGhhdC5jb21wcmVzc2VkU2l6ZSwgY2hlY2tDcmMzMiwgZ2V0V3JpdGVyRGF0YSwgb25wcm9ncmVzcywgb25yZWFkZXJyb3IsIG9ud3JpdGVlcnJvcik7XG5cdFx0XHRcdFx0ZWxzZVxuXHRcdFx0XHRcdFx0aW5mbGF0ZSh0aGF0Ll93b3JrZXIsIGluZmxhdGVTTisrLCByZWFkZXIsIHdyaXRlciwgZGF0YU9mZnNldCwgdGhhdC5jb21wcmVzc2VkU2l6ZSwgY2hlY2tDcmMzMiwgZ2V0V3JpdGVyRGF0YSwgb25wcm9ncmVzcywgb25yZWFkZXJyb3IsIG9ud3JpdGVlcnJvcik7XG5cdFx0XHRcdH0sIG9ud3JpdGVlcnJvcik7XG5cdFx0XHR9LCBvbnJlYWRlcnJvcik7XG5cdFx0fTtcblxuXHRcdGZ1bmN0aW9uIHNlZWtFT0NEUihlb2NkckNhbGxiYWNrKSB7XG5cdFx0XHQvLyBcIkVuZCBvZiBjZW50cmFsIGRpcmVjdG9yeSByZWNvcmRcIiBpcyB0aGUgbGFzdCBwYXJ0IG9mIGEgemlwIGFyY2hpdmUsIGFuZCBpcyBhdCBsZWFzdCAyMiBieXRlcyBsb25nLlxuXHRcdFx0Ly8gWmlwIGZpbGUgY29tbWVudCBpcyB0aGUgbGFzdCBwYXJ0IG9mIEVPQ0RSIGFuZCBoYXMgbWF4IGxlbmd0aCBvZiA2NEtCLFxuXHRcdFx0Ly8gc28gd2Ugb25seSBoYXZlIHRvIHNlYXJjaCB0aGUgbGFzdCA2NEsgKyAyMiBieXRlcyBvZiBhIGFyY2hpdmUgZm9yIEVPQ0RSIHNpZ25hdHVyZSAoMHgwNjA1NGI1MCkuXG5cdFx0XHR2YXIgRU9DRFJfTUlOID0gMjI7XG5cdFx0XHRpZiAocmVhZGVyLnNpemUgPCBFT0NEUl9NSU4pIHtcblx0XHRcdFx0b25lcnJvcihFUlJfQkFEX0ZPUk1BVCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHZhciBaSVBfQ09NTUVOVF9NQVggPSAyNTYgKiAyNTYsIEVPQ0RSX01BWCA9IEVPQ0RSX01JTiArIFpJUF9DT01NRU5UX01BWDtcblxuXHRcdFx0Ly8gSW4gbW9zdCBjYXNlcywgdGhlIEVPQ0RSIGlzIEVPQ0RSX01JTiBieXRlcyBsb25nXG5cdFx0XHRkb1NlZWsoRU9DRFJfTUlOLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0Ly8gSWYgbm90IGZvdW5kLCB0cnkgd2l0aGluIEVPQ0RSX01BWCBieXRlc1xuXHRcdFx0XHRkb1NlZWsoTWF0aC5taW4oRU9DRFJfTUFYLCByZWFkZXIuc2l6ZSksIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdG9uZXJyb3IoRVJSX0JBRF9GT1JNQVQpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXG5cdFx0XHQvLyBzZWVrIGxhc3QgbGVuZ3RoIGJ5dGVzIG9mIGZpbGUgZm9yIEVPQ0RSXG5cdFx0XHRmdW5jdGlvbiBkb1NlZWsobGVuZ3RoLCBlb2Nkck5vdEZvdW5kQ2FsbGJhY2spIHtcblx0XHRcdFx0cmVhZGVyLnJlYWRVaW50OEFycmF5KHJlYWRlci5zaXplIC0gbGVuZ3RoLCBsZW5ndGgsIGZ1bmN0aW9uKGJ5dGVzKSB7XG5cdFx0XHRcdFx0Zm9yICh2YXIgaSA9IGJ5dGVzLmxlbmd0aCAtIEVPQ0RSX01JTjsgaSA+PSAwOyBpLS0pIHtcblx0XHRcdFx0XHRcdGlmIChieXRlc1tpXSA9PT0gMHg1MCAmJiBieXRlc1tpICsgMV0gPT09IDB4NGIgJiYgYnl0ZXNbaSArIDJdID09PSAweDA1ICYmIGJ5dGVzW2kgKyAzXSA9PT0gMHgwNikge1xuXHRcdFx0XHRcdFx0XHRlb2NkckNhbGxiYWNrKG5ldyBEYXRhVmlldyhieXRlcy5idWZmZXIsIGksIEVPQ0RSX01JTikpO1xuXHRcdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGVvY2RyTm90Rm91bmRDYWxsYmFjaygpO1xuXHRcdFx0XHR9LCBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRvbmVycm9yKEVSUl9SRUFEKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dmFyIHppcFJlYWRlciA9IHtcblx0XHRcdGdldEVudHJpZXMgOiBmdW5jdGlvbihjYWxsYmFjaykge1xuXHRcdFx0XHR2YXIgd29ya2VyID0gdGhpcy5fd29ya2VyO1xuXHRcdFx0XHQvLyBsb29rIGZvciBFbmQgb2YgY2VudHJhbCBkaXJlY3RvcnkgcmVjb3JkXG5cdFx0XHRcdHNlZWtFT0NEUihmdW5jdGlvbihkYXRhVmlldykge1xuXHRcdFx0XHRcdHZhciBkYXRhbGVuZ3RoLCBmaWxlc2xlbmd0aDtcblx0XHRcdFx0XHRkYXRhbGVuZ3RoID0gZGF0YVZpZXcuZ2V0VWludDMyKDE2LCB0cnVlKTtcblx0XHRcdFx0XHRmaWxlc2xlbmd0aCA9IGRhdGFWaWV3LmdldFVpbnQxNig4LCB0cnVlKTtcblx0XHRcdFx0XHRpZiAoZGF0YWxlbmd0aCA8IDAgfHwgZGF0YWxlbmd0aCA+PSByZWFkZXIuc2l6ZSkge1xuXHRcdFx0XHRcdFx0b25lcnJvcihFUlJfQkFEX0ZPUk1BVCk7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJlYWRlci5yZWFkVWludDhBcnJheShkYXRhbGVuZ3RoLCByZWFkZXIuc2l6ZSAtIGRhdGFsZW5ndGgsIGZ1bmN0aW9uKGJ5dGVzKSB7XG5cdFx0XHRcdFx0XHR2YXIgaSwgaW5kZXggPSAwLCBlbnRyaWVzID0gW10sIGVudHJ5LCBmaWxlbmFtZSwgY29tbWVudCwgZGF0YSA9IGdldERhdGFIZWxwZXIoYnl0ZXMubGVuZ3RoLCBieXRlcyk7XG5cdFx0XHRcdFx0XHRmb3IgKGkgPSAwOyBpIDwgZmlsZXNsZW5ndGg7IGkrKykge1xuXHRcdFx0XHRcdFx0XHRlbnRyeSA9IG5ldyBFbnRyeSgpO1xuXHRcdFx0XHRcdFx0XHRlbnRyeS5fd29ya2VyID0gd29ya2VyO1xuXHRcdFx0XHRcdFx0XHRpZiAoZGF0YS52aWV3LmdldFVpbnQzMihpbmRleCkgIT0gMHg1MDRiMDEwMikge1xuXHRcdFx0XHRcdFx0XHRcdG9uZXJyb3IoRVJSX0JBRF9GT1JNQVQpO1xuXHRcdFx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRyZWFkQ29tbW9uSGVhZGVyKGVudHJ5LCBkYXRhLCBpbmRleCArIDYsIHRydWUsIG9uZXJyb3IpO1xuXHRcdFx0XHRcdFx0XHRlbnRyeS5jb21tZW50TGVuZ3RoID0gZGF0YS52aWV3LmdldFVpbnQxNihpbmRleCArIDMyLCB0cnVlKTtcblx0XHRcdFx0XHRcdFx0ZW50cnkuZGlyZWN0b3J5ID0gKChkYXRhLnZpZXcuZ2V0VWludDgoaW5kZXggKyAzOCkgJiAweDEwKSA9PSAweDEwKTtcblx0XHRcdFx0XHRcdFx0ZW50cnkub2Zmc2V0ID0gZGF0YS52aWV3LmdldFVpbnQzMihpbmRleCArIDQyLCB0cnVlKTtcblx0XHRcdFx0XHRcdFx0ZmlsZW5hbWUgPSBnZXRTdHJpbmcoZGF0YS5hcnJheS5zdWJhcnJheShpbmRleCArIDQ2LCBpbmRleCArIDQ2ICsgZW50cnkuZmlsZW5hbWVMZW5ndGgpKTtcblx0XHRcdFx0XHRcdFx0ZW50cnkuZmlsZW5hbWUgPSAoKGVudHJ5LmJpdEZsYWcgJiAweDA4MDApID09PSAweDA4MDApID8gZGVjb2RlVVRGOChmaWxlbmFtZSkgOiBkZWNvZGVBU0NJSShmaWxlbmFtZSk7XG5cdFx0XHRcdFx0XHRcdGlmICghZW50cnkuZGlyZWN0b3J5ICYmIGVudHJ5LmZpbGVuYW1lLmNoYXJBdChlbnRyeS5maWxlbmFtZS5sZW5ndGggLSAxKSA9PSBcIi9cIilcblx0XHRcdFx0XHRcdFx0XHRlbnRyeS5kaXJlY3RvcnkgPSB0cnVlO1xuXHRcdFx0XHRcdFx0XHRjb21tZW50ID0gZ2V0U3RyaW5nKGRhdGEuYXJyYXkuc3ViYXJyYXkoaW5kZXggKyA0NiArIGVudHJ5LmZpbGVuYW1lTGVuZ3RoICsgZW50cnkuZXh0cmFGaWVsZExlbmd0aCwgaW5kZXggKyA0NlxuXHRcdFx0XHRcdFx0XHRcdFx0KyBlbnRyeS5maWxlbmFtZUxlbmd0aCArIGVudHJ5LmV4dHJhRmllbGRMZW5ndGggKyBlbnRyeS5jb21tZW50TGVuZ3RoKSk7XG5cdFx0XHRcdFx0XHRcdGVudHJ5LmNvbW1lbnQgPSAoKGVudHJ5LmJpdEZsYWcgJiAweDA4MDApID09PSAweDA4MDApID8gZGVjb2RlVVRGOChjb21tZW50KSA6IGRlY29kZUFTQ0lJKGNvbW1lbnQpO1xuXHRcdFx0XHRcdFx0XHRlbnRyaWVzLnB1c2goZW50cnkpO1xuXHRcdFx0XHRcdFx0XHRpbmRleCArPSA0NiArIGVudHJ5LmZpbGVuYW1lTGVuZ3RoICsgZW50cnkuZXh0cmFGaWVsZExlbmd0aCArIGVudHJ5LmNvbW1lbnRMZW5ndGg7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRjYWxsYmFjayhlbnRyaWVzKTtcblx0XHRcdFx0XHR9LCBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdG9uZXJyb3IoRVJSX1JFQUQpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0sXG5cdFx0XHRjbG9zZSA6IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG5cdFx0XHRcdGlmICh0aGlzLl93b3JrZXIpIHtcblx0XHRcdFx0XHR0aGlzLl93b3JrZXIudGVybWluYXRlKCk7XG5cdFx0XHRcdFx0dGhpcy5fd29ya2VyID0gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoY2FsbGJhY2spXG5cdFx0XHRcdFx0Y2FsbGJhY2soKTtcblx0XHRcdH0sXG5cdFx0XHRfd29ya2VyOiBudWxsXG5cdFx0fTtcblxuXHRcdGlmICghb2JqLnppcC51c2VXZWJXb3JrZXJzKVxuXHRcdFx0Y2FsbGJhY2soemlwUmVhZGVyKTtcblx0XHRlbHNlIHtcblx0XHRcdGNyZWF0ZVdvcmtlcignaW5mbGF0ZXInLFxuXHRcdFx0XHRmdW5jdGlvbih3b3JrZXIpIHtcblx0XHRcdFx0XHR6aXBSZWFkZXIuX3dvcmtlciA9IHdvcmtlcjtcblx0XHRcdFx0XHRjYWxsYmFjayh6aXBSZWFkZXIpO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRmdW5jdGlvbihlcnIpIHtcblx0XHRcdFx0XHRvbmVycm9yKGVycik7XG5cdFx0XHRcdH1cblx0XHRcdCk7XG5cdFx0fVxuXHR9XG5cblx0Ly8gWmlwV3JpdGVyXG5cblx0ZnVuY3Rpb24gZW5jb2RlVVRGOChzdHJpbmcpIHtcblx0XHRyZXR1cm4gdW5lc2NhcGUoZW5jb2RlVVJJQ29tcG9uZW50KHN0cmluZykpO1xuXHR9XG5cblx0ZnVuY3Rpb24gZ2V0Qnl0ZXMoc3RyKSB7XG5cdFx0dmFyIGksIGFycmF5ID0gW107XG5cdFx0Zm9yIChpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKylcblx0XHRcdGFycmF5LnB1c2goc3RyLmNoYXJDb2RlQXQoaSkpO1xuXHRcdHJldHVybiBhcnJheTtcblx0fVxuXG5cdGZ1bmN0aW9uIGNyZWF0ZVppcFdyaXRlcih3cml0ZXIsIGNhbGxiYWNrLCBvbmVycm9yLCBkb250RGVmbGF0ZSkge1xuXHRcdHZhciBmaWxlcyA9IHt9LCBmaWxlbmFtZXMgPSBbXSwgZGF0YWxlbmd0aCA9IDA7XG5cdFx0dmFyIGRlZmxhdGVTTiA9IDA7XG5cblx0XHRmdW5jdGlvbiBvbndyaXRlZXJyb3IoZXJyKSB7XG5cdFx0XHRvbmVycm9yKGVyciB8fCBFUlJfV1JJVEUpO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIG9ucmVhZGVycm9yKGVycikge1xuXHRcdFx0b25lcnJvcihlcnIgfHwgRVJSX1JFQURfREFUQSk7XG5cdFx0fVxuXG5cdFx0dmFyIHppcFdyaXRlciA9IHtcblx0XHRcdGFkZCA6IGZ1bmN0aW9uKG5hbWUsIHJlYWRlciwgb25lbmQsIG9ucHJvZ3Jlc3MsIG9wdGlvbnMpIHtcblx0XHRcdFx0dmFyIGhlYWRlciwgZmlsZW5hbWUsIGRhdGU7XG5cdFx0XHRcdHZhciB3b3JrZXIgPSB0aGlzLl93b3JrZXI7XG5cblx0XHRcdFx0ZnVuY3Rpb24gd3JpdGVIZWFkZXIoY2FsbGJhY2spIHtcblx0XHRcdFx0XHR2YXIgZGF0YTtcblx0XHRcdFx0XHRkYXRlID0gb3B0aW9ucy5sYXN0TW9kRGF0ZSB8fCBuZXcgRGF0ZSgpO1xuXHRcdFx0XHRcdGhlYWRlciA9IGdldERhdGFIZWxwZXIoMjYpO1xuXHRcdFx0XHRcdGZpbGVzW25hbWVdID0ge1xuXHRcdFx0XHRcdFx0aGVhZGVyQXJyYXkgOiBoZWFkZXIuYXJyYXksXG5cdFx0XHRcdFx0XHRkaXJlY3RvcnkgOiBvcHRpb25zLmRpcmVjdG9yeSxcblx0XHRcdFx0XHRcdGZpbGVuYW1lIDogZmlsZW5hbWUsXG5cdFx0XHRcdFx0XHRvZmZzZXQgOiBkYXRhbGVuZ3RoLFxuXHRcdFx0XHRcdFx0Y29tbWVudCA6IGdldEJ5dGVzKGVuY29kZVVURjgob3B0aW9ucy5jb21tZW50IHx8IFwiXCIpKVxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0aGVhZGVyLnZpZXcuc2V0VWludDMyKDAsIDB4MTQwMDA4MDgpO1xuXHRcdFx0XHRcdGlmIChvcHRpb25zLnZlcnNpb24pXG5cdFx0XHRcdFx0XHRoZWFkZXIudmlldy5zZXRVaW50OCgwLCBvcHRpb25zLnZlcnNpb24pO1xuXHRcdFx0XHRcdGlmICghZG9udERlZmxhdGUgJiYgb3B0aW9ucy5sZXZlbCAhPT0gMCAmJiAhb3B0aW9ucy5kaXJlY3RvcnkpXG5cdFx0XHRcdFx0XHRoZWFkZXIudmlldy5zZXRVaW50MTYoNCwgMHgwODAwKTtcblx0XHRcdFx0XHRoZWFkZXIudmlldy5zZXRVaW50MTYoNiwgKCgoZGF0ZS5nZXRIb3VycygpIDw8IDYpIHwgZGF0ZS5nZXRNaW51dGVzKCkpIDw8IDUpIHwgZGF0ZS5nZXRTZWNvbmRzKCkgLyAyLCB0cnVlKTtcblx0XHRcdFx0XHRoZWFkZXIudmlldy5zZXRVaW50MTYoOCwgKCgoKGRhdGUuZ2V0RnVsbFllYXIoKSAtIDE5ODApIDw8IDQpIHwgKGRhdGUuZ2V0TW9udGgoKSArIDEpKSA8PCA1KSB8IGRhdGUuZ2V0RGF0ZSgpLCB0cnVlKTtcblx0XHRcdFx0XHRoZWFkZXIudmlldy5zZXRVaW50MTYoMjIsIGZpbGVuYW1lLmxlbmd0aCwgdHJ1ZSk7XG5cdFx0XHRcdFx0ZGF0YSA9IGdldERhdGFIZWxwZXIoMzAgKyBmaWxlbmFtZS5sZW5ndGgpO1xuXHRcdFx0XHRcdGRhdGEudmlldy5zZXRVaW50MzIoMCwgMHg1MDRiMDMwNCk7XG5cdFx0XHRcdFx0ZGF0YS5hcnJheS5zZXQoaGVhZGVyLmFycmF5LCA0KTtcblx0XHRcdFx0XHRkYXRhLmFycmF5LnNldChmaWxlbmFtZSwgMzApO1xuXHRcdFx0XHRcdGRhdGFsZW5ndGggKz0gZGF0YS5hcnJheS5sZW5ndGg7XG5cdFx0XHRcdFx0d3JpdGVyLndyaXRlVWludDhBcnJheShkYXRhLmFycmF5LCBjYWxsYmFjaywgb253cml0ZWVycm9yKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGZ1bmN0aW9uIHdyaXRlRm9vdGVyKGNvbXByZXNzZWRMZW5ndGgsIGNyYzMyKSB7XG5cdFx0XHRcdFx0dmFyIGZvb3RlciA9IGdldERhdGFIZWxwZXIoMTYpO1xuXHRcdFx0XHRcdGRhdGFsZW5ndGggKz0gY29tcHJlc3NlZExlbmd0aCB8fCAwO1xuXHRcdFx0XHRcdGZvb3Rlci52aWV3LnNldFVpbnQzMigwLCAweDUwNGIwNzA4KTtcblx0XHRcdFx0XHRpZiAodHlwZW9mIGNyYzMyICE9IFwidW5kZWZpbmVkXCIpIHtcblx0XHRcdFx0XHRcdGhlYWRlci52aWV3LnNldFVpbnQzMigxMCwgY3JjMzIsIHRydWUpO1xuXHRcdFx0XHRcdFx0Zm9vdGVyLnZpZXcuc2V0VWludDMyKDQsIGNyYzMyLCB0cnVlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKHJlYWRlcikge1xuXHRcdFx0XHRcdFx0Zm9vdGVyLnZpZXcuc2V0VWludDMyKDgsIGNvbXByZXNzZWRMZW5ndGgsIHRydWUpO1xuXHRcdFx0XHRcdFx0aGVhZGVyLnZpZXcuc2V0VWludDMyKDE0LCBjb21wcmVzc2VkTGVuZ3RoLCB0cnVlKTtcblx0XHRcdFx0XHRcdGZvb3Rlci52aWV3LnNldFVpbnQzMigxMiwgcmVhZGVyLnNpemUsIHRydWUpO1xuXHRcdFx0XHRcdFx0aGVhZGVyLnZpZXcuc2V0VWludDMyKDE4LCByZWFkZXIuc2l6ZSwgdHJ1ZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHdyaXRlci53cml0ZVVpbnQ4QXJyYXkoZm9vdGVyLmFycmF5LCBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdGRhdGFsZW5ndGggKz0gMTY7XG5cdFx0XHRcdFx0XHRvbmVuZCgpO1xuXHRcdFx0XHRcdH0sIG9ud3JpdGVlcnJvcik7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRmdW5jdGlvbiB3cml0ZUZpbGUoKSB7XG5cdFx0XHRcdFx0b3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cdFx0XHRcdFx0bmFtZSA9IG5hbWUudHJpbSgpO1xuXHRcdFx0XHRcdGlmIChvcHRpb25zLmRpcmVjdG9yeSAmJiBuYW1lLmNoYXJBdChuYW1lLmxlbmd0aCAtIDEpICE9IFwiL1wiKVxuXHRcdFx0XHRcdFx0bmFtZSArPSBcIi9cIjtcblx0XHRcdFx0XHRpZiAoZmlsZXMuaGFzT3duUHJvcGVydHkobmFtZSkpIHtcblx0XHRcdFx0XHRcdG9uZXJyb3IoRVJSX0RVUExJQ0FURURfTkFNRSk7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGZpbGVuYW1lID0gZ2V0Qnl0ZXMoZW5jb2RlVVRGOChuYW1lKSk7XG5cdFx0XHRcdFx0ZmlsZW5hbWVzLnB1c2gobmFtZSk7XG5cdFx0XHRcdFx0d3JpdGVIZWFkZXIoZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHRpZiAocmVhZGVyKVxuXHRcdFx0XHRcdFx0XHRpZiAoZG9udERlZmxhdGUgfHwgb3B0aW9ucy5sZXZlbCA9PT0gMClcblx0XHRcdFx0XHRcdFx0XHRjb3B5KHdvcmtlciwgZGVmbGF0ZVNOKyssIHJlYWRlciwgd3JpdGVyLCAwLCByZWFkZXIuc2l6ZSwgdHJ1ZSwgd3JpdGVGb290ZXIsIG9ucHJvZ3Jlc3MsIG9ucmVhZGVycm9yLCBvbndyaXRlZXJyb3IpO1xuXHRcdFx0XHRcdFx0XHRlbHNlXG5cdFx0XHRcdFx0XHRcdFx0ZGVmbGF0ZSh3b3JrZXIsIGRlZmxhdGVTTisrLCByZWFkZXIsIHdyaXRlciwgb3B0aW9ucy5sZXZlbCwgd3JpdGVGb290ZXIsIG9ucHJvZ3Jlc3MsIG9ucmVhZGVycm9yLCBvbndyaXRlZXJyb3IpO1xuXHRcdFx0XHRcdFx0ZWxzZVxuXHRcdFx0XHRcdFx0XHR3cml0ZUZvb3RlcigpO1xuXHRcdFx0XHRcdH0sIG9ud3JpdGVlcnJvcik7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAocmVhZGVyKVxuXHRcdFx0XHRcdHJlYWRlci5pbml0KHdyaXRlRmlsZSwgb25yZWFkZXJyb3IpO1xuXHRcdFx0XHRlbHNlXG5cdFx0XHRcdFx0d3JpdGVGaWxlKCk7XG5cdFx0XHR9LFxuXHRcdFx0Y2xvc2UgOiBmdW5jdGlvbihjYWxsYmFjaykge1xuXHRcdFx0XHRpZiAodGhpcy5fd29ya2VyKSB7XG5cdFx0XHRcdFx0dGhpcy5fd29ya2VyLnRlcm1pbmF0ZSgpO1xuXHRcdFx0XHRcdHRoaXMuX3dvcmtlciA9IG51bGw7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR2YXIgZGF0YSwgbGVuZ3RoID0gMCwgaW5kZXggPSAwLCBpbmRleEZpbGVuYW1lLCBmaWxlO1xuXHRcdFx0XHRmb3IgKGluZGV4RmlsZW5hbWUgPSAwOyBpbmRleEZpbGVuYW1lIDwgZmlsZW5hbWVzLmxlbmd0aDsgaW5kZXhGaWxlbmFtZSsrKSB7XG5cdFx0XHRcdFx0ZmlsZSA9IGZpbGVzW2ZpbGVuYW1lc1tpbmRleEZpbGVuYW1lXV07XG5cdFx0XHRcdFx0bGVuZ3RoICs9IDQ2ICsgZmlsZS5maWxlbmFtZS5sZW5ndGggKyBmaWxlLmNvbW1lbnQubGVuZ3RoO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGRhdGEgPSBnZXREYXRhSGVscGVyKGxlbmd0aCArIDIyKTtcblx0XHRcdFx0Zm9yIChpbmRleEZpbGVuYW1lID0gMDsgaW5kZXhGaWxlbmFtZSA8IGZpbGVuYW1lcy5sZW5ndGg7IGluZGV4RmlsZW5hbWUrKykge1xuXHRcdFx0XHRcdGZpbGUgPSBmaWxlc1tmaWxlbmFtZXNbaW5kZXhGaWxlbmFtZV1dO1xuXHRcdFx0XHRcdGRhdGEudmlldy5zZXRVaW50MzIoaW5kZXgsIDB4NTA0YjAxMDIpO1xuXHRcdFx0XHRcdGRhdGEudmlldy5zZXRVaW50MTYoaW5kZXggKyA0LCAweDE0MDApO1xuXHRcdFx0XHRcdGRhdGEuYXJyYXkuc2V0KGZpbGUuaGVhZGVyQXJyYXksIGluZGV4ICsgNik7XG5cdFx0XHRcdFx0ZGF0YS52aWV3LnNldFVpbnQxNihpbmRleCArIDMyLCBmaWxlLmNvbW1lbnQubGVuZ3RoLCB0cnVlKTtcblx0XHRcdFx0XHRpZiAoZmlsZS5kaXJlY3RvcnkpXG5cdFx0XHRcdFx0XHRkYXRhLnZpZXcuc2V0VWludDgoaW5kZXggKyAzOCwgMHgxMCk7XG5cdFx0XHRcdFx0ZGF0YS52aWV3LnNldFVpbnQzMihpbmRleCArIDQyLCBmaWxlLm9mZnNldCwgdHJ1ZSk7XG5cdFx0XHRcdFx0ZGF0YS5hcnJheS5zZXQoZmlsZS5maWxlbmFtZSwgaW5kZXggKyA0Nik7XG5cdFx0XHRcdFx0ZGF0YS5hcnJheS5zZXQoZmlsZS5jb21tZW50LCBpbmRleCArIDQ2ICsgZmlsZS5maWxlbmFtZS5sZW5ndGgpO1xuXHRcdFx0XHRcdGluZGV4ICs9IDQ2ICsgZmlsZS5maWxlbmFtZS5sZW5ndGggKyBmaWxlLmNvbW1lbnQubGVuZ3RoO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGRhdGEudmlldy5zZXRVaW50MzIoaW5kZXgsIDB4NTA0YjA1MDYpO1xuXHRcdFx0XHRkYXRhLnZpZXcuc2V0VWludDE2KGluZGV4ICsgOCwgZmlsZW5hbWVzLmxlbmd0aCwgdHJ1ZSk7XG5cdFx0XHRcdGRhdGEudmlldy5zZXRVaW50MTYoaW5kZXggKyAxMCwgZmlsZW5hbWVzLmxlbmd0aCwgdHJ1ZSk7XG5cdFx0XHRcdGRhdGEudmlldy5zZXRVaW50MzIoaW5kZXggKyAxMiwgbGVuZ3RoLCB0cnVlKTtcblx0XHRcdFx0ZGF0YS52aWV3LnNldFVpbnQzMihpbmRleCArIDE2LCBkYXRhbGVuZ3RoLCB0cnVlKTtcblx0XHRcdFx0d3JpdGVyLndyaXRlVWludDhBcnJheShkYXRhLmFycmF5LCBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHR3cml0ZXIuZ2V0RGF0YShjYWxsYmFjayk7XG5cdFx0XHRcdH0sIG9ud3JpdGVlcnJvcik7XG5cdFx0XHR9LFxuXHRcdFx0X3dvcmtlcjogbnVsbFxuXHRcdH07XG5cblx0XHRpZiAoIW9iai56aXAudXNlV2ViV29ya2Vycylcblx0XHRcdGNhbGxiYWNrKHppcFdyaXRlcik7XG5cdFx0ZWxzZSB7XG5cdFx0XHRjcmVhdGVXb3JrZXIoJ2RlZmxhdGVyJyxcblx0XHRcdFx0ZnVuY3Rpb24od29ya2VyKSB7XG5cdFx0XHRcdFx0emlwV3JpdGVyLl93b3JrZXIgPSB3b3JrZXI7XG5cdFx0XHRcdFx0Y2FsbGJhY2soemlwV3JpdGVyKTtcblx0XHRcdFx0fSxcblx0XHRcdFx0ZnVuY3Rpb24oZXJyKSB7XG5cdFx0XHRcdFx0b25lcnJvcihlcnIpO1xuXHRcdFx0XHR9XG5cdFx0XHQpO1xuXHRcdH1cblx0fVxuXG5cdGZ1bmN0aW9uIHJlc29sdmVVUkxzKHVybHMpIHtcblx0XHR2YXIgYSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2EnKTtcblx0XHRyZXR1cm4gdXJscy5tYXAoZnVuY3Rpb24odXJsKSB7XG5cdFx0XHRhLmhyZWYgPSB1cmw7XG5cdFx0XHRyZXR1cm4gYS5ocmVmO1xuXHRcdH0pO1xuXHR9XG5cblx0dmFyIERFRkFVTFRfV09SS0VSX1NDUklQVFMgPSB7XG5cdFx0ZGVmbGF0ZXI6IFsnei13b3JrZXIuanMnLCAnZGVmbGF0ZS5qcyddLFxuXHRcdGluZmxhdGVyOiBbJ3otd29ya2VyLmpzJywgJ2luZmxhdGUuanMnXVxuXHR9O1xuXHRmdW5jdGlvbiBjcmVhdGVXb3JrZXIodHlwZSwgY2FsbGJhY2ssIG9uZXJyb3IpIHtcblx0XHRpZiAob2JqLnppcC53b3JrZXJTY3JpcHRzICE9PSBudWxsICYmIG9iai56aXAud29ya2VyU2NyaXB0c1BhdGggIT09IG51bGwpIHtcblx0XHRcdG9uZXJyb3IobmV3IEVycm9yKCdFaXRoZXIgemlwLndvcmtlclNjcmlwdHMgb3IgemlwLndvcmtlclNjcmlwdHNQYXRoIG1heSBiZSBzZXQsIG5vdCBib3RoLicpKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dmFyIHNjcmlwdHM7XG5cdFx0aWYgKG9iai56aXAud29ya2VyU2NyaXB0cykge1xuXHRcdFx0c2NyaXB0cyA9IG9iai56aXAud29ya2VyU2NyaXB0c1t0eXBlXTtcblx0XHRcdGlmICghQXJyYXkuaXNBcnJheShzY3JpcHRzKSkge1xuXHRcdFx0XHRvbmVycm9yKG5ldyBFcnJvcignemlwLndvcmtlclNjcmlwdHMuJyArIHR5cGUgKyAnIGlzIG5vdCBhbiBhcnJheSEnKSk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHNjcmlwdHMgPSByZXNvbHZlVVJMcyhzY3JpcHRzKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0c2NyaXB0cyA9IERFRkFVTFRfV09SS0VSX1NDUklQVFNbdHlwZV0uc2xpY2UoMCk7XG5cdFx0XHRzY3JpcHRzWzBdID0gKG9iai56aXAud29ya2VyU2NyaXB0c1BhdGggfHwgJycpICsgc2NyaXB0c1swXTtcblx0XHR9XG5cdFx0dmFyIHdvcmtlciA9IG5ldyBXb3JrZXIoc2NyaXB0c1swXSk7XG5cdFx0Ly8gcmVjb3JkIHRvdGFsIGNvbnN1bWVkIHRpbWUgYnkgaW5mbGF0ZXIvZGVmbGF0ZXIvY3JjMzIgaW4gdGhpcyB3b3JrZXJcblx0XHR3b3JrZXIuY29kZWNUaW1lID0gd29ya2VyLmNyY1RpbWUgPSAwO1xuXHRcdHdvcmtlci5wb3N0TWVzc2FnZSh7IHR5cGU6ICdpbXBvcnRTY3JpcHRzJywgc2NyaXB0czogc2NyaXB0cy5zbGljZSgxKSB9KTtcblx0XHR3b3JrZXIuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIG9ubWVzc2FnZSk7XG5cdFx0ZnVuY3Rpb24gb25tZXNzYWdlKGV2KSB7XG5cdFx0XHR2YXIgbXNnID0gZXYuZGF0YTtcblx0XHRcdGlmIChtc2cuZXJyb3IpIHtcblx0XHRcdFx0d29ya2VyLnRlcm1pbmF0ZSgpOyAvLyBzaG91bGQgYmVmb3JlIG9uZXJyb3IoKSwgYmVjYXVzZSBvbmVycm9yKCkgbWF5IHRocm93LlxuXHRcdFx0XHRvbmVycm9yKG1zZy5lcnJvcik7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmIChtc2cudHlwZSA9PT0gJ2ltcG9ydFNjcmlwdHMnKSB7XG5cdFx0XHRcdHdvcmtlci5yZW1vdmVFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgb25tZXNzYWdlKTtcblx0XHRcdFx0d29ya2VyLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2Vycm9yJywgZXJyb3JIYW5kbGVyKTtcblx0XHRcdFx0Y2FsbGJhY2sod29ya2VyKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0Ly8gY2F0Y2ggZW50cnkgc2NyaXB0IGxvYWRpbmcgZXJyb3IgYW5kIG90aGVyIHVuaGFuZGxlZCBlcnJvcnNcblx0XHR3b3JrZXIuYWRkRXZlbnRMaXN0ZW5lcignZXJyb3InLCBlcnJvckhhbmRsZXIpO1xuXHRcdGZ1bmN0aW9uIGVycm9ySGFuZGxlcihlcnIpIHtcblx0XHRcdHdvcmtlci50ZXJtaW5hdGUoKTtcblx0XHRcdG9uZXJyb3IoZXJyKTtcblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiBvbmVycm9yX2RlZmF1bHQoZXJyb3IpIHtcblx0XHRjb25zb2xlLmVycm9yKGVycm9yKTtcblx0fVxuXHRvYmouemlwID0ge1xuXHRcdFJlYWRlciA6IFJlYWRlcixcblx0XHRXcml0ZXIgOiBXcml0ZXIsXG5cdFx0QmxvYlJlYWRlciA6IEJsb2JSZWFkZXIsXG5cdFx0RGF0YTY0VVJJUmVhZGVyIDogRGF0YTY0VVJJUmVhZGVyLFxuXHRcdFRleHRSZWFkZXIgOiBUZXh0UmVhZGVyLFxuXHRcdEJsb2JXcml0ZXIgOiBCbG9iV3JpdGVyLFxuXHRcdERhdGE2NFVSSVdyaXRlciA6IERhdGE2NFVSSVdyaXRlcixcblx0XHRUZXh0V3JpdGVyIDogVGV4dFdyaXRlcixcblx0XHRjcmVhdGVSZWFkZXIgOiBmdW5jdGlvbihyZWFkZXIsIGNhbGxiYWNrLCBvbmVycm9yKSB7XG5cdFx0XHRvbmVycm9yID0gb25lcnJvciB8fCBvbmVycm9yX2RlZmF1bHQ7XG5cblx0XHRcdHJlYWRlci5pbml0KGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRjcmVhdGVaaXBSZWFkZXIocmVhZGVyLCBjYWxsYmFjaywgb25lcnJvcik7XG5cdFx0XHR9LCBvbmVycm9yKTtcblx0XHR9LFxuXHRcdGNyZWF0ZVdyaXRlciA6IGZ1bmN0aW9uKHdyaXRlciwgY2FsbGJhY2ssIG9uZXJyb3IsIGRvbnREZWZsYXRlKSB7XG5cdFx0XHRvbmVycm9yID0gb25lcnJvciB8fCBvbmVycm9yX2RlZmF1bHQ7XG5cdFx0XHRkb250RGVmbGF0ZSA9ICEhZG9udERlZmxhdGU7XG5cblx0XHRcdHdyaXRlci5pbml0KGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRjcmVhdGVaaXBXcml0ZXIod3JpdGVyLCBjYWxsYmFjaywgb25lcnJvciwgZG9udERlZmxhdGUpO1xuXHRcdFx0fSwgb25lcnJvcik7XG5cdFx0fSxcblx0XHR1c2VXZWJXb3JrZXJzIDogdHJ1ZSxcblx0XHQvKipcblx0XHQgKiBEaXJlY3RvcnkgY29udGFpbmluZyB0aGUgZGVmYXVsdCB3b3JrZXIgc2NyaXB0cyAoei13b3JrZXIuanMsIGRlZmxhdGUuanMsIGFuZCBpbmZsYXRlLmpzKSwgcmVsYXRpdmUgdG8gY3VycmVudCBiYXNlIHVybC5cblx0XHQgKiBFLmcuOiB6aXAud29ya2VyU2NyaXB0cyA9ICcuLyc7XG5cdFx0ICovXG5cdFx0d29ya2VyU2NyaXB0c1BhdGggOiBudWxsLFxuXHRcdC8qKlxuXHRcdCAqIEFkdmFuY2VkIG9wdGlvbiB0byBjb250cm9sIHdoaWNoIHNjcmlwdHMgYXJlIGxvYWRlZCBpbiB0aGUgV2ViIHdvcmtlci4gSWYgdGhpcyBvcHRpb24gaXMgc3BlY2lmaWVkLCB0aGVuIHdvcmtlclNjcmlwdHNQYXRoIG11c3Qgbm90IGJlIHNldC5cblx0XHQgKiB3b3JrZXJTY3JpcHRzLmRlZmxhdGVyL3dvcmtlclNjcmlwdHMuaW5mbGF0ZXIgc2hvdWxkIGJlIGFycmF5cyBvZiB1cmxzIHRvIHNjcmlwdHMgZm9yIGRlZmxhdGVyL2luZmxhdGVyLCByZXNwZWN0aXZlbHkuXG5cdFx0ICogU2NyaXB0cyBpbiB0aGUgYXJyYXkgYXJlIGV4ZWN1dGVkIGluIG9yZGVyLCBhbmQgdGhlIGZpcnN0IG9uZSBzaG91bGQgYmUgei13b3JrZXIuanMsIHdoaWNoIGlzIHVzZWQgdG8gc3RhcnQgdGhlIHdvcmtlci5cblx0XHQgKiBBbGwgdXJscyBhcmUgcmVsYXRpdmUgdG8gY3VycmVudCBiYXNlIHVybC5cblx0XHQgKiBFLmcuOlxuXHRcdCAqIHppcC53b3JrZXJTY3JpcHRzID0ge1xuXHRcdCAqICAgZGVmbGF0ZXI6IFsnei13b3JrZXIuanMnLCAnZGVmbGF0ZS5qcyddLFxuXHRcdCAqICAgaW5mbGF0ZXI6IFsnei13b3JrZXIuanMnLCAnaW5mbGF0ZS5qcyddXG5cdFx0ICogfTtcblx0XHQgKi9cblx0XHR3b3JrZXJTY3JpcHRzIDogbnVsbCxcblx0fTtcblxufSkod2luZG93KTtcbiIsImltcG9ydCBjb25maWcgZnJvbSAnY29uZmlnJztcblxuZXhwb3J0IGRlZmF1bHQgQmFja2JvbmUuVmlldy5leHRlbmQoe1xuXG4gICB0ZW1wbGF0ZTogXy50ZW1wbGF0ZShcbiAgICAgIGA8bGFiZWwgY2xhc3M9XCJmbGV4aXRlbSBmbGV4aXRlbS1oYWxmXCI+XG4gICAgICAgICA8aW5wdXQgY2xhc3M9XCJpdGVtLWNoZWNrXCIgdHlwZT1cImNoZWNrYm94XCIgPCU9IHN0YXRlID4gMCA/ICdjaGVja2VkJyA6ICcnICU+IDwlPSAoc3RhdGUgPCAwIHx8IHN0YXRlID4gMSkgPyAnZGlzYWJsZWQnIDogJycgJT4+XG4gICAgICA8L2xhYmVsPlxuICAgICAgPGRpdiBjbGFzcz1cImZsZXhpdGVtIGZsZXhpdGVtLWRvdWJsZVwiPlxuICAgICAgICAgPHNwYW4+PCU9IG5hbWUgJT48L3NwYW4+XG4gICAgICA8L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJmbGV4aXRlbSBmbGV4aXRlbVwiPlxuICAgICAgICAgPHNlbGVjdCBjbGFzcz1cIml0ZW0tdHJhbnNmb3JtZXJcIj5gXG4gICAgICAgICAgICArIGNvbmZpZy50cmFuc2Zvcm1lcnMubWFwKHRmID0+IGA8b3B0aW9uIHZhbHVlPVwiJHt0Zi5uYW1lfVwiPiR7dGYubmFtZX08L29wdGlvbj5gKS5qb2luKCcnKSArXG4gICAgICAgICBgPC9zZWxlY3Q+XG4gICAgICA8L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJmbGV4aXRlbSBmbGV4aXRlbS1yaWdodFwiPlxuICAgICAgICAgPHNwYW4+PCU9IGZvcm1hdHRlZF9zaXplICU+PC9zcGFuPlxuICAgICAgPC9kaXY+XG4gICAgICA8ZGl2IGNsYXNzPVwiZmxleGl0ZW0gZmxleGl0ZW0taGFsZlwiPlxuICAgICAgICAgPGRpdiBjbGFzcz1cImJ0biBidG4tbGlua1wiPjxpIGNsYXNzPVwiaXRlbS1kb3dubG9hZCBmYSBmYS1kb3dubG9hZFwiPjwvaT48L2Rpdj5cbiAgICAgIDwvZGl2PmBcbiAgICksXG5cbiAgIHRhZ05hbWU6ICdkaXYnLFxuICAgY2xhc3NOYW1lOiAnZmxleHJvdycsXG5cbiAgIGV2ZW50czoge1xuICAgICAgLy8gJ2NoYW5nZSAuaXRlbS1uYW1lJzogJ2NoYW5nZUZpbGVuYW1lJyxcbiAgICAgICdjaGFuZ2UgLml0ZW0tdHJhbnNmb3JtZXInOiAnY2hhbmdlVHJhbnNmb3JtZXInLFxuICAgICAgJ2NoYW5nZSAuaXRlbS1jaGVjayc6ICd0b2dnbGVTdGF0ZScsXG4gICAgICAnY2xpY2sgLml0ZW0tZG93bmxvYWQnOiAnZG93bmxvYWQnXG4gICB9LFxuXG4gICBpbml0aWFsaXplKCkge1xuICAgICAgXy5iaW5kQWxsKHRoaXMsICdyZW5kZXInLCAnZG93bmxvYWQnLCAndG9nZ2xlU3RhdGUnKTtcbiAgICAgIHRoaXMubGlzdGVuVG8odGhpcy5tb2RlbCwgJ2NoYW5nZScsIHRoaXMucmVuZGVyKTtcbiAgICAgIC8vIHRoaXMubGlzdGVuVG8odGhpcy5tb2RlbCwgJ2Rlc3Ryb3knLCB0aGlzLnJlbW92ZSk7XG4gICB9LFxuXG4gICByZW5kZXIoKSB7XG4gICAgICB0aGlzLiRlbFxuICAgICAgICAgLmh0bWwodGhpcy50ZW1wbGF0ZSh0aGlzLm1vZGVsLnRvSlNPTigpKSlcbiAgICAgICAgIC5hdHRyKCdkYXRhLXN0YXRlJywgdGhpcy5tb2RlbC5nZXQoJ3N0YXRlJykpO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICB9LFxuXG4gICBkb3dubG9hZCgpIHtcbiAgICAgIHRoaXMubW9kZWwuZG93bmxvYWQoKTtcbiAgIH0sXG5cbiAgIC8vIGNoYW5nZUZpbGVuYW1lKGV2ZW50KSB7XG4gICAvLyAgICB0aGlzLm1vZGVsLnNldCgnbmFtZScsIGV2ZW50LnRhcmdldC52YWx1ZSk7XG4gICAvLyB9LFxuXG4gICBjaGFuZ2VUcmFuc2Zvcm1lcihldmVudCkge1xuICAgICAgY29uc29sZS53YXJuKCdjaGFuZ2VUcmFuc2Zvcm1lcicsICdGZWF0dXJlIG5vY2ggbmljaHQgaW1wbGVtZW50aWVydCcsIGV2ZW50LnRhcmdldC52YWx1ZSk7XG4gICAgICAvLyB0aGlzLm1vZGVsLnNldCgnbmFtZScsIGV2ZW50LnRhcmdldC52YWx1ZSk7XG4gICB9LFxuXG4gICB0b2dnbGVTdGF0ZShldmVudCkge1xuICAgICAgbGV0IGN1cnJlbnRTdGF0ZSA9IHRoaXMubW9kZWwuZ2V0KCdzdGF0ZScpO1xuICAgICAgaWYgKGN1cnJlbnRTdGF0ZSA8IDAgfHwgY3VycmVudFN0YXRlID4gMSkge1xuICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgICB0aGlzLm1vZGVsLnNldCgnc3RhdGUnLCArZXZlbnQudGFyZ2V0LmNoZWNrZWQpO1xuICAgICAgfVxuICAgfVxuXG59KTtcbiIsImltcG9ydCBGaWxlTWFuYWdlckl0ZW1WaWV3IGZyb20gJ3ZpZXdzL0ZpbGVNYW5hZ2VySXRlbVZpZXcnO1xuXG5leHBvcnQgZGVmYXVsdCBCYWNrYm9uZS5WaWV3LmV4dGVuZCh7XG5cbiAgIGNsYXNzTmFtZTogJ2ZsZXh0YWJsZSBmbGV4Y29sJyxcblxuICAgdGVtcGxhdGU6IF8udGVtcGxhdGUoXG4gICAgICBgPGRpdiBjbGFzcz1cImZsZXhoZWFkZXIgZmxleHJvd1wiPlxuICAgICAgICAgPGRpdiBjbGFzcz1cImZsZXhpdGVtIGZsZXhpdGVtLWhhbGZcIj5Vc2U8L2Rpdj5cbiAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4aXRlbSBmbGV4aXRlbS1kb3VibGVcIj5OYW1lPC9kaXY+XG4gICAgICAgICA8ZGl2IGNsYXNzPVwiZmxleGl0ZW0gZmxleGl0ZW1cIj5Gb3JtYXQ8L2Rpdj5cbiAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4aXRlbVwiPlNpemU8L2Rpdj5cbiAgICAgICAgIDxkaXYgY2xhc3M9XCJmbGV4aXRlbSBmbGV4aXRlbS1oYWxmXCI+PGkgY2xhc3M9XCJmYSBmYS13cmVuY2hcIj48L2k+PC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJmbGV4Ym9keVwiPjwvZGl2PlxuICAgYCksXG5cbiAgIHZpZXdzOiB7fSxcblxuICAgaW5pdGlhbGl6ZSgpIHtcbiAgICAgIF8uYmluZEFsbCh0aGlzLCAncmVuZGVyJywgJ3JlbmRlckl0ZW0nKTtcbiAgICAgIHRoaXMucmVuZGVyKCk7XG4gICAgICB0aGlzLmxpc3RlblRvKHRoaXMuY29sbGVjdGlvbiwgJ2FkZCcsIHRoaXMucmVuZGVySXRlbSk7XG4gICAgICAvLyB0aGlzLmxpc3RlblRvKHRoaXMuY29sbGVjdGlvbiwgJ2Rlc3Ryb3knLCB0aGlzLnJlbW92ZUl0ZW0pO1xuICAgfSxcblxuICAgcmVuZGVyKCkge1xuICAgICAgdGhpcy4kZWxcbiAgICAgICAgIC5odG1sKHRoaXMudGVtcGxhdGUoKSlcbiAgICAgICAgIC5hZGRDbGFzcyh0aGlzLmNsYXNzTmFtZSk7XG5cbiAgICAgIHRoaXMuJHRhYmxlQm9keSA9IHRoaXMuJCgnLmZsZXhib2R5Jyk7XG5cbiAgICAgIF8uZWFjaCh0aGlzLmNvbGxlY3Rpb24ubW9kZWxzLCB0aGlzLnJlbmRlckl0ZW0pO1xuICAgfSxcblxuICAgcmVuZGVySXRlbShtb2RlbCkge1xuICAgICAgbGV0IHZpZXcgPSBuZXcgRmlsZU1hbmFnZXJJdGVtVmlldyh7bW9kZWx9KTtcbiAgICAgIHRoaXMudmlld3NbbW9kZWwuaWRdID0gdmlldztcbiAgICAgIHRoaXMuJHRhYmxlQm9keS5hcHBlbmQodmlldy5yZW5kZXIoKS5lbCk7XG4gICAgICByZXR1cm4gdmlldztcbiAgIH1cblxufSk7XG4iLCJpbXBvcnQgRmlsZUNvbGxlY3Rpb24gZnJvbSAnbW9kZWxzL0ZpbGVDb2xsZWN0aW9uJztcbmltcG9ydCBQcm9ncmVzcyBmcm9tICd1dGlsL1Byb2dyZXNzJztcbmltcG9ydCAndXRpbC96aXAnOyAvLyBodHRwOi8vZ2lsZGFzLWxvcm1lYXUuZ2l0aHViLmlvL3ppcC5qcy9jb3JlLWFwaS5odG1sXG5pbXBvcnQgJ3V0aWwvemlwLWV4dCc7XG5cbndpbmRvdy56aXAud29ya2VyU2NyaXB0c1BhdGggPSAnYXNzZXRzL2pzL3ppcC8nO1xuXG5leHBvcnQgZGVmYXVsdCBCYWNrYm9uZS5WaWV3LmV4dGVuZCh7XG5cbiAgIGNvbGxlY3Rpb246IG5ldyBGaWxlQ29sbGVjdGlvbigpLFxuXG4gICBldmVudHM6IHtcbiAgICAgICdkcm9wJzogJ2hhbmRsZUZpbGVzJyxcbiAgICAgICdjaGFuZ2UgaW5wdXRbdHlwZT1cImZpbGVcIl0nOiAnaGFuZGxlRmlsZXMnLFxuICAgICAgJ2NsaWNrIC5kcm9wYXJlYSBidXR0b24nOiAnZGVsZWdhdGVDbGljaycsXG4gICAgICAnY2hhbmdlIC5wYW5lbC1ib2R5IGlucHV0JzogJ2NoYW5nZVBzZXVkb255bScsXG4gICAgICAnY2xpY2sgLmJ0bi1kb3dubG9hZCc6ICdkb3dubG9hZCdcbiAgIH0sXG5cbiAgIGluaXRpYWxpemUoKSB7XG4gICAgICBfLmJpbmRBbGwodGhpcywgJ2hhbmRsZUZpbGVzJywgJ2xvYWRJdGVtcycsICdyZWFkRmlsZScsICdidWZmZXJUb01vZGVsJywgJ2hhbmRsZVppcEZpbGUnKTtcbiAgICAgIHRoaXMuJGZpbGVJbnB1dCA9IHRoaXMuJCgnaW5wdXRbdHlwZT1cImZpbGVcIl0nKTtcblxuICAgICAgLy8gdGhpcy5tb2RlbC5vbignY2hhbmdlOnBzZXVkb255bScsIChtb2RlbCwgbmV3UHNldWRvbnltKSA9PiB7XG4gICAgICAvLyAgICB0aGlzLiQoJy5wYW5lbC1mb290ZXInKS50b2dnbGVDbGFzcygnaGlkZGVuJywgIW5ld1BzZXVkb255bS5sZW5ndGgpO1xuICAgICAgLy8gfSk7XG5cbiAgICAgIC8vIFByZXZlbnQgdGhlIGRlZmF1bHQgYWN0aW9uIHdoZW4gYSBmaWxlIGlzIGRyb3BwZWRcbiAgICAgIC8vIG9uIHRoZSB3aW5kb3cgaS5lLiByZWRpcmVjdGluZyB0byB0aGF0IGZpbGVcbiAgICAgICQoZG9jdW1lbnQpLm9uKCdkcm9wIGRyYWdvdmVyJywgZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICB9KTtcbiAgIH0sXG5cbiAgIGRlbGVnYXRlQ2xpY2soZXZlbnQpIHtcbiAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICB0aGlzLiRmaWxlSW5wdXQuY2xpY2soKS5ibHVyKCk7XG4gICB9LFxuXG4gICBoYW5kbGVGaWxlcygkZXZlbnQpIHtcbiAgICAgIGxldCBvZSA9ICRldmVudC5vcmlnaW5hbEV2ZW50O1xuICAgICAgbGV0IGl0ZW1zID0gb2UuZGF0YVRyYW5zZmVyLml0ZW1zIHx8IG9lLmRhdGFUcmFuc2Zlci5maWxlcztcbiAgICAgIHRoaXMubG9hZEl0ZW1zKGl0ZW1zKTtcbiAgIH0sXG5cbiAgIGxvYWRJdGVtcyhpdGVtcykge1xuICAgICAgbGV0IGVudHJ5ID0ge307XG4gICAgICBfLmVhY2goaXRlbXMsIGl0ZW0gPT4ge1xuICAgICAgICAgaWYgKGl0ZW0udHlwZSA9PT0gJ2FwcGxpY2F0aW9uL3ppcCcgJiYgXy5pc0Z1bmN0aW9uKGl0ZW0uZ2V0QXNGaWxlKSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuaGFuZGxlWmlwRmlsZShpdGVtLmdldEFzRmlsZSgpKTtcbiAgICAgICAgIH1cbiAgICAgICAgIGVsc2UgaWYgKGl0ZW0uaXNGaWxlIHx8IGl0ZW0uaXNEaXJlY3RvcnkpIHtcbiAgICAgICAgICAgIGVudHJ5ID0gaXRlbTtcbiAgICAgICAgIH1cbiAgICAgICAgIGVsc2UgaWYgKGl0ZW0uZ2V0QXNFbnRyeSkge1xuICAgICAgICAgICAgZW50cnkgPSBpdGVtLmdldEFzRW50cnkoKTtcbiAgICAgICAgIH1cbiAgICAgICAgIGVsc2UgaWYgKGl0ZW0ud2Via2l0R2V0QXNFbnRyeSkge1xuICAgICAgICAgICAgZW50cnkgPSBpdGVtLndlYmtpdEdldEFzRW50cnkoKTtcbiAgICAgICAgIH1cbiAgICAgICAgIGVsc2UgaWYgKF8uaXNGdW5jdGlvbihpdGVtLmdldEFzRmlsZSkpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnJlYWRGaWxlKGl0ZW0uZ2V0QXNGaWxlKCkpO1xuICAgICAgICAgfVxuICAgICAgICAgZWxzZSBpZiAoRmlsZSAmJiBpdGVtIGluc3RhbmNlb2YgRmlsZSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMucmVhZEZpbGUoaXRlbSk7XG4gICAgICAgICB9XG4gICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgfVxuXG4gICAgICAgICBpZiAoZW50cnkuaXNGaWxlKSB7XG4gICAgICAgICAgICBlbnRyeS5maWxlKFxuICAgICAgICAgICAgICAgZmlsZSA9PiB0aGlzLnJlYWRGaWxlKGZpbGUpLFxuICAgICAgICAgICAgICAgZXJyID0+IGNvbnNvbGUud2FybihlcnIpXG4gICAgICAgICAgICApO1xuICAgICAgICAgfVxuICAgICAgICAgZWxzZSBpZiAoZW50cnkuaXNEaXJlY3RvcnkpIHtcbiAgICAgICAgICAgIGVudHJ5LmNyZWF0ZVJlYWRlcigpLnJlYWRFbnRyaWVzKFxuICAgICAgICAgICAgICAgZW50cmllcyA9PiB0aGlzLmxvYWRJdGVtcyhlbnRyaWVzKSxcbiAgICAgICAgICAgICAgIGVyciA9PiBjb25zb2xlLndhcm4oZXJyKVxuICAgICAgICAgICAgKTtcbiAgICAgICAgIH1cbiAgICAgIH0pO1xuICAgfSxcblxuICAgLy8gRnJvbTogaHR0cDovL3d3dy5odG1sNXJvY2tzLmNvbS9lbi90dXRvcmlhbHMvZmlsZS9kbmRmaWxlcy9cbiAgIC8vIFRPRE86IEVycm9yIGhhbmRsaW5nIChzZWUgbGluayBhYm92ZSlcbiAgIHJlYWRGaWxlKGZpbGUpIHtcbiAgICAgIGxldCByZWFkZXIgPSBuZXcgRmlsZVJlYWRlcigpO1xuICAgICAgbGV0IHByb2dyZXNzID0gbmV3IFByb2dyZXNzKCk7XG4gICAgICB0aGlzLiRlbC5hcHBlbmQocHJvZ3Jlc3MuZWwpO1xuXG4gICAgICByZWFkZXIub25wcm9ncmVzcyA9IChldmVudCkgPT4ge1xuICAgICAgICAgaWYgKCFldmVudC5sZW5ndGhDb21wdXRhYmxlKSB7IHJldHVybjsgfSAvLyBpZiBldmVudCBpcyBub3QgYSBQcm9ncmVzc0V2ZW50XG4gICAgICAgICBwcm9ncmVzcy51cGRhdGUoZXZlbnQubG9hZGVkIC8gZXZlbnQudG90YWwgKiAxMDApO1xuICAgICAgfTtcblxuICAgICAgcmVhZGVyLm9ubG9hZCA9ICgvKmV2ZW50Ki8pID0+IHtcbiAgICAgICAgIHRoaXMuYnVmZmVyVG9Nb2RlbChyZWFkZXIucmVzdWx0LCBmaWxlKTtcbiAgICAgICAgIHByb2dyZXNzLnJlbW92ZSgpO1xuICAgICAgfTtcblxuICAgICAgcmVhZGVyLm9uZXJyb3IgPSAoKSA9PiBjb25zb2xlLmxvZygncmVhZGVyIC0gb25lcnJvcicpO1xuICAgICAgcmVhZGVyLm9uYWJvcnQgPSAoKSA9PiBjb25zb2xlLmxvZygncmVhZGVyIC0gb25hYm9ydCcpO1xuICAgICAgcmVhZGVyLm9ubG9hZHN0YXJ0ID0gKCkgPT4gY29uc29sZS5sb2coJ3JlYWRlciAtIG9ubG9hZHN0YXJ0Jyk7XG5cbiAgICAgIHJlYWRlci5yZWFkQXNBcnJheUJ1ZmZlcihmaWxlKTtcbiAgIH0sXG5cbiAgIGJ1ZmZlclRvTW9kZWwoYnVmZmVyLCBtZXRhRGF0YSkge1xuICAgICAgbGV0IG1vZGVsID0gdGhpcy5jb2xsZWN0aW9uLmNyZWF0ZSh7XG4gICAgICAgICB1cGRhdGVkX2F0OiBtZXRhRGF0YS5sYXN0TW9kaWZpZWQsXG4gICAgICAgICBuYW1lOiBtZXRhRGF0YS5uYW1lLFxuICAgICAgICAgc2l6ZTogbWV0YURhdGEuc2l6ZSxcbiAgICAgICAgIHR5cGU6IG1ldGFEYXRhLnR5cGUsXG4gICAgICAgICBjb250ZW50OiBuZXcgSW50OEFycmF5KGJ1ZmZlcilcbiAgICAgIH0pO1xuICAgICAgbW9kZWwuc2V0UGF0aWVudE5hbWUoKTtcbiAgICAgIGFwcC52ZW50LnRyaWdnZXIoJ0ZpbGU6bG9hZGVkJywgbW9kZWwpO1xuICAgfSxcblxuICAgaGFuZGxlWmlwRmlsZShmaWxlKSB7XG4gICAgICBsZXQgemlwQnVmZmVyID0gbmV3IHdpbmRvdy56aXAuQXJyYXlCdWZmZXJXcml0ZXIoKTtcbiAgICAgIGxldCBibG9iUmVhZGVyID0gbmV3IHdpbmRvdy56aXAuQmxvYlJlYWRlcihmaWxlKTtcbiAgICAgIHdpbmRvdy56aXAuY3JlYXRlUmVhZGVyKGJsb2JSZWFkZXIsXG4gICAgICAgICAvLyBzdWNjZXNzXG4gICAgICAgICAoemlwUmVhZGVyKSA9PiB6aXBSZWFkZXIuZ2V0RW50cmllcyhcbiAgICAgICAgICAgIChlbnRyaWVzID0gW10pID0+IGVudHJpZXMuZm9yRWFjaChcbiAgICAgICAgICAgICAgIChlbnRyeSkgPT4ge1xuICAgICAgICAgICAgICAgICAgaWYgKGVudHJ5LmRpcmVjdG9yeSkgeyByZXR1cm47IH1cbiAgICAgICAgICAgICAgICAgIGVudHJ5LmdldERhdGEoemlwQnVmZmVyLFxuICAgICAgICAgICAgICAgICAgICAgKGJ1ZmZlcikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IG1ldGFEYXRhID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgbGFzdE1vZGlmaWVkOiBlbnRyeS5sYXN0TW9kRGF0ZVJhdyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IGVudHJ5LmZpbGVuYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgc2l6ZTogZW50cnkudW5jb21wcmVzc2VkU2l6ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICd1bmtub3duJ1xuICAgICAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYnVmZmVyVG9Nb2RlbChidWZmZXIsIG1ldGFEYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICB9XG4gICAgICAgICAgICApXG4gICAgICAgICApLFxuICAgICAgICAgLy8gZXJyb3JcbiAgICAgICAgIChtZXNzYWdlKSA9PiBjb25zb2xlLmVycm9yKCdFcnJvciByZWFkaW5nIHppcDonLCBtZXNzYWdlKVxuICAgICAgKTtcbiAgIH1cblxufSk7XG4iLCJleHBvcnQgZGVmYXVsdCBCYWNrYm9uZS5WaWV3LmV4dGVuZCh7XG5cbiAgIGV2ZW50czoge1xuICAgICAgJ2NoYW5nZSBpbnB1dFtuYW1lPVwicHNldWRvbnltXCJdJzogJ2NoYW5nZVBzZXVkb255bScsXG4gICAgICAnY2xpY2sgLmJ0bi1wc2V1ZG8taGlzdG9yeSc6ICdyZW5kZXJUYWJsZSdcbiAgIH0sXG5cbiAgIG1haW5Sb3c6ICQoJy5tYWluLXJvdycpLFxuXG4gICBpbml0aWFsaXplKG9wdGlvbnMgPSB7fSkge1xuICAgICAgXy5iaW5kQWxsKHRoaXMsICdyZW5kZXJUYWJsZScsICdzZXRJbml0aWFsUGF0aWVudE5hbWUnLCAnY2hhbmdlUHNldWRvbnltJywgJ2Nsb3NlJywgJ3ByaW50Jyk7XG5cbiAgICAgIHRoaXMuJHBzZXVkb255bSA9IHRoaXMuJCgnaW5wdXRbbmFtZT1cInBzZXVkb255bVwiXScpO1xuICAgICAgdGhpcy51c2VkUHNldWRvbnltcyA9IEpTT04ucGFyc2UobG9jYWxTdG9yYWdlLmdldEl0ZW0oJ3BzZXVkb255bXMnKSkgfHwge307XG5cbiAgICAgIC8vIFp1IGRpZXNlbSBiZXN0aW1tdGVuIFplaXRwdW5rdCBpc3QgbnVyIGVpbiBNb2RlbCB2b3JoYW5kZW4sIGRhcnVtIGt1cnogd2FydGVuXG4gICAgICBfLmRlZmVyKCgpID0+IHtcbiAgICAgICAgIHRoaXMuc2V0SW5pdGlhbFBhdGllbnROYW1lKCk7XG4gICAgICAgICB0aGlzLnNldEluaXRpYWxQc2V1ZG9ueW0oKTtcbiAgICAgICAgIHRoaXMuY2hhbmdlUHNldWRvbnltKCk7XG4gICAgICAgICB0aGlzLmNvbGxlY3Rpb24ub24oJ2FkZCcsIG1vZGVsID0+IG1vZGVsLnNldCgncHNldWRvbnltJywgdGhpcy5wc2V1ZG9ueW0pKTtcbiAgICAgIH0pO1xuXG4gICAgICB0aGlzLnRhYmxlQ29udGFpbmVyID0gb3B0aW9ucy50YWJsZUNvbnRhaW5lcjtcbiAgICAgIHRoaXMudGFibGVDb250YWluZXIuZmluZCgnLmJ0bi1jbG9zZScpLm9uKCdjbGljaycsIHRoaXMuY2xvc2UpO1xuICAgICAgdGhpcy50YWJsZUNvbnRhaW5lci5maW5kKCcuYnRuLXByaW50Jykub24oJ2NsaWNrJywgdGhpcy5wcmludCk7XG4gICB9LFxuXG4gICByZW5kZXJUYWJsZSgpIHtcbiAgICAgIGxldCBodG1sID0gXy5wYWlycyh0aGlzLnVzZWRQc2V1ZG9ueW1zKVxuICAgICAgICAgICAgICAgICAgLm1hcCgoW25hbWUsIHBzZXVkb10pID0+IGA8dHI+PHRkPiR7bmFtZX08L3RkPjx0ZD4ke3BzZXVkb308L3RyPmApXG4gICAgICAgICAgICAgICAgICAuam9pbignJyk7XG4gICAgICB0aGlzLm1haW5Sb3cuYWRkQ2xhc3MoJ2hpZGRlbicpO1xuICAgICAgdGhpcy50YWJsZUNvbnRhaW5lci5yZW1vdmVDbGFzcygnaGlkZGVuJylcbiAgICAgICAgIC5maW5kKCcucHNldWRvbnltLXRhYmxlJykuaHRtbChodG1sKTtcbiAgIH0sXG5cbiAgIHNldEluaXRpYWxQYXRpZW50TmFtZSgpIHtcbiAgICAgIGxldCBuYW1lcyA9IHRoaXMuY29sbGVjdGlvbi5wbHVjaygncGF0aWVudE5hbWUnKTtcbiAgICAgIGxldCByYW5rZWROYW1lcyA9IF8uY2hhaW4obmFtZXMpLmNvdW50QnkoKS5wYWlycygpLnZhbHVlKCk7XG5cbiAgICAgIGlmIChyYW5rZWROYW1lcy5sZW5ndGggPiAxKSB7XG4gICAgICAgICB3aW5kb3cuYWxlcnQoYEZvdW5kIGRpZmZlcmVudCBwYXRpZW50IG5hbWVzLiBUaGUgbW9zdCBjb21tb24gbmFtZSBcIiR7cmFua2VkTmFtZXNbMF1bMF19XCIgd2FzIHNlbGVjdGVkLmApOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLWFsZXJ0XG4gICAgICB9XG5cbiAgICAgIHRoaXMucGF0aWVudE5hbWUgPSByYW5rZWROYW1lc1swXVswXTtcbiAgIH0sXG5cbiAgIHNldEluaXRpYWxQc2V1ZG9ueW0oKSB7XG4gICAgICB0aGlzLnBzZXVkb255bSA9IHRoaXMudXNlZFBzZXVkb255bXNbdGhpcy5wYXRpZW50TmFtZV0gfHwgYnRvYShNYXRoLnJhbmRvbSgpKS5zdWJzdHIoMywgMTYpO1xuICAgICAgdGhpcy4kcHNldWRvbnltLnZhbCh0aGlzLnBzZXVkb255bSk7XG4gICB9LFxuXG4gICBjaGFuZ2VQc2V1ZG9ueW0oKSB7XG4gICAgICB2YXIgbmV3UHNldWRvbnltID0gdGhpcy4kcHNldWRvbnltLnZhbCgpO1xuICAgICAgdGhpcy5jb2xsZWN0aW9uLm1vZGVscy5mb3JFYWNoKG1vZGVsID0+IG1vZGVsLnNldCgncHNldWRvbnltJywgbmV3UHNldWRvbnltKSk7XG4gICAgICB0aGlzLnVzZWRQc2V1ZG9ueW1zW3RoaXMucGF0aWVudE5hbWVdID0gbmV3UHNldWRvbnltO1xuICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ3BzZXVkb255bXMnLCBKU09OLnN0cmluZ2lmeSh0aGlzLnVzZWRQc2V1ZG9ueW1zKSk7XG4gICB9LFxuXG4gICBjbG9zZSgpIHtcbiAgICAgIHRoaXMubWFpblJvdy5yZW1vdmVDbGFzcygnaGlkZGVuJyk7XG4gICAgICB0aGlzLnRhYmxlQ29udGFpbmVyLmFkZENsYXNzKCdoaWRkZW4nKTtcbiAgIH0sXG5cbiAgIHByaW50KCkge1xuICAgICAgd2luZG93LnByaW50KCk7XG4gICB9XG5cbn0pO1xuIiwiaW1wb3J0IGNvbmZpZyBmcm9tICdjb25maWcnO1xuaW1wb3J0IHhuYXRBUEkgZnJvbSAnWG5hdEFQSSc7XG5pbXBvcnQgUHJvZ3Jlc3MgZnJvbSAndXRpbC9Qcm9ncmVzcyc7XG5pbXBvcnQgZ2V0UXVlcnlWYXJpYWJsZSBmcm9tICd1dGlsL2dldFF1ZXJ5VmFyaWFibGUnO1xuXG5leHBvcnQgZGVmYXVsdCBCYWNrYm9uZS5WaWV3LmV4dGVuZCh7XG5cbiAgIHRlbXBsYXRlX3Byb2plY3RzOiBfLnRlbXBsYXRlKCc8JSBfLmVhY2gobW9kZWxzLCBmdW5jdGlvbihtKSB7ICU+IDxvcHRpb24gdmFsdWU9XCI8JT0gbS5pZCAlPlwiPjwlPSBtLm5hbWUgJT48L29wdGlvbj4gPCUgfSk7ICU+JyksXG4gICB0ZW1wbGF0ZV91c2VyczogXy50ZW1wbGF0ZSgnPCUgXy5lYWNoKHVzZXJzLCBmdW5jdGlvbih1c2VyLCBrZXkpIHsgJT4gPG9wdGlvbiB2YWx1ZT1cIjwlPSBrZXkgJT5cIj48JT0ga2V5ICU+PC9vcHRpb24+IDwlIH0pOyAlPicpLFxuXG4gICBldmVudHM6IHtcbiAgICAgICdjaGFuZ2Ugc2VsZWN0W25hbWU9XCJ1c2VyXCJdJzogJ2NoYW5nZVVzZXInLFxuICAgICAgJ2NsaWNrIC5idG4tc2hvdy1zZXR0aW5ncyc6ICdzaG93U2V0dGluZ3MnLFxuICAgICAgJ2NsaWNrIC5idG4tbG9naW4nOiAnbG9naW4nLFxuICAgICAgJ2NsaWNrIC5idG4tY2hlY2snOiAnY2hlY2snLFxuICAgICAgJ2NsaWNrIC5idG4tdXBsb2FkJzogJ2luaXRVcGxvYWQnXG4gICB9LFxuXG4gICBpbml0aWFsaXplKCkge1xuICAgICAgXy5iaW5kQWxsKHRoaXMsICdzZXRDdXJyZW50TW9kZWwnLCAnbG9naW4nLCAnY2hlY2snLCAnaW5pdFVwbG9hZCcsICdjcmVhdGVTdWJqZWN0JywgJ2NyZWF0ZVNlc3Npb24nLCAnY3JlYXRlU2NhbicsICd1cGxvYWQnLCAnc3RhcnRQaXBlbGluZScpO1xuICAgICAgdGhpcy54bmF0ID0geG5hdEFQSShjb25maWcuWE5BVF9VUkwpO1xuXG4gICAgICB0aGlzLiRidG5fY3JlYXRlX3Nlc3Npb24gPSB0aGlzLiQoJy5idG4tY3JlYXRlLXNlc3Npb24nKTtcbiAgICAgIHRoaXMuJGJ0bl9jcmVhdGVfc2NhbiA9IHRoaXMuJCgnLmJ0bi1jcmVhdGUtc2NhbicpO1xuICAgICAgdGhpcy4kYnRuX2xvZ2luID0gdGhpcy4kKCcuYnRuLWxvZ2luJyk7XG4gICAgICB0aGlzLiRidG5fdXBsb2FkID0gdGhpcy4kKCcuYnRuLXVwbG9hZCcpO1xuICAgICAgdGhpcy4kYnRuX2NoZWNrID0gdGhpcy4kKCcuYnRuLWNoZWNrJyk7XG4gICAgICB0aGlzLiRwYW5lbF9mb290ZXIgPSB0aGlzLiQoJy5wYW5lbC1mb290ZXInKTtcbiAgICAgIHRoaXMuJHNlbGVjdF9wcm9qZWN0ID0gdGhpcy4kKCcudXBsb2FkZXItcHJvamVjdHMgc2VsZWN0Jyk7XG4gICAgICB0aGlzLiRzZWxlY3RfdXNlciA9IHRoaXMuJCgnc2VsZWN0W25hbWU9XCJ1c2VyXCJdJyk7XG5cbiAgICAgIHRoaXMuY29sbGVjdGlvbi5vbignYWRkJywgdGhpcy5sb2dpbik7XG5cbiAgICAgIHRoaXMuc2V0Q3VycmVudE1vZGVsKCk7XG5cbiAgICAgIHRoaXMuJHNlbGVjdF91c2VyLmFwcGVuZCh0aGlzLnRlbXBsYXRlX3VzZXJzKHsgdXNlcnM6IGNvbmZpZy51c2VycyB9KSk7XG5cbiAgICAgIGxldCB1c2VyID0gZ2V0UXVlcnlWYXJpYWJsZSgndXNlcicpO1xuICAgICAgaWYgKCF1c2VyIHx8ICFjb25maWcudXNlcnNbdXNlcl0pIHVzZXIgPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgndXNlcicpOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIGN1cmx5XG4gICAgICBpZiAoIXVzZXIgfHwgIWNvbmZpZy51c2Vyc1t1c2VyXSkgdXNlciA9IGNvbmZpZy5kZWZhdWx0VXNlcjsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBjdXJseVxuXG4gICAgICB0aGlzLiRzZWxlY3RfdXNlci52YWwodXNlcik7XG4gICAgICB0aGlzLmNoYW5nZVVzZXIodXNlcik7XG4gICB9LFxuXG4gICBzZXRDdXJyZW50TW9kZWwoKSB7XG4gICAgICBpZiAodGhpcy5jdXJyZW50TW9kZWwpIHtcbiAgICAgICAgIHRoaXMuY3VycmVudE1vZGVsLnNldCh7XG4gICAgICAgICAgICBjb250ZW50OiBudWxsLFxuICAgICAgICAgICAgc3RhdGU6IC0xIC8vIGRvbmVcbiAgICAgICAgIH0pO1xuICAgICAgICAgdmFyIHByb2plY3RpZCA9IHRoaXMuY3VycmVudE1vZGVsLmdldCgncHJvamVjdGlkJyk7XG4gICAgICAgICB2YXIgc3ViamVjdGlkID0gdGhpcy5jdXJyZW50TW9kZWwuZ2V0KCdzdWJqZWN0aWQnKTtcbiAgICAgICAgIHZhciBzZXNzaW9uaWQgPSB0aGlzLmN1cnJlbnRNb2RlbC5nZXQoJ3Nlc3Npb25pZCcpO1xuICAgICAgfVxuXG4gICAgICBsZXQgb25Qc2V1ZG9ueW1DaGFuZ2UgPSAobW9kZWwsIG5ld1ZhbHVlKSA9PiB7XG4gICAgICAgICBsZXQgdGltZXN0YW1wZWQgPSBuZXdWYWx1ZSArICdfJyArIERhdGUubm93KCk7XG4gICAgICAgICB0aGlzLiQoJy51cGxvYWRlci1zZXNzaW9uLXNjYW4gaW5wdXRbbmFtZT1cImZpbGVcIl0nKS52YWwodGltZXN0YW1wZWQpO1xuICAgICAgICAgdGhpcy4kKCcudXBsb2FkZXItc2Vzc2lvbi1zY2FuIGlucHV0W25hbWU9XCJzZXNzaW9uXCJdJykudmFsKG5ld1ZhbHVlKTtcbiAgICAgICAgIHRoaXMuJCgnLnVwbG9hZGVyLXNlc3Npb24tc2NhbiBpbnB1dFtuYW1lPVwic2NhblwiXScpLnZhbCh0aW1lc3RhbXBlZCk7XG4gICAgICB9O1xuXG4gICAgICBsZXQgbmV3Q3VycmVudE1vZGVsID0gdGhpcy5jb2xsZWN0aW9uLmZpbHRlcihtb2RlbCA9PiBtb2RlbC5nZXQoJ3N0YXRlJykgPT09IDEpWzBdO1xuICAgICAgaWYgKCFuZXdDdXJyZW50TW9kZWwpIHsgcmV0dXJuIGZhbHNlOyB9XG4gICAgICBuZXdDdXJyZW50TW9kZWwuc2V0KHtcbiAgICAgICAgIHN0YXRlOiAyLCAvLyBjdXJyZW50XG4gICAgICAgICBwcm9qZWN0aWQsXG4gICAgICAgICBzdWJqZWN0aWQsXG4gICAgICAgICBzZXNzaW9uaWRcbiAgICAgIH0pO1xuICAgICAgbmV3Q3VycmVudE1vZGVsLm9uKCdjaGFuZ2U6cHNldWRvbnltJywgb25Qc2V1ZG9ueW1DaGFuZ2UpO1xuICAgICAgb25Qc2V1ZG9ueW1DaGFuZ2UobmV3Q3VycmVudE1vZGVsLCBuZXdDdXJyZW50TW9kZWwuZ2V0KCdwc2V1ZG9ueW0nKSk7XG4gICAgICB0aGlzLmN1cnJlbnRNb2RlbCA9IG5ld0N1cnJlbnRNb2RlbDtcbiAgICAgIHJldHVybiB0cnVlO1xuXG4gICB9LFxuXG4gICBjaGFuZ2VVc2VyKCkge1xuICAgICAgbGV0IHVzZXJOYW1lID0gdGhpcy4kc2VsZWN0X3VzZXIudmFsKCk7XG4gICAgICBsZXQgdXNlckRhdGEgPSBjb25maWcudXNlcnNbdXNlck5hbWVdO1xuICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ3VzZXInLCB1c2VyTmFtZSk7XG4gICAgICB0aGlzLnNldENyZWRlbnRpYWxzKHVzZXJEYXRhKTtcbiAgICAgIHRoaXMuY3VycmVudE1vZGVsLnNldCgncHJvamVjdGlkJywgdXNlckRhdGEucHJvamVjdCk7XG4gICAgICB0aGlzLmxvZ2luKCk7XG4gICB9LFxuXG4gICBzZXRDcmVkZW50aWFscyh1c2VyKSB7XG4gICAgICB0aGlzLiQoJy51cGxvYWRlci1sb2dpbiBpbnB1dFtuYW1lPVwidXNlcm5hbWVcIl0nKS52YWwodXNlci51c2VybmFtZSk7XG4gICAgICB0aGlzLiQoJy51cGxvYWRlci1sb2dpbiBpbnB1dFtuYW1lPVwicGFzc3dvcmRcIl0nKS52YWwodXNlci5wYXNzd29yZCk7XG4gICB9LFxuXG4gICBzaG93U2V0dGluZ3MoKSB7XG4gICAgICB0aGlzLiQoJy51cGxvYWQtZGV0YWlscycpLnJlbW92ZUNsYXNzKCdoaWRkZW4nKTtcbiAgICAgIHRoaXMuJCgnLmJ0bi1zaG93LXNldHRpbmdzJykucGFyZW50KCkucmVtb3ZlKCk7XG4gICB9LFxuXG4gICBsb2dpbigpIHtcbiAgICAgIHRoaXMuJGJ0bl9sb2dpbi5odG1sKCc8aSBjbGFzcz1cImZhIGZhLXNwaW5uZXJcIj48L2k+Jyk7XG5cbiAgICAgIGxldCB1c2VybmFtZSA9IHRoaXMuJCgnLnVwbG9hZGVyLWxvZ2luIGlucHV0W25hbWU9XCJ1c2VybmFtZVwiXScpLnZhbCgpO1xuICAgICAgbGV0IHBhc3N3b3JkID0gdGhpcy4kKCcudXBsb2FkZXItbG9naW4gaW5wdXRbbmFtZT1cInBhc3N3b3JkXCJdJykudmFsKCk7XG5cbiAgICAgIGxldCBzdWNjZXNzQ2FsbGJhY2sgPSAoLypzZXNzaW9uaWQqLykgPT4ge1xuICAgICAgICAgdGhpcy4kYnRuX2xvZ2luLmh0bWwoJzxpIGNsYXNzPVwiZmEgZmEtY2hlY2tcIj48L2k+JykuYWRkQ2xhc3MoJ2J0bi1zdWNjZXNzJyk7XG4gICAgICAgICB0aGlzLnNob3dQcm9qZWN0cygpO1xuICAgICAgICAgdGhpcy4kYnRuX3VwbG9hZC5wcm9wKCdkaXNhYmxlZCcsIGZhbHNlKTtcbiAgICAgIH07XG5cbiAgICAgIGxldCBlcnJvckNhbGxiYWNrID0gKCkgPT4ge1xuICAgICAgICAgdGhpcy5zaG93U2V0dGluZ3MoKTsgLy8gc2hvdyBkZXRhaWxzXG4gICAgICAgICB0aGlzLiRidG5fbG9naW4uaHRtbCgnPGkgY2xhc3M9XCJmYSBmYS13YXJuaW5nXCI+PC9pPicpLmFkZENsYXNzKCdidG4tZGFuZ2VyJyk7XG4gICAgICAgICBfLmRlbGF5KCgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuJGJ0bl9sb2dpbi5odG1sKCdMb2dpbicpLnJlbW92ZUNsYXNzKCdidG4tZGFuZ2VyIGJ0bi1zdWNjZXNzJyk7XG4gICAgICAgICB9LCAyMDAwKTtcbiAgICAgICAgIHRoaXMuJHNlbGVjdF9wcm9qZWN0LmVtcHR5KCk7XG4gICAgICB9O1xuXG4gICAgICB0aGlzLnhuYXQubG9naW4odXNlcm5hbWUsIHBhc3N3b3JkLCBzdWNjZXNzQ2FsbGJhY2ssIGVycm9yQ2FsbGJhY2spO1xuICAgfSxcblxuICAgY2hlY2soKSB7XG4gICAgICBsZXQgcHJvamVjdGlkID0gJCgnLnVwbG9hZGVyLXByb2plY3RzIHNlbGVjdCcpLnZhbCgpO1xuICAgICAgbGV0IHByb2plY3QgPSB0aGlzLnhuYXQuZ2V0UHJvamVjdHMoKS5nZXQocHJvamVjdGlkKTtcblxuICAgICAgdGhpcy5jdXJyZW50TW9kZWwuc2V0KCdwcm9qZWN0aWQnLCBwcm9qZWN0LmdldCgnaWQnKSk7XG5cbiAgICAgIGxldCBkYXRhID0gdGhpcy5sYXN0X2NoZWNrZWRfZGF0YSA9IHtcbiAgICAgICAgIHByb2plY3Q6IHByb2plY3RpZCxcbiAgICAgICAgIHN1YmplY3Q6ICcnLFxuICAgICAgICAgc2Vzc2lvbjogJycsXG4gICAgICAgICBzY2FuOiAnJ1xuICAgICAgfTtcblxuICAgICAgbGV0IHF1ZXVlID0gW3tcbiAgICAgICAgIG5hbWU6ICdzdWJqZWN0JyxcbiAgICAgICAgIGNvbmRpdGlvbjoge1xuICAgICAgICAgICAgbGFiZWw6ICQoJ2lucHV0W25hbWU9XCJwc2V1ZG9ueW1cIl0nKS52YWwoKVxuICAgICAgICAgfVxuICAgICAgfSwge1xuICAgICAgICAgbmFtZTogJ3Nlc3Npb24nLFxuICAgICAgICAgY29uZGl0aW9uOiB7XG4gICAgICAgICAgICBsYWJlbDogdGhpcy4kKCcudXBsb2FkZXItc2Vzc2lvbi1zY2FuIGlucHV0W25hbWU9XCJzZXNzaW9uXCJdJykudmFsKClcbiAgICAgICAgIH1cbiAgICAgIH0sIHtcbiAgICAgICAgIG5hbWU6ICdzY2FuJyxcbiAgICAgICAgIGNvbmRpdGlvbjoge1xuICAgICAgICAgICAgaWQ6IHRoaXMuJCgnLnVwbG9hZGVyLXNlc3Npb24tc2NhbiBpbnB1dFtuYW1lPVwic2NhblwiXScpLnZhbCgpXG4gICAgICAgICB9XG4gICAgICB9XTtcblxuICAgICAgbGV0IGZpbmFsID0gKCkgPT4ge1xuICAgICAgICAgY29uc29sZS5sb2coJ2ZpbmFsJyk7XG4gICAgICAgICBsZXQgaHRtbCA9IF8ubWFwKGRhdGEsICh2YWx1ZSwga2V5KSA9PiB7XG4gICAgICAgICAgICBsZXQgbXNnID0gZGF0YVtrZXldID8gYGFscmVhZHkgZXhpc3RzICgke3ZhbHVlfSlgIDogJ2hhcyB0byBiZSBjcmVhdGVkJztcbiAgICAgICAgICAgIHJldHVybiBgPHAgY2xhc3M9XCJsZWFkXCI+PHN0cm9uZz4ke2tleX08L3N0cm9uZz4gJHttc2d9PC9wPmA7XG4gICAgICAgICB9KS5qb2luKCcnKTtcblxuICAgICAgICAgJCgnLnVwbG9hZGVyLWNoZWNrJylcbiAgICAgICAgICAgIC5maW5kKCcudXBsb2FkZXItY2hlY2stb3V0cHV0JylcbiAgICAgICAgICAgIC5yZW1vdmVDbGFzcygnaGlkZGVuJylcbiAgICAgICAgICAgIC5odG1sKGh0bWwpO1xuICAgICAgfTtcblxuICAgICAgbGV0IGZldGNoID0gKCkgPT4ge1xuICAgICAgICAgbGV0IGN1cnJlbnRTdGVwID0gcXVldWUuc2hpZnQoKTtcbiAgICAgICAgIGNvbnNvbGUubG9nKCdmZXRjaCcsIGN1cnJlbnRTdGVwKTtcbiAgICAgICAgIHRoaXMueG5hdC5mZXRjaChjdXJyZW50U3RlcC5uYW1lLCBkYXRhLCB7XG4gICAgICAgICAgICBzdWNjZXNzKGNvbGxlY3Rpb24pIHtcbiAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdzdWNjZXNzJywgY3VycmVudFN0ZXAubmFtZSk7XG4gICAgICAgICAgICAgICBsZXQgbW9kZWwgPSBjb2xsZWN0aW9uLmZpbmRXaGVyZShjdXJyZW50U3RlcC5jb25kaXRpb24pO1xuICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ21vZGVsJywgbW9kZWwpO1xuICAgICAgICAgICAgICAgaWYgKG1vZGVsKSB7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgY3VybHlcbiAgICAgICAgICAgICAgICAgIGRhdGFbY3VycmVudFN0ZXAubmFtZV0gPSBtb2RlbC5nZXQoJ2lkJyk7XG4gICAgICAgICAgICAgICAgICBpZiAocXVldWUubGVuZ3RoKSBmZXRjaChxdWV1ZSk7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgY3VybHlcbiAgICAgICAgICAgICAgICAgIGVsc2UgZmluYWwoKTtcbiAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgIGVsc2UgZmluYWwoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgIH0pO1xuICAgICAgfTtcblxuICAgICAgZmV0Y2goKTtcbiAgIH0sXG5cbiAgIGluaXRVcGxvYWQoKSB7XG4gICAgICB0aGlzLmN1cnJlbnRNb2RlbC5zZXQoJ2ludmVzdGlnYXRvcicsICQoJy51cGxvYWRlciBpbnB1dFtuYW1lPVwiaW52ZXN0aWdhdG9yXCJdJykudmFsKCkpO1xuICAgICAgdGhpcy5jdXJyZW50TW9kZWwuc2V0KCdkaWFnbm9zZScsICQoJy51cGxvYWRlciBpbnB1dFtuYW1lPVwiZGlhZ25vc2VcIl0nKS52YWwoKSk7XG5cbiAgICAgIGlmICh0aGlzLmN1cnJlbnRNb2RlbC5nZXQoJ3N0YXRlJykgPT09IC0xICYmICF0aGlzLnNldEN1cnJlbnRNb2RlbCgpKSB7XG4gICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cblxuICAgICAgdGhpcy5jcmVhdGVTdWJqZWN0KClcbiAgICAgICAgIC50aGVuKHRoaXMuY3JlYXRlU2Vzc2lvbilcbiAgICAgICAgIC50aGVuKHRoaXMuY3JlYXRlU2NhbilcbiAgICAgICAgIC50aGVuKHRoaXMudXBsb2FkKVxuICAgICAgICAgLnRoZW4odGhpcy5zdGFydFBpcGVsaW5lKVxuICAgICAgICAgLmNhdGNoKGVyciA9PiBjb25zb2xlLmVycm9yKGVycikpXG4gICAgICAgICAudGhlbih0aGlzLnNldEN1cnJlbnRNb2RlbClcbiAgICAgICAgIC50aGVuKGhhc01vZGVsID0+XG4gICAgICAgICAgICBoYXNNb2RlbCA/IHRoaXMuaW5pdFVwbG9hZCgpIDogY29uc29sZS5sb2coJ1VwbG9hZCBmaW5pc2hlZCcpKTtcbiAgIH0sXG5cbiAgIC8vIC0tLSBIRUxQRVIgLS0tXG5cbiAgIHNob3dQcm9qZWN0cygpIHtcbiAgICAgIGxldCBzdWNjZXNzID0gY29sbGVjdGlvbiA9PiB7XG4gICAgICAgICBjb25zb2xlLmxvZygnU1VDQ0VTUycpO1xuICAgICAgICAgdGhpcy4kc2VsZWN0X3Byb2plY3QuaHRtbCh0aGlzLnRlbXBsYXRlX3Byb2plY3RzKHtcbiAgICAgICAgICAgIG1vZGVsczogY29sbGVjdGlvbi50b0pTT04oKVxuICAgICAgICAgfSkpO1xuICAgICAgICAgdGhpcy4kKCcudXBsb2FkZXItcHJvamVjdHMsIC51cGxvYWRlci1zZXNzaW9uLXNjYW4nKS5yZW1vdmVDbGFzcygnaGlkZGVuJyk7XG4gICAgICAgICB0aGlzLiRzZWxlY3RfcHJvamVjdC52YWwodGhpcy5jdXJyZW50TW9kZWwuZ2V0KCdwcm9qZWN0aWQnKSk7IC8vIHNlbGVjdCBjdXJyZW50IHByb2plY3RcbiAgICAgICAgIHRoaXMuJHBhbmVsX2Zvb3Rlci5yZW1vdmVDbGFzcygnaGlkZGVuJyk7XG4gICAgICB9O1xuXG4gICAgICBsZXQgZXJyb3IgPSAoKSA9PiB0aGlzLiRzZWxlY3RfcHJvamVjdC5lbXB0eSgpO1xuXG4gICAgICB0aGlzLnhuYXQuZ2V0UHJvamVjdHMoeyBzdWNjZXNzLCBlcnJvciB9KTtcbiAgIH0sXG5cbiAgIC8vIFRPRE8gdW51c2VkIC0+IHJlbW92ZVxuICAgZ2V0U3ViamVjdHMoLypldmVudCovKSB7XG4gICAgICAvLyBjb25zb2xlLmxvZygnZ2V0U3ViamVjdHMgZm9yICcsIGV2ZW50LnRhcmdldC52YWx1ZSk7XG4gICAgICAvLyBsZXQgdGhhdCA9IHRoaXM7XG4gICAgICAvLyBsZXQgcHJvamVjdCA9IHRoaXMueG5hdC5nZXRQcm9qZWN0cygpLmdldChldmVudC50YXJnZXQudmFsdWUpO1xuXG4gICAgICAvLyB0aGlzLmN1cnJlbnRNb2RlbC5zZXQoJ3Byb2plY3RpZCcsIHByb2plY3QuZ2V0KCdpZCcpKTtcblxuICAgICAgLy8gbGV0IGNhbGxiYWNrID0gZnVuY3Rpb24oY29sbGVjdGlvbikge1xuICAgICAgLy8gICAgbGV0IHBzZXVkb255bSA9IHRoYXQubW9kZWwuZ2V0KCdwc2V1ZG9ueW0nKTtcbiAgICAgIC8vICAgIGxldCBzdWJqZWN0ID0gY29sbGVjdGlvbi5maW5kV2hlcmUoe1xuICAgICAgLy8gICAgICAgbGFiZWw6IHBzZXVkb255bVxuICAgICAgLy8gICAgfSk7XG4gICAgICAvLyAgICBpZiAoc3ViamVjdCkge1xuICAgICAgLy8gICAgICAgY29uc29sZS5sb2coJ25vIG5lZWQgdG8gY3JlYXRlIG5ldyBzdWJqZWN0JywgcHNldWRvbnltLCBzdWJqZWN0LmdldCgnaWQnKSk7XG4gICAgICAvLyAgICAgICB0aGF0Lm1vZGVsLnNldCgnc3ViamVjdGlkJywgc3ViamVjdC5nZXQoJ2lkJykpO1xuICAgICAgLy8gICAgfVxuICAgICAgLy8gICAgZWxzZSB7XG4gICAgICAvLyAgICAgICBjb25zb2xlLmxvZygnd2lsbCBjcmVhdGUgbmV3IHN1YmplY3QnLCBwc2V1ZG9ueW0pO1xuXG4gICAgICAvLyAgICAgICB0aGF0LnhuYXQuY3JlYXRlU3ViamVjdChwc2V1ZG9ueW0sIHRoYXQubW9kZWwsIGZ1bmN0aW9uKHN1YmplY3RpZCkge1xuICAgICAgLy8gICAgICAgICAgY29uc29sZS5sb2coJ3N1YmplY3QgY3JlYXRlZCcsIHBzZXVkb255bSwgc3ViamVjdGlkKTtcbiAgICAgIC8vICAgICAgICAgIHRoYXQubW9kZWwuc2V0KCdzdWJqZWN0aWQnLCBzdWJqZWN0aWQpO1xuICAgICAgLy8gICAgICAgfSk7XG4gICAgICAvLyAgICB9XG4gICAgICAvLyB9O1xuXG4gICAgICAvLyBwcm9qZWN0LmdldENoaWxkcmVuKCdzdWJqZWN0cycsIHtcbiAgICAgIC8vICAgIHN1Y2Nlc3M6IGNhbGxiYWNrXG4gICAgICAvLyB9KTtcbiAgIH0sXG5cbiAgIGNyZWF0ZVN1YmplY3QoKSB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UocmVzb2x2ZSA9PiB7XG4gICAgICAgICBpZiAodGhpcy5jdXJyZW50TW9kZWwuaGFzKCdzdWJqZWN0aWQnKSkge1xuICAgICAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxldCBzdWJqZWN0X25hbWUgPSAkKCdpbnB1dFtuYW1lPVwicHNldWRvbnltXCJdJykudmFsKCk7XG4gICAgICAgICAgICB0aGlzLnhuYXQuY3JlYXRlU3ViamVjdChzdWJqZWN0X25hbWUsIHRoaXMuY3VycmVudE1vZGVsLCAoc3ViamVjdGlkKSA9PiB7XG4gICAgICAgICAgICAgICB0aGlzLmN1cnJlbnRNb2RlbC5zZXQoJ3N1YmplY3RpZCcsIHN1YmplY3RpZCk7XG4gICAgICAgICAgICAgICByZXNvbHZlKCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgIH1cbiAgICAgIH0pO1xuICAgfSxcblxuICAgY3JlYXRlU2Vzc2lvbigpIHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcbiAgICAgICAgIGlmICh0aGlzLmN1cnJlbnRNb2RlbC5oYXMoJ3Nlc3Npb25pZCcpKSB7XG4gICAgICAgICAgICByZXNvbHZlKCk7XG4gICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbGV0IHNlc3Npb25fbmFtZSA9IHRoaXMuJCgnLnVwbG9hZGVyLXNlc3Npb24tc2NhbiBpbnB1dFtuYW1lPVwic2Vzc2lvblwiXScpLnZhbCgpO1xuICAgICAgICAgICAgdGhpcy54bmF0LmNyZWF0ZVNlc3Npb24oc2Vzc2lvbl9uYW1lLCB0aGlzLmN1cnJlbnRNb2RlbCwgKHNlc3Npb25pZCkgPT4ge1xuICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50TW9kZWwuc2V0KCdzZXNzaW9uaWQnLCBzZXNzaW9uaWQpO1xuICAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICB9XG4gICAgICB9KTtcbiAgIH0sXG5cbiAgIGNyZWF0ZVNjYW4oKSB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UocmVzb2x2ZSA9PiB7XG4gICAgICAgICBpZiAodGhpcy5jdXJyZW50TW9kZWwuaGFzKCdzY2FuaWQnKSkge1xuICAgICAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxldCBzY2FuX25hbWUgPSB0aGlzLiQoJy51cGxvYWRlci1zZXNzaW9uLXNjYW4gaW5wdXRbbmFtZT1cInNjYW5cIl0nKS52YWwoKTtcblxuICAgICAgICAgICAgdGhpcy54bmF0LmNyZWF0ZVNjYW4oc2Nhbl9uYW1lLCB0aGlzLmN1cnJlbnRNb2RlbCwgKCkgPT4ge1xuICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50TW9kZWwuc2V0KCdzY2FuaWQnLCBzY2FuX25hbWUpO1xuXG4gICAgICAgICAgICAgICB0aGlzLnhuYXQuY3JlYXRlUmVzb3VyY2UoJ0VERicsIHRoaXMuY3VycmVudE1vZGVsLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnRNb2RlbC5zZXQoJ3Jlc291cmNlaWQnLCAnRURGJyk7XG4gICAgICAgICAgICAgICAgICByZXNvbHZlKCk7XG4gICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgfVxuICAgICAgfSk7XG4gICB9LFxuXG4gICB1cGxvYWQoKSB7XG4gICAgICBjb25zb2xlLmxvZygndXBsb2FkJywgdGhpcy5jdXJyZW50TW9kZWwuZ2V0KCdjb250ZW50JykuYnl0ZUxlbmd0aCk7XG5cbiAgICAgIGxldCBmaWxlbmFtZSA9IHRoaXMuJCgnLnVwbG9hZGVyLXNlc3Npb24tc2NhbiBpbnB1dFtuYW1lPVwiZmlsZVwiXScpLnZhbCgpO1xuICAgICAgaWYgKGZpbGVuYW1lKSB7IHRoaXMuY3VycmVudE1vZGVsLnNldCgnbmFtZScsIGZpbGVuYW1lKTsgfVxuXG4gICAgICBsZXQgcHJvZ3Jlc3MgPSBuZXcgUHJvZ3Jlc3MoKTtcbiAgICAgICQoJy51cGxvYWRlci1jaGVjaycpLmFkZENsYXNzKCdoaWRkZW4nKTtcbiAgICAgIHRoaXMuJHBhbmVsX2Zvb3Rlci5hcHBlbmQocHJvZ3Jlc3MuZWwpO1xuICAgICAgdGhpcy4kYnRuX2NoZWNrLmh0bWwoJzxpIGNsYXNzPVwiZmEgZmEtc3Bpbm5lclwiPjwvaT4nKTtcblxuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuICAgICAgICAgdGhpcy54bmF0LnVwbG9hZCh0aGlzLmN1cnJlbnRNb2RlbCwgcHJvZ3Jlc3MsICgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuJGJ0bl9jaGVjay5odG1sKCc8aSBjbGFzcz1cImZhIGZhLWNoZWNrXCI+PC9pPicpO1xuICAgICAgICAgICAgdGhpcy4kYnRuX3VwbG9hZC5wcm9wKCdkaXNhYmxlZCcsIHRydWUpO1xuICAgICAgICAgICAgcHJvZ3Jlc3MucmVtb3ZlKCk7XG4gICAgICAgICAgICByZXNvbHZlKCk7XG4gICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgfSxcblxuICAgc3RhcnRQaXBlbGluZSgpIHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcbiAgICAgICAgIHRoaXMueG5hdC5zdGFydFBpcGVsaW5lKHRoaXMuY3VycmVudE1vZGVsLCByZXNvbHZlKTtcbiAgICAgIH0pO1xuICAgfVxuXG59KTtcbiIsIi8qIVxuICogVGhlIGJ1ZmZlciBtb2R1bGUgZnJvbSBub2RlLmpzLCBmb3IgdGhlIGJyb3dzZXIuXG4gKlxuICogQGF1dGhvciAgIEZlcm9zcyBBYm91a2hhZGlqZWggPGZlcm9zc0BmZXJvc3Mub3JnPiA8aHR0cDovL2Zlcm9zcy5vcmc+XG4gKiBAbGljZW5zZSAgTUlUXG4gKi9cblxudmFyIGJhc2U2NCA9IHJlcXVpcmUoJ2Jhc2U2NC1qcycpXG52YXIgaWVlZTc1NCA9IHJlcXVpcmUoJ2llZWU3NTQnKVxudmFyIGlzQXJyYXkgPSByZXF1aXJlKCdpcy1hcnJheScpXG5cbmV4cG9ydHMuQnVmZmVyID0gQnVmZmVyXG5leHBvcnRzLlNsb3dCdWZmZXIgPSBTbG93QnVmZmVyXG5leHBvcnRzLklOU1BFQ1RfTUFYX0JZVEVTID0gNTBcbkJ1ZmZlci5wb29sU2l6ZSA9IDgxOTIgLy8gbm90IHVzZWQgYnkgdGhpcyBpbXBsZW1lbnRhdGlvblxuXG52YXIgcm9vdFBhcmVudCA9IHt9XG5cbi8qKlxuICogSWYgYEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUYDpcbiAqICAgPT09IHRydWUgICAgVXNlIFVpbnQ4QXJyYXkgaW1wbGVtZW50YXRpb24gKGZhc3Rlc3QpXG4gKiAgID09PSBmYWxzZSAgIFVzZSBPYmplY3QgaW1wbGVtZW50YXRpb24gKG1vc3QgY29tcGF0aWJsZSwgZXZlbiBJRTYpXG4gKlxuICogQnJvd3NlcnMgdGhhdCBzdXBwb3J0IHR5cGVkIGFycmF5cyBhcmUgSUUgMTArLCBGaXJlZm94IDQrLCBDaHJvbWUgNyssIFNhZmFyaSA1LjErLFxuICogT3BlcmEgMTEuNissIGlPUyA0LjIrLlxuICpcbiAqIE5vdGU6XG4gKlxuICogLSBJbXBsZW1lbnRhdGlvbiBtdXN0IHN1cHBvcnQgYWRkaW5nIG5ldyBwcm9wZXJ0aWVzIHRvIGBVaW50OEFycmF5YCBpbnN0YW5jZXMuXG4gKiAgIEZpcmVmb3ggNC0yOSBsYWNrZWQgc3VwcG9ydCwgZml4ZWQgaW4gRmlyZWZveCAzMCsuXG4gKiAgIFNlZTogaHR0cHM6Ly9idWd6aWxsYS5tb3ppbGxhLm9yZy9zaG93X2J1Zy5jZ2k/aWQ9Njk1NDM4LlxuICpcbiAqICAtIENocm9tZSA5LTEwIGlzIG1pc3NpbmcgdGhlIGBUeXBlZEFycmF5LnByb3RvdHlwZS5zdWJhcnJheWAgZnVuY3Rpb24uXG4gKlxuICogIC0gSUUxMCBoYXMgYSBicm9rZW4gYFR5cGVkQXJyYXkucHJvdG90eXBlLnN1YmFycmF5YCBmdW5jdGlvbiB3aGljaCByZXR1cm5zIGFycmF5cyBvZlxuICogICAgaW5jb3JyZWN0IGxlbmd0aCBpbiBzb21lIHNpdHVhdGlvbnMuXG4gKlxuICogV2UgZGV0ZWN0IHRoZXNlIGJ1Z2d5IGJyb3dzZXJzIGFuZCBzZXQgYEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUYCB0byBgZmFsc2VgIHNvIHRoZXkgd2lsbFxuICogZ2V0IHRoZSBPYmplY3QgaW1wbGVtZW50YXRpb24sIHdoaWNoIGlzIHNsb3dlciBidXQgd2lsbCB3b3JrIGNvcnJlY3RseS5cbiAqL1xuQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQgPSAoZnVuY3Rpb24gKCkge1xuICBmdW5jdGlvbiBGb28gKCkge31cbiAgdHJ5IHtcbiAgICB2YXIgYnVmID0gbmV3IEFycmF5QnVmZmVyKDApXG4gICAgdmFyIGFyciA9IG5ldyBVaW50OEFycmF5KGJ1ZilcbiAgICBhcnIuZm9vID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gNDIgfVxuICAgIGFyci5jb25zdHJ1Y3RvciA9IEZvb1xuICAgIHJldHVybiBhcnIuZm9vKCkgPT09IDQyICYmIC8vIHR5cGVkIGFycmF5IGluc3RhbmNlcyBjYW4gYmUgYXVnbWVudGVkXG4gICAgICAgIGFyci5jb25zdHJ1Y3RvciA9PT0gRm9vICYmIC8vIGNvbnN0cnVjdG9yIGNhbiBiZSBzZXRcbiAgICAgICAgdHlwZW9mIGFyci5zdWJhcnJheSA9PT0gJ2Z1bmN0aW9uJyAmJiAvLyBjaHJvbWUgOS0xMCBsYWNrIGBzdWJhcnJheWBcbiAgICAgICAgbmV3IFVpbnQ4QXJyYXkoMSkuc3ViYXJyYXkoMSwgMSkuYnl0ZUxlbmd0aCA9PT0gMCAvLyBpZTEwIGhhcyBicm9rZW4gYHN1YmFycmF5YFxuICB9IGNhdGNoIChlKSB7XG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cbn0pKClcblxuZnVuY3Rpb24ga01heExlbmd0aCAoKSB7XG4gIHJldHVybiBCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVFxuICAgID8gMHg3ZmZmZmZmZlxuICAgIDogMHgzZmZmZmZmZlxufVxuXG4vKipcbiAqIENsYXNzOiBCdWZmZXJcbiAqID09PT09PT09PT09PT1cbiAqXG4gKiBUaGUgQnVmZmVyIGNvbnN0cnVjdG9yIHJldHVybnMgaW5zdGFuY2VzIG9mIGBVaW50OEFycmF5YCB0aGF0IGFyZSBhdWdtZW50ZWRcbiAqIHdpdGggZnVuY3Rpb24gcHJvcGVydGllcyBmb3IgYWxsIHRoZSBub2RlIGBCdWZmZXJgIEFQSSBmdW5jdGlvbnMuIFdlIHVzZVxuICogYFVpbnQ4QXJyYXlgIHNvIHRoYXQgc3F1YXJlIGJyYWNrZXQgbm90YXRpb24gd29ya3MgYXMgZXhwZWN0ZWQgLS0gaXQgcmV0dXJuc1xuICogYSBzaW5nbGUgb2N0ZXQuXG4gKlxuICogQnkgYXVnbWVudGluZyB0aGUgaW5zdGFuY2VzLCB3ZSBjYW4gYXZvaWQgbW9kaWZ5aW5nIHRoZSBgVWludDhBcnJheWBcbiAqIHByb3RvdHlwZS5cbiAqL1xuZnVuY3Rpb24gQnVmZmVyIChhcmcpIHtcbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIEJ1ZmZlcikpIHtcbiAgICAvLyBBdm9pZCBnb2luZyB0aHJvdWdoIGFuIEFyZ3VtZW50c0FkYXB0b3JUcmFtcG9saW5lIGluIHRoZSBjb21tb24gY2FzZS5cbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDEpIHJldHVybiBuZXcgQnVmZmVyKGFyZywgYXJndW1lbnRzWzFdKVxuICAgIHJldHVybiBuZXcgQnVmZmVyKGFyZylcbiAgfVxuXG4gIHRoaXMubGVuZ3RoID0gMFxuICB0aGlzLnBhcmVudCA9IHVuZGVmaW5lZFxuXG4gIC8vIENvbW1vbiBjYXNlLlxuICBpZiAodHlwZW9mIGFyZyA9PT0gJ251bWJlcicpIHtcbiAgICByZXR1cm4gZnJvbU51bWJlcih0aGlzLCBhcmcpXG4gIH1cblxuICAvLyBTbGlnaHRseSBsZXNzIGNvbW1vbiBjYXNlLlxuICBpZiAodHlwZW9mIGFyZyA9PT0gJ3N0cmluZycpIHtcbiAgICByZXR1cm4gZnJvbVN0cmluZyh0aGlzLCBhcmcsIGFyZ3VtZW50cy5sZW5ndGggPiAxID8gYXJndW1lbnRzWzFdIDogJ3V0ZjgnKVxuICB9XG5cbiAgLy8gVW51c3VhbC5cbiAgcmV0dXJuIGZyb21PYmplY3QodGhpcywgYXJnKVxufVxuXG5mdW5jdGlvbiBmcm9tTnVtYmVyICh0aGF0LCBsZW5ndGgpIHtcbiAgdGhhdCA9IGFsbG9jYXRlKHRoYXQsIGxlbmd0aCA8IDAgPyAwIDogY2hlY2tlZChsZW5ndGgpIHwgMClcbiAgaWYgKCFCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIHRoYXRbaV0gPSAwXG4gICAgfVxuICB9XG4gIHJldHVybiB0aGF0XG59XG5cbmZ1bmN0aW9uIGZyb21TdHJpbmcgKHRoYXQsIHN0cmluZywgZW5jb2RpbmcpIHtcbiAgaWYgKHR5cGVvZiBlbmNvZGluZyAhPT0gJ3N0cmluZycgfHwgZW5jb2RpbmcgPT09ICcnKSBlbmNvZGluZyA9ICd1dGY4J1xuXG4gIC8vIEFzc3VtcHRpb246IGJ5dGVMZW5ndGgoKSByZXR1cm4gdmFsdWUgaXMgYWx3YXlzIDwga01heExlbmd0aC5cbiAgdmFyIGxlbmd0aCA9IGJ5dGVMZW5ndGgoc3RyaW5nLCBlbmNvZGluZykgfCAwXG4gIHRoYXQgPSBhbGxvY2F0ZSh0aGF0LCBsZW5ndGgpXG5cbiAgdGhhdC53cml0ZShzdHJpbmcsIGVuY29kaW5nKVxuICByZXR1cm4gdGhhdFxufVxuXG5mdW5jdGlvbiBmcm9tT2JqZWN0ICh0aGF0LCBvYmplY3QpIHtcbiAgaWYgKEJ1ZmZlci5pc0J1ZmZlcihvYmplY3QpKSByZXR1cm4gZnJvbUJ1ZmZlcih0aGF0LCBvYmplY3QpXG5cbiAgaWYgKGlzQXJyYXkob2JqZWN0KSkgcmV0dXJuIGZyb21BcnJheSh0aGF0LCBvYmplY3QpXG5cbiAgaWYgKG9iamVjdCA9PSBudWxsKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignbXVzdCBzdGFydCB3aXRoIG51bWJlciwgYnVmZmVyLCBhcnJheSBvciBzdHJpbmcnKVxuICB9XG5cbiAgaWYgKHR5cGVvZiBBcnJheUJ1ZmZlciAhPT0gJ3VuZGVmaW5lZCcgJiYgb2JqZWN0LmJ1ZmZlciBpbnN0YW5jZW9mIEFycmF5QnVmZmVyKSB7XG4gICAgcmV0dXJuIGZyb21UeXBlZEFycmF5KHRoYXQsIG9iamVjdClcbiAgfVxuXG4gIGlmIChvYmplY3QubGVuZ3RoKSByZXR1cm4gZnJvbUFycmF5TGlrZSh0aGF0LCBvYmplY3QpXG5cbiAgcmV0dXJuIGZyb21Kc29uT2JqZWN0KHRoYXQsIG9iamVjdClcbn1cblxuZnVuY3Rpb24gZnJvbUJ1ZmZlciAodGhhdCwgYnVmZmVyKSB7XG4gIHZhciBsZW5ndGggPSBjaGVja2VkKGJ1ZmZlci5sZW5ndGgpIHwgMFxuICB0aGF0ID0gYWxsb2NhdGUodGhhdCwgbGVuZ3RoKVxuICBidWZmZXIuY29weSh0aGF0LCAwLCAwLCBsZW5ndGgpXG4gIHJldHVybiB0aGF0XG59XG5cbmZ1bmN0aW9uIGZyb21BcnJheSAodGhhdCwgYXJyYXkpIHtcbiAgdmFyIGxlbmd0aCA9IGNoZWNrZWQoYXJyYXkubGVuZ3RoKSB8IDBcbiAgdGhhdCA9IGFsbG9jYXRlKHRoYXQsIGxlbmd0aClcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkgKz0gMSkge1xuICAgIHRoYXRbaV0gPSBhcnJheVtpXSAmIDI1NVxuICB9XG4gIHJldHVybiB0aGF0XG59XG5cbi8vIER1cGxpY2F0ZSBvZiBmcm9tQXJyYXkoKSB0byBrZWVwIGZyb21BcnJheSgpIG1vbm9tb3JwaGljLlxuZnVuY3Rpb24gZnJvbVR5cGVkQXJyYXkgKHRoYXQsIGFycmF5KSB7XG4gIHZhciBsZW5ndGggPSBjaGVja2VkKGFycmF5Lmxlbmd0aCkgfCAwXG4gIHRoYXQgPSBhbGxvY2F0ZSh0aGF0LCBsZW5ndGgpXG4gIC8vIFRydW5jYXRpbmcgdGhlIGVsZW1lbnRzIGlzIHByb2JhYmx5IG5vdCB3aGF0IHBlb3BsZSBleHBlY3QgZnJvbSB0eXBlZFxuICAvLyBhcnJheXMgd2l0aCBCWVRFU19QRVJfRUxFTUVOVCA+IDEgYnV0IGl0J3MgY29tcGF0aWJsZSB3aXRoIHRoZSBiZWhhdmlvclxuICAvLyBvZiB0aGUgb2xkIEJ1ZmZlciBjb25zdHJ1Y3Rvci5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkgKz0gMSkge1xuICAgIHRoYXRbaV0gPSBhcnJheVtpXSAmIDI1NVxuICB9XG4gIHJldHVybiB0aGF0XG59XG5cbmZ1bmN0aW9uIGZyb21BcnJheUxpa2UgKHRoYXQsIGFycmF5KSB7XG4gIHZhciBsZW5ndGggPSBjaGVja2VkKGFycmF5Lmxlbmd0aCkgfCAwXG4gIHRoYXQgPSBhbGxvY2F0ZSh0aGF0LCBsZW5ndGgpXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpICs9IDEpIHtcbiAgICB0aGF0W2ldID0gYXJyYXlbaV0gJiAyNTVcbiAgfVxuICByZXR1cm4gdGhhdFxufVxuXG4vLyBEZXNlcmlhbGl6ZSB7IHR5cGU6ICdCdWZmZXInLCBkYXRhOiBbMSwyLDMsLi4uXSB9IGludG8gYSBCdWZmZXIgb2JqZWN0LlxuLy8gUmV0dXJucyBhIHplcm8tbGVuZ3RoIGJ1ZmZlciBmb3IgaW5wdXRzIHRoYXQgZG9uJ3QgY29uZm9ybSB0byB0aGUgc3BlYy5cbmZ1bmN0aW9uIGZyb21Kc29uT2JqZWN0ICh0aGF0LCBvYmplY3QpIHtcbiAgdmFyIGFycmF5XG4gIHZhciBsZW5ndGggPSAwXG5cbiAgaWYgKG9iamVjdC50eXBlID09PSAnQnVmZmVyJyAmJiBpc0FycmF5KG9iamVjdC5kYXRhKSkge1xuICAgIGFycmF5ID0gb2JqZWN0LmRhdGFcbiAgICBsZW5ndGggPSBjaGVja2VkKGFycmF5Lmxlbmd0aCkgfCAwXG4gIH1cbiAgdGhhdCA9IGFsbG9jYXRlKHRoYXQsIGxlbmd0aClcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSArPSAxKSB7XG4gICAgdGhhdFtpXSA9IGFycmF5W2ldICYgMjU1XG4gIH1cbiAgcmV0dXJuIHRoYXRcbn1cblxuZnVuY3Rpb24gYWxsb2NhdGUgKHRoYXQsIGxlbmd0aCkge1xuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICAvLyBSZXR1cm4gYW4gYXVnbWVudGVkIGBVaW50OEFycmF5YCBpbnN0YW5jZSwgZm9yIGJlc3QgcGVyZm9ybWFuY2VcbiAgICB0aGF0ID0gQnVmZmVyLl9hdWdtZW50KG5ldyBVaW50OEFycmF5KGxlbmd0aCkpXG4gIH0gZWxzZSB7XG4gICAgLy8gRmFsbGJhY2s6IFJldHVybiBhbiBvYmplY3QgaW5zdGFuY2Ugb2YgdGhlIEJ1ZmZlciBjbGFzc1xuICAgIHRoYXQubGVuZ3RoID0gbGVuZ3RoXG4gICAgdGhhdC5faXNCdWZmZXIgPSB0cnVlXG4gIH1cblxuICB2YXIgZnJvbVBvb2wgPSBsZW5ndGggIT09IDAgJiYgbGVuZ3RoIDw9IEJ1ZmZlci5wb29sU2l6ZSA+Pj4gMVxuICBpZiAoZnJvbVBvb2wpIHRoYXQucGFyZW50ID0gcm9vdFBhcmVudFxuXG4gIHJldHVybiB0aGF0XG59XG5cbmZ1bmN0aW9uIGNoZWNrZWQgKGxlbmd0aCkge1xuICAvLyBOb3RlOiBjYW5ub3QgdXNlIGBsZW5ndGggPCBrTWF4TGVuZ3RoYCBoZXJlIGJlY2F1c2UgdGhhdCBmYWlscyB3aGVuXG4gIC8vIGxlbmd0aCBpcyBOYU4gKHdoaWNoIGlzIG90aGVyd2lzZSBjb2VyY2VkIHRvIHplcm8uKVxuICBpZiAobGVuZ3RoID49IGtNYXhMZW5ndGgoKSkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdBdHRlbXB0IHRvIGFsbG9jYXRlIEJ1ZmZlciBsYXJnZXIgdGhhbiBtYXhpbXVtICcgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICdzaXplOiAweCcgKyBrTWF4TGVuZ3RoKCkudG9TdHJpbmcoMTYpICsgJyBieXRlcycpXG4gIH1cbiAgcmV0dXJuIGxlbmd0aCB8IDBcbn1cblxuZnVuY3Rpb24gU2xvd0J1ZmZlciAoc3ViamVjdCwgZW5jb2RpbmcpIHtcbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIFNsb3dCdWZmZXIpKSByZXR1cm4gbmV3IFNsb3dCdWZmZXIoc3ViamVjdCwgZW5jb2RpbmcpXG5cbiAgdmFyIGJ1ZiA9IG5ldyBCdWZmZXIoc3ViamVjdCwgZW5jb2RpbmcpXG4gIGRlbGV0ZSBidWYucGFyZW50XG4gIHJldHVybiBidWZcbn1cblxuQnVmZmVyLmlzQnVmZmVyID0gZnVuY3Rpb24gaXNCdWZmZXIgKGIpIHtcbiAgcmV0dXJuICEhKGIgIT0gbnVsbCAmJiBiLl9pc0J1ZmZlcilcbn1cblxuQnVmZmVyLmNvbXBhcmUgPSBmdW5jdGlvbiBjb21wYXJlIChhLCBiKSB7XG4gIGlmICghQnVmZmVyLmlzQnVmZmVyKGEpIHx8ICFCdWZmZXIuaXNCdWZmZXIoYikpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdBcmd1bWVudHMgbXVzdCBiZSBCdWZmZXJzJylcbiAgfVxuXG4gIGlmIChhID09PSBiKSByZXR1cm4gMFxuXG4gIHZhciB4ID0gYS5sZW5ndGhcbiAgdmFyIHkgPSBiLmxlbmd0aFxuXG4gIHZhciBpID0gMFxuICB2YXIgbGVuID0gTWF0aC5taW4oeCwgeSlcbiAgd2hpbGUgKGkgPCBsZW4pIHtcbiAgICBpZiAoYVtpXSAhPT0gYltpXSkgYnJlYWtcblxuICAgICsraVxuICB9XG5cbiAgaWYgKGkgIT09IGxlbikge1xuICAgIHggPSBhW2ldXG4gICAgeSA9IGJbaV1cbiAgfVxuXG4gIGlmICh4IDwgeSkgcmV0dXJuIC0xXG4gIGlmICh5IDwgeCkgcmV0dXJuIDFcbiAgcmV0dXJuIDBcbn1cblxuQnVmZmVyLmlzRW5jb2RpbmcgPSBmdW5jdGlvbiBpc0VuY29kaW5nIChlbmNvZGluZykge1xuICBzd2l0Y2ggKFN0cmluZyhlbmNvZGluZykudG9Mb3dlckNhc2UoKSkge1xuICAgIGNhc2UgJ2hleCc6XG4gICAgY2FzZSAndXRmOCc6XG4gICAgY2FzZSAndXRmLTgnOlxuICAgIGNhc2UgJ2FzY2lpJzpcbiAgICBjYXNlICdiaW5hcnknOlxuICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgY2FzZSAncmF3JzpcbiAgICBjYXNlICd1Y3MyJzpcbiAgICBjYXNlICd1Y3MtMic6XG4gICAgY2FzZSAndXRmMTZsZSc6XG4gICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgcmV0dXJuIHRydWVcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIGZhbHNlXG4gIH1cbn1cblxuQnVmZmVyLmNvbmNhdCA9IGZ1bmN0aW9uIGNvbmNhdCAobGlzdCwgbGVuZ3RoKSB7XG4gIGlmICghaXNBcnJheShsaXN0KSkgdGhyb3cgbmV3IFR5cGVFcnJvcignbGlzdCBhcmd1bWVudCBtdXN0IGJlIGFuIEFycmF5IG9mIEJ1ZmZlcnMuJylcblxuICBpZiAobGlzdC5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gbmV3IEJ1ZmZlcigwKVxuICB9IGVsc2UgaWYgKGxpc3QubGVuZ3RoID09PSAxKSB7XG4gICAgcmV0dXJuIGxpc3RbMF1cbiAgfVxuXG4gIHZhciBpXG4gIGlmIChsZW5ndGggPT09IHVuZGVmaW5lZCkge1xuICAgIGxlbmd0aCA9IDBcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgbGVuZ3RoICs9IGxpc3RbaV0ubGVuZ3RoXG4gICAgfVxuICB9XG5cbiAgdmFyIGJ1ZiA9IG5ldyBCdWZmZXIobGVuZ3RoKVxuICB2YXIgcG9zID0gMFxuICBmb3IgKGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xuICAgIHZhciBpdGVtID0gbGlzdFtpXVxuICAgIGl0ZW0uY29weShidWYsIHBvcylcbiAgICBwb3MgKz0gaXRlbS5sZW5ndGhcbiAgfVxuICByZXR1cm4gYnVmXG59XG5cbmZ1bmN0aW9uIGJ5dGVMZW5ndGggKHN0cmluZywgZW5jb2RpbmcpIHtcbiAgaWYgKHR5cGVvZiBzdHJpbmcgIT09ICdzdHJpbmcnKSBzdHJpbmcgPSAnJyArIHN0cmluZ1xuXG4gIHZhciBsZW4gPSBzdHJpbmcubGVuZ3RoXG4gIGlmIChsZW4gPT09IDApIHJldHVybiAwXG5cbiAgLy8gVXNlIGEgZm9yIGxvb3AgdG8gYXZvaWQgcmVjdXJzaW9uXG4gIHZhciBsb3dlcmVkQ2FzZSA9IGZhbHNlXG4gIGZvciAoOzspIHtcbiAgICBzd2l0Y2ggKGVuY29kaW5nKSB7XG4gICAgICBjYXNlICdhc2NpaSc6XG4gICAgICBjYXNlICdiaW5hcnknOlxuICAgICAgLy8gRGVwcmVjYXRlZFxuICAgICAgY2FzZSAncmF3JzpcbiAgICAgIGNhc2UgJ3Jhd3MnOlxuICAgICAgICByZXR1cm4gbGVuXG4gICAgICBjYXNlICd1dGY4JzpcbiAgICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgICAgcmV0dXJuIHV0ZjhUb0J5dGVzKHN0cmluZykubGVuZ3RoXG4gICAgICBjYXNlICd1Y3MyJzpcbiAgICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgICByZXR1cm4gbGVuICogMlxuICAgICAgY2FzZSAnaGV4JzpcbiAgICAgICAgcmV0dXJuIGxlbiA+Pj4gMVxuICAgICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgICAgcmV0dXJuIGJhc2U2NFRvQnl0ZXMoc3RyaW5nKS5sZW5ndGhcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGlmIChsb3dlcmVkQ2FzZSkgcmV0dXJuIHV0ZjhUb0J5dGVzKHN0cmluZykubGVuZ3RoIC8vIGFzc3VtZSB1dGY4XG4gICAgICAgIGVuY29kaW5nID0gKCcnICsgZW5jb2RpbmcpLnRvTG93ZXJDYXNlKClcbiAgICAgICAgbG93ZXJlZENhc2UgPSB0cnVlXG4gICAgfVxuICB9XG59XG5CdWZmZXIuYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGhcblxuLy8gcHJlLXNldCBmb3IgdmFsdWVzIHRoYXQgbWF5IGV4aXN0IGluIHRoZSBmdXR1cmVcbkJ1ZmZlci5wcm90b3R5cGUubGVuZ3RoID0gdW5kZWZpbmVkXG5CdWZmZXIucHJvdG90eXBlLnBhcmVudCA9IHVuZGVmaW5lZFxuXG5mdW5jdGlvbiBzbG93VG9TdHJpbmcgKGVuY29kaW5nLCBzdGFydCwgZW5kKSB7XG4gIHZhciBsb3dlcmVkQ2FzZSA9IGZhbHNlXG5cbiAgc3RhcnQgPSBzdGFydCB8IDBcbiAgZW5kID0gZW5kID09PSB1bmRlZmluZWQgfHwgZW5kID09PSBJbmZpbml0eSA/IHRoaXMubGVuZ3RoIDogZW5kIHwgMFxuXG4gIGlmICghZW5jb2RpbmcpIGVuY29kaW5nID0gJ3V0ZjgnXG4gIGlmIChzdGFydCA8IDApIHN0YXJ0ID0gMFxuICBpZiAoZW5kID4gdGhpcy5sZW5ndGgpIGVuZCA9IHRoaXMubGVuZ3RoXG4gIGlmIChlbmQgPD0gc3RhcnQpIHJldHVybiAnJ1xuXG4gIHdoaWxlICh0cnVlKSB7XG4gICAgc3dpdGNoIChlbmNvZGluZykge1xuICAgICAgY2FzZSAnaGV4JzpcbiAgICAgICAgcmV0dXJuIGhleFNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ3V0ZjgnOlxuICAgICAgY2FzZSAndXRmLTgnOlxuICAgICAgICByZXR1cm4gdXRmOFNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ2FzY2lpJzpcbiAgICAgICAgcmV0dXJuIGFzY2lpU2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAnYmluYXJ5JzpcbiAgICAgICAgcmV0dXJuIGJpbmFyeVNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICAgIHJldHVybiBiYXNlNjRTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICd1Y3MyJzpcbiAgICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgICByZXR1cm4gdXRmMTZsZVNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGlmIChsb3dlcmVkQ2FzZSkgdGhyb3cgbmV3IFR5cGVFcnJvcignVW5rbm93biBlbmNvZGluZzogJyArIGVuY29kaW5nKVxuICAgICAgICBlbmNvZGluZyA9IChlbmNvZGluZyArICcnKS50b0xvd2VyQ2FzZSgpXG4gICAgICAgIGxvd2VyZWRDYXNlID0gdHJ1ZVxuICAgIH1cbiAgfVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24gdG9TdHJpbmcgKCkge1xuICB2YXIgbGVuZ3RoID0gdGhpcy5sZW5ndGggfCAwXG4gIGlmIChsZW5ndGggPT09IDApIHJldHVybiAnJ1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIHV0ZjhTbGljZSh0aGlzLCAwLCBsZW5ndGgpXG4gIHJldHVybiBzbG93VG9TdHJpbmcuYXBwbHkodGhpcywgYXJndW1lbnRzKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLmVxdWFscyA9IGZ1bmN0aW9uIGVxdWFscyAoYikge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihiKSkgdGhyb3cgbmV3IFR5cGVFcnJvcignQXJndW1lbnQgbXVzdCBiZSBhIEJ1ZmZlcicpXG4gIGlmICh0aGlzID09PSBiKSByZXR1cm4gdHJ1ZVxuICByZXR1cm4gQnVmZmVyLmNvbXBhcmUodGhpcywgYikgPT09IDBcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5pbnNwZWN0ID0gZnVuY3Rpb24gaW5zcGVjdCAoKSB7XG4gIHZhciBzdHIgPSAnJ1xuICB2YXIgbWF4ID0gZXhwb3J0cy5JTlNQRUNUX01BWF9CWVRFU1xuICBpZiAodGhpcy5sZW5ndGggPiAwKSB7XG4gICAgc3RyID0gdGhpcy50b1N0cmluZygnaGV4JywgMCwgbWF4KS5tYXRjaCgvLnsyfS9nKS5qb2luKCcgJylcbiAgICBpZiAodGhpcy5sZW5ndGggPiBtYXgpIHN0ciArPSAnIC4uLiAnXG4gIH1cbiAgcmV0dXJuICc8QnVmZmVyICcgKyBzdHIgKyAnPidcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5jb21wYXJlID0gZnVuY3Rpb24gY29tcGFyZSAoYikge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihiKSkgdGhyb3cgbmV3IFR5cGVFcnJvcignQXJndW1lbnQgbXVzdCBiZSBhIEJ1ZmZlcicpXG4gIGlmICh0aGlzID09PSBiKSByZXR1cm4gMFxuICByZXR1cm4gQnVmZmVyLmNvbXBhcmUodGhpcywgYilcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5pbmRleE9mID0gZnVuY3Rpb24gaW5kZXhPZiAodmFsLCBieXRlT2Zmc2V0KSB7XG4gIGlmIChieXRlT2Zmc2V0ID4gMHg3ZmZmZmZmZikgYnl0ZU9mZnNldCA9IDB4N2ZmZmZmZmZcbiAgZWxzZSBpZiAoYnl0ZU9mZnNldCA8IC0weDgwMDAwMDAwKSBieXRlT2Zmc2V0ID0gLTB4ODAwMDAwMDBcbiAgYnl0ZU9mZnNldCA+Pj0gMFxuXG4gIGlmICh0aGlzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIC0xXG4gIGlmIChieXRlT2Zmc2V0ID49IHRoaXMubGVuZ3RoKSByZXR1cm4gLTFcblxuICAvLyBOZWdhdGl2ZSBvZmZzZXRzIHN0YXJ0IGZyb20gdGhlIGVuZCBvZiB0aGUgYnVmZmVyXG4gIGlmIChieXRlT2Zmc2V0IDwgMCkgYnl0ZU9mZnNldCA9IE1hdGgubWF4KHRoaXMubGVuZ3RoICsgYnl0ZU9mZnNldCwgMClcblxuICBpZiAodHlwZW9mIHZhbCA9PT0gJ3N0cmluZycpIHtcbiAgICBpZiAodmFsLmxlbmd0aCA9PT0gMCkgcmV0dXJuIC0xIC8vIHNwZWNpYWwgY2FzZTogbG9va2luZyBmb3IgZW1wdHkgc3RyaW5nIGFsd2F5cyBmYWlsc1xuICAgIHJldHVybiBTdHJpbmcucHJvdG90eXBlLmluZGV4T2YuY2FsbCh0aGlzLCB2YWwsIGJ5dGVPZmZzZXQpXG4gIH1cbiAgaWYgKEJ1ZmZlci5pc0J1ZmZlcih2YWwpKSB7XG4gICAgcmV0dXJuIGFycmF5SW5kZXhPZih0aGlzLCB2YWwsIGJ5dGVPZmZzZXQpXG4gIH1cbiAgaWYgKHR5cGVvZiB2YWwgPT09ICdudW1iZXInKSB7XG4gICAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUICYmIFVpbnQ4QXJyYXkucHJvdG90eXBlLmluZGV4T2YgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHJldHVybiBVaW50OEFycmF5LnByb3RvdHlwZS5pbmRleE9mLmNhbGwodGhpcywgdmFsLCBieXRlT2Zmc2V0KVxuICAgIH1cbiAgICByZXR1cm4gYXJyYXlJbmRleE9mKHRoaXMsIFsgdmFsIF0sIGJ5dGVPZmZzZXQpXG4gIH1cblxuICBmdW5jdGlvbiBhcnJheUluZGV4T2YgKGFyciwgdmFsLCBieXRlT2Zmc2V0KSB7XG4gICAgdmFyIGZvdW5kSW5kZXggPSAtMVxuICAgIGZvciAodmFyIGkgPSAwOyBieXRlT2Zmc2V0ICsgaSA8IGFyci5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKGFycltieXRlT2Zmc2V0ICsgaV0gPT09IHZhbFtmb3VuZEluZGV4ID09PSAtMSA/IDAgOiBpIC0gZm91bmRJbmRleF0pIHtcbiAgICAgICAgaWYgKGZvdW5kSW5kZXggPT09IC0xKSBmb3VuZEluZGV4ID0gaVxuICAgICAgICBpZiAoaSAtIGZvdW5kSW5kZXggKyAxID09PSB2YWwubGVuZ3RoKSByZXR1cm4gYnl0ZU9mZnNldCArIGZvdW5kSW5kZXhcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZvdW5kSW5kZXggPSAtMVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gLTFcbiAgfVxuXG4gIHRocm93IG5ldyBUeXBlRXJyb3IoJ3ZhbCBtdXN0IGJlIHN0cmluZywgbnVtYmVyIG9yIEJ1ZmZlcicpXG59XG5cbi8vIGBnZXRgIHdpbGwgYmUgcmVtb3ZlZCBpbiBOb2RlIDAuMTMrXG5CdWZmZXIucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uIGdldCAob2Zmc2V0KSB7XG4gIGNvbnNvbGUubG9nKCcuZ2V0KCkgaXMgZGVwcmVjYXRlZC4gQWNjZXNzIHVzaW5nIGFycmF5IGluZGV4ZXMgaW5zdGVhZC4nKVxuICByZXR1cm4gdGhpcy5yZWFkVUludDgob2Zmc2V0KVxufVxuXG4vLyBgc2V0YCB3aWxsIGJlIHJlbW92ZWQgaW4gTm9kZSAwLjEzK1xuQnVmZmVyLnByb3RvdHlwZS5zZXQgPSBmdW5jdGlvbiBzZXQgKHYsIG9mZnNldCkge1xuICBjb25zb2xlLmxvZygnLnNldCgpIGlzIGRlcHJlY2F0ZWQuIEFjY2VzcyB1c2luZyBhcnJheSBpbmRleGVzIGluc3RlYWQuJylcbiAgcmV0dXJuIHRoaXMud3JpdGVVSW50OCh2LCBvZmZzZXQpXG59XG5cbmZ1bmN0aW9uIGhleFdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgb2Zmc2V0ID0gTnVtYmVyKG9mZnNldCkgfHwgMFxuICB2YXIgcmVtYWluaW5nID0gYnVmLmxlbmd0aCAtIG9mZnNldFxuICBpZiAoIWxlbmd0aCkge1xuICAgIGxlbmd0aCA9IHJlbWFpbmluZ1xuICB9IGVsc2Uge1xuICAgIGxlbmd0aCA9IE51bWJlcihsZW5ndGgpXG4gICAgaWYgKGxlbmd0aCA+IHJlbWFpbmluZykge1xuICAgICAgbGVuZ3RoID0gcmVtYWluaW5nXG4gICAgfVxuICB9XG5cbiAgLy8gbXVzdCBiZSBhbiBldmVuIG51bWJlciBvZiBkaWdpdHNcbiAgdmFyIHN0ckxlbiA9IHN0cmluZy5sZW5ndGhcbiAgaWYgKHN0ckxlbiAlIDIgIT09IDApIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBoZXggc3RyaW5nJylcblxuICBpZiAobGVuZ3RoID4gc3RyTGVuIC8gMikge1xuICAgIGxlbmd0aCA9IHN0ckxlbiAvIDJcbiAgfVxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIHBhcnNlZCA9IHBhcnNlSW50KHN0cmluZy5zdWJzdHIoaSAqIDIsIDIpLCAxNilcbiAgICBpZiAoaXNOYU4ocGFyc2VkKSkgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGhleCBzdHJpbmcnKVxuICAgIGJ1ZltvZmZzZXQgKyBpXSA9IHBhcnNlZFxuICB9XG4gIHJldHVybiBpXG59XG5cbmZ1bmN0aW9uIHV0ZjhXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBibGl0QnVmZmVyKHV0ZjhUb0J5dGVzKHN0cmluZywgYnVmLmxlbmd0aCAtIG9mZnNldCksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbmZ1bmN0aW9uIGFzY2lpV3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYmxpdEJ1ZmZlcihhc2NpaVRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuZnVuY3Rpb24gYmluYXJ5V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYXNjaWlXcml0ZShidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbmZ1bmN0aW9uIGJhc2U2NFdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGJsaXRCdWZmZXIoYmFzZTY0VG9CeXRlcyhzdHJpbmcpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiB1Y3MyV3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYmxpdEJ1ZmZlcih1dGYxNmxlVG9CeXRlcyhzdHJpbmcsIGJ1Zi5sZW5ndGggLSBvZmZzZXQpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlID0gZnVuY3Rpb24gd3JpdGUgKHN0cmluZywgb2Zmc2V0LCBsZW5ndGgsIGVuY29kaW5nKSB7XG4gIC8vIEJ1ZmZlciN3cml0ZShzdHJpbmcpXG4gIGlmIChvZmZzZXQgPT09IHVuZGVmaW5lZCkge1xuICAgIGVuY29kaW5nID0gJ3V0ZjgnXG4gICAgbGVuZ3RoID0gdGhpcy5sZW5ndGhcbiAgICBvZmZzZXQgPSAwXG4gIC8vIEJ1ZmZlciN3cml0ZShzdHJpbmcsIGVuY29kaW5nKVxuICB9IGVsc2UgaWYgKGxlbmd0aCA9PT0gdW5kZWZpbmVkICYmIHR5cGVvZiBvZmZzZXQgPT09ICdzdHJpbmcnKSB7XG4gICAgZW5jb2RpbmcgPSBvZmZzZXRcbiAgICBsZW5ndGggPSB0aGlzLmxlbmd0aFxuICAgIG9mZnNldCA9IDBcbiAgLy8gQnVmZmVyI3dyaXRlKHN0cmluZywgb2Zmc2V0WywgbGVuZ3RoXVssIGVuY29kaW5nXSlcbiAgfSBlbHNlIGlmIChpc0Zpbml0ZShvZmZzZXQpKSB7XG4gICAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICAgIGlmIChpc0Zpbml0ZShsZW5ndGgpKSB7XG4gICAgICBsZW5ndGggPSBsZW5ndGggfCAwXG4gICAgICBpZiAoZW5jb2RpbmcgPT09IHVuZGVmaW5lZCkgZW5jb2RpbmcgPSAndXRmOCdcbiAgICB9IGVsc2Uge1xuICAgICAgZW5jb2RpbmcgPSBsZW5ndGhcbiAgICAgIGxlbmd0aCA9IHVuZGVmaW5lZFxuICAgIH1cbiAgLy8gbGVnYWN5IHdyaXRlKHN0cmluZywgZW5jb2RpbmcsIG9mZnNldCwgbGVuZ3RoKSAtIHJlbW92ZSBpbiB2MC4xM1xuICB9IGVsc2Uge1xuICAgIHZhciBzd2FwID0gZW5jb2RpbmdcbiAgICBlbmNvZGluZyA9IG9mZnNldFxuICAgIG9mZnNldCA9IGxlbmd0aCB8IDBcbiAgICBsZW5ndGggPSBzd2FwXG4gIH1cblxuICB2YXIgcmVtYWluaW5nID0gdGhpcy5sZW5ndGggLSBvZmZzZXRcbiAgaWYgKGxlbmd0aCA9PT0gdW5kZWZpbmVkIHx8IGxlbmd0aCA+IHJlbWFpbmluZykgbGVuZ3RoID0gcmVtYWluaW5nXG5cbiAgaWYgKChzdHJpbmcubGVuZ3RoID4gMCAmJiAobGVuZ3RoIDwgMCB8fCBvZmZzZXQgPCAwKSkgfHwgb2Zmc2V0ID4gdGhpcy5sZW5ndGgpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignYXR0ZW1wdCB0byB3cml0ZSBvdXRzaWRlIGJ1ZmZlciBib3VuZHMnKVxuICB9XG5cbiAgaWYgKCFlbmNvZGluZykgZW5jb2RpbmcgPSAndXRmOCdcblxuICB2YXIgbG93ZXJlZENhc2UgPSBmYWxzZVxuICBmb3IgKDs7KSB7XG4gICAgc3dpdGNoIChlbmNvZGluZykge1xuICAgICAgY2FzZSAnaGV4JzpcbiAgICAgICAgcmV0dXJuIGhleFdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ3V0ZjgnOlxuICAgICAgY2FzZSAndXRmLTgnOlxuICAgICAgICByZXR1cm4gdXRmOFdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ2FzY2lpJzpcbiAgICAgICAgcmV0dXJuIGFzY2lpV3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgY2FzZSAnYmluYXJ5JzpcbiAgICAgICAgcmV0dXJuIGJpbmFyeVdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICAgIC8vIFdhcm5pbmc6IG1heExlbmd0aCBub3QgdGFrZW4gaW50byBhY2NvdW50IGluIGJhc2U2NFdyaXRlXG4gICAgICAgIHJldHVybiBiYXNlNjRXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICd1Y3MyJzpcbiAgICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgICByZXR1cm4gdWNzMldyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGlmIChsb3dlcmVkQ2FzZSkgdGhyb3cgbmV3IFR5cGVFcnJvcignVW5rbm93biBlbmNvZGluZzogJyArIGVuY29kaW5nKVxuICAgICAgICBlbmNvZGluZyA9ICgnJyArIGVuY29kaW5nKS50b0xvd2VyQ2FzZSgpXG4gICAgICAgIGxvd2VyZWRDYXNlID0gdHJ1ZVxuICAgIH1cbiAgfVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnRvSlNPTiA9IGZ1bmN0aW9uIHRvSlNPTiAoKSB7XG4gIHJldHVybiB7XG4gICAgdHlwZTogJ0J1ZmZlcicsXG4gICAgZGF0YTogQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwodGhpcy5fYXJyIHx8IHRoaXMsIDApXG4gIH1cbn1cblxuZnVuY3Rpb24gYmFzZTY0U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICBpZiAoc3RhcnQgPT09IDAgJiYgZW5kID09PSBidWYubGVuZ3RoKSB7XG4gICAgcmV0dXJuIGJhc2U2NC5mcm9tQnl0ZUFycmF5KGJ1ZilcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gYmFzZTY0LmZyb21CeXRlQXJyYXkoYnVmLnNsaWNlKHN0YXJ0LCBlbmQpKVxuICB9XG59XG5cbmZ1bmN0aW9uIHV0ZjhTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciByZXMgPSAnJ1xuICB2YXIgdG1wID0gJydcbiAgZW5kID0gTWF0aC5taW4oYnVmLmxlbmd0aCwgZW5kKVxuXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgaWYgKGJ1ZltpXSA8PSAweDdGKSB7XG4gICAgICByZXMgKz0gZGVjb2RlVXRmOENoYXIodG1wKSArIFN0cmluZy5mcm9tQ2hhckNvZGUoYnVmW2ldKVxuICAgICAgdG1wID0gJydcbiAgICB9IGVsc2Uge1xuICAgICAgdG1wICs9ICclJyArIGJ1ZltpXS50b1N0cmluZygxNilcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcmVzICsgZGVjb2RlVXRmOENoYXIodG1wKVxufVxuXG5mdW5jdGlvbiBhc2NpaVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHJldCA9ICcnXG4gIGVuZCA9IE1hdGgubWluKGJ1Zi5sZW5ndGgsIGVuZClcblxuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgIHJldCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ1ZltpXSAmIDB4N0YpXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5mdW5jdGlvbiBiaW5hcnlTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciByZXQgPSAnJ1xuICBlbmQgPSBNYXRoLm1pbihidWYubGVuZ3RoLCBlbmQpXG5cbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICByZXQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShidWZbaV0pXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5mdW5jdGlvbiBoZXhTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG5cbiAgaWYgKCFzdGFydCB8fCBzdGFydCA8IDApIHN0YXJ0ID0gMFxuICBpZiAoIWVuZCB8fCBlbmQgPCAwIHx8IGVuZCA+IGxlbikgZW5kID0gbGVuXG5cbiAgdmFyIG91dCA9ICcnXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgb3V0ICs9IHRvSGV4KGJ1ZltpXSlcbiAgfVxuICByZXR1cm4gb3V0XG59XG5cbmZ1bmN0aW9uIHV0ZjE2bGVTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciBieXRlcyA9IGJ1Zi5zbGljZShzdGFydCwgZW5kKVxuICB2YXIgcmVzID0gJydcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBieXRlcy5sZW5ndGg7IGkgKz0gMikge1xuICAgIHJlcyArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ5dGVzW2ldICsgYnl0ZXNbaSArIDFdICogMjU2KVxuICB9XG4gIHJldHVybiByZXNcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5zbGljZSA9IGZ1bmN0aW9uIHNsaWNlIChzdGFydCwgZW5kKSB7XG4gIHZhciBsZW4gPSB0aGlzLmxlbmd0aFxuICBzdGFydCA9IH5+c3RhcnRcbiAgZW5kID0gZW5kID09PSB1bmRlZmluZWQgPyBsZW4gOiB+fmVuZFxuXG4gIGlmIChzdGFydCA8IDApIHtcbiAgICBzdGFydCArPSBsZW5cbiAgICBpZiAoc3RhcnQgPCAwKSBzdGFydCA9IDBcbiAgfSBlbHNlIGlmIChzdGFydCA+IGxlbikge1xuICAgIHN0YXJ0ID0gbGVuXG4gIH1cblxuICBpZiAoZW5kIDwgMCkge1xuICAgIGVuZCArPSBsZW5cbiAgICBpZiAoZW5kIDwgMCkgZW5kID0gMFxuICB9IGVsc2UgaWYgKGVuZCA+IGxlbikge1xuICAgIGVuZCA9IGxlblxuICB9XG5cbiAgaWYgKGVuZCA8IHN0YXJ0KSBlbmQgPSBzdGFydFxuXG4gIHZhciBuZXdCdWZcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgbmV3QnVmID0gQnVmZmVyLl9hdWdtZW50KHRoaXMuc3ViYXJyYXkoc3RhcnQsIGVuZCkpXG4gIH0gZWxzZSB7XG4gICAgdmFyIHNsaWNlTGVuID0gZW5kIC0gc3RhcnRcbiAgICBuZXdCdWYgPSBuZXcgQnVmZmVyKHNsaWNlTGVuLCB1bmRlZmluZWQpXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzbGljZUxlbjsgaSsrKSB7XG4gICAgICBuZXdCdWZbaV0gPSB0aGlzW2kgKyBzdGFydF1cbiAgICB9XG4gIH1cblxuICBpZiAobmV3QnVmLmxlbmd0aCkgbmV3QnVmLnBhcmVudCA9IHRoaXMucGFyZW50IHx8IHRoaXNcblxuICByZXR1cm4gbmV3QnVmXG59XG5cbi8qXG4gKiBOZWVkIHRvIG1ha2Ugc3VyZSB0aGF0IGJ1ZmZlciBpc24ndCB0cnlpbmcgdG8gd3JpdGUgb3V0IG9mIGJvdW5kcy5cbiAqL1xuZnVuY3Rpb24gY2hlY2tPZmZzZXQgKG9mZnNldCwgZXh0LCBsZW5ndGgpIHtcbiAgaWYgKChvZmZzZXQgJSAxKSAhPT0gMCB8fCBvZmZzZXQgPCAwKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignb2Zmc2V0IGlzIG5vdCB1aW50JylcbiAgaWYgKG9mZnNldCArIGV4dCA+IGxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ1RyeWluZyB0byBhY2Nlc3MgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50TEUgPSBmdW5jdGlvbiByZWFkVUludExFIChvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgYnl0ZUxlbmd0aCwgdGhpcy5sZW5ndGgpXG5cbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0XVxuICB2YXIgbXVsID0gMVxuICB2YXIgaSA9IDBcbiAgd2hpbGUgKCsraSA8IGJ5dGVMZW5ndGggJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB2YWwgKz0gdGhpc1tvZmZzZXQgKyBpXSAqIG11bFxuICB9XG5cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50QkUgPSBmdW5jdGlvbiByZWFkVUludEJFIChvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBjaGVja09mZnNldChvZmZzZXQsIGJ5dGVMZW5ndGgsIHRoaXMubGVuZ3RoKVxuICB9XG5cbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0ICsgLS1ieXRlTGVuZ3RoXVxuICB2YXIgbXVsID0gMVxuICB3aGlsZSAoYnl0ZUxlbmd0aCA+IDAgJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB2YWwgKz0gdGhpc1tvZmZzZXQgKyAtLWJ5dGVMZW5ndGhdICogbXVsXG4gIH1cblxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQ4ID0gZnVuY3Rpb24gcmVhZFVJbnQ4IChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMSwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiB0aGlzW29mZnNldF1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDE2TEUgPSBmdW5jdGlvbiByZWFkVUludDE2TEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAyLCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIHRoaXNbb2Zmc2V0XSB8ICh0aGlzW29mZnNldCArIDFdIDw8IDgpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQxNkJFID0gZnVuY3Rpb24gcmVhZFVJbnQxNkJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiAodGhpc1tvZmZzZXRdIDw8IDgpIHwgdGhpc1tvZmZzZXQgKyAxXVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MzJMRSA9IGZ1bmN0aW9uIHJlYWRVSW50MzJMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAoKHRoaXNbb2Zmc2V0XSkgfFxuICAgICAgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOCkgfFxuICAgICAgKHRoaXNbb2Zmc2V0ICsgMl0gPDwgMTYpKSArXG4gICAgICAodGhpc1tvZmZzZXQgKyAzXSAqIDB4MTAwMDAwMClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDMyQkUgPSBmdW5jdGlvbiByZWFkVUludDMyQkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSAqIDB4MTAwMDAwMCkgK1xuICAgICgodGhpc1tvZmZzZXQgKyAxXSA8PCAxNikgfFxuICAgICh0aGlzW29mZnNldCArIDJdIDw8IDgpIHxcbiAgICB0aGlzW29mZnNldCArIDNdKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnRMRSA9IGZ1bmN0aW9uIHJlYWRJbnRMRSAob2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoIHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIGJ5dGVMZW5ndGgsIHRoaXMubGVuZ3RoKVxuXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldF1cbiAgdmFyIG11bCA9IDFcbiAgdmFyIGkgPSAwXG4gIHdoaWxlICgrK2kgPCBieXRlTGVuZ3RoICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdmFsICs9IHRoaXNbb2Zmc2V0ICsgaV0gKiBtdWxcbiAgfVxuICBtdWwgKj0gMHg4MFxuXG4gIGlmICh2YWwgPj0gbXVsKSB2YWwgLT0gTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGgpXG5cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnRCRSA9IGZ1bmN0aW9uIHJlYWRJbnRCRSAob2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoIHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIGJ5dGVMZW5ndGgsIHRoaXMubGVuZ3RoKVxuXG4gIHZhciBpID0gYnl0ZUxlbmd0aFxuICB2YXIgbXVsID0gMVxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXQgKyAtLWldXG4gIHdoaWxlIChpID4gMCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHZhbCArPSB0aGlzW29mZnNldCArIC0taV0gKiBtdWxcbiAgfVxuICBtdWwgKj0gMHg4MFxuXG4gIGlmICh2YWwgPj0gbXVsKSB2YWwgLT0gTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGgpXG5cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQ4ID0gZnVuY3Rpb24gcmVhZEludDggKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAxLCB0aGlzLmxlbmd0aClcbiAgaWYgKCEodGhpc1tvZmZzZXRdICYgMHg4MCkpIHJldHVybiAodGhpc1tvZmZzZXRdKVxuICByZXR1cm4gKCgweGZmIC0gdGhpc1tvZmZzZXRdICsgMSkgKiAtMSlcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MTZMRSA9IGZ1bmN0aW9uIHJlYWRJbnQxNkxFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldF0gfCAodGhpc1tvZmZzZXQgKyAxXSA8PCA4KVxuICByZXR1cm4gKHZhbCAmIDB4ODAwMCkgPyB2YWwgfCAweEZGRkYwMDAwIDogdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDE2QkUgPSBmdW5jdGlvbiByZWFkSW50MTZCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDIsIHRoaXMubGVuZ3RoKVxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXQgKyAxXSB8ICh0aGlzW29mZnNldF0gPDwgOClcbiAgcmV0dXJuICh2YWwgJiAweDgwMDApID8gdmFsIHwgMHhGRkZGMDAwMCA6IHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQzMkxFID0gZnVuY3Rpb24gcmVhZEludDMyTEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSkgfFxuICAgICh0aGlzW29mZnNldCArIDFdIDw8IDgpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAyXSA8PCAxNikgfFxuICAgICh0aGlzW29mZnNldCArIDNdIDw8IDI0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQzMkJFID0gZnVuY3Rpb24gcmVhZEludDMyQkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSA8PCAyNCkgfFxuICAgICh0aGlzW29mZnNldCArIDFdIDw8IDE2KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMl0gPDwgOCkgfFxuICAgICh0aGlzW29mZnNldCArIDNdKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRGbG9hdExFID0gZnVuY3Rpb24gcmVhZEZsb2F0TEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIHRydWUsIDIzLCA0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRGbG9hdEJFID0gZnVuY3Rpb24gcmVhZEZsb2F0QkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIGZhbHNlLCAyMywgNClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRG91YmxlTEUgPSBmdW5jdGlvbiByZWFkRG91YmxlTEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA4LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIHRydWUsIDUyLCA4KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWREb3VibGVCRSA9IGZ1bmN0aW9uIHJlYWREb3VibGVCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDgsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgZmFsc2UsIDUyLCA4KVxufVxuXG5mdW5jdGlvbiBjaGVja0ludCAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBleHQsIG1heCwgbWluKSB7XG4gIGlmICghQnVmZmVyLmlzQnVmZmVyKGJ1ZikpIHRocm93IG5ldyBUeXBlRXJyb3IoJ2J1ZmZlciBtdXN0IGJlIGEgQnVmZmVyIGluc3RhbmNlJylcbiAgaWYgKHZhbHVlID4gbWF4IHx8IHZhbHVlIDwgbWluKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcigndmFsdWUgaXMgb3V0IG9mIGJvdW5kcycpXG4gIGlmIChvZmZzZXQgKyBleHQgPiBidWYubGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignaW5kZXggb3V0IG9mIHJhbmdlJylcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnRMRSA9IGZ1bmN0aW9uIHdyaXRlVUludExFICh2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoIHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aCksIDApXG5cbiAgdmFyIG11bCA9IDFcbiAgdmFyIGkgPSAwXG4gIHRoaXNbb2Zmc2V0XSA9IHZhbHVlICYgMHhGRlxuICB3aGlsZSAoKytpIDwgYnl0ZUxlbmd0aCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHRoaXNbb2Zmc2V0ICsgaV0gPSAodmFsdWUgLyBtdWwpICYgMHhGRlxuICB9XG5cbiAgcmV0dXJuIG9mZnNldCArIGJ5dGVMZW5ndGhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnRCRSA9IGZ1bmN0aW9uIHdyaXRlVUludEJFICh2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoIHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aCksIDApXG5cbiAgdmFyIGkgPSBieXRlTGVuZ3RoIC0gMVxuICB2YXIgbXVsID0gMVxuICB0aGlzW29mZnNldCArIGldID0gdmFsdWUgJiAweEZGXG4gIHdoaWxlICgtLWkgPj0gMCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHRoaXNbb2Zmc2V0ICsgaV0gPSAodmFsdWUgLyBtdWwpICYgMHhGRlxuICB9XG5cbiAgcmV0dXJuIG9mZnNldCArIGJ5dGVMZW5ndGhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQ4ID0gZnVuY3Rpb24gd3JpdGVVSW50OCAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAxLCAweGZmLCAwKVxuICBpZiAoIUJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB2YWx1ZSA9IE1hdGguZmxvb3IodmFsdWUpXG4gIHRoaXNbb2Zmc2V0XSA9IHZhbHVlXG4gIHJldHVybiBvZmZzZXQgKyAxXG59XG5cbmZ1bmN0aW9uIG9iamVjdFdyaXRlVUludDE2IChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbikge1xuICBpZiAodmFsdWUgPCAwKSB2YWx1ZSA9IDB4ZmZmZiArIHZhbHVlICsgMVxuICBmb3IgKHZhciBpID0gMCwgaiA9IE1hdGgubWluKGJ1Zi5sZW5ndGggLSBvZmZzZXQsIDIpOyBpIDwgajsgaSsrKSB7XG4gICAgYnVmW29mZnNldCArIGldID0gKHZhbHVlICYgKDB4ZmYgPDwgKDggKiAobGl0dGxlRW5kaWFuID8gaSA6IDEgLSBpKSkpKSA+Pj5cbiAgICAgIChsaXR0bGVFbmRpYW4gPyBpIDogMSAtIGkpICogOFxuICB9XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MTZMRSA9IGZ1bmN0aW9uIHdyaXRlVUludDE2TEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHhmZmZmLCAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSB2YWx1ZVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDE2QkUgPSBmdW5jdGlvbiB3cml0ZVVJbnQxNkJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDIsIDB4ZmZmZiwgMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSB2YWx1ZVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbmZ1bmN0aW9uIG9iamVjdFdyaXRlVUludDMyIChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbikge1xuICBpZiAodmFsdWUgPCAwKSB2YWx1ZSA9IDB4ZmZmZmZmZmYgKyB2YWx1ZSArIDFcbiAgZm9yICh2YXIgaSA9IDAsIGogPSBNYXRoLm1pbihidWYubGVuZ3RoIC0gb2Zmc2V0LCA0KTsgaSA8IGo7IGkrKykge1xuICAgIGJ1ZltvZmZzZXQgKyBpXSA9ICh2YWx1ZSA+Pj4gKGxpdHRsZUVuZGlhbiA/IGkgOiAzIC0gaSkgKiA4KSAmIDB4ZmZcbiAgfVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDMyTEUgPSBmdW5jdGlvbiB3cml0ZVVJbnQzMkxFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4ZmZmZmZmZmYsIDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0ICsgM10gPSAodmFsdWUgPj4+IDI0KVxuICAgIHRoaXNbb2Zmc2V0ICsgMl0gPSAodmFsdWUgPj4+IDE2KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXRdID0gdmFsdWVcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MzJCRSA9IGZ1bmN0aW9uIHdyaXRlVUludDMyQkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgNCwgMHhmZmZmZmZmZiwgMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiAyNClcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiAxNilcbiAgICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgM10gPSB2YWx1ZVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnRMRSA9IGZ1bmN0aW9uIHdyaXRlSW50TEUgKHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIHZhciBsaW1pdCA9IE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoIC0gMSlcblxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIGxpbWl0IC0gMSwgLWxpbWl0KVxuICB9XG5cbiAgdmFyIGkgPSAwXG4gIHZhciBtdWwgPSAxXG4gIHZhciBzdWIgPSB2YWx1ZSA8IDAgPyAxIDogMFxuICB0aGlzW29mZnNldF0gPSB2YWx1ZSAmIDB4RkZcbiAgd2hpbGUgKCsraSA8IGJ5dGVMZW5ndGggJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB0aGlzW29mZnNldCArIGldID0gKCh2YWx1ZSAvIG11bCkgPj4gMCkgLSBzdWIgJiAweEZGXG4gIH1cblxuICByZXR1cm4gb2Zmc2V0ICsgYnl0ZUxlbmd0aFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50QkUgPSBmdW5jdGlvbiB3cml0ZUludEJFICh2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICB2YXIgbGltaXQgPSBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aCAtIDEpXG5cbiAgICBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBsaW1pdCAtIDEsIC1saW1pdClcbiAgfVxuXG4gIHZhciBpID0gYnl0ZUxlbmd0aCAtIDFcbiAgdmFyIG11bCA9IDFcbiAgdmFyIHN1YiA9IHZhbHVlIDwgMCA/IDEgOiAwXG4gIHRoaXNbb2Zmc2V0ICsgaV0gPSB2YWx1ZSAmIDB4RkZcbiAgd2hpbGUgKC0taSA+PSAwICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdGhpc1tvZmZzZXQgKyBpXSA9ICgodmFsdWUgLyBtdWwpID4+IDApIC0gc3ViICYgMHhGRlxuICB9XG5cbiAgcmV0dXJuIG9mZnNldCArIGJ5dGVMZW5ndGhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDggPSBmdW5jdGlvbiB3cml0ZUludDggKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMSwgMHg3ZiwgLTB4ODApXG4gIGlmICghQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHZhbHVlID0gTWF0aC5mbG9vcih2YWx1ZSlcbiAgaWYgKHZhbHVlIDwgMCkgdmFsdWUgPSAweGZmICsgdmFsdWUgKyAxXG4gIHRoaXNbb2Zmc2V0XSA9IHZhbHVlXG4gIHJldHVybiBvZmZzZXQgKyAxXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQxNkxFID0gZnVuY3Rpb24gd3JpdGVJbnQxNkxFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDIsIDB4N2ZmZiwgLTB4ODAwMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gdmFsdWVcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiA4KVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDE2QkUgPSBmdW5jdGlvbiB3cml0ZUludDE2QkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHg3ZmZmLCAtMHg4MDAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9IHZhbHVlXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDMyTEUgPSBmdW5jdGlvbiB3cml0ZUludDMyTEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgNCwgMHg3ZmZmZmZmZiwgLTB4ODAwMDAwMDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9IHZhbHVlXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiAxNilcbiAgICB0aGlzW29mZnNldCArIDNdID0gKHZhbHVlID4+PiAyNClcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQzMkJFID0gZnVuY3Rpb24gd3JpdGVJbnQzMkJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4N2ZmZmZmZmYsIC0weDgwMDAwMDAwKVxuICBpZiAodmFsdWUgPCAwKSB2YWx1ZSA9IDB4ZmZmZmZmZmYgKyB2YWx1ZSArIDFcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiAyNClcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiAxNilcbiAgICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgM10gPSB2YWx1ZVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbmZ1bmN0aW9uIGNoZWNrSUVFRTc1NCAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBleHQsIG1heCwgbWluKSB7XG4gIGlmICh2YWx1ZSA+IG1heCB8fCB2YWx1ZSA8IG1pbikgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ3ZhbHVlIGlzIG91dCBvZiBib3VuZHMnKVxuICBpZiAob2Zmc2V0ICsgZXh0ID4gYnVmLmxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ2luZGV4IG91dCBvZiByYW5nZScpXG4gIGlmIChvZmZzZXQgPCAwKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignaW5kZXggb3V0IG9mIHJhbmdlJylcbn1cblxuZnVuY3Rpb24gd3JpdGVGbG9hdCAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBjaGVja0lFRUU3NTQoYnVmLCB2YWx1ZSwgb2Zmc2V0LCA0LCAzLjQwMjgyMzQ2NjM4NTI4ODZlKzM4LCAtMy40MDI4MjM0NjYzODUyODg2ZSszOClcbiAgfVxuICBpZWVlNzU0LndyaXRlKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCAyMywgNClcbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUZsb2F0TEUgPSBmdW5jdGlvbiB3cml0ZUZsb2F0TEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZUZsb2F0KHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRmxvYXRCRSA9IGZ1bmN0aW9uIHdyaXRlRmxvYXRCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRmxvYXQodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiB3cml0ZURvdWJsZSAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBjaGVja0lFRUU3NTQoYnVmLCB2YWx1ZSwgb2Zmc2V0LCA4LCAxLjc5NzY5MzEzNDg2MjMxNTdFKzMwOCwgLTEuNzk3NjkzMTM0ODYyMzE1N0UrMzA4KVxuICB9XG4gIGllZWU3NTQud3JpdGUoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIDUyLCA4KVxuICByZXR1cm4gb2Zmc2V0ICsgOFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRG91YmxlTEUgPSBmdW5jdGlvbiB3cml0ZURvdWJsZUxFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVEb3VibGUodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVEb3VibGVCRSA9IGZ1bmN0aW9uIHdyaXRlRG91YmxlQkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZURvdWJsZSh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbi8vIGNvcHkodGFyZ2V0QnVmZmVyLCB0YXJnZXRTdGFydD0wLCBzb3VyY2VTdGFydD0wLCBzb3VyY2VFbmQ9YnVmZmVyLmxlbmd0aClcbkJ1ZmZlci5wcm90b3R5cGUuY29weSA9IGZ1bmN0aW9uIGNvcHkgKHRhcmdldCwgdGFyZ2V0U3RhcnQsIHN0YXJ0LCBlbmQpIHtcbiAgaWYgKCFzdGFydCkgc3RhcnQgPSAwXG4gIGlmICghZW5kICYmIGVuZCAhPT0gMCkgZW5kID0gdGhpcy5sZW5ndGhcbiAgaWYgKHRhcmdldFN0YXJ0ID49IHRhcmdldC5sZW5ndGgpIHRhcmdldFN0YXJ0ID0gdGFyZ2V0Lmxlbmd0aFxuICBpZiAoIXRhcmdldFN0YXJ0KSB0YXJnZXRTdGFydCA9IDBcbiAgaWYgKGVuZCA+IDAgJiYgZW5kIDwgc3RhcnQpIGVuZCA9IHN0YXJ0XG5cbiAgLy8gQ29weSAwIGJ5dGVzOyB3ZSdyZSBkb25lXG4gIGlmIChlbmQgPT09IHN0YXJ0KSByZXR1cm4gMFxuICBpZiAodGFyZ2V0Lmxlbmd0aCA9PT0gMCB8fCB0aGlzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIDBcblxuICAvLyBGYXRhbCBlcnJvciBjb25kaXRpb25zXG4gIGlmICh0YXJnZXRTdGFydCA8IDApIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcigndGFyZ2V0U3RhcnQgb3V0IG9mIGJvdW5kcycpXG4gIH1cbiAgaWYgKHN0YXJ0IDwgMCB8fCBzdGFydCA+PSB0aGlzLmxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ3NvdXJjZVN0YXJ0IG91dCBvZiBib3VuZHMnKVxuICBpZiAoZW5kIDwgMCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ3NvdXJjZUVuZCBvdXQgb2YgYm91bmRzJylcblxuICAvLyBBcmUgd2Ugb29iP1xuICBpZiAoZW5kID4gdGhpcy5sZW5ndGgpIGVuZCA9IHRoaXMubGVuZ3RoXG4gIGlmICh0YXJnZXQubGVuZ3RoIC0gdGFyZ2V0U3RhcnQgPCBlbmQgLSBzdGFydCkge1xuICAgIGVuZCA9IHRhcmdldC5sZW5ndGggLSB0YXJnZXRTdGFydCArIHN0YXJ0XG4gIH1cblxuICB2YXIgbGVuID0gZW5kIC0gc3RhcnRcblxuICBpZiAobGVuIDwgMTAwMCB8fCAhQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICB0YXJnZXRbaSArIHRhcmdldFN0YXJ0XSA9IHRoaXNbaSArIHN0YXJ0XVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICB0YXJnZXQuX3NldCh0aGlzLnN1YmFycmF5KHN0YXJ0LCBzdGFydCArIGxlbiksIHRhcmdldFN0YXJ0KVxuICB9XG5cbiAgcmV0dXJuIGxlblxufVxuXG4vLyBmaWxsKHZhbHVlLCBzdGFydD0wLCBlbmQ9YnVmZmVyLmxlbmd0aClcbkJ1ZmZlci5wcm90b3R5cGUuZmlsbCA9IGZ1bmN0aW9uIGZpbGwgKHZhbHVlLCBzdGFydCwgZW5kKSB7XG4gIGlmICghdmFsdWUpIHZhbHVlID0gMFxuICBpZiAoIXN0YXJ0KSBzdGFydCA9IDBcbiAgaWYgKCFlbmQpIGVuZCA9IHRoaXMubGVuZ3RoXG5cbiAgaWYgKGVuZCA8IHN0YXJ0KSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignZW5kIDwgc3RhcnQnKVxuXG4gIC8vIEZpbGwgMCBieXRlczsgd2UncmUgZG9uZVxuICBpZiAoZW5kID09PSBzdGFydCkgcmV0dXJuXG4gIGlmICh0aGlzLmxlbmd0aCA9PT0gMCkgcmV0dXJuXG5cbiAgaWYgKHN0YXJ0IDwgMCB8fCBzdGFydCA+PSB0aGlzLmxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ3N0YXJ0IG91dCBvZiBib3VuZHMnKVxuICBpZiAoZW5kIDwgMCB8fCBlbmQgPiB0aGlzLmxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ2VuZCBvdXQgb2YgYm91bmRzJylcblxuICB2YXIgaVxuICBpZiAodHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJykge1xuICAgIGZvciAoaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICAgIHRoaXNbaV0gPSB2YWx1ZVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICB2YXIgYnl0ZXMgPSB1dGY4VG9CeXRlcyh2YWx1ZS50b1N0cmluZygpKVxuICAgIHZhciBsZW4gPSBieXRlcy5sZW5ndGhcbiAgICBmb3IgKGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgICB0aGlzW2ldID0gYnl0ZXNbaSAlIGxlbl1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpc1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBuZXcgYEFycmF5QnVmZmVyYCB3aXRoIHRoZSAqY29waWVkKiBtZW1vcnkgb2YgdGhlIGJ1ZmZlciBpbnN0YW5jZS5cbiAqIEFkZGVkIGluIE5vZGUgMC4xMi4gT25seSBhdmFpbGFibGUgaW4gYnJvd3NlcnMgdGhhdCBzdXBwb3J0IEFycmF5QnVmZmVyLlxuICovXG5CdWZmZXIucHJvdG90eXBlLnRvQXJyYXlCdWZmZXIgPSBmdW5jdGlvbiB0b0FycmF5QnVmZmVyICgpIHtcbiAgaWYgKHR5cGVvZiBVaW50OEFycmF5ICE9PSAndW5kZWZpbmVkJykge1xuICAgIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgICAgcmV0dXJuIChuZXcgQnVmZmVyKHRoaXMpKS5idWZmZXJcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIGJ1ZiA9IG5ldyBVaW50OEFycmF5KHRoaXMubGVuZ3RoKVxuICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IGJ1Zi5sZW5ndGg7IGkgPCBsZW47IGkgKz0gMSkge1xuICAgICAgICBidWZbaV0gPSB0aGlzW2ldXG4gICAgICB9XG4gICAgICByZXR1cm4gYnVmLmJ1ZmZlclxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdCdWZmZXIudG9BcnJheUJ1ZmZlciBub3Qgc3VwcG9ydGVkIGluIHRoaXMgYnJvd3NlcicpXG4gIH1cbn1cblxuLy8gSEVMUEVSIEZVTkNUSU9OU1xuLy8gPT09PT09PT09PT09PT09PVxuXG52YXIgQlAgPSBCdWZmZXIucHJvdG90eXBlXG5cbi8qKlxuICogQXVnbWVudCBhIFVpbnQ4QXJyYXkgKmluc3RhbmNlKiAobm90IHRoZSBVaW50OEFycmF5IGNsYXNzISkgd2l0aCBCdWZmZXIgbWV0aG9kc1xuICovXG5CdWZmZXIuX2F1Z21lbnQgPSBmdW5jdGlvbiBfYXVnbWVudCAoYXJyKSB7XG4gIGFyci5jb25zdHJ1Y3RvciA9IEJ1ZmZlclxuICBhcnIuX2lzQnVmZmVyID0gdHJ1ZVxuXG4gIC8vIHNhdmUgcmVmZXJlbmNlIHRvIG9yaWdpbmFsIFVpbnQ4QXJyYXkgc2V0IG1ldGhvZCBiZWZvcmUgb3ZlcndyaXRpbmdcbiAgYXJyLl9zZXQgPSBhcnIuc2V0XG5cbiAgLy8gZGVwcmVjYXRlZCwgd2lsbCBiZSByZW1vdmVkIGluIG5vZGUgMC4xMytcbiAgYXJyLmdldCA9IEJQLmdldFxuICBhcnIuc2V0ID0gQlAuc2V0XG5cbiAgYXJyLndyaXRlID0gQlAud3JpdGVcbiAgYXJyLnRvU3RyaW5nID0gQlAudG9TdHJpbmdcbiAgYXJyLnRvTG9jYWxlU3RyaW5nID0gQlAudG9TdHJpbmdcbiAgYXJyLnRvSlNPTiA9IEJQLnRvSlNPTlxuICBhcnIuZXF1YWxzID0gQlAuZXF1YWxzXG4gIGFyci5jb21wYXJlID0gQlAuY29tcGFyZVxuICBhcnIuaW5kZXhPZiA9IEJQLmluZGV4T2ZcbiAgYXJyLmNvcHkgPSBCUC5jb3B5XG4gIGFyci5zbGljZSA9IEJQLnNsaWNlXG4gIGFyci5yZWFkVUludExFID0gQlAucmVhZFVJbnRMRVxuICBhcnIucmVhZFVJbnRCRSA9IEJQLnJlYWRVSW50QkVcbiAgYXJyLnJlYWRVSW50OCA9IEJQLnJlYWRVSW50OFxuICBhcnIucmVhZFVJbnQxNkxFID0gQlAucmVhZFVJbnQxNkxFXG4gIGFyci5yZWFkVUludDE2QkUgPSBCUC5yZWFkVUludDE2QkVcbiAgYXJyLnJlYWRVSW50MzJMRSA9IEJQLnJlYWRVSW50MzJMRVxuICBhcnIucmVhZFVJbnQzMkJFID0gQlAucmVhZFVJbnQzMkJFXG4gIGFyci5yZWFkSW50TEUgPSBCUC5yZWFkSW50TEVcbiAgYXJyLnJlYWRJbnRCRSA9IEJQLnJlYWRJbnRCRVxuICBhcnIucmVhZEludDggPSBCUC5yZWFkSW50OFxuICBhcnIucmVhZEludDE2TEUgPSBCUC5yZWFkSW50MTZMRVxuICBhcnIucmVhZEludDE2QkUgPSBCUC5yZWFkSW50MTZCRVxuICBhcnIucmVhZEludDMyTEUgPSBCUC5yZWFkSW50MzJMRVxuICBhcnIucmVhZEludDMyQkUgPSBCUC5yZWFkSW50MzJCRVxuICBhcnIucmVhZEZsb2F0TEUgPSBCUC5yZWFkRmxvYXRMRVxuICBhcnIucmVhZEZsb2F0QkUgPSBCUC5yZWFkRmxvYXRCRVxuICBhcnIucmVhZERvdWJsZUxFID0gQlAucmVhZERvdWJsZUxFXG4gIGFyci5yZWFkRG91YmxlQkUgPSBCUC5yZWFkRG91YmxlQkVcbiAgYXJyLndyaXRlVUludDggPSBCUC53cml0ZVVJbnQ4XG4gIGFyci53cml0ZVVJbnRMRSA9IEJQLndyaXRlVUludExFXG4gIGFyci53cml0ZVVJbnRCRSA9IEJQLndyaXRlVUludEJFXG4gIGFyci53cml0ZVVJbnQxNkxFID0gQlAud3JpdGVVSW50MTZMRVxuICBhcnIud3JpdGVVSW50MTZCRSA9IEJQLndyaXRlVUludDE2QkVcbiAgYXJyLndyaXRlVUludDMyTEUgPSBCUC53cml0ZVVJbnQzMkxFXG4gIGFyci53cml0ZVVJbnQzMkJFID0gQlAud3JpdGVVSW50MzJCRVxuICBhcnIud3JpdGVJbnRMRSA9IEJQLndyaXRlSW50TEVcbiAgYXJyLndyaXRlSW50QkUgPSBCUC53cml0ZUludEJFXG4gIGFyci53cml0ZUludDggPSBCUC53cml0ZUludDhcbiAgYXJyLndyaXRlSW50MTZMRSA9IEJQLndyaXRlSW50MTZMRVxuICBhcnIud3JpdGVJbnQxNkJFID0gQlAud3JpdGVJbnQxNkJFXG4gIGFyci53cml0ZUludDMyTEUgPSBCUC53cml0ZUludDMyTEVcbiAgYXJyLndyaXRlSW50MzJCRSA9IEJQLndyaXRlSW50MzJCRVxuICBhcnIud3JpdGVGbG9hdExFID0gQlAud3JpdGVGbG9hdExFXG4gIGFyci53cml0ZUZsb2F0QkUgPSBCUC53cml0ZUZsb2F0QkVcbiAgYXJyLndyaXRlRG91YmxlTEUgPSBCUC53cml0ZURvdWJsZUxFXG4gIGFyci53cml0ZURvdWJsZUJFID0gQlAud3JpdGVEb3VibGVCRVxuICBhcnIuZmlsbCA9IEJQLmZpbGxcbiAgYXJyLmluc3BlY3QgPSBCUC5pbnNwZWN0XG4gIGFyci50b0FycmF5QnVmZmVyID0gQlAudG9BcnJheUJ1ZmZlclxuXG4gIHJldHVybiBhcnJcbn1cblxudmFyIElOVkFMSURfQkFTRTY0X1JFID0gL1teK1xcLzAtOUEtelxcLV0vZ1xuXG5mdW5jdGlvbiBiYXNlNjRjbGVhbiAoc3RyKSB7XG4gIC8vIE5vZGUgc3RyaXBzIG91dCBpbnZhbGlkIGNoYXJhY3RlcnMgbGlrZSBcXG4gYW5kIFxcdCBmcm9tIHRoZSBzdHJpbmcsIGJhc2U2NC1qcyBkb2VzIG5vdFxuICBzdHIgPSBzdHJpbmd0cmltKHN0cikucmVwbGFjZShJTlZBTElEX0JBU0U2NF9SRSwgJycpXG4gIC8vIE5vZGUgY29udmVydHMgc3RyaW5ncyB3aXRoIGxlbmd0aCA8IDIgdG8gJydcbiAgaWYgKHN0ci5sZW5ndGggPCAyKSByZXR1cm4gJydcbiAgLy8gTm9kZSBhbGxvd3MgZm9yIG5vbi1wYWRkZWQgYmFzZTY0IHN0cmluZ3MgKG1pc3NpbmcgdHJhaWxpbmcgPT09KSwgYmFzZTY0LWpzIGRvZXMgbm90XG4gIHdoaWxlIChzdHIubGVuZ3RoICUgNCAhPT0gMCkge1xuICAgIHN0ciA9IHN0ciArICc9J1xuICB9XG4gIHJldHVybiBzdHJcbn1cblxuZnVuY3Rpb24gc3RyaW5ndHJpbSAoc3RyKSB7XG4gIGlmIChzdHIudHJpbSkgcmV0dXJuIHN0ci50cmltKClcbiAgcmV0dXJuIHN0ci5yZXBsYWNlKC9eXFxzK3xcXHMrJC9nLCAnJylcbn1cblxuZnVuY3Rpb24gdG9IZXggKG4pIHtcbiAgaWYgKG4gPCAxNikgcmV0dXJuICcwJyArIG4udG9TdHJpbmcoMTYpXG4gIHJldHVybiBuLnRvU3RyaW5nKDE2KVxufVxuXG5mdW5jdGlvbiB1dGY4VG9CeXRlcyAoc3RyaW5nLCB1bml0cykge1xuICB1bml0cyA9IHVuaXRzIHx8IEluZmluaXR5XG4gIHZhciBjb2RlUG9pbnRcbiAgdmFyIGxlbmd0aCA9IHN0cmluZy5sZW5ndGhcbiAgdmFyIGxlYWRTdXJyb2dhdGUgPSBudWxsXG4gIHZhciBieXRlcyA9IFtdXG4gIHZhciBpID0gMFxuXG4gIGZvciAoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICBjb2RlUG9pbnQgPSBzdHJpbmcuY2hhckNvZGVBdChpKVxuXG4gICAgLy8gaXMgc3Vycm9nYXRlIGNvbXBvbmVudFxuICAgIGlmIChjb2RlUG9pbnQgPiAweEQ3RkYgJiYgY29kZVBvaW50IDwgMHhFMDAwKSB7XG4gICAgICAvLyBsYXN0IGNoYXIgd2FzIGEgbGVhZFxuICAgICAgaWYgKGxlYWRTdXJyb2dhdGUpIHtcbiAgICAgICAgLy8gMiBsZWFkcyBpbiBhIHJvd1xuICAgICAgICBpZiAoY29kZVBvaW50IDwgMHhEQzAwKSB7XG4gICAgICAgICAgaWYgKCh1bml0cyAtPSAzKSA+IC0xKSBieXRlcy5wdXNoKDB4RUYsIDB4QkYsIDB4QkQpXG4gICAgICAgICAgbGVhZFN1cnJvZ2F0ZSA9IGNvZGVQb2ludFxuICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gdmFsaWQgc3Vycm9nYXRlIHBhaXJcbiAgICAgICAgICBjb2RlUG9pbnQgPSBsZWFkU3Vycm9nYXRlIC0gMHhEODAwIDw8IDEwIHwgY29kZVBvaW50IC0gMHhEQzAwIHwgMHgxMDAwMFxuICAgICAgICAgIGxlYWRTdXJyb2dhdGUgPSBudWxsXG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIG5vIGxlYWQgeWV0XG5cbiAgICAgICAgaWYgKGNvZGVQb2ludCA+IDB4REJGRikge1xuICAgICAgICAgIC8vIHVuZXhwZWN0ZWQgdHJhaWxcbiAgICAgICAgICBpZiAoKHVuaXRzIC09IDMpID4gLTEpIGJ5dGVzLnB1c2goMHhFRiwgMHhCRiwgMHhCRClcbiAgICAgICAgICBjb250aW51ZVxuICAgICAgICB9IGVsc2UgaWYgKGkgKyAxID09PSBsZW5ndGgpIHtcbiAgICAgICAgICAvLyB1bnBhaXJlZCBsZWFkXG4gICAgICAgICAgaWYgKCh1bml0cyAtPSAzKSA+IC0xKSBieXRlcy5wdXNoKDB4RUYsIDB4QkYsIDB4QkQpXG4gICAgICAgICAgY29udGludWVcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyB2YWxpZCBsZWFkXG4gICAgICAgICAgbGVhZFN1cnJvZ2F0ZSA9IGNvZGVQb2ludFxuICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGxlYWRTdXJyb2dhdGUpIHtcbiAgICAgIC8vIHZhbGlkIGJtcCBjaGFyLCBidXQgbGFzdCBjaGFyIHdhcyBhIGxlYWRcbiAgICAgIGlmICgodW5pdHMgLT0gMykgPiAtMSkgYnl0ZXMucHVzaCgweEVGLCAweEJGLCAweEJEKVxuICAgICAgbGVhZFN1cnJvZ2F0ZSA9IG51bGxcbiAgICB9XG5cbiAgICAvLyBlbmNvZGUgdXRmOFxuICAgIGlmIChjb2RlUG9pbnQgPCAweDgwKSB7XG4gICAgICBpZiAoKHVuaXRzIC09IDEpIDwgMCkgYnJlYWtcbiAgICAgIGJ5dGVzLnB1c2goY29kZVBvaW50KVxuICAgIH0gZWxzZSBpZiAoY29kZVBvaW50IDwgMHg4MDApIHtcbiAgICAgIGlmICgodW5pdHMgLT0gMikgPCAwKSBicmVha1xuICAgICAgYnl0ZXMucHVzaChcbiAgICAgICAgY29kZVBvaW50ID4+IDB4NiB8IDB4QzAsXG4gICAgICAgIGNvZGVQb2ludCAmIDB4M0YgfCAweDgwXG4gICAgICApXG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPCAweDEwMDAwKSB7XG4gICAgICBpZiAoKHVuaXRzIC09IDMpIDwgMCkgYnJlYWtcbiAgICAgIGJ5dGVzLnB1c2goXG4gICAgICAgIGNvZGVQb2ludCA+PiAweEMgfCAweEUwLFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHg2ICYgMHgzRiB8IDB4ODAsXG4gICAgICAgIGNvZGVQb2ludCAmIDB4M0YgfCAweDgwXG4gICAgICApXG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPCAweDIwMDAwMCkge1xuICAgICAgaWYgKCh1bml0cyAtPSA0KSA8IDApIGJyZWFrXG4gICAgICBieXRlcy5wdXNoKFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHgxMiB8IDB4RjAsXG4gICAgICAgIGNvZGVQb2ludCA+PiAweEMgJiAweDNGIHwgMHg4MCxcbiAgICAgICAgY29kZVBvaW50ID4+IDB4NiAmIDB4M0YgfCAweDgwLFxuICAgICAgICBjb2RlUG9pbnQgJiAweDNGIHwgMHg4MFxuICAgICAgKVxuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgY29kZSBwb2ludCcpXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGJ5dGVzXG59XG5cbmZ1bmN0aW9uIGFzY2lpVG9CeXRlcyAoc3RyKSB7XG4gIHZhciBieXRlQXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xuICAgIC8vIE5vZGUncyBjb2RlIHNlZW1zIHRvIGJlIGRvaW5nIHRoaXMgYW5kIG5vdCAmIDB4N0YuLlxuICAgIGJ5dGVBcnJheS5wdXNoKHN0ci5jaGFyQ29kZUF0KGkpICYgMHhGRilcbiAgfVxuICByZXR1cm4gYnl0ZUFycmF5XG59XG5cbmZ1bmN0aW9uIHV0ZjE2bGVUb0J5dGVzIChzdHIsIHVuaXRzKSB7XG4gIHZhciBjLCBoaSwgbG9cbiAgdmFyIGJ5dGVBcnJheSA9IFtdXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKCh1bml0cyAtPSAyKSA8IDApIGJyZWFrXG5cbiAgICBjID0gc3RyLmNoYXJDb2RlQXQoaSlcbiAgICBoaSA9IGMgPj4gOFxuICAgIGxvID0gYyAlIDI1NlxuICAgIGJ5dGVBcnJheS5wdXNoKGxvKVxuICAgIGJ5dGVBcnJheS5wdXNoKGhpKVxuICB9XG5cbiAgcmV0dXJuIGJ5dGVBcnJheVxufVxuXG5mdW5jdGlvbiBiYXNlNjRUb0J5dGVzIChzdHIpIHtcbiAgcmV0dXJuIGJhc2U2NC50b0J5dGVBcnJheShiYXNlNjRjbGVhbihzdHIpKVxufVxuXG5mdW5jdGlvbiBibGl0QnVmZmVyIChzcmMsIGRzdCwgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgIGlmICgoaSArIG9mZnNldCA+PSBkc3QubGVuZ3RoKSB8fCAoaSA+PSBzcmMubGVuZ3RoKSkgYnJlYWtcbiAgICBkc3RbaSArIG9mZnNldF0gPSBzcmNbaV1cbiAgfVxuICByZXR1cm4gaVxufVxuXG5mdW5jdGlvbiBkZWNvZGVVdGY4Q2hhciAoc3RyKSB7XG4gIHRyeSB7XG4gICAgcmV0dXJuIGRlY29kZVVSSUNvbXBvbmVudChzdHIpXG4gIH0gY2F0Y2ggKGVycikge1xuICAgIHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlKDB4RkZGRCkgLy8gVVRGIDggaW52YWxpZCBjaGFyXG4gIH1cbn1cbiIsInZhciBsb29rdXAgPSAnQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODkrLyc7XG5cbjsoZnVuY3Rpb24gKGV4cG9ydHMpIHtcblx0J3VzZSBzdHJpY3QnO1xuXG4gIHZhciBBcnIgPSAodHlwZW9mIFVpbnQ4QXJyYXkgIT09ICd1bmRlZmluZWQnKVxuICAgID8gVWludDhBcnJheVxuICAgIDogQXJyYXlcblxuXHR2YXIgUExVUyAgID0gJysnLmNoYXJDb2RlQXQoMClcblx0dmFyIFNMQVNIICA9ICcvJy5jaGFyQ29kZUF0KDApXG5cdHZhciBOVU1CRVIgPSAnMCcuY2hhckNvZGVBdCgwKVxuXHR2YXIgTE9XRVIgID0gJ2EnLmNoYXJDb2RlQXQoMClcblx0dmFyIFVQUEVSICA9ICdBJy5jaGFyQ29kZUF0KDApXG5cdHZhciBQTFVTX1VSTF9TQUZFID0gJy0nLmNoYXJDb2RlQXQoMClcblx0dmFyIFNMQVNIX1VSTF9TQUZFID0gJ18nLmNoYXJDb2RlQXQoMClcblxuXHRmdW5jdGlvbiBkZWNvZGUgKGVsdCkge1xuXHRcdHZhciBjb2RlID0gZWx0LmNoYXJDb2RlQXQoMClcblx0XHRpZiAoY29kZSA9PT0gUExVUyB8fFxuXHRcdCAgICBjb2RlID09PSBQTFVTX1VSTF9TQUZFKVxuXHRcdFx0cmV0dXJuIDYyIC8vICcrJ1xuXHRcdGlmIChjb2RlID09PSBTTEFTSCB8fFxuXHRcdCAgICBjb2RlID09PSBTTEFTSF9VUkxfU0FGRSlcblx0XHRcdHJldHVybiA2MyAvLyAnLydcblx0XHRpZiAoY29kZSA8IE5VTUJFUilcblx0XHRcdHJldHVybiAtMSAvL25vIG1hdGNoXG5cdFx0aWYgKGNvZGUgPCBOVU1CRVIgKyAxMClcblx0XHRcdHJldHVybiBjb2RlIC0gTlVNQkVSICsgMjYgKyAyNlxuXHRcdGlmIChjb2RlIDwgVVBQRVIgKyAyNilcblx0XHRcdHJldHVybiBjb2RlIC0gVVBQRVJcblx0XHRpZiAoY29kZSA8IExPV0VSICsgMjYpXG5cdFx0XHRyZXR1cm4gY29kZSAtIExPV0VSICsgMjZcblx0fVxuXG5cdGZ1bmN0aW9uIGI2NFRvQnl0ZUFycmF5IChiNjQpIHtcblx0XHR2YXIgaSwgaiwgbCwgdG1wLCBwbGFjZUhvbGRlcnMsIGFyclxuXG5cdFx0aWYgKGI2NC5sZW5ndGggJSA0ID4gMCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHN0cmluZy4gTGVuZ3RoIG11c3QgYmUgYSBtdWx0aXBsZSBvZiA0Jylcblx0XHR9XG5cblx0XHQvLyB0aGUgbnVtYmVyIG9mIGVxdWFsIHNpZ25zIChwbGFjZSBob2xkZXJzKVxuXHRcdC8vIGlmIHRoZXJlIGFyZSB0d28gcGxhY2Vob2xkZXJzLCB0aGFuIHRoZSB0d28gY2hhcmFjdGVycyBiZWZvcmUgaXRcblx0XHQvLyByZXByZXNlbnQgb25lIGJ5dGVcblx0XHQvLyBpZiB0aGVyZSBpcyBvbmx5IG9uZSwgdGhlbiB0aGUgdGhyZWUgY2hhcmFjdGVycyBiZWZvcmUgaXQgcmVwcmVzZW50IDIgYnl0ZXNcblx0XHQvLyB0aGlzIGlzIGp1c3QgYSBjaGVhcCBoYWNrIHRvIG5vdCBkbyBpbmRleE9mIHR3aWNlXG5cdFx0dmFyIGxlbiA9IGI2NC5sZW5ndGhcblx0XHRwbGFjZUhvbGRlcnMgPSAnPScgPT09IGI2NC5jaGFyQXQobGVuIC0gMikgPyAyIDogJz0nID09PSBiNjQuY2hhckF0KGxlbiAtIDEpID8gMSA6IDBcblxuXHRcdC8vIGJhc2U2NCBpcyA0LzMgKyB1cCB0byB0d28gY2hhcmFjdGVycyBvZiB0aGUgb3JpZ2luYWwgZGF0YVxuXHRcdGFyciA9IG5ldyBBcnIoYjY0Lmxlbmd0aCAqIDMgLyA0IC0gcGxhY2VIb2xkZXJzKVxuXG5cdFx0Ly8gaWYgdGhlcmUgYXJlIHBsYWNlaG9sZGVycywgb25seSBnZXQgdXAgdG8gdGhlIGxhc3QgY29tcGxldGUgNCBjaGFyc1xuXHRcdGwgPSBwbGFjZUhvbGRlcnMgPiAwID8gYjY0Lmxlbmd0aCAtIDQgOiBiNjQubGVuZ3RoXG5cblx0XHR2YXIgTCA9IDBcblxuXHRcdGZ1bmN0aW9uIHB1c2ggKHYpIHtcblx0XHRcdGFycltMKytdID0gdlxuXHRcdH1cblxuXHRcdGZvciAoaSA9IDAsIGogPSAwOyBpIDwgbDsgaSArPSA0LCBqICs9IDMpIHtcblx0XHRcdHRtcCA9IChkZWNvZGUoYjY0LmNoYXJBdChpKSkgPDwgMTgpIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAxKSkgPDwgMTIpIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAyKSkgPDwgNikgfCBkZWNvZGUoYjY0LmNoYXJBdChpICsgMykpXG5cdFx0XHRwdXNoKCh0bXAgJiAweEZGMDAwMCkgPj4gMTYpXG5cdFx0XHRwdXNoKCh0bXAgJiAweEZGMDApID4+IDgpXG5cdFx0XHRwdXNoKHRtcCAmIDB4RkYpXG5cdFx0fVxuXG5cdFx0aWYgKHBsYWNlSG9sZGVycyA9PT0gMikge1xuXHRcdFx0dG1wID0gKGRlY29kZShiNjQuY2hhckF0KGkpKSA8PCAyKSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMSkpID4+IDQpXG5cdFx0XHRwdXNoKHRtcCAmIDB4RkYpXG5cdFx0fSBlbHNlIGlmIChwbGFjZUhvbGRlcnMgPT09IDEpIHtcblx0XHRcdHRtcCA9IChkZWNvZGUoYjY0LmNoYXJBdChpKSkgPDwgMTApIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAxKSkgPDwgNCkgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDIpKSA+PiAyKVxuXHRcdFx0cHVzaCgodG1wID4+IDgpICYgMHhGRilcblx0XHRcdHB1c2godG1wICYgMHhGRilcblx0XHR9XG5cblx0XHRyZXR1cm4gYXJyXG5cdH1cblxuXHRmdW5jdGlvbiB1aW50OFRvQmFzZTY0ICh1aW50OCkge1xuXHRcdHZhciBpLFxuXHRcdFx0ZXh0cmFCeXRlcyA9IHVpbnQ4Lmxlbmd0aCAlIDMsIC8vIGlmIHdlIGhhdmUgMSBieXRlIGxlZnQsIHBhZCAyIGJ5dGVzXG5cdFx0XHRvdXRwdXQgPSBcIlwiLFxuXHRcdFx0dGVtcCwgbGVuZ3RoXG5cblx0XHRmdW5jdGlvbiBlbmNvZGUgKG51bSkge1xuXHRcdFx0cmV0dXJuIGxvb2t1cC5jaGFyQXQobnVtKVxuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIHRyaXBsZXRUb0Jhc2U2NCAobnVtKSB7XG5cdFx0XHRyZXR1cm4gZW5jb2RlKG51bSA+PiAxOCAmIDB4M0YpICsgZW5jb2RlKG51bSA+PiAxMiAmIDB4M0YpICsgZW5jb2RlKG51bSA+PiA2ICYgMHgzRikgKyBlbmNvZGUobnVtICYgMHgzRilcblx0XHR9XG5cblx0XHQvLyBnbyB0aHJvdWdoIHRoZSBhcnJheSBldmVyeSB0aHJlZSBieXRlcywgd2UnbGwgZGVhbCB3aXRoIHRyYWlsaW5nIHN0dWZmIGxhdGVyXG5cdFx0Zm9yIChpID0gMCwgbGVuZ3RoID0gdWludDgubGVuZ3RoIC0gZXh0cmFCeXRlczsgaSA8IGxlbmd0aDsgaSArPSAzKSB7XG5cdFx0XHR0ZW1wID0gKHVpbnQ4W2ldIDw8IDE2KSArICh1aW50OFtpICsgMV0gPDwgOCkgKyAodWludDhbaSArIDJdKVxuXHRcdFx0b3V0cHV0ICs9IHRyaXBsZXRUb0Jhc2U2NCh0ZW1wKVxuXHRcdH1cblxuXHRcdC8vIHBhZCB0aGUgZW5kIHdpdGggemVyb3MsIGJ1dCBtYWtlIHN1cmUgdG8gbm90IGZvcmdldCB0aGUgZXh0cmEgYnl0ZXNcblx0XHRzd2l0Y2ggKGV4dHJhQnl0ZXMpIHtcblx0XHRcdGNhc2UgMTpcblx0XHRcdFx0dGVtcCA9IHVpbnQ4W3VpbnQ4Lmxlbmd0aCAtIDFdXG5cdFx0XHRcdG91dHB1dCArPSBlbmNvZGUodGVtcCA+PiAyKVxuXHRcdFx0XHRvdXRwdXQgKz0gZW5jb2RlKCh0ZW1wIDw8IDQpICYgMHgzRilcblx0XHRcdFx0b3V0cHV0ICs9ICc9PSdcblx0XHRcdFx0YnJlYWtcblx0XHRcdGNhc2UgMjpcblx0XHRcdFx0dGVtcCA9ICh1aW50OFt1aW50OC5sZW5ndGggLSAyXSA8PCA4KSArICh1aW50OFt1aW50OC5sZW5ndGggLSAxXSlcblx0XHRcdFx0b3V0cHV0ICs9IGVuY29kZSh0ZW1wID4+IDEwKVxuXHRcdFx0XHRvdXRwdXQgKz0gZW5jb2RlKCh0ZW1wID4+IDQpICYgMHgzRilcblx0XHRcdFx0b3V0cHV0ICs9IGVuY29kZSgodGVtcCA8PCAyKSAmIDB4M0YpXG5cdFx0XHRcdG91dHB1dCArPSAnPSdcblx0XHRcdFx0YnJlYWtcblx0XHR9XG5cblx0XHRyZXR1cm4gb3V0cHV0XG5cdH1cblxuXHRleHBvcnRzLnRvQnl0ZUFycmF5ID0gYjY0VG9CeXRlQXJyYXlcblx0ZXhwb3J0cy5mcm9tQnl0ZUFycmF5ID0gdWludDhUb0Jhc2U2NFxufSh0eXBlb2YgZXhwb3J0cyA9PT0gJ3VuZGVmaW5lZCcgPyAodGhpcy5iYXNlNjRqcyA9IHt9KSA6IGV4cG9ydHMpKVxuIiwiZXhwb3J0cy5yZWFkID0gZnVuY3Rpb24gKGJ1ZmZlciwgb2Zmc2V0LCBpc0xFLCBtTGVuLCBuQnl0ZXMpIHtcbiAgdmFyIGUsIG1cbiAgdmFyIGVMZW4gPSBuQnl0ZXMgKiA4IC0gbUxlbiAtIDFcbiAgdmFyIGVNYXggPSAoMSA8PCBlTGVuKSAtIDFcbiAgdmFyIGVCaWFzID0gZU1heCA+PiAxXG4gIHZhciBuQml0cyA9IC03XG4gIHZhciBpID0gaXNMRSA/IChuQnl0ZXMgLSAxKSA6IDBcbiAgdmFyIGQgPSBpc0xFID8gLTEgOiAxXG4gIHZhciBzID0gYnVmZmVyW29mZnNldCArIGldXG5cbiAgaSArPSBkXG5cbiAgZSA9IHMgJiAoKDEgPDwgKC1uQml0cykpIC0gMSlcbiAgcyA+Pj0gKC1uQml0cylcbiAgbkJpdHMgKz0gZUxlblxuICBmb3IgKDsgbkJpdHMgPiAwOyBlID0gZSAqIDI1NiArIGJ1ZmZlcltvZmZzZXQgKyBpXSwgaSArPSBkLCBuQml0cyAtPSA4KSB7fVxuXG4gIG0gPSBlICYgKCgxIDw8ICgtbkJpdHMpKSAtIDEpXG4gIGUgPj49ICgtbkJpdHMpXG4gIG5CaXRzICs9IG1MZW5cbiAgZm9yICg7IG5CaXRzID4gMDsgbSA9IG0gKiAyNTYgKyBidWZmZXJbb2Zmc2V0ICsgaV0sIGkgKz0gZCwgbkJpdHMgLT0gOCkge31cblxuICBpZiAoZSA9PT0gMCkge1xuICAgIGUgPSAxIC0gZUJpYXNcbiAgfSBlbHNlIGlmIChlID09PSBlTWF4KSB7XG4gICAgcmV0dXJuIG0gPyBOYU4gOiAoKHMgPyAtMSA6IDEpICogSW5maW5pdHkpXG4gIH0gZWxzZSB7XG4gICAgbSA9IG0gKyBNYXRoLnBvdygyLCBtTGVuKVxuICAgIGUgPSBlIC0gZUJpYXNcbiAgfVxuICByZXR1cm4gKHMgPyAtMSA6IDEpICogbSAqIE1hdGgucG93KDIsIGUgLSBtTGVuKVxufVxuXG5leHBvcnRzLndyaXRlID0gZnVuY3Rpb24gKGJ1ZmZlciwgdmFsdWUsIG9mZnNldCwgaXNMRSwgbUxlbiwgbkJ5dGVzKSB7XG4gIHZhciBlLCBtLCBjXG4gIHZhciBlTGVuID0gbkJ5dGVzICogOCAtIG1MZW4gLSAxXG4gIHZhciBlTWF4ID0gKDEgPDwgZUxlbikgLSAxXG4gIHZhciBlQmlhcyA9IGVNYXggPj4gMVxuICB2YXIgcnQgPSAobUxlbiA9PT0gMjMgPyBNYXRoLnBvdygyLCAtMjQpIC0gTWF0aC5wb3coMiwgLTc3KSA6IDApXG4gIHZhciBpID0gaXNMRSA/IDAgOiAobkJ5dGVzIC0gMSlcbiAgdmFyIGQgPSBpc0xFID8gMSA6IC0xXG4gIHZhciBzID0gdmFsdWUgPCAwIHx8ICh2YWx1ZSA9PT0gMCAmJiAxIC8gdmFsdWUgPCAwKSA/IDEgOiAwXG5cbiAgdmFsdWUgPSBNYXRoLmFicyh2YWx1ZSlcblxuICBpZiAoaXNOYU4odmFsdWUpIHx8IHZhbHVlID09PSBJbmZpbml0eSkge1xuICAgIG0gPSBpc05hTih2YWx1ZSkgPyAxIDogMFxuICAgIGUgPSBlTWF4XG4gIH0gZWxzZSB7XG4gICAgZSA9IE1hdGguZmxvb3IoTWF0aC5sb2codmFsdWUpIC8gTWF0aC5MTjIpXG4gICAgaWYgKHZhbHVlICogKGMgPSBNYXRoLnBvdygyLCAtZSkpIDwgMSkge1xuICAgICAgZS0tXG4gICAgICBjICo9IDJcbiAgICB9XG4gICAgaWYgKGUgKyBlQmlhcyA+PSAxKSB7XG4gICAgICB2YWx1ZSArPSBydCAvIGNcbiAgICB9IGVsc2Uge1xuICAgICAgdmFsdWUgKz0gcnQgKiBNYXRoLnBvdygyLCAxIC0gZUJpYXMpXG4gICAgfVxuICAgIGlmICh2YWx1ZSAqIGMgPj0gMikge1xuICAgICAgZSsrXG4gICAgICBjIC89IDJcbiAgICB9XG5cbiAgICBpZiAoZSArIGVCaWFzID49IGVNYXgpIHtcbiAgICAgIG0gPSAwXG4gICAgICBlID0gZU1heFxuICAgIH0gZWxzZSBpZiAoZSArIGVCaWFzID49IDEpIHtcbiAgICAgIG0gPSAodmFsdWUgKiBjIC0gMSkgKiBNYXRoLnBvdygyLCBtTGVuKVxuICAgICAgZSA9IGUgKyBlQmlhc1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gdmFsdWUgKiBNYXRoLnBvdygyLCBlQmlhcyAtIDEpICogTWF0aC5wb3coMiwgbUxlbilcbiAgICAgIGUgPSAwXG4gICAgfVxuICB9XG5cbiAgZm9yICg7IG1MZW4gPj0gODsgYnVmZmVyW29mZnNldCArIGldID0gbSAmIDB4ZmYsIGkgKz0gZCwgbSAvPSAyNTYsIG1MZW4gLT0gOCkge31cblxuICBlID0gKGUgPDwgbUxlbikgfCBtXG4gIGVMZW4gKz0gbUxlblxuICBmb3IgKDsgZUxlbiA+IDA7IGJ1ZmZlcltvZmZzZXQgKyBpXSA9IGUgJiAweGZmLCBpICs9IGQsIGUgLz0gMjU2LCBlTGVuIC09IDgpIHt9XG5cbiAgYnVmZmVyW29mZnNldCArIGkgLSBkXSB8PSBzICogMTI4XG59XG4iLCJcbi8qKlxuICogaXNBcnJheVxuICovXG5cbnZhciBpc0FycmF5ID0gQXJyYXkuaXNBcnJheTtcblxuLyoqXG4gKiB0b1N0cmluZ1xuICovXG5cbnZhciBzdHIgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nO1xuXG4vKipcbiAqIFdoZXRoZXIgb3Igbm90IHRoZSBnaXZlbiBgdmFsYFxuICogaXMgYW4gYXJyYXkuXG4gKlxuICogZXhhbXBsZTpcbiAqXG4gKiAgICAgICAgaXNBcnJheShbXSk7XG4gKiAgICAgICAgLy8gPiB0cnVlXG4gKiAgICAgICAgaXNBcnJheShhcmd1bWVudHMpO1xuICogICAgICAgIC8vID4gZmFsc2VcbiAqICAgICAgICBpc0FycmF5KCcnKTtcbiAqICAgICAgICAvLyA+IGZhbHNlXG4gKlxuICogQHBhcmFtIHttaXhlZH0gdmFsXG4gKiBAcmV0dXJuIHtib29sfVxuICovXG5cbm1vZHVsZS5leHBvcnRzID0gaXNBcnJheSB8fCBmdW5jdGlvbiAodmFsKSB7XG4gIHJldHVybiAhISB2YWwgJiYgJ1tvYmplY3QgQXJyYXldJyA9PSBzdHIuY2FsbCh2YWwpO1xufTtcbiIsIi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxuXG52YXIgcHJvY2VzcyA9IG1vZHVsZS5leHBvcnRzID0ge307XG52YXIgcXVldWUgPSBbXTtcbnZhciBkcmFpbmluZyA9IGZhbHNlO1xudmFyIGN1cnJlbnRRdWV1ZTtcbnZhciBxdWV1ZUluZGV4ID0gLTE7XG5cbmZ1bmN0aW9uIGNsZWFuVXBOZXh0VGljaygpIHtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGlmIChjdXJyZW50UXVldWUubGVuZ3RoKSB7XG4gICAgICAgIHF1ZXVlID0gY3VycmVudFF1ZXVlLmNvbmNhdChxdWV1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgIH1cbiAgICBpZiAocXVldWUubGVuZ3RoKSB7XG4gICAgICAgIGRyYWluUXVldWUoKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRyYWluUXVldWUoKSB7XG4gICAgaWYgKGRyYWluaW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIHRpbWVvdXQgPSBzZXRUaW1lb3V0KGNsZWFuVXBOZXh0VGljayk7XG4gICAgZHJhaW5pbmcgPSB0cnVlO1xuXG4gICAgdmFyIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB3aGlsZShsZW4pIHtcbiAgICAgICAgY3VycmVudFF1ZXVlID0gcXVldWU7XG4gICAgICAgIHF1ZXVlID0gW107XG4gICAgICAgIHdoaWxlICgrK3F1ZXVlSW5kZXggPCBsZW4pIHtcbiAgICAgICAgICAgIGN1cnJlbnRRdWV1ZVtxdWV1ZUluZGV4XS5ydW4oKTtcbiAgICAgICAgfVxuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgICAgIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB9XG4gICAgY3VycmVudFF1ZXVlID0gbnVsbDtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGNsZWFyVGltZW91dCh0aW1lb3V0KTtcbn1cblxucHJvY2Vzcy5uZXh0VGljayA9IGZ1bmN0aW9uIChmdW4pIHtcbiAgICB2YXIgYXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoIC0gMSk7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBxdWV1ZS5wdXNoKG5ldyBJdGVtKGZ1biwgYXJncykpO1xuICAgIGlmIChxdWV1ZS5sZW5ndGggPT09IDEgJiYgIWRyYWluaW5nKSB7XG4gICAgICAgIHNldFRpbWVvdXQoZHJhaW5RdWV1ZSwgMCk7XG4gICAgfVxufTtcblxuLy8gdjggbGlrZXMgcHJlZGljdGlibGUgb2JqZWN0c1xuZnVuY3Rpb24gSXRlbShmdW4sIGFycmF5KSB7XG4gICAgdGhpcy5mdW4gPSBmdW47XG4gICAgdGhpcy5hcnJheSA9IGFycmF5O1xufVxuSXRlbS5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuZnVuLmFwcGx5KG51bGwsIHRoaXMuYXJyYXkpO1xufTtcbnByb2Nlc3MudGl0bGUgPSAnYnJvd3Nlcic7XG5wcm9jZXNzLmJyb3dzZXIgPSB0cnVlO1xucHJvY2Vzcy5lbnYgPSB7fTtcbnByb2Nlc3MuYXJndiA9IFtdO1xucHJvY2Vzcy52ZXJzaW9uID0gJyc7IC8vIGVtcHR5IHN0cmluZyB0byBhdm9pZCByZWdleHAgaXNzdWVzXG5wcm9jZXNzLnZlcnNpb25zID0ge307XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuXG4vLyBUT0RPKHNodHlsbWFuKVxucHJvY2Vzcy5jd2QgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnLycgfTtcbnByb2Nlc3MuY2hkaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmNoZGlyIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5wcm9jZXNzLnVtYXNrID0gZnVuY3Rpb24oKSB7IHJldHVybiAwOyB9O1xuIl19
