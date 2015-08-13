export default Backbone.View.extend({

   tagName: 'div',
   className: 'progress',

   progress: 0,

   template: _.template(
      '<div class="progress-bar" style="width: <%= progress %>%;"><%= progress %>%</div>'),

   initialize: function() {
      this.render();
   },

   render: function() {
      this.$el.html(this.template({ progress: Math.ceil(this.progress) }));
      return this;
   },

   update: function(value) {
      this.progress = value;
      this.render();
      return this;
   }

});
