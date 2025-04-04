declare module 'react-grid-layout' {
  import * as React from 'react';
  
  export interface Layout {
    i: string;
    x: number;
    y: number;
    w: number;
    h: number;
    minW?: number;
    minH?: number;
    maxW?: number;
    maxH?: number;
    isDraggable?: boolean;
    isResizable?: boolean;
    isBounded?: boolean;
    static?: boolean;
  }
  
  export interface Layouts {
    [key: string]: Layout[];
  }
  
  export interface ReactGridLayoutProps {
    className?: string;
    style?: React.CSSProperties;
    width?: number;
    autoSize?: boolean;
    cols?: number;
    draggableHandle?: string;
    draggableCancel?: string;
    compactType?: 'vertical' | 'horizontal' | null;
    layout?: Layout[];
    margin?: [number, number];
    containerPadding?: [number, number];
    rowHeight?: number;
    maxRows?: number;
    isBounded?: boolean;
    isDraggable?: boolean;
    isResizable?: boolean;
    isDroppable?: boolean;
    preventCollision?: boolean;
    useCSSTransforms?: boolean;
    transformScale?: number;
    resizeHandles?: Array<'s' | 'w' | 'e' | 'n' | 'sw' | 'nw' | 'se' | 'ne'>;
    allowOverlap?: boolean;
    onLayoutChange?: (layout: Layout[]) => void;
    onDragStart?: (layout: Layout[], oldItem: Layout, newItem: Layout, placeholder: Layout, event: MouseEvent, element: HTMLElement) => void;
    onDrag?: (layout: Layout[], oldItem: Layout, newItem: Layout, placeholder: Layout, event: MouseEvent, element: HTMLElement) => void;
    onDragStop?: (layout: Layout[], oldItem: Layout, newItem: Layout, placeholder: Layout, event: MouseEvent, element: HTMLElement) => void;
    onResizeStart?: (layout: Layout[], oldItem: Layout, newItem: Layout, placeholder: Layout, event: MouseEvent, element: HTMLElement) => void;
    onResize?: (layout: Layout[], oldItem: Layout, newItem: Layout, placeholder: Layout, event: MouseEvent, element: HTMLElement) => void;
    onResizeStop?: (layout: Layout[], oldItem: Layout, newItem: Layout, placeholder: Layout, event: MouseEvent, element: HTMLElement) => void;
    onDrop?: (layout: Layout[], item: Layout, e: Event) => void;
    children?: React.ReactNode;
  }
  
  export interface ResponsiveProps extends ReactGridLayoutProps {
    breakpoints?: {[key: string]: number};
    cols?: {[key: string]: number};
    layouts?: Layouts;
    onBreakpointChange?: (breakpoint: string, cols: number) => void;
    onLayoutChange?: (layout: Layout[], layouts: Layouts) => void;
    onWidthChange?: (width: number, margin: [number, number], cols: number, containerPadding: [number, number]) => void;
  }
  
  export default class ReactGridLayout extends React.Component<ReactGridLayoutProps> {}
  export class Responsive extends React.Component<ResponsiveProps> {}
  export function WidthProvider(component: React.ComponentType<any>): React.ComponentType<any>;
} 