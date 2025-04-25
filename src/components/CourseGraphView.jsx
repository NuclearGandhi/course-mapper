import React from 'react';
import { ReactFlow, Background, Controls, MiniMap } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './CourseGraphView.css';

// General reusable course graph view
const CourseGraphView = ({ 
  nodes, 
  edges, 
  selected, 
  highlighted, 
  highlightedAnd, 
  highlightedOr, 
  highlightedEdges, 
  showControls, 
  showMiniMap, 
  onInit, 
  style, 
  ...props 
}) => {
  
  // Helper function to render semester badges
  const renderSemesterBadges = (semesters) => {
    if (!semesters || semesters.length === 0) return null;
    
    return (
      <div className="semester-badges">
        {semesters.includes("חורף") && <span className="semester-badge winter">חורף</span>}
        {semesters.includes("אביב") && <span className="semester-badge spring">אביב</span>}
      </div>
    );
  };
  
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
                {renderSemesterBadges(node.data.semesters)}
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
        edges={edges.map(edge => ({
          ...edge,
          className: `${edge.className || ''}${highlightedEdges?.has?.(edge.id) ? ' highlighted' : ''}`
        }))}
        fitView
        panOnDrag
        zoomOnScroll
        zoomOnPinch
        zoomOnDoubleClick={false}
        attributionPosition="bottom-right"
        onInit={onInit}
        {...props}
      >
        <Background />
        {showControls && <Controls showInteractive={false} />}
        {showMiniMap && (
          <MiniMap 
            draggable={true}
            panOnDrag={true}
            pannable={true}
            nodeColor={(n) => {
              if (selected === n.id) return '#F57DBD';
              if (highlightedAnd?.has?.(n.id)) return '#F57DBD';
              if (highlightedOr?.has?.(n.id)) return '#F57DBD';
              if (highlighted?.has?.(n.id)) return '#F57DBD';
              return '#ffffff';
            }}
            nodeStrokeWidth={3}
            nodeBorderRadius={8}
            maskColor="rgba(0, 0, 0, 0.2)"
            position="bottom-right"
          />
        )}
      </ReactFlow>
    </div>
  );
};

export default CourseGraphView;
