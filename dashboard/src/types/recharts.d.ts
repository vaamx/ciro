declare module 'recharts' {
  import * as React from 'react';

  // Common props
  interface BaseProps {
    // Add common props
    className?: string;
    style?: React.CSSProperties;
    children?: React.ReactNode;
  }

  // Chart components
  export class BarChart extends React.Component<any> {}
  export class LineChart extends React.Component<any> {}
  export class PieChart extends React.Component<any> {}
  export class ScatterChart extends React.Component<any> {}
  export class AreaChart extends React.Component<any> {}
  export class ComposedChart extends React.Component<any> {}

  // Chart elements
  export class Bar extends React.Component<any> {}
  export class Line extends React.Component<any> {}
  export class Pie extends React.Component<any> {}
  export class Scatter extends React.Component<any> {}
  export class Area extends React.Component<any> {}
  export class Cell extends React.Component<any> {}

  // Supporting components
  export class XAxis extends React.Component<any> {}
  export class YAxis extends React.Component<any> {}
  export class CartesianGrid extends React.Component<any> {}
  export class Tooltip extends React.Component<any> {}
  export class Legend extends React.Component<any> {}
  export class ResponsiveContainer extends React.Component<any> {}
} 