import React, { useEffect, useState } from 'react';
import ReactFlow, { Background, Controls, MiniMap } from 'reactflow';
import 'reactflow/dist/style.css';
import './App.css';
import { buildCourseMap, mergeCourseMaps, courseNodesAndEdges } from './courseGraph';

const App = () => {
  const [elements, setElements] = useState({ nodes: [], edges: [] });

  useEffect(() => {
    const fetchData = async () => {
      const [winter, spring] = await Promise.all([
        fetch('/last_winter_semester.json').then(r => r.json()),
        fetch('/last_spring_semester.json').then(r => r.json()).catch(() => []),
      ]);
      const winterMap = buildCourseMap(winter, 'חורף');
      const springMap = buildCourseMap(spring, 'אביב');
      const merged = mergeCourseMaps(winterMap, springMap);
      setElements(courseNodesAndEdges(merged));
    };
    fetchData();
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', direction: 'rtl', background: '#181a20' }}>
      <h1 style={{ textAlign: 'right', padding: 16, color: '#fff' }}>מפת קורסים - גרף קדם אינטראקטיבי</h1>
      <div style={{ width: '100%', height: '90vh' }}>
        <ReactFlow
          nodes={elements.nodes.map(node => ({
            ...node,
            data: {
              ...node.data,
              label: (
                <div style={{ direction: 'rtl', textAlign: 'right', color: '#fff' }}>
                  <b>{node.data.name}</b>
                  <div style={{ fontSize: 12, color: '#0af' }}>
                    {node.data.id} [{node.data.semesters && node.data.semesters.map(s => s === 'חורף' ? 'חורף' : 'אביב').join(', ')}]
                  </div>
                </div>
              )
            }
          }))}
          edges={elements.edges}
          fitView
          panOnDrag
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable
          style={{ direction: 'rtl', background: '#181a20' }}
        >
          <MiniMap nodeColor={() => '#23272f'} maskColor="#2229" style={{ background: '#23272f' }} />
          <Controls style={{ background: '#23272f', color: '#fff' }} />
          <Background gap={16} color="#333" />
        </ReactFlow>
      </div>
    </div>
  );
};

export default App;
