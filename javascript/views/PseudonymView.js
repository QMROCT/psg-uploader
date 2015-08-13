export default Backbone.View.extend({

   events: {
      'change input[name="pseudonym"]': 'changePseudonym',
      'click .btn-pseudo-history': 'renderTable'
   },

   mainRow: $('.main-row'),

   initialize(options = {}) {
      _.bindAll(this, 'renderTable', 'setInitialPatientName', 'changePseudonym', 'close', 'print');

      this.$pseudonym = this.$('input[name="pseudonym"]');
      this.usedPseudonyms = JSON.parse(localStorage.getItem('pseudonyms')) || {};

      // Zu diesem bestimmten Zeitpunkt ist nur ein Model vorhanden, darum kurz warten
      _.defer(() => {
         this.setInitialPatientName();
         this.setInitialPseudonym();
         this.changePseudonym();
         this.collection.on('add', model => model.set('pseudonym', this.pseudonym));
      });

      this.tableContainer = options.tableContainer;
      this.tableContainer.find('.btn-close').on('click', this.close);
      this.tableContainer.find('.btn-print').on('click', this.print);
   },

   renderTable() {
      let html = _.pairs(this.usedPseudonyms)
                  .map(([name, pseudo]) => `<tr><td>${name}</td><td>${pseudo}</tr>`)
                  .join('');
      this.mainRow.addClass('hidden');
      this.tableContainer.removeClass('hidden')
         .find('.pseudonym-table').html(html);
   },

   setInitialPatientName() {
      let names = this.collection.pluck('patientName');
      let rankedNames = _.chain(names).countBy().pairs().value();

      if (rankedNames.length > 1) {
         window.alert(`Found different patient names. The most common name "${rankedNames[0][0]}" was selected.`); // eslint-disable-line no-alert
      }

      this.patientName = rankedNames[0][0];
   },

   setInitialPseudonym() {
      this.pseudonym = this.usedPseudonyms[this.patientName] || btoa(Math.random()).substr(3, 16);
      this.$pseudonym.val(this.pseudonym);
   },

   changePseudonym() {
      var newPseudonym = this.$pseudonym.val();
      this.collection.models.forEach(model => model.set('pseudonym', newPseudonym));
      this.usedPseudonyms[this.patientName] = newPseudonym;
      localStorage.setItem('pseudonyms', JSON.stringify(this.usedPseudonyms));
   },

   close() {
      this.mainRow.removeClass('hidden');
      this.tableContainer.addClass('hidden');
   },

   print() {
      window.print();
   }

});
