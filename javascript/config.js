import EDF from 'transformers/EDF';
import XML from 'transformers/XML';

export default {

   XNAT_URL: 'https://example.com/xnat',

   defaultUser: 'somnonetz',

   users: {
      unknown: {
         username: 'unknown',
         password: 'password',
         project: 'project'
      }
   },

   transformers: [
      {
         name: 'EDF',
         description: 'European Data Format',
         extensions: ['edf', 'rml'],
         mixin: EDF
      }, {
         name: 'XML',
         description: 'Extensible Markup Language',
         extensions: ['xml'],
         mixin: XML
      }
   ]

};
