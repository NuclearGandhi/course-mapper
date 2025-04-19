import React, { useEffect, useState } from 'react';
import { Background, Controls, MiniMap } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './App.css';
import { buildCourseMap, mergeCourseMaps, courseNodesAndEdges, applyDagreLayout } from './courseGraph';
import InfoPopup from './components/InfoPopup';
import CourseGraphView from './components/CourseGraphView';

function getAllPrereqs(courseMap, courseNum, visited = new Set()) {
  if (!courseMap[courseNum] || visited.has(courseNum)) return visited;
  visited.add(courseNum);
  courseMap[courseNum].prereqs.forEach(pr => getAllPrereqs(courseMap, pr, visited));
  return visited;
}

// Helper to traverse prereqTree and collect node ids by logic type
function collectPrereqHighlights(tree, type = null, result = { and: new Set(), or: new Set() }) {
  if (!tree) return result;
  if (typeof tree === 'string') {
    if (type) result[type].add(tree);
    return result;
  }
  if (tree.and) {
    tree.and.forEach(child => collectPrereqHighlights(child, 'and', result));
  } else if (tree.or) {
    tree.or.forEach(child => collectPrereqHighlights(child, 'or', result));
  }
  return result;
}

const App = () => {
  const [elements, setElements] = useState({ nodes: [], edges: [] });
  const [courseMap, setCourseMap] = useState({});
  const [selected, setSelected] = useState(null);
  const [highlighted, setHighlighted] = useState(new Set());
  const [highlightedAnd, setHighlightedAnd] = useState(new Set());
  const [highlightedOr, setHighlightedOr] = useState(new Set());
  const [highlightedEdges, setHighlightedEdges] = useState(new Set());
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
      const tree = courseMap[selected].prereqTree;
      const highlights = collectPrereqHighlights(tree);
      setHighlightedAnd(highlights.and);
      setHighlightedOr(highlights.or);
      // Compute highlighted edges
      const highlightedSet = new Set(getAllPrereqs(courseMap, selected));
      const { edges } = courseNodesAndEdges(courseMap);
      const edgeIds = edges
        .filter(e => highlightedSet.has(e.source) && highlightedSet.has(e.target))
        .map(e => e.id);
      setHighlightedEdges(new Set(edgeIds));
    } else {
      setHighlighted(new Set());
      setHighlightedAnd(new Set());
      setHighlightedOr(new Set());
      setHighlightedEdges(new Set());
    }
  }, [selected, courseMap]);

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
        <CourseGraphView
          nodes={elements.nodes}
          edges={elements.edges}
          selected={selected}
          highlighted={highlighted}
          highlightedAnd={highlightedAnd}
          highlightedOr={highlightedOr}
          highlightedEdges={highlightedEdges}
          style={{ width: '100vw', height: '100vh' }}
          onNodeClick={(_, n) => setSelected(n.id)}
          onNodeDoubleClick={(_, n) => setPopupCourse(rawCourses[n.id])}
          showControls={true}
          showMiniMap={true}
        />
        {popupCourse && <InfoPopup course={popupCourse} onClose={() => setPopupCourse(null)} courseMap={courseMap} />}
      </div>
  );
};

export default App;
