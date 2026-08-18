import DefaultTheme from 'vitepress/theme';
import './style.css';
import Layout from './Layout.vue';
import MermaidDiagram from './MermaidDiagram.vue';

export default {
  extends: DefaultTheme,
  Layout: Layout,
  enhanceApp({app}) {
    app.component('MermaidDiagram', MermaidDiagram);
  },
};
