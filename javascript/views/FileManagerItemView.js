import config from 'config';

export default Backbone.View.extend({

   template: _.template(
      `<label class="flexitem flexitem-half">
         <input class="item-check" type="checkbox" <%= state > 0 ? 'checked' : '' %> <%= (state < 0 || state > 1) ? 'disabled' : '' %>>
      </label>
      <div class="flexitem flexitem-double">
         <span><%= name %></span>
      </div>
      <div class="flexitem flexitem">
         <select class="item-transformer">`
            + config.transformers.map(tf => `<option value="${tf.name}">${tf.name}</option>`).join('') +
         `</select>
      </div>
      <div class="flexitem flexitem-right">
         <span><%= formatted_size %></span>
      </div>
      <div class="flexitem flexitem-half">
         <div class="btn btn-link"><i class="item-download fa fa-download"></i></div>
      </div>`
   ),

   tagName: 'div',
   className: 'flexrow',

   events: {
      // 'change .item-name': 'changeFilename',
      'change .item-transformer': 'changeTransformer',
      'change .item-check': 'toggleState',
      'click .item-download': 'download'
   },

   initialize() {
      _.bindAll(this, 'render', 'download', 'toggleState');
      this.listenTo(this.model, 'change', this.render);
      // this.listenTo(this.model, 'destroy', this.remove);
   },

   render() {
      this.$el
         .html(this.template(this.model.toJSON()))
         .attr('data-state', this.model.get('state'));
      return this;
   },

   download() {
      this.model.download();
   },

   // changeFilename(event) {
   //    this.model.set('name', event.target.value);
   // },

   changeTransformer(event) {
      console.warn('changeTransformer', 'Feature noch nicht implementiert', event.target.value);
      // this.model.set('name', event.target.value);
   },

   toggleState(event) {
      let currentState = this.model.get('state');
      if (currentState < 0 || currentState > 1) {
         event.preventDefault();
      } else {
         this.model.set('state', +event.target.checked);
      }
   }

});
