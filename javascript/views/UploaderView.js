import config from 'config';
import xnatAPI from 'XnatAPI';
import Progress from 'util/Progress';
import getQueryVariable from 'util/getQueryVariable';

export default Backbone.View.extend({

   template_projects: _.template('<% _.each(models, function(m) { %> <option value="<%= m.id %>"><%= m.name %></option> <% }); %>'),
   template_users: _.template('<% _.each(users, function(user, key) { %> <option value="<%= key %>"><%= key %></option> <% }); %>'),

   events: {
      'change select[name="user"]': 'changeUser',
      'click .btn-show-settings': 'showSettings',
      'click .btn-login': 'login',
      'click .btn-check': 'check',
      'click .btn-upload': 'initUpload'
   },

   initialize() {
      _.bindAll(this, 'setCurrentModel', 'login', 'check', 'initUpload', 'createSubject', 'createSession', 'createScan', 'upload', 'startPipeline');
      this.xnat = xnatAPI(config.XNAT_URL);

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

      this.$select_user.append(this.template_users({ users: config.users }));

      let user = getQueryVariable('user');
      if (!user || !config.users[user]) user = localStorage.getItem('user'); // eslint-disable-line curly
      if (!user || !config.users[user]) user = config.defaultUser; // eslint-disable-line curly

      this.$select_user.val(user);
      this.changeUser(user);
   },

   setCurrentModel() {
      if (this.currentModel) {
         this.currentModel.set({
            content: null,
            state: -1 // done
         });
         var projectid = this.currentModel.get('projectid');
         var subjectid = this.currentModel.get('subjectid');
         var sessionid = this.currentModel.get('sessionid');
      }

      let onPseudonymChange = (model, newValue) => {
         let timestamped = newValue + '_' + Date.now();
         this.$('.uploader-session-scan input[name="file"]').val(timestamped);
         this.$('.uploader-session-scan input[name="session"]').val(newValue);
         this.$('.uploader-session-scan input[name="scan"]').val(timestamped);
      };

      let newCurrentModel = this.collection.filter(model => model.get('state') === 1)[0];
      if (!newCurrentModel) { return false; }
      newCurrentModel.set({
         state: 2, // current
         projectid,
         subjectid,
         sessionid
      });
      newCurrentModel.on('change:pseudonym', onPseudonymChange);
      onPseudonymChange(newCurrentModel, newCurrentModel.get('pseudonym'));
      this.currentModel = newCurrentModel;
      return true;
   },

   changeUser() {
      let userName = this.$select_user.val();
      let userData = config.users[userName];
      localStorage.setItem('user', userName);
      this.setCredentials(userData);
      this.currentModel.set('projectid', userData.project);
      this.login();
   },

   setCredentials(user) {
      this.$('.uploader-login input[name="username"]').val(user.username);
      this.$('.uploader-login input[name="password"]').val(user.password);
   },

   showSettings() {
      this.$('.upload-details').removeClass('hidden');
      this.$('.btn-show-settings').parent().remove();
   },

   login() {
      this.$btn_login.html('<i class="fa fa-spinner"></i>');

      let username = this.$('.uploader-login input[name="username"]').val();
      let password = this.$('.uploader-login input[name="password"]').val();

      let successCallback = (/*sessionid*/) => {
         this.$btn_login.html('<i class="fa fa-check"></i>').addClass('btn-success');
         this.showProjects();
         this.$btn_upload.prop('disabled', false);
      };

      let errorCallback = () => {
         this.showSettings(); // show details
         this.$btn_login.html('<i class="fa fa-warning"></i>').addClass('btn-danger');
         _.delay(() => {
            this.$btn_login.html('Login').removeClass('btn-danger btn-success');
         }, 2000);
         this.$select_project.empty();
      };

      this.xnat.login(username, password, successCallback, errorCallback);
   },

   check() {
      let projectid = $('.uploader-projects select').val();
      let project = this.xnat.getProjects().get(projectid);

      this.currentModel.set('projectid', project.get('id'));

      let data = this.last_checked_data = {
         project: projectid,
         subject: '',
         session: '',
         scan: ''
      };

      let queue = [{
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

      let final = () => {
         console.log('final');
         let html = _.map(data, (value, key) => {
            let msg = data[key] ? `already exists (${value})` : 'has to be created';
            return `<p class="lead"><strong>${key}</strong> ${msg}</p>`;
         }).join('');

         $('.uploader-check')
            .find('.uploader-check-output')
            .removeClass('hidden')
            .html(html);
      };

      let fetch = () => {
         let currentStep = queue.shift();
         console.log('fetch', currentStep);
         this.xnat.fetch(currentStep.name, data, {
            success(collection) {
               console.log('success', currentStep.name);
               let model = collection.findWhere(currentStep.condition);
               console.log('model', model);
               if (model) { // eslint-disable-line curly
                  data[currentStep.name] = model.get('id');
                  if (queue.length) fetch(queue); // eslint-disable-line curly
                  else final();
               }
               else final();
            }
         });
      };

      fetch();
   },

   initUpload() {
      this.currentModel.set('investigator', $('.uploader input[name="investigator"]').val());
      this.currentModel.set('diagnose', $('.uploader input[name="diagnose"]').val());

      if (this.currentModel.get('state') === -1 && !this.setCurrentModel()) {
         return null;
      }

      this.createSubject()
         .then(this.createSession)
         .then(this.createScan)
         .then(this.upload)
         .then(this.startPipeline)
         .catch(err => console.error(err))
         .then(this.setCurrentModel)
         .then(hasModel =>
            hasModel ? this.initUpload() : console.log('Upload finished'));
   },

   // --- HELPER ---

   showProjects() {
      let success = collection => {
         console.log('SUCCESS');
         this.$select_project.html(this.template_projects({
            models: collection.toJSON()
         }));
         this.$('.uploader-projects, .uploader-session-scan').removeClass('hidden');
         this.$select_project.val(this.currentModel.get('projectid')); // select current project
         this.$panel_footer.removeClass('hidden');
      };

      let error = () => this.$select_project.empty();

      this.xnat.getProjects({ success, error });
   },

   createSubject() {
      return new Promise(resolve => {
         if (this.currentModel.has('subjectid')) {
            resolve();
         } else {
            let subject_name = $('input[name="pseudonym"]').val();
            this.xnat.createSubject(subject_name, this.currentModel, (subjectid) => {
               this.currentModel.set('subjectid', subjectid);
               resolve();
            });
         }
      });
   },

   createSession() {
      return new Promise(resolve => {
         if (this.currentModel.has('sessionid')) {
            resolve();
         } else {
            let session_name = this.$('.uploader-session-scan input[name="session"]').val();
            this.xnat.createSession(session_name, this.currentModel, (sessionid) => {
               this.currentModel.set('sessionid', sessionid);
               resolve();
            });
         }
      });
   },

   createScan() {
      return new Promise(resolve => {
         if (this.currentModel.has('scanid')) {
            resolve();
         } else {
            let scan_name = this.$('.uploader-session-scan input[name="scan"]').val();

            this.xnat.createScan(scan_name, this.currentModel, () => {
               this.currentModel.set('scanid', scan_name);

               this.xnat.createResource('EDF', this.currentModel, () => {
                  this.currentModel.set('resourceid', 'EDF');
                  resolve();
               });
            });
         }
      });
   },

   upload() {
      console.log('upload', this.currentModel.get('content').byteLength);

      let filename = this.$('.uploader-session-scan input[name="file"]').val();
      if (filename) { this.currentModel.set('name', filename); }

      let progress = new Progress();
      $('.uploader-check').addClass('hidden');
      this.$panel_footer.append(progress.el);
      this.$btn_check.html('<i class="fa fa-spinner"></i>');

      return new Promise(resolve => {
         this.xnat.upload(this.currentModel, progress, () => {
            this.$btn_check.html('<i class="fa fa-check"></i>');
            this.$btn_upload.prop('disabled', true);
            progress.remove();
            resolve();
         });
      });
   },

   startPipeline() {
      return new Promise(resolve => {
         this.xnat.startPipeline(this.currentModel, resolve);
      });
   }

});
