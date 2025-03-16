# Extended Visualization Types

This document describes the extended visualization types that have been added to the system. These new visualization types enable more sophisticated data analysis and presentation.

## New Visualization Types

### 1. Network Graph

Network graphs visualize relationships between entities, showing connections and their strength.

**Use Cases:**
- Social network analysis
- Organizational relationships
- System dependencies
- Customer journey mapping
- Process flows

**Data Structure:**
```typescript
{
  nodes: [
    { id: "node1", label: "Node 1", value: 10, color: "#4299E1", group: "group1" },
    { id: "node2", label: "Node 2", value: 5, color: "#48BB78", group: "group2" }
  ],
  edges: [
    { source: "node1", target: "node2", value: 5, label: "connects to" }
  ]
}
```

### 2. Geospatial Map

Geospatial maps display data on a geographical map, allowing for location-based analysis.

**Use Cases:**
- Store location analysis
- Customer distribution
- Delivery route optimization
- Regional sales performance
- Event tracking

**Data Structure:**
```typescript
[
  { 
    id: "point1", 
    latitude: 37.7749, 
    longitude: -122.4194, 
    label: "San Francisco", 
    value: 100 
  },
  { 
    id: "point2", 
    latitude: 40.7128, 
    longitude: -74.0060, 
    label: "New York", 
    value: 200 
  }
]
```

### 3. Sankey Diagram

Sankey diagrams visualize flow quantities, where the width of the arrows is proportional to the flow quantity.

**Use Cases:**
- Energy flow analysis
- Budget allocation
- Website traffic flow
- Conversion funnels
- Resource distribution

**Data Structure:**
```typescript
{
  nodes: [
    { id: "node1", name: "Source 1", color: "#4299E1" },
    { id: "node2", name: "Target 1", color: "#48BB78" }
  ],
  links: [
    { source: "node1", target: "node2", value: 100 }
  ]
}
```

### 4. Funnel Chart

Funnel charts show values decreasing progressively through a process.

**Use Cases:**
- Sales pipeline
- Conversion rates
- Recruitment process
- Customer acquisition
- Project stages

**Data Structure:**
```typescript
[
  { label: "Visitors", value: 1000, color: "#4299E1" },
  { label: "Leads", value: 500, color: "#48BB78" },
  { label: "Qualified Leads", value: 200, color: "#F56565" },
  { label: "Proposals", value: 100, color: "#ED8936" },
  { label: "Sales", value: 50, color: "#9F7AEA" }
]
```

### 5. 3D Visualizations

3D visualizations display data in three dimensions, allowing for more complex data representation.

**Types:**
- 3D Scatter Plot
- 3D Bar Chart
- 3D Surface Plot

**Use Cases:**
- Scientific data analysis
- Multi-dimensional data exploration
- Complex correlations
- Terrain mapping
- Financial modeling

**Data Structure:**
```typescript
[
  { x: 1, y: 2, z: 3, label: "Point 1", color: "#4299E1" },
  { x: 4, y: 5, z: 6, label: "Point 2", color: "#48BB78" }
]
```

### 6. Animated Charts

Animated charts show data changing over time, providing a dynamic view of trends and patterns.

**Use Cases:**
- Time series analysis
- Trend evolution
- Comparative analysis over time
- Process simulation
- Historical data exploration

**Data Structure:**
```typescript
[
  { 
    data: [
      { name: "A", value: 10 },
      { name: "B", value: 20 }
    ], 
    timestamp: "2023-01-01", 
    label: "January" 
  },
  { 
    data: [
      { name: "A", value: 15 },
      { name: "B", value: 25 }
    ], 
    timestamp: "2023-02-01", 
    label: "February" 
  }
]
```

## Implementation Details

These visualization types are implemented using a combination of libraries:

- **Network Graphs**: vis-network
- **Geospatial Maps**: react-leaflet
- **Sankey Diagrams**: d3-sankey
- **Funnel Charts**: plotly.js
- **3D Visualizations**: plotly.js
- **Animated Charts**: Custom implementation using existing chart types

## Usage Examples

### Network Graph

```typescript
const config = {
  type: 'network',
  data: {
    nodes: [
      { id: '1', label: 'Node 1', value: 10 },
      { id: '2', label: 'Node 2', value: 5 }
    ],
    edges: [
      { source: '1', target: '2', value: 1 }
    ]
  },
  options: {
    physics: {
      stabilization: true
    }
  }
};

<Visualization config={config} height={400} />
```

### Geospatial Map

```typescript
const config = {
  type: 'geospatial',
  data: [
    { latitude: 37.7749, longitude: -122.4194, label: 'San Francisco', value: 100 },
    { latitude: 40.7128, longitude: -74.0060, label: 'New York', value: 200 }
  ],
  options: {
    center: { lat: 39, lng: -98 },
    zoom: 4
  }
};

<Visualization config={config} height={400} />
```

### Sankey Diagram

```typescript
const config = {
  type: 'sankey',
  data: {
    nodes: [
      { id: 'a', name: 'Source' },
      { id: 'b', name: 'Target' }
    ],
    links: [
      { source: 'a', target: 'b', value: 100 }
    ]
  }
};

<Visualization config={config} height={400} />
```

### Funnel Chart

```typescript
const config = {
  type: 'funnel',
  data: [
    { label: 'Visitors', value: 1000 },
    { label: 'Leads', value: 500 },
    { label: 'Sales', value: 100 }
  ]
};

<Visualization config={config} height={400} />
```

### 3D Scatter Plot

```typescript
const config = {
  type: '3d_scatter',
  data: [
    { x: 1, y: 2, z: 3, label: 'Point 1' },
    { x: 4, y: 5, z: 6, label: 'Point 2' }
  ],
  labels: {
    xAxis: 'X Axis',
    yAxis: 'Y Axis',
    title: '3D Scatter Plot'
  }
};

<Visualization config={config} height={400} />
```

### Animated Chart

```typescript
const config = {
  type: 'animated',
  data: [
    {
      data: [
        { name: 'A', value: 10 },
        { name: 'B', value: 20 }
      ],
      timestamp: '2023-01-01',
      label: 'January'
    },
    {
      data: [
        { name: 'A', value: 15 },
        { name: 'B', value: 25 }
      ],
      timestamp: '2023-02-01',
      label: 'February'
    }
  ],
  options: {
    baseType: 'bar',
    animation: {
      speed: 1000
    }
  }
};

<Visualization config={config} height={400} />
``` 