import DefaultTheme from 'vitepress/theme';
import './style.css';

export default {
  extends: DefaultTheme,
  enhanceApp({app}) {
    // app.component('foo', Foo)
  },
};
