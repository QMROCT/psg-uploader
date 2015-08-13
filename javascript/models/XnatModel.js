export var Model = Backbone.Model.extend({

   defaults: {
      updated_at: Date.now()
   },

   initialize( /*options*/ ) {
      this.set('id', this.get('ID'));
   },

   url() {
      return collection.get('host') + this.get('URI');
   },

   getChildren(name, options) {
      if (!this.get(name)) {
         this.fetchChildren(name, options);
      }
      else if (options && options.success) {
         options.success(this.get(name));
      }
      return this.get(name);
   },

   fetchChildren(name, options) {
      if (!this.get(name)) {
         this.set(name, new Collection({
            url: this.url() + '/' + name
         }));
      }
      this.get(name).fetch(options);

      return this.get(name);
   }
});

export var Collection = Backbone.Collection.extend({

   model: Model,

   initialize(options) {
      this.url = options.url || this.url;
      this.host = options.host || '';
   },

   parse(response) {
      return response.ResultSet.Result;
   }

});
