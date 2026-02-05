declare module 'resizable-panels-react' {
    import { ReactNode, CSSProperties } from 'react';

    interface ResizablePanelsProps {
        displayDirection?: 'row' | 'column';
        width?: string;
        height?: string;
        panelsSize?: number[];
        sizeUnitMeasure?: '%' | 'px';
        resizerColor?: string;
        resizerSize?: string;
        bkcolor?: string;
        children?: ReactNode;
        style?: CSSProperties;
    }

    const ResizablePanels: React.FC<ResizablePanelsProps>;
    export default ResizablePanels;
}
