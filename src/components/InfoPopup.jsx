import React from 'react';
import { ReactFlow, Background, Controls } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { courseNodesAndEdges, applyDagreLayout } from '../courseGraph';
import CourseGraphView from './CourseGraphView';

const InfoPopup = ({ course, onClose, courseMap }) => {
  const courseId = course?.['מספר מקצוע'];
  // Build subgraph for the popup: include all prereqs and all dependents recursively
  // Collect all prerequisites recursively
  const collectAllPrereqs = (courseId, map, acc = {}) => {
    if (!map[courseId] || acc[courseId]) return acc;
    acc[courseId] = map[courseId];
    map[courseId].prereqs.forEach(pr => collectAllPrereqs(pr, map, acc));
    return acc;
  };
  // Collect all dependents recursively
  const collectAllDependents = (courseId, map, acc = {}) => {
    for (const [id, course] of Object.entries(map)) {
      if (course.prereqs.includes(courseId) && !acc[id]) {
        acc[id] = course;
        collectAllDependents(id, map, acc);
      }
    }
    return acc;
  };
  const subCourseMap = React.useMemo(() => {
    if (!courseId) return {};
    // Merge all prereqs and all dependents (including the course itself)
    const prereqs = collectAllPrereqs(courseId, courseMap);
    const dependents = collectAllDependents(courseId, courseMap);
    return { ...prereqs, ...dependents };
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
        style={{ width: '100%', height: 480, margin: '16px auto 0 auto', background: '#23272f', borderRadius: 8 }}
      />
    </div>
  );
};

export default InfoPopup;
