import FileCollection from 'models/FileCollection';
import Progress from 'util/Progress';
import 'util/zip'; // http://gildas-lormeau.github.io/zip.js/core-api.html
import 'util/zip-ext';

window.zip.workerScriptsPath = 'assets/js/zip/';

export default Backbone.View.extend({

   collection: new FileCollection(),

   events: {
      'drop': 'handleFiles',
      'change input[type="file"]': 'handleFiles',
      'click .droparea button': 'delegateClick',
      'change .panel-body input': 'changePseudonym',
      'click .btn-download': 'download'
   },

   initialize() {
      _.bindAll(this, 'handleFiles', 'loadItems', 'readFile', 'bufferToModel', 'handleZipFile');
      this.$fileInput = this.$('input[type="file"]');

      // this.model.on('change:pseudonym', (model, newPseudonym) => {
      //    this.$('.panel-footer').toggleClass('hidden', !newPseudonym.length);
      // });

      // Prevent the default action when a file is dropped
      // on the window i.e. redirecting to that file
      $(document).on('drop dragover', function(event) {
         event.preventDefault();
      });
   },

   delegateClick(event) {
      event.preventDefault();
      this.$fileInput.click().blur();
   },

   handleFiles($event) {
      let oe = $event.originalEvent;
      let items = oe.dataTransfer.items || oe.dataTransfer.files;
      this.loadItems(items);
   },

   loadItems(items) {
      let entry = {};
      _.each(items, item => {
         if (item.type === 'application/zip' && _.isFunction(item.getAsFile)) {
            return this.handleZipFile(item.getAsFile());
         }
         else if (item.isFile || item.isDirectory) {
            entry = item;
         }
         else if (item.getAsEntry) {
            entry = item.getAsEntry();
         }
         else if (item.webkitGetAsEntry) {
            entry = item.webkitGetAsEntry();
         }
         else if (_.isFunction(item.getAsFile)) {
            return this.readFile(item.getAsFile());
         }
         else if (File && item instanceof File) {
            return this.readFile(item);
         }
         else {
            return null;
         }

         if (entry.isFile) {
            entry.file(
               file => this.readFile(file),
               err => console.warn(err)
            );
         }
         else if (entry.isDirectory) {
            entry.createReader().readEntries(
               entries => this.loadItems(entries),
               err => console.warn(err)
            );
         }
      });
   },

   // From: http://www.html5rocks.com/en/tutorials/file/dndfiles/
   // TODO: Error handling (see link above)
   readFile(file) {
      let reader = new FileReader();
      let progress = new Progress();
      this.$el.append(progress.el);

      reader.onprogress = (event) => {
         if (!event.lengthComputable) { return; } // if event is not a ProgressEvent
         progress.update(event.loaded / event.total * 100);
      };

      reader.onload = (/*event*/) => {
         this.bufferToModel(reader.result, file);
         progress.remove();
      };

      reader.onerror = () => console.log('reader - onerror');
      reader.onabort = () => console.log('reader - onabort');
      reader.onloadstart = () => console.log('reader - onloadstart');

      reader.readAsArrayBuffer(file);
   },

   bufferToModel(buffer, metaData) {
      let model = this.collection.create({
         updated_at: metaData.lastModified,
         name: metaData.name,
         size: metaData.size,
         type: metaData.type,
         content: new Int8Array(buffer)
      });
      model.setPatientName();
      app.vent.trigger('File:loaded', model);
   },

   handleZipFile(file) {
      let zipBuffer = new window.zip.ArrayBufferWriter();
      let blobReader = new window.zip.BlobReader(file);
      window.zip.createReader(blobReader,
         // success
         (zipReader) => zipReader.getEntries(
            (entries = []) => entries.forEach(
               (entry) => {
                  if (entry.directory) { return; }
                  entry.getData(zipBuffer,
                     (buffer) => {
                        let metaData = {
                           lastModified: entry.lastModDateRaw,
                           name: entry.filename,
                           size: entry.uncompressedSize,
                           type: 'unknown'
                        };
                        this.bufferToModel(buffer, metaData);
                     }
                  );
               }
            )
         ),
         // error
         (message) => console.error('Error reading zip:', message)
      );
   }

});
