/*eslint key-spacing:0 no-multi-spaces:0*/
import { Collection } from 'models/XnatModel';

export default function(host) {

   var templates = {};
   templates.project  = host              + '/REST/projects/<%= project %>';
   templates.subject  = templates.project + '/subjects/<%= subject %>';
   templates.session  = templates.subject + '/experiments/<%= session %>';
   templates.scan     = templates.session + '/scans/<%= scan %>';
   templates.resource = templates.scan    + '/resources/<%= resource %>';

   templates.create = {
      subject:  templates.subject  + '?group=<%= diagnose %>&src=<%= investigator %>',
      session:  templates.session  + '?snet01:SleepResearchSessionData/date=<%= date %>',
      scan:     templates.scan     + '?xsiType=snet01:psgScanData',
      resource: templates.resource + '?format=<%= format %>',
      file:     templates.resource + '/files/<%= name %>_<%= timestamp %>.edf'
   };

   var projects;
   var timestamp = ~~(Date.now() / 1000);

   // see https://wiki.xnat.org/pages/viewpage.action?pageId=6226264
   // GET instead of POST because … yeah … otherwise it doesn't work
   var login = function(username, password, success, fail) {
      $.ajax({
         url: host + '/data/JSESSION',
         type: 'GET',
         beforeSend: function(xhr) {
            xhr.setRequestHeader('Authorization', 'Basic ' + btoa(username + ':' + password));
         }
      }).done(success).fail(fail);
   };

   var fetchProjects = function(options) {
      if (!projects) {
         projects = new Collection({ host, url: host + '/REST/projects'});
      }
      return projects.fetch(options);
   };

   var getProjects = function(options) {
      return projects || fetchProjects(options);
   };

   var fetch = function(name, data, options) {
      console.log('XnatAPI - fetch', name, data, options);

      var template = _.template(templates[name])(data);

      var collection = new Collection({ host, url: template });

      collection.fetch(options);

      return collection;
   };

   // ----------------------------------------------------

   var createSubject = function(name, model, callback) {
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
      }).done(function(subjectid) {
         console.log('subject_created', subjectid);
         app.vent.trigger('XNAT:subject_created', subjectid);
         callback(subjectid);
      }).fail(function(error) {
         console.log('subject_failed', error);
      });
   };

   var createSession = function(name, model, callback) {
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
      }).done(function(sessionid) {
         console.log('session_created', sessionid);
         app.vent.trigger('XNAT:session_created', sessionid);
         callback(sessionid);
      }).fail(function(error) {
         console.log('session_failed', error);
      });
   };

   var createScan = function(name, model, callback) {
      var data = {
         project: model.get('projectid'),
         subject: model.get('subjectid'),
         session: model.get('sessionid'),
         scan: name
      };

      $.ajax({
         url: _.template(templates.create.scan)(data),
         type: 'PUT'
      }).done(function() {
         console.log('scan_created', name);
         app.vent.trigger('XNAT:scan_created', name);
         callback(name);
      }).fail(function(error) {
         console.log('scan_failed', error);
      });
   };

   var createResource = function(name, model, callback) {
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
      }).done(function() {
         console.log('resource_created');
         app.vent.trigger('XNAT:resource_created', name);
         callback(name);
      }).fail(function(error) {
         console.log('resource_failed', error);
      });
   };

   //TODO
   var upload = function(model, progress, callback) {

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
         progressUpload: function(event) {
            if (event.lengthComputable) {
               progress.update(event.loaded / event.total * 100);
            }
         }
      }).done(function() {
         console.log('Upload completed.', data);
         app.vent.trigger('XNAT:file_uploaded', model.get('name'));
         callback();
      }).fail(function(/*data*/) {
         console.log('upload failed', model.get('name'));
      });
   };

   var startPipeline = (model, callback) => {
      var template = (data) => {
         return `param[0].name=scanids
            &param[0][0].value=${data.pseudonym}
            &param[0].name.rowcount=1
            &param[1].name=project
            &param[1][0].value=${data.projectid}
            &param[1].name.rowcount=1
            &param[2].name=subject
            &param[2][0].value=${data.subjectid}
            &param[2].name.rowcount=1
            &param[3].name=xnat_id
            &param[3][0].value=${data.sessionid}
            &param[3].name.rowcount=1
            &param[4].name=sessionId
            &param[4][0].value=${data.name}
            &param[4].name.rowcount=1
            &param[5].name=notify
            &param[5][0].value=0
            &param[5].name.rowcount=1
            &eventSubmit_doLaunchpipeline=Submit
            &schema_type=snet01%3AsleepResearchSessionData
            &param_cnt=6
            &pipeline_path=%2Fopt%2Fxnat%2Fpipeline%2Fcatalog%2Fsomnonetz_pipelines%2FedfMetadataExtractor.xml
            &search_element=snet01%3AsleepResearchSessionData
            &search_field=snet01%3AsleepResearchSessionData.ID
            &search_value=${data.sessionid}
            &project=somnonetz`.replace(/\s/g, '');
      };

      $.ajax({
         url: `${host}/app/action/ManagePipeline`,
         type: 'POST',
         data: decodeURI(template(model.attributes))
      }).done(function() {
         console.log('Pipeline started.');
         app.vent.trigger('XNAT:pipeline_started', model.get('name'));
         callback();
      }).fail(function(/*data*/) {
         console.log('upload failed', model.get('name'));
      });
   };

   // Interface
   return {
      login,
      getProjects,
      fetch,
      createSubject,
      createSession,
      createScan,
      createResource,
      upload,
      startPipeline
   };

}
