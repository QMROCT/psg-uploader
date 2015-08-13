// Add XHR2 upload and download progress events to jQuery.ajax
// From https://gist.github.com/nebirhos/3892018
var originalXhr = $.ajaxSettings.xhr;
$.ajaxSetup({
   xhr() {
      var request = originalXhr();
      if (request) {
         if (typeof request.addEventListener === 'function' && this.progress !== undefined) {
            request.addEventListener('progress', (evt) => this.progress(evt), false);
         }
         if (typeof request.upload === 'object' && this.progressUpload !== undefined) {
            request.upload.addEventListener('progress', (evt) => this.progressUpload(evt), false);
         }
      }
      return request;
   }
});
