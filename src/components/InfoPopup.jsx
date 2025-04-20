import React from 'react';
import { ReactFlow, Background, Controls } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { courseNodesAndEdges, applyDagreLayout } from '../courseGraph';
import CourseGraphView from './CourseGraphView';

const InfoPopup = ({ course, onClose, courseMap }) => {
  const courseId = course?.['מספר מקצוע'];
  // Build subgraph for the popup: include all prereqs and all dependents recursively
  // Collect all prerequisites recursively
  const collectAllPrereqs = React.useCallback((courseId, map, acc = {}) => {
    if (!map[courseId] || acc[courseId]) return acc;
    acc[courseId] = map[courseId];
    map[courseId].prereqs.forEach(pr => collectAllPrereqs(pr, map, acc));
    return acc;
  }, []);
  // Collect all dependents recursively
  const collectAllDependents = React.useCallback((courseId, map, acc = {}) => {
    for (const [id, course] of Object.entries(map)) {
      if (course.prereqs.includes(courseId) && !acc[id]) {
        acc[id] = course;
        collectAllDependents(id, map, acc);
      }
    }
    return acc;
  }, []);
  const subCourseMap = React.useMemo(() => {
    if (!courseId) return {};
    // Merge all prereqs and all dependents (including the course itself)
    const prereqs = collectAllPrereqs(courseId, courseMap);
    const dependents = collectAllDependents(courseId, courseMap);
    return { ...prereqs, ...dependents };
  }, [courseId, courseMap, collectAllPrereqs, collectAllDependents]);
  const { nodes, edges } = courseNodesAndEdges(subCourseMap);
  const layoutedNodes = applyDagreLayout(nodes, edges);

  const prereqs = courseMap[courseId]?.prereqs || [];
  console.log('prereqs', prereqs);

  // Helper for tooltip state
  const [hoveredPrereq, setHoveredPrereq] = React.useState(null);
  const [tooltipPos, setTooltipPos] = React.useState({ x: 0, y: 0, text: '' });
  const detailsRef = React.useRef();

  return (
    <div className="react-flow__info-popup">
      <button className="react-flow__info-popup-close" onClick={onClose}>×</button>
      <h2 className="react-flow__info-popup-title">{course['שם מקצוע']}</h2>
      <div className="react-flow__info-popup-details" ref={detailsRef} style={{ position: 'relative' }}>
        <b>מספר מקצוע:</b> {course['מספר מקצוע']}<br />
        <b>נקודות:</b> {course['נקודות'] || '-'}<br />
        <b>קדמים:</b>{' '}
        {Array.isArray(prereqs) && prereqs.length > 0
          ? prereqs.map((pr, i) => (
              <React.Fragment key={pr}>
                <span
                  className="prereq-hoverable"
                  onMouseEnter={e => {
                    setHoveredPrereq(pr);
                    const rect = e.target.getBoundingClientRect();
                    const parentRect = detailsRef.current?.getBoundingClientRect();
                    setTooltipPos({
                      x: rect.left - (parentRect?.left || 0) + rect.width / 2,
                      y: rect.top - (parentRect?.top || 0),
                      text: courseMap[pr]?.name || ''
                    });
                  }}
                  onMouseLeave={() => setHoveredPrereq(null)}
                >
                  {pr}
                </span>
                {i < prereqs.length - 1 && <span key={pr + '-comma'}>, </span>}
                {/* Always render the tooltip, but control its visibility */}
                <span
                  className="prereq-tooltip"
                  style={{
                    left: tooltipPos.x,
                    top: tooltipPos.y - 5,
                    transform: 'translateX(-50%) translateY(-100%)', // Center horizontally and position above
                    position: 'absolute',
                    pointerEvents: 'none',
                    visibility: hoveredPrereq === pr && tooltipPos.text ? 'visible' : 'hidden',
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    color: 'white',
                    padding: '8px 12px', // Increased padding for more height
                    borderRadius: '4px',
                    zIndex: 1000,
                    whiteSpace: 'nowrap', // Prevent text wrapping
                    maxWidth: '300px',
                    textAlign: 'center',
                    boxShadow: '0px 1px 4px rgba(0,0,0,0.2)',
                    lineHeight: '1.5', // Increased line height for better text spacing
                    fontSize: '14px', // Set explicit font size
                    minHeight: '24px', // Set minimum height
                  }}
                >
                  {courseMap[pr]?.name || ''}
                </span>
              </React.Fragment>
            ))
          : '-'}
        <br />
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
