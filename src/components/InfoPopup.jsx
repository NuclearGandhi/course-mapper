import React from 'react';
import { ReactFlow, Background, Controls } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { courseNodesAndEdges, applyDagreLayout } from '../courseGraph';
import CourseGraphView from './CourseGraphView';

const InfoPopup = ({ course, onClose, courseMap }) => {
  const courseId = course?.['מספר מקצוע'];
  // Build subgraph for the popup
  const subCourseMap = React.useMemo(() => {
    if (!courseId) return {};
    const subMap = {};
    if (courseMap[courseId]) subMap[courseId] = courseMap[courseId];
    if (courseMap[courseId]?.prereqs) {
      courseMap[courseId].prereqs.forEach(pr => {
        if (courseMap[pr]) subMap[pr] = courseMap[pr];
      });
    }
    Object.entries(courseMap).forEach(([id, c]) => {
      if (c.prereqs && c.prereqs.includes(courseId)) {
        subMap[id] = c;
      }
    });
    return subMap;
  }, [courseId, courseMap]);
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
      <CourseGraphView
        nodes={layoutedNodes}
        edges={edges}
        style={{ width: '100%', height: 180, margin: '16px auto 0 auto', background: '#23272f', borderRadius: 8 }}
      />
    </div>
  );
};

export default InfoPopup;
