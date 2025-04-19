import React, { useEffect, useState } from 'react';
import {ReactFlow, Background, Controls, MiniMap } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './App.css';
import { buildCourseMap, mergeCourseMaps, courseNodesAndEdges, applyDagreLayout } from './courseGraph';

function getAllPrereqs(courseMap, courseNum, visited = new Set()) {
  if (!courseMap[courseNum] || visited.has(courseNum)) return visited;
  visited.add(courseNum);
  courseMap[courseNum].prereqs.forEach(pr => getAllPrereqs(courseMap, pr, visited));
  return visited;
}

const InfoPopup = ({ course, onClose }) => (
  <div className="react-flow__info-popup">
    <button className="react-flow__info-popup-close" onClick={onClose}>×</button>
    <h2 className="react-flow__info-popup-title">{course['שם מקצוע']}</h2>
    <div className="react-flow__info-popup-details">
      <b>מספר מקצוע:</b> {course['מספר מקצוע']}<br />
      <b>נקודות:</b> {course['נקודות'] || '-'}<br />
      <b>קדם:</b> {course['מקצועות קדם'] || '-'}<br />
      <b>סילבוס:</b> {course['סילבוס'] || '-'}<br />
    </div>
  </div>
);

const App = () => {
  const [elements, setElements] = useState({ nodes: [], edges: [] });
  const [courseMap, setCourseMap] = useState({});
  const [selected, setSelected] = useState(null);
  const [highlighted, setHighlighted] = useState(new Set());
  const [popupCourse, setPopupCourse] = useState(null);
  const [rawCourses, setRawCourses] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      const csvText = await fetch('/path/course_numbers.csv').then(r => r.text());
      const courseNumbers = new Set(
        csvText
          .split('\n')
          .map(line => line.trim())
          .filter(line => /^\d{8}$/.test(line))
      );
      const [winter, spring] = await Promise.all([
        fetch('/data/last_winter_semester.json').then(r => r.json()),
        fetch('/data/last_spring_semester.json').then(r => r.json()).catch(() => []),
      ]);
      const winterMap = buildCourseMap(winter, 'חורף');
      const springMap = buildCourseMap(spring, 'אביב');
      const merged = mergeCourseMaps(winterMap, springMap);
      const filtered = Object.fromEntries(
        Object.entries(merged).filter(([num]) => courseNumbers.has(num))
      );
      // Find missing prereqs
      for (const course of Object.values(filtered)) {
        for (const prereq of course.prereqs) {
          if (!filtered[prereq] && merged[prereq]) {
            filtered[prereq] = merged[prereq];
          }
        }
      }
      setCourseMap(filtered);
      // Save raw course info for popups
      const raw = {};
      [...winter, ...spring].forEach(c => {
        if (c.general && c.general['מספר מקצוע']) raw[c.general['מספר מקצוע']] = c.general;
      });
      setRawCourses(raw);
      const { nodes, edges } = courseNodesAndEdges(filtered);
      const layoutedNodes = applyDagreLayout(nodes, edges);
      setElements({ nodes: layoutedNodes, edges });
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (selected && courseMap[selected]) {
      setHighlighted(new Set(getAllPrereqs(courseMap, selected)));
    } else {
      setHighlighted(new Set());
    }
  }, [selected, courseMap]);

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
        <ReactFlow
          colorMode="dark"
          nodes={elements.nodes.map(node => ({
            ...node,
            data: {
              ...node.data,
              label: (
                <div className="react-flow__node-label">
                  <b>{node.data.name}</b>
                  <div className="react-flow__node-label-id">
                    {node.data.id} [{node.data.semesters && node.data.semesters.map(s => s === 'חורף' ? 'חורף' : 'אביב').join(', ')}]
                  </div>
                </div>
              )
            },
            className: `${node.className || ''}${highlighted.has(node.id) ? ' highlighted' : ''}`,
            style: {
              ...node.style,
              zIndex: node.id === selected ? 10 : undefined,
            },
            selected: node.id === selected,
            draggable: true,
            onClick: (_, n) => setSelected(n.id),
            onDoubleClick: (_, n) => setPopupCourse(rawCourses[n.id]),
          }))}
          edges={elements.edges.map(edge => ({
            ...edge
          }))}
          fitView
          panOnDrag
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable
          onNodeClick={(_, n) => setSelected(n.id)}
          onNodeDoubleClick={(_, n) => setPopupCourse(rawCourses[n.id])}
        >
          <MiniMap/>
          <Controls 
            className="custom-controls"
          />
          <Background/>
        </ReactFlow>
        {popupCourse && <InfoPopup course={popupCourse} onClose={() => setPopupCourse(null)} />}
      </div>
  );
};

export default App;
