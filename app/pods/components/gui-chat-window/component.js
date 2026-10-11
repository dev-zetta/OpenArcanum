import { setComponentTemplate } from '@ember/component'
import template from './layout.hbs'
import GuiWidget from '../gui-widget'

//requireNode('converse.js/dist/converse.min.js')
/* global converse */

//import converse from 'converse.'

class GuiChatWindow extends GuiWidget {
  default = {
    type: `chat-window`,
    size: [`100%`, `100%`]
  }

  constructor() {
    super(...arguments)
  }

  didInsertElement() {
    super.didInsertElement(...arguments)
    /*var bw = requireNode('electron').remote.BrowserWindow;
    var ei = bw.getDevToolsExtensions()['Ember Inspector'];
    if (ei) {
      console.log ('removing')
      bw.removeDevToolsExtension('Ember Inspector');
    }*/

    // https://conversejs.org/docs/html/configuration.html
    //window.addEventListener("converse-loaded", function(event) {
    /*let result = converse.initialize({
        jid: 'maxli@jwchat.org',
        authentication: 'login', // 'prebind',
        keepalive: true,
        allow_logout: false,

        bosh_service_url: 'https://conversejs.org/http-bind/', // Please use this connection manager only for testing purposes
        show_controlbox_by_default: true,
        root: document.getElementById('chat-window'),

        cache_otr_key: true,
        allow_otr: true,
        //credentials_url
        //default_domain:
        hide_muc_server: true,
        fullname: 'dsfsdfs',
        nickname: 'cccccc',
        play_sounds: true,
        show_send_button: true,


        allow_dragresize: false,
        animate: false,
        //view_mode: 'overlay',
        blacklisted_plugins: [
          'converse-register',
          'converse-dragresize',
          'converse-fullscreen',
          'converse-minimize',

        ]
      })*/
    //})
  }
}

export default setComponentTemplate(template, GuiChatWindow)
