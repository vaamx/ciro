declare module 'react-plotly.js' {
  import * as React from 'react';
  import * as Plotly from 'plotly.js';

  interface PlotParams {
    data: Plotly.Data[];
    layout?: Partial<Plotly.Layout>;
    frames?: Plotly.Frame[];
    config?: Partial<Plotly.Config>;
    style?: React.CSSProperties;
    className?: string;
    useResizeHandler?: boolean;
    onInitialized?: (figure: Plotly.Figure, graphDiv: HTMLElement) => void;
    onUpdate?: (figure: Plotly.Figure, graphDiv: HTMLElement) => void;
    onPurge?: (figure: Plotly.Figure, graphDiv: HTMLElement) => void;
    onError?: (err: Error) => void;
    onAfterPlot?: (figure: Plotly.Figure, graphDiv: HTMLElement) => void;
    onRedraw?: (figure: Plotly.Figure, graphDiv: HTMLElement) => void;
    onSelected?: (event: Plotly.PlotSelectionEvent) => void;
    onSelecting?: (event: Plotly.PlotSelectionEvent) => void;
    onRestyle?: (data: any, graphDiv: HTMLElement) => void;
    onRelayout?: (data: any, graphDiv: HTMLElement) => void;
    onClickAnnotation?: (event: Plotly.ClickAnnotationEvent) => void;
    onLegendClick?: (event: Plotly.LegendClickEvent) => boolean;
    onLegendDoubleClick?: (event: Plotly.LegendClickEvent) => boolean;
    onSliderChange?: (event: Plotly.SliderChangeEvent) => void;
    onSliderEnd?: (event: Plotly.SliderEndEvent) => void;
    onSliderStart?: (event: Plotly.SliderStartEvent) => void;
    onAnimated?: () => void;
    onAnimatingFrame?: (event: Plotly.AnimationFrameEvent) => void;
    onHover?: (event: Plotly.PlotHoverEvent) => void;
    onUnhover?: (event: Plotly.PlotHoverEvent) => void;
    onClick?: (event: Plotly.PlotMouseEvent) => void;
    onDoubleClick?: (event: Plotly.PlotMouseEvent) => void;
    onDeselect?: () => void;
    onWebGlContextLost?: () => void;
    divId?: string;
  }

  class Plot extends React.Component<PlotParams> {}
  export default Plot;
} 