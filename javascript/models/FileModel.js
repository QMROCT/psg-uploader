import config from 'config';
import FileSaver from 'util/FileSaver';
import sizeFormatter from 'util/sizeFormatter';

export default Backbone.Model.extend({

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

   initialize(/*attributes*/) {
      this.on('change:name', () => this.setTransformer());
      this.on('change:pseudonym', () => this.pseudonymize());
      this.on('change:size', () => this.updateFormattedSize());

      this.setTransformer();
      this.updateFormattedSize();
   },

   download() {
      let blob = new Blob([this.get('content')], { type: this.get('type') });
      FileSaver.saveAs(blob, this.get('name'));
   },

   pseudonymize() {
      console.warn('Abstract Method `pseudonymize` should be overriden');
   },

   setPatientName() {
      console.warn('Abstract Method `setPatientName` should be overriden');
   },

   setTransformer() {
      let name = this.get('name');
      let pattern;

      let transformer = _.find(config.transformers, (tf) => {
         return _.find(tf.extensions, (extension) => {
            pattern = new RegExp('\.' + extension + '$', 'i');
            return pattern.test(name);
         });
      });

      if (transformer) {
         _.each(transformer.mixin, (value, key) => this[key] = value);
      }
   },

   updateFormattedSize() {
      let formattedSize = sizeFormatter(this.get('size'));
      this.set('formatted_size', formattedSize);
   },

   // no sync needed
   sync() { return null; },
   fetch() { return null; },
   save() { return null; }

});
