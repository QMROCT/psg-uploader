export default {

   pseudonymize() {
      console.log('XML - pseudonymize', this.get('name'));
   },

   setPatientName() {
      console.log('XML - setPatientName for', this.get('name'));
   },

   setFileName() {
      console.log('XML - setFileName for', this.get('name'));
   }

};
