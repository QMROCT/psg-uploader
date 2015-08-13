import Reader from 'views/FileReaderView';
import Uploader from 'views/UploaderView';
import PseudonymView from 'views/PseudonymView';
import FileManagerView from 'views/FileManagerView';
import 'util/jquery.ajax.progress';

$(function() {
   window.app = {};
   app.vent = _.extend({}, Backbone.Events);

   app.reader = new Reader({
      el: $('.file-reader')
   });

   app.vent.once('File:loaded', (model) => {

      let collection = model.collection;

      app.pseudonyms = new PseudonymView({
         collection,
         el: $('.pseudonym-list'),
         tableContainer: $('.pseudonym-row')
      });

      app.files = new FileManagerView({
         collection,
         el: $('.file-manager')
      });

      // TODO meh … should have its own view
      collection.on('change:state', () => {
         let hasActiveItems = !!collection.filter(m => m.get('state') === 1).length;
         $('.btn-use-files').attr('disabled', !hasActiveItems);
      });

      $('.btn-use-files').on('click', () => {
         app.uploader = new Uploader({
            collection,
            el: $('.uploader')
         });

         $('.uploader').removeClass('hidden');
         $('.files-to-upload .panel-footer').addClass('hidden');
      });

      // slide to the side animation
      app.reader.$el.removeClass('col-md-offset-4');
      _.delay(() => $('.main-column').removeClass('hidden'), 500);

   });

   // app.vent.once('XNAT:file_uploaded', (/*name*/) => {
   //    $('.overlay').removeClass('hidden');
   // });

});
