import styled from '@emotion/styled';
import {Mosaic} from 'react-mosaic-component';

const StyledMosaic = styled(Mosaic<string>)``;

// const StyledMosaic = styled(Mosaic<string>)`
//   background: ${(props) => props.theme.colors.gray[800]};

//   .mosaic-zero-state {
//     background: ${(props) => props.theme.colors.gray[300]};
//     box-shadow: 0 0 5px ${(props) => props.theme.colors.gray[800]};

//     .default-zero-state-icon {
//       font-size: 120px;
//     }
//   }

//   .mosaic-split:hover {
//     background: none;
//     .mosaic-split-line {
//       box-shadow: 0 0 0 1px ${(props) => props.theme.colors.blue};
//     }
//   }

//   &.mosaic-drop-target,
//   .mosaic-drop-target {
//     .drop-target-container .drop-target {
//       background: fade(@blue5, 20%);
//       border: 2px solid ${(props) => props.theme.colors.blue};
//       transition: opacity 100ms;
//     }
//   }

//   .mosaic-window,
//   .mosaic-preview {
//     box-shadow: 0 0 5px ${(props) => props.theme.colors.gray[800]};

//     .mosaic-window-toolbar {
//       background: ${(props) => props.theme.colors.gray[700]};

//       &.draggable:hover {
//         .mosaic-window-title {
//           color: #000;
//         }
//         background: ${(props) => props.theme.colors.gray[800]};
//       }
//     }

//     .mosaic-window-title {
//       font-weight: 600;
//       color: @dark-gray5;
//     }

//     .mosaic-window-controls {
//       .separator {
//         border-left: 1px solid @light-gray2;
//       }
//       .@{ns}-button {
//         &,
//         &:before {
//           color: @gray2;
//         }
//       }
//     }

//     .default-preview-icon {
//       font-size: 72px;
//     }

//     .mosaic-window-body {
//       border-top-width: 0;
//       background: @pt-app-background-color;
//       border-bottom-right-radius: @pt-border-radius;
//       border-bottom-left-radius: @pt-border-radius;
//     }

//     .mosaic-window-additional-actions-bar {
//       transition: height 250ms;
//       box-shadow: 0 1px 1px @pt-divider-black;

//       .@{ns}-button {
//         &,
//         &:before {
//           color: @gray2;
//         }
//       }
//     }

//     &.additional-controls-open {
//       .mosaic-window-toolbar {
//         box-shadow: 0 1px 0 @pt-elevation-shadow-0;
//       }
//     }

//     .mosaic-preview {
//       border: 1px solid @gray3;

//       h4 {
//         color: @dark-gray5;
//       }
//     }
//   }

//   &.@{ns}-dark {
//     background: @dark-gray2;

//     .mosaic-zero-state {
//       background: @dark-gray4;
//       box-shadow: @pt-dark-elevation-shadow-0;
//     }

//     .mosaic-split:hover .mosaic-split-line {
//       box-shadow: 0 0 0 1px @blue3;
//     }

//     &.mosaic-drop-target,
//     .mosaic-drop-target {
//       .drop-target-container .drop-target {
//         background: fade(@blue2, 20%);
//         border-color: @blue3;
//       }
//     }

//     .mosaic-window-toolbar,
//     .mosaic-window-additional-actions-bar {
//       background: @dark-gray4;
//       box-shadow: 0 1px 1px @pt-dark-divider-black;
//     }

//     .mosaic-window,
//     .mosaic-preview {
//       box-shadow: @pt-dark-elevation-shadow-0;

//       .mosaic-window-toolbar.draggable:hover {
//         .mosaic-window-title {
//           color: #fff;
//         }
//         background: linear-gradient(to bottom, @dark-gray5, @dark-gray4);
//       }

//       .mosaic-window-title {
//         color: @light-gray2;
//       }

//       .mosaic-window-controls {
//         .separator {
//           border-color: @gray1;
//         }
//         .@{ns}-button {
//           &,
//           &:before {
//             color: @gray4;
//           }
//         }
//       }

//       .mosaic-window-body {
//         background: ${(props) => props.theme.colors.gray[800]};
//       }

//       .mosaic-window-additional-actions-bar {
//         .@{ns}-button {
//           &,
//           &:before {
//             color: @gray5;
//           }
//         }
//       }

//       &.additional-controls-open {
//         .mosaic-window-toolbar {
//           box-shadow: @pt-dark-elevation-shadow-0;
//         }
//       }

//       .mosaic-preview {
//         border-color: @gray1;

//         h4 {
//           color: @light-gray4;
//         }
//       }
//     }
//   }
// `;

export default StyledMosaic;
