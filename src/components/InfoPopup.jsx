import React from 'react';
import { ReactFlow, Background, Controls } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { courseNodesAndEdges, applyDagreLayout } from '../courseGraph';

// Helper: get all direct prereqs and dependents for a course
function getSubgraphCourseMap(courseMap, courseId) {
  const subMap = {};
  // Add the selected course
  if (courseMap[courseId]) subMap[courseId] = courseMap[courseId];
  // Add all direct prereqs
  if (courseMap[courseId]?.prereqs) {
    courseMap[courseId].prereqs.forEach(pr => {
      if (courseMap[pr]) subMap[pr] = courseMap[pr];
    });
  }
  // Add all direct dependents
  Object.entries(courseMap).forEach(([id, c]) => {
    if (c.prereqs && c.prereqs.includes(courseId)) {
      subMap[id] = c;
    }
  });
  return subMap;
}

const InfoPopup = ({ course, onClose, courseMap }) => {
  const courseId = course?.['מספר מקצוע'];
  const subCourseMap = courseId ? getSubgraphCourseMap(courseMap, courseId) : {};
  const { nodes, edges } = courseNodesAndEdges(subCourseMap);
  const layoutedNodes = applyDagreLayout(nodes, edges);
  return (
    <div className="react-flow__info-popup">
      <button className="react-flow__info-popup-close" onClick={onClose}>×</button>
      <h2 className="react-flow__info-popup-title">{course['שם מקצוע']}</h2>
      <div className="react-flow__info-popup-details">
        <b>מספר מקצוע:</b> {course['מספר מקצוע']}<br />
        <b>נקודות:</b> {course['נקודות'] || '-'}<br />
        <b>קדם:</b> {course['מקצועות קדם'] || '-'}<br />
        <b>סילבוס:</b> {course['סילבוס'] || '-'}<br />
      </div>
      <div style={{ width: '100%', height: 180, margin: '16px auto 0 auto', background: '#23272f', borderRadius: 8 }}>
        <ReactFlow
          nodes={layoutedNodes.map(node => ({
            ...node,
            data: {
              ...node.data,
              label: (
                <div className="react-flow__node-label">
                  <b>{node.data.name}</b>
                  <div className="react-flow__node-label-id">{node.data.id}</div>
                </div>
              )
            },
            className: node.className,
            style: {
              ...node.style,
              borderRadius: '8px'
            }
          }))}
          colorMode='dark'
          edges={edges}
          fitView
          panOnDrag
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          zoomOnScroll
          zoomOnPinch
          attributionPosition="top-left"
        >
          <Background />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
};

export default InfoPopup;
