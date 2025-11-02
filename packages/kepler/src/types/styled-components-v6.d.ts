import 'styled-components';

declare module 'styled-components' {
  export interface StyleSheetManagerProps {
    shouldForwardProp?: (propName: string, elementToBeRendered: any) => boolean;
  }
}


