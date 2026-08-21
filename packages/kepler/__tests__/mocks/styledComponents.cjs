/* global module, require */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const styledComponents = require('styled-components/dist/styled-components.cjs.js');

module.exports = styledComponents.styled;
module.exports.styled = styledComponents.styled;
module.exports.ThemeProvider = styledComponents.ThemeProvider;
module.exports.StyleSheetManager = styledComponents.StyleSheetManager;
module.exports.useTheme = styledComponents.useTheme;
module.exports.css = styledComponents.css;
module.exports.keyframes = styledComponents.keyframes;
module.exports.withTheme = styledComponents.withTheme;
