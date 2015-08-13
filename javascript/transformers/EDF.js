export default {

   /**
    * Removes the 80 bytes of user data and optionally replaces them by a given pseudonym
    */
   pseudonymize() {
      console.log('pseudonymize', this.get('name'));
      let buffer = this.get('content');
      let pseudonym = this.get('pseudonym');

      for (var i = 0; i < 80; i++) {
         buffer[i + 8] = (pseudonym[i] || ' ').charCodeAt();
      }
   },

   setPatientName() {
      console.log('setPatientName for', this.get('name'));
      let rawChars = this.get('content').subarray(8, 88);
      let patientName = String.fromCharCode.apply(null, rawChars).trim();
      this.set('patientName', patientName);
   },

   setFileName() {
      console.log('setFileName for', this.get('name'));
      let name = this.get('patientName') + '_' + Date.now();
      this.set('name', name);
   }

};
