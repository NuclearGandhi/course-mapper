import React from 'react';
import { ReactFlow, Background, Controls } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { IoClose } from 'react-icons/io5';
import { courseNodesAndEdges, applyDagreLayout, extractCourseNumbersFromTree } from '../courseGraph';
import CourseGraphView from './CourseGraphView';
import './InfoPopup.css';

const InfoPopup = ({ course, onClose, courseMap }) => {
  const courseId = course?.['מספר מקצוע'];
  // Build subgraph for the popup: include all prereqs and all dependents recursively
  // Collect all prerequisites recursively
  const collectAllPrereqs = React.useCallback((courseId, map, acc = {}) => {
    if (!map[courseId] || acc[courseId]) return acc;
    acc[courseId] = map[courseId];
    
    // Extract prerequisites from prereqTree
    const prereqs = extractCourseNumbersFromTree(map[courseId].prereqTree);
    prereqs.forEach(pr => collectAllPrereqs(pr, map, acc));
    return acc;
  }, []);
  
  // Collect all dependents recursively
  const collectAllDependents = React.useCallback((courseId, map, acc = {}) => {
    for (const [id, course] of Object.entries(map)) {
      // Extract prereqs from prereqTree and check if courseId is among them
      const prereqs = extractCourseNumbersFromTree(course.prereqTree);
      if (prereqs.includes(courseId) && !acc[id]) {
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

  // Extract prereqs from prereqTree
  const prereqs = React.useMemo(() => 
    courseMap[courseId] ? extractCourseNumbersFromTree(courseMap[courseId].prereqTree) : []
  , [courseId, courseMap]);
  
  // Helper for tooltip state
  const [hoveredPrereq, setHoveredPrereq] = React.useState(null);
  const [tooltipPos, setTooltipPos] = React.useState({ x: 0, y: 0, text: '' });
  const detailsRef = React.useRef();

  // Create sets for highlighting in the graph
  const highlightedNodes = React.useMemo(() => {
    const highlighted = new Set();
    if (courseId && courseMap[courseId]) {
      // Include direct prerequisites
      prereqs.forEach(pr => highlighted.add(pr));
      highlighted.add(courseId);
    }
    return highlighted;
  }, [courseId, courseMap, prereqs]);

  // Calculate highlighted edges
  const highlightedEdges = React.useMemo(() => {
    const edgeSet = new Set();
    if (courseId && prereqs.length > 0) {
      prereqs.forEach(pr => {
        const edgeId = `${pr}->${courseId}`;
        edgeSet.add(edgeId);
      });
    }
    return edgeSet;
  }, [courseId, prereqs]);

  // Calculate AND/OR prereqs if available
  const { highlightedAnd, highlightedOr } = React.useMemo(() => {
    const and = new Set();
    const or = new Set();
    
    if (courseId && courseMap[courseId]?.prereqTree) {
      const tree = courseMap[courseId].prereqTree;
      // Simple extraction of AND/OR nodes from prereqTree
      if (tree && tree.and) {
        tree.and.forEach(child => {
          if (typeof child === 'string') and.add(child);
        });
      } else if (tree && tree.or) {
        tree.or.forEach(child => {
          if (typeof child === 'string') or.add(child);
        });
      }
    }
    
    return { highlightedAnd: and, highlightedOr: or };
  }, [courseId, courseMap]);
  
  // Helper function to render prereq tree with logical structure
  const renderPrereqTree = React.useCallback((tree, depth = 0) => {
    if (!tree) return null;
    
    // If it's just a course number string
    if (typeof tree === 'string') {
      return (
        <span
          className="prereq-hoverable"
          onMouseEnter={e => {
            setHoveredPrereq(tree);
            const rect = e.target.getBoundingClientRect();
            const parentRect = detailsRef.current?.getBoundingClientRect();
            setTooltipPos({
              x: rect.left - (parentRect?.left || 0) + rect.width / 2,
              y: rect.top - (parentRect?.top || 0),
              text: courseMap[tree]?.name || ''
            });
          }}
          onMouseLeave={() => setHoveredPrereq(null)}
        >
          {tree}
        </span>
      );
    }
    
    // Handle AND condition
    if (tree.and) {
      return (
        <span className="prereq-logic-group">
          {tree.and.map((child, index) => (
            <React.Fragment key={`and-${depth}-${index}`}>
              {index > 0 && <span className="prereq-logic-operator"> וגם </span>}
              {renderPrereqTree(child, depth + 1)}
            </React.Fragment>
          ))}
        </span>
      );
    }
    
    // Handle OR condition
    if (tree.or) {
      return (
        <span className="prereq-logic-group">
          {tree.or.map((child, index) => (
            <React.Fragment key={`or-${depth}-${index}`}>
              {index > 0 && <span className="prereq-logic-operator"> או </span>}
              {renderPrereqTree(child, depth + 1)}
            </React.Fragment>
          ))}
        </span>
      );
    }
    
    return null;
  }, [courseMap]);

  return (
    <div className="react-flow__info-popup">
      <div className="react-flow__info-popup-header">
        <button className="react-flow__info-popup-close" onClick={onClose}>
          <IoClose size={24} />
        </button>
        <h2 className="react-flow__info-popup-title">{course['שם מקצוע']}</h2>
      </div>
      
      <div className="react-flow__info-popup-content">
        <div className="react-flow__info-popup-details-container">
          <div className="react-flow__info-popup-details" ref={detailsRef}>
            <b>מספר מקצוע:</b> {course['מספר מקצוע']}<br />
            <b>נקודות:</b> {course['נקודות'] || '-'}<br />
            <b>קדמים:</b>{' '}
            {courseMap[courseId]?.prereqTree 
              ? (
                  <>
                    {renderPrereqTree(courseMap[courseId].prereqTree)}
                    {hoveredPrereq && (
                      <span
                        className="prereq-tooltip"
                        style={{
                          left: tooltipPos.x,
                          top: tooltipPos.y - 5,
                          visibility: hoveredPrereq && tooltipPos.text ? 'visible' : 'hidden',
                        }}
                      >
                        {courseMap[hoveredPrereq]?.name || ''}
                      </span>
                    )}
                  </>
                )
              : '-'}
            <br />
            <b>סילבוס:</b> <span className="syllabus-text">{course['סילבוס'] || '-'}</span><br />
          </div>
        </div>
        
        <div className="react-flow__info-popup-graph">
          <CourseGraphView
            nodes={layoutedNodes}
            edges={edges}
            selected={courseId}
            highlighted={highlightedNodes}
            highlightedAnd={highlightedAnd}
            highlightedOr={highlightedOr}
            highlightedEdges={highlightedEdges}
            style={{
              width: '100%', 
              height: '480px',
              background: '#23272f', 
              borderRadius: '12px', 
              overflow: 'hidden' 
            }}
            fitView
          />
        </div>
      </div>
    </div>
  );
};

export default InfoPopup;
