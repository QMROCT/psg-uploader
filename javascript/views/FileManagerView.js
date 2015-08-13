import FileManagerItemView from 'views/FileManagerItemView';

export default Backbone.View.extend({

   className: 'flextable flexcol',

   template: _.template(
      `<div class="flexheader flexrow">
         <div class="flexitem flexitem-half">Use</div>
         <div class="flexitem flexitem-double">Name</div>
         <div class="flexitem flexitem">Format</div>
         <div class="flexitem">Size</div>
         <div class="flexitem flexitem-half"><i class="fa fa-wrench"></i></div>
      </div>
      <div class="flexbody"></div>
   `),

   views: {},

   initialize() {
      _.bindAll(this, 'render', 'renderItem');
      this.render();
      this.listenTo(this.collection, 'add', this.renderItem);
      // this.listenTo(this.collection, 'destroy', this.removeItem);
   },

   render() {
      this.$el
         .html(this.template())
         .addClass(this.className);

      this.$tableBody = this.$('.flexbody');

      _.each(this.collection.models, this.renderItem);
   },

   renderItem(model) {
      let view = new FileManagerItemView({model});
      this.views[model.id] = view;
      this.$tableBody.append(view.render().el);
      return view;
   }

});
