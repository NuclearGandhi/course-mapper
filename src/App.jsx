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
    <div style={{ width: '100vw', height: '100vh', background: '#181a20' }}>
      <h1 style={{ textAlign: 'center', margin: 0, color: '#fff' }}>מפת קורסים - גרף קדמים אינטראקטיבי</h1>
      <div style={{ width: '100%', height: '90vh' }}>
        <ReactFlow
          nodes={elements.nodes.map(node => ({
            ...node,
            data: {
              ...node.data,
              label: (
                <div style={{ textAlign: 'right', color: highlighted.has(node.id) ? '#ff0' : '#fff', fontWeight: node.id === selected ? 'bold' : 'normal' }}>
                  <b>{node.data.name}</b>
                  <div style={{ fontSize: 12, color: '#0af' }}>
                    {node.data.id} [{node.data.semesters && node.data.semesters.map(s => s === 'חורף' ? 'חורף' : 'אביב').join(', ')}]
                  </div>
                </div>
              )
            },
            style: {
              ...node.style,
              border: node.id === selected ? '3px solid #ff0' : highlighted.has(node.id) ? '2px solid #ff0' : node.style.border,
              boxShadow: node.id === selected ? '0 0 12px #ff0' : undefined,
              zIndex: node.id === selected ? 10 : undefined,
            },
            selected: node.id === selected,
            draggable: true,
            onClick: (_, n) => setSelected(n.id),
            onDoubleClick: (_, n) => setPopupCourse(rawCourses[n.id]),
          }))}
          edges={elements.edges.map(edge => ({
            ...edge,
            style: highlighted.has(edge.source) && highlighted.has(edge.target)
              ? { ...edge.style, stroke: '#ff0', strokeWidth: 3 }
              : edge.style,
          }))}
          fitView
          panOnDrag
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable
          style={{ background: '#181a20' }}
          onNodeClick={(_, n) => setSelected(n.id)}
          onNodeDoubleClick={(_, n) => setPopupCourse(rawCourses[n.id])}
        >
          <MiniMap nodeColor={n => highlighted.has(n.id) ? '#ff0' : '#23272f'} maskColor="#2229" style={{ background: '#23272f' }} />
          <Controls style={{ color: '#fff' }} />
          <Background gap={16} color="#333" />
        </ReactFlow>
        {popupCourse && <InfoPopup course={popupCourse} onClose={() => setPopupCourse(null)} />}
      </div>
    </div>
  );
};

export default App;
