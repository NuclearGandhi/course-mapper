// All course graph helpers for the node map

import dagre from 'dagre';

// Parse prerequisites string to array of course numbers
export function parsePrerequisites(prereqStr) {
  if (!prereqStr) return [];
  return prereqStr
    .replace(/[()]/g, '')
    .split(/\s*או\s*|\s*ו\s*|\s+/)
    .map(s => s.trim())
    .filter(s => /^\d{8}$/.test(s));
}

// Build a map: courseNum -> { name, prereqs: [courseNum, ...], semesters: ["חורף", "אביב"] }
export function buildCourseMap(courses, semesterLabel) {
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
        if (!map[num].semesters.includes(semesterLabel)) {
          map[num].semesters.push(semesterLabel);
        }
      }
    }
  });
  return map;
}

export function mergeCourseMaps(winterMap, springMap) {
  const merged = { ...winterMap };
  for (const [num, course] of Object.entries(springMap)) {
    if (merged[num]) {
      merged[num].semesters = Array.from(new Set([...merged[num].semesters, ...course.semesters]));
      merged[num].prereqs = Array.from(new Set([...merged[num].prereqs, ...course.prereqs]));
    } else {
      merged[num] = course;
    }
  }
  return merged;
}

export function courseNodesAndEdges(courseMap) {
  const nodes = [];
  const edges = [];
  const edgeSet = new Set(); // Track unique edge ids
  const nodeIds = Object.keys(courseMap);
  const xStep = 350;
  const yStep = 120;
  let x = 0;
  let y = 0;
  nodeIds.forEach((id, idx) => {
    x = (idx % 5) * xStep;
    y = Math.floor(idx / 5) * yStep;
    const course = courseMap[id];
    nodes.push({
      id,
      data: {
        name: course.name,
        semesters: course.semesters,
        id: id,
      },
      position: { x, y },
      style: { minWidth: 180, maxWidth: 250, borderRadius: 8, padding: 8 },
    });
  });
  nodeIds.forEach(id => {
    const course = courseMap[id];
    course.prereqs.forEach(prereq => {
      if (courseMap[prereq]) {
        const edgeId = `${prereq}->${id}`;
        if (!edgeSet.has(edgeId)) {
          edges.push({ id: edgeId, source: prereq, target: id, animated: false });
          edgeSet.add(edgeId);
        }
      }
    });
  });
  return { nodes, edges };
}

export function applyDagreLayout(nodes, edges) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'TB', marginx: 50, marginy: 100 }); // Increased marginy for larger vertical spacing
  g.setDefaultEdgeLabel(() => ({}));

  // Add nodes to the graph
  nodes.forEach(node => {
    g.setNode(node.id, { width: 180, height: 50 });
  });

  // Add edges to the graph
  edges.forEach(edge => {
    g.setEdge(edge.source, edge.target);
  });

  // Run the dagre layout
  dagre.layout(g);

  // Update node positions based on the layout
  const updatedNodes = nodes.map(node => {
    const nodeWithPosition = g.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x, // Center the node horizontally
        y: nodeWithPosition.y, // Center the node vertically
      },
    };
  });

  return updatedNodes;
}
