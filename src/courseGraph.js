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

// Parse prerequisites string to a logical tree (AND/OR/parentheses)
export function parsePrerequisiteTree(prereqStr) {
  if (!prereqStr) return null;
  // Tokenize: numbers, 'או', 'ו', ',', '(', ')'
  const tokens = prereqStr
    .replace(/[()]/g, m => ` ${m} `)
    .replace(/,/g, ' , ')
    .replace(/או/g, ' או ')
    .replace(/ו/g, ' ו ')
    .split(/\s+/)
    .filter(Boolean);

  let pos = 0;
  function parseExpr() {
    let items = [];
    let op = null;
    while (pos < tokens.length) {
      let t = tokens[pos];
      if (t === '(') {
        pos++;
        items.push(parseExpr());
      } else if (t === ')') {
        pos++;
        break;
      } else if (t === 'או' || t === ',' || t === 'ו') {
        op = t;
        pos++;
      } else if (/^\d{8}$/.test(t)) {
        items.push(t);
        pos++;
      } else {
        pos++;
      }
    }
    if (op === 'או') return { or: items };
    if (op === ',' || op === 'ו') return { and: items };
    if (items.length === 1) return items[0];
    return { and: items };
  }
  return parseExpr();
}

// Build a map: courseNum -> { name, prereqs: [courseNum, ...], prereqTree: logicTree, semesters: ["חורף", "אביב"] }
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
          prereqTree: parsePrerequisiteTree(prereqStr), // Store parsed logic tree
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
  const xStep = 220; // was 350, now more compact
  const yStep = 90;  // was 120, now more compact
  let x = 0;
  let y = 0;
  
  // Use consistent dimensions for node sizing
  const nodeWidth = 180;
  const nodeHeight = 70; // Increased to match min-height in CSS
  
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
      style: { width: nodeWidth, height: nodeHeight, borderRadius: 8, padding: 8 },
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
  g.setGraph({ rankdir: 'RL', marginx: 20, marginy: 40 }); // Right-to-left layout
  g.setDefaultEdgeLabel(() => ({}));

  // Use consistent dimensions that match the node dimensions in courseNodesAndEdges
  const nodeWidth = 180;
  const nodeHeight = 70;

  // Add nodes to the graph
  nodes.forEach(node => {
    g.setNode(node.id, { width: nodeWidth, height: nodeHeight });
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
        x: nodeWithPosition.x,
        y: nodeWithPosition.y,
      },
      style: { ...node.style, width: nodeWidth, height: nodeHeight },
      sourcePosition: 'left',
      targetPosition: 'right',
    };
  });

  return updatedNodes;
}
