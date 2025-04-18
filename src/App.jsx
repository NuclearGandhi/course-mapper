import React, { useEffect, useState } from 'react';
import ReactFlow, { Background, Controls, MiniMap } from 'reactflow';
import 'reactflow/dist/style.css';
import './App.css';
import { buildCourseMap, mergeCourseMaps, courseNodesAndEdges, applyDagreLayout } from './courseGraph';

function getAllPrereqs(courseMap, courseNum, visited = new Set()) {
  if (!courseMap[courseNum] || visited.has(courseNum)) return visited;
  visited.add(courseNum);
  courseMap[courseNum].prereqs.forEach(pr => getAllPrereqs(courseMap, pr, visited));
  return visited;
}

const InfoPopup = ({ course, onClose }) => (
  <div style={{
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    background: '#23272f',
    color: '#fff',
    border: '2px solid #0af',
    borderRadius: 12,
    padding: 24,
    zIndex: 1000,
    minWidth: 300,
    boxShadow: '0 0 32px #000a',
  }}>
    <button onClick={onClose} style={{ float: 'left', background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer' }}>×</button>
    <h2 style={{ textAlign: 'right', marginTop: 0 }}>{course['שם מקצוע']}</h2>
    <div style={{ textAlign: 'right', fontSize: 15 }}>
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
                <div style={{ textAlign: 'right', color: highlighted.has(node.id) ? '#ff0' : '#fff' }}>
                  <b>{node.data.name}</b>
                  <div style={{ fontSize: 12, color: '#0af' }}>
                    {node.data.id} [{node.data.semesters && node.data.semesters.map(s => s === 'חורף' ? 'חורף' : 'אביב').join(', ')}]
                  </div>
                </div>
              )
            },
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
            showInteractive={true}
            className="custom-controls"
          />
          <Background gap={16}  />
        </ReactFlow>
        {popupCourse && <InfoPopup course={popupCourse} onClose={() => setPopupCourse(null)} />}
      </div>
  );
};

export default App;
