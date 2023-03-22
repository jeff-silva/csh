import { createApp } from 'vue';
import './style.css';

// Vuetify
// https://next.vuetifyjs.com/en/
import 'vuetify/styles';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';

const vueCreateApp = (component, params={}) => {
  return createApp(component, params)
    .use(createVuetify({ components, directives }))
};

import App from './App.vue';
vueCreateApp(App).mount('#app');

import csh from '@/components/csh.vue';
customElements.define('app-csh', class extends HTMLElement {
  constructor() {
    super();
    setTimeout(() => {
      const elem = document.createElement('div');
      this.append(elem);
      vueCreateApp(csh).mount(elem);
    }, 10);
  }
});

document.body.appendChild(document.createElement('app-csh'));