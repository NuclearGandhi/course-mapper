import React from 'react';
import { ReactFlow, Background, Controls, MiniMap } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// General reusable course graph view
const CourseGraphView = ({ nodes, edges, selected, highlighted, highlightedAnd, highlightedOr, showControls, showMiniMap, style, ...props }) => {
  return (
    <div style={style}>
      <ReactFlow
        nodes={nodes.map(node => ({
          ...node,
          data: {
            ...node.data,
            label: (
              <div className="react-flow__node-label">
                <b>{node.data.name}</b>
                <div className="react-flow__node-label-id">
                  {node.data.id}
                </div>
              </div>
            )
          },
          className: `${node.className || ''}
            ${highlightedAnd?.has?.(node.id) ? ' prereq-and' : ''}
            ${highlightedOr?.has?.(node.id) ? ' prereq-or' : ''}
            ${highlighted?.has?.(node.id) ? ' highlighted' : ''}
            ${selected === node.id ? ' selected' : ''}`,
        }))}
        colorMode='dark'
        edges={edges}
        fitView
        panOnDrag
        zoomOnScroll
        zoomOnPinch
        zoomOnDoubleClick={false}
        attributionPosition="top-left"
        {...props}
      >
        <Background />
        {showControls && <Controls showInteractive={false} />} {/* Show controls if specified */}
        {showMiniMap && <MiniMap />} {/* Show minimap if specified */}
      </ReactFlow>
    </div>
  );
};

export default CourseGraphView;
