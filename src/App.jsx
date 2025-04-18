import React, { useEffect, useState } from 'react';
import './App.css';

// Helper: Parse prerequisites string to array of course numbers
function parsePrerequisites(prereqStr) {
  if (!prereqStr) return [];
  // Remove parentheses, split by 'או' (or), 'ו' (and), spaces, etc.
  return prereqStr
    .replace(/[()]/g, '')
    .split(/\s*או\s*|\s*ו\s*|\s+/)
    .map(s => s.trim())
    .filter(s => /^\d{8}$/.test(s));
}

// Build a map: courseNum -> { name, prereqs: [courseNum, ...], semesters: ["חורף", "אביב"] }
function buildCourseMap(courses, semesterLabel) {
  const map = {};
  courses.forEach(course => {
    const general = course.general || {};
    const num = general['מספר מקצוע'];
    const name = general['שם מקצוע'];
    const prereqStr = general['מקצועות קדם'];
    if (num && name) {
      if (!map[num]) {
        map[num] = {
          name,
          prereqs: parsePrerequisites(prereqStr),
          semesters: [semesterLabel],
        };
      } else {
        // Merge semesters if duplicate
        if (!map[num].semesters.includes(semesterLabel)) {
          map[num].semesters.push(semesterLabel);
        }
      }
    }
  });
  return map;
}

function mergeCourseMaps(winterMap, springMap) {
  const merged = { ...winterMap };
  for (const [num, course] of Object.entries(springMap)) {
    if (merged[num]) {
      // Merge semesters and prereqs
      merged[num].semesters = Array.from(new Set([...merged[num].semesters, ...course.semesters]));
      merged[num].prereqs = Array.from(new Set([...merged[num].prereqs, ...course.prereqs]));
    } else {
      merged[num] = course;
    }
  }
  return merged;
}

// Find root courses (no one lists them as a prerequisite)
function findRootCourses(courseMap) {
  const all = new Set(Object.keys(courseMap));
  const children = new Set();
  Object.values(courseMap).forEach(c => c.prereqs.forEach(p => children.add(p)));
  return [...all].filter(num => !children.has(num));
}

// Recursively build tree nodes
function buildTree(courseMap, courseNum, visited = new Set()) {
  if (visited.has(courseNum)) return null; // Prevent cycles
  visited.add(courseNum);
  const course = courseMap[courseNum];
  if (!course) return null;
  return {
    num: courseNum,
    name: course.name,
    children: course.prereqs.map(p => buildTree(courseMap, p, new Set(visited))).filter(Boolean),
  };
}

// Flatten tree for rendering
function flattenTree(node, depth = 0, expanded = {}, arr = []) {
  if (!node) return arr;
  arr.push({ ...node, depth });
  if (expanded[node.num]) {
    node.children.forEach(child => flattenTree(child, depth + 1, expanded, arr));
  }
  return arr;
}

const TreeRow = ({ node, onToggle, expanded }) => (
  <div
    style={{
      paddingRight: node.depth * 24,
      direction: 'rtl',
      textAlign: 'right',
      cursor: node.children.length ? 'pointer' : 'default',
      userSelect: 'none',
      fontWeight: node.children.length ? 'bold' : 'normal',
    }}
    onClick={() => node.children.length && onToggle(node.num)}
  >
    {node.children.length ? (expanded[node.num] ? '▼' : '▶') : '•'}{' '}
    {node.name} <span style={{ color: '#888', fontSize: 12 }}>({node.num})</span>
    <span style={{ color: '#0a7', fontSize: 12, marginRight: 8 }}>
      [{node.semesters && node.semesters.map(s => s === 'חורף' ? 'חורף' : 'אביב').join(', ')}]
    </span>
  </div>
);

const App = () => {
  const [courseMap, setCourseMap] = useState({});
  const [roots, setRoots] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [treeRows, setTreeRows] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const [winter, spring] = await Promise.all([
        fetch('/last_winter_semester.json').then(r => r.json()),
        fetch('/last_spring_semester.json').then(r => r.json()),
      ]);
      const winterMap = buildCourseMap(winter, 'חורף');
      const springMap = buildCourseMap(spring, 'אביב');
      const merged = mergeCourseMaps(winterMap, springMap);
      setCourseMap(merged);
      setRoots(findRootCourses(merged));
    };
    fetchData();
  }, []);

  useEffect(() => {
    // Build and flatten all root trees
    let rows = [];
    roots.forEach(rootNum => {
      const tree = buildTree(courseMap, rootNum);
      flattenTree(tree, 0, expanded, rows);
    });
    setTreeRows(rows);
  }, [courseMap, roots, expanded]);

  const handleToggle = num => setExpanded(e => ({ ...e, [num]: !e[num] }));

  return (
    <div className="App" style={{ direction: 'rtl', textAlign: 'right', height: '100vh', overflow: 'auto' }}>
      <h1>מפת קורסים - עץ קדם</h1>
      {treeRows.length === 0 ? (
        <div>טוען נתונים...</div>
      ) : (
        treeRows.map(node => (
          <TreeRow key={node.num + '-' + node.depth} node={node} onToggle={handleToggle} expanded={expanded} />
        ))
      )}
    </div>
  );
};

export default App;
