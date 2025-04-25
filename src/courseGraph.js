// All course graph helpers for the node map

import dagre from 'dagre';

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

// Extract all course numbers from a prerequisite tree
function extractCourseNumbersFromTree(tree) {
  const result = new Set();
  
  function traverse(node) {
    if (!node) return;
    
    if (typeof node === 'string') {
      if (/^\d{8}$/.test(node)) {
        result.add(node);
      }
      return;
    }
    
    if (node.and) {
      node.and.forEach(child => traverse(child));
    }
    
    if (node.or) {
      node.or.forEach(child => traverse(child));
    }
  }
  
  traverse(tree);
  return Array.from(result);
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
        const prereqTree = parsePrerequisiteTree(prereqStr);
        map[num] = {
          name,
          prereqs: extractCourseNumbersFromTree(prereqTree),
          prereqTree: prereqTree,
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
  
  // Use consistent dimensions for node sizing
  const nodeWidth = 180;
  const nodeHeight = 70; // Increased to match min-height in CSS
  
  nodeIds.forEach((id) => {
    const course = courseMap[id];
    nodes.push({
      id,
      data: {
        name: course.name,
        semesters: course.semesters,
        id: id,
      },
      // Position will be set by the layout function
      position: { x: 0, y: 0 },
      width: nodeWidth,
      height: nodeHeight,
      style: { borderRadius: 8, padding: 8 },
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

// New function for semester-based layout
export function applySemesterLayout(nodes, edges, semesterData) {
  // Define semesters and other lists in the correct order
  const semesterOrder = [
    "סמסטר א'",
    "סמסטר ב'",
    "סמסטר ג'",
    "סמסטר ד'",
    "סמסטר ה'",
    "סמסטר ו'",
    "סמסטר ז'",
    "סמסטר ח'",
    "רשימה א'",
    "רשימה ב'",
    "רשימה ג'",
    "רשימה ד'",
    "רשימה ה'"
  ];

  // Column width and spacing
  const columnWidth = 300;
  const nodeVertSpacing = 100;

  // Create a map of course to its semester
  const courseToSemester = {};
  
  // Create a set of all courses in the JSON file
  const coursesInJson = new Set();
  Object.values(semesterData).forEach(courses => {
    courses.forEach(courseId => coursesInJson.add(courseId));
  });
  
  // First, map courses from semesters 1-5 to their respective semesters
  for (let i = 0; i < 5; i++) {
    const semester = semesterOrder[i];
    const courses = semesterData[semester] || [];
    courses.forEach(courseId => {
      // Only set if course hasn't been assigned yet
      if (courseToSemester[courseId] === undefined) {
        courseToSemester[courseId] = i;
      }
    });
  }
  
  // Create arrays for all semester columns
  const columns = Array(8).fill().map(() => []);
  
  // First, assign courses from semesters 1-5 to their respective columns
  nodes.forEach(node => {
    const courseId = node.id;
    const semesterIdx = courseToSemester[courseId];
    
    if (semesterIdx !== undefined && semesterIdx < 5) {
      columns[semesterIdx].push(node);
    }
  });
  
  // Now distribute list courses and courses from semesters 6-8 among columns 5-7
  // First, collect all courses from semesters 6-8 and all lists
  const laterCourses = new Set();
  
  // Add courses from semesters 6-8
  for (let i = 5; i < 8; i++) {
    const semester = semesterOrder[i];
    const courses = semesterData[semester] || [];
    courses.forEach(courseId => {
      laterCourses.add(courseId);
      // Assign to the corresponding semester column
      courseToSemester[courseId] = i;
    });
  }
  
  // Add courses from all lists
  for (let i = 8; i < semesterOrder.length; i++) {
    const list = semesterOrder[i];
    const courses = semesterData[list] || [];
    courses.forEach(courseId => {
      laterCourses.add(courseId);
      // Don't assign a semester yet, we'll do that based on prerequisites
    });
  }
  
  // Create a prerequisites graph for later courses and external prerequisites
  const prereqGraph = {};
  
  // Identify external prerequisite courses (not in JSON but in the node list)
  const externalPrereqs = new Set();
  nodes.forEach(node => {
    const courseId = node.id;
    if (!coursesInJson.has(courseId)) {
      externalPrereqs.add(courseId);
    }
  });
  
  // Initialize the graph with all nodes that need placement
  nodes.forEach(node => {
    const courseId = node.id;
    prereqGraph[courseId] = { 
      prereqs: [], 
      dependents: [],
      isExternal: externalPrereqs.has(courseId)
    };
  });
  
  // Build the graph connections
  edges.forEach(edge => {
    if (prereqGraph[edge.target] && prereqGraph[edge.source]) {
      prereqGraph[edge.target].prereqs.push(edge.source);
      prereqGraph[edge.source].dependents.push(edge.target);
    }
  });
  
  // Helper function to determine the depth level of a course in the prereq graph
  function getDepthLevel(courseId, visited = new Set()) {
    if (visited.has(courseId)) return 0; // Avoid cycles
    visited.add(courseId);
    
    const prereqs = prereqGraph[courseId]?.prereqs || [];
    if (prereqs.length === 0) return 0;
    
    const prereqDepths = prereqs.map(p => getDepthLevel(p, new Set(visited)));
    return Math.max(...prereqDepths) + 1;
  }
  
  // Helper function to determine the reverse depth level 
  // (how many courses depend on this one)
  function getReverseDependencyLevel(courseId, visited = new Set()) {
    if (visited.has(courseId)) return 0; // Avoid cycles
    visited.add(courseId);
    
    const dependents = prereqGraph[courseId]?.dependents || [];
    if (dependents.length === 0) return 0;
    
    const dependentDepths = dependents.map(d => getReverseDependencyLevel(d, new Set(visited)));
    return Math.max(...dependentDepths) + 1;
  }
  
  // First assign courses from semesters 6-8 to their respective columns
  for (let i = 5; i < 8; i++) {
    const semester = semesterOrder[i];
    (semesterData[semester] || []).forEach(courseId => {
      const node = nodes.find(n => n.id === courseId);
      if (node) {
        columns[i].push(node);
      }
    });
  }
  
  // For courses from the lists, distribute across semesters 6-8 based on prerequisites
  const listCourses = new Set();
  for (let i = 8; i < semesterOrder.length; i++) {
    (semesterData[semesterOrder[i]] || []).forEach(courseId => listCourses.add(courseId));
  }
  
  // Calculate dependency levels for list courses
  const courseDepths = {};
  listCourses.forEach(courseId => {
    courseDepths[courseId] = getDepthLevel(courseId);
  });
  
  // Distribute list courses to semesters 6-8 based on depth levels
  listCourses.forEach(courseId => {
    const node = nodes.find(n => n.id === courseId);
    if (!node) return;
    
    const depth = courseDepths[courseId];
    
    // Distribute based on depth
    let targetColumn;
    if (depth === 0) targetColumn = 5;      // Semester 6
    else if (depth === 1) targetColumn = 6;  // Semester 7
    else targetColumn = 7;                  // Semester 8
    
    columns[targetColumn].push(node);
    courseToSemester[courseId] = targetColumn;
  });
  
  // Handle external prerequisite courses - place them in appropriate columns 
  // based on their relationship to other courses
  externalPrereqs.forEach(courseId => {
    const node = nodes.find(n => n.id === courseId);
    if (!node) return;
    
    // Calculate dependency depth to determine the best placement
    // A course that is a prerequisite for many later courses should come earlier
    const forwardDependencyDepth = getDepthLevel(courseId);
    const reverseDependencyDepth = getReverseDependencyLevel(courseId);
    
    // Strategy: 
    // 1. If a course has deep prerequisites (high forward depth), place it later
    // 2. If a course has many dependent courses (high reverse depth), place it earlier
    
    let placement;
    
    // If it's a foundational course (many things depend on it)
    if (reverseDependencyDepth > 1 && forwardDependencyDepth < 2) {
      placement = 0; // Place in first semester
    }
    // If it's a mid-tier course
    else if (reverseDependencyDepth > 0) {
      placement = Math.min(2, reverseDependencyDepth); // Place in semester 2-3
    }
    // If it's a later course with prerequisites
    else if (forwardDependencyDepth > 0) {
      placement = Math.min(7, 4 + forwardDependencyDepth); // Place in later semesters
    }
    // Default case
    else {
      placement = 4; // Default to semester 5
    }
    
    columns[placement].push(node);
    courseToSemester[courseId] = placement;
  });
  
  // Calculate the width needed for the 8 semesters
  const totalSemesterWidth = columnWidth * 8;
  
  // Position nodes in the 8 semesters in columns (right-to-left)
  for (let semesterIdx = 0; semesterIdx < 8; semesterIdx++) {
    const column = columns[semesterIdx];
    
    // Calculate x-position for right-to-left layout
    // First semester (0) will be at rightmost position
    const xPosition = totalSemesterWidth - ((semesterIdx + 1) * columnWidth);
    
    column.forEach((node, rowIdx) => {
      node.position = {
        x: xPosition,
        y: rowIdx * nodeVertSpacing
      };
      node.sourcePosition = 'left';
      node.targetPosition = 'right';
      
      // Add a special style to external prerequisite courses
      if (externalPrereqs.has(node.id)) {
        node.style = {
          ...node.style,
          borderStyle: 'dashed',
          borderColor: '#888'
        };
      }
    });
  }
  
  return nodes;
}

// For backward compatibility, keeping the old function but it's not used anymore
export function applyDagreLayout(nodes, edges) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'RL', marginx: 20, marginy: 40 }); // Right-to-left layout
  g.setDefaultEdgeLabel(() => ({}));

  // Use consistent dimensions that match the node dimensions in courseNodesAndEdges
  const nodeWidth = 180;
  const nodeHeight = 70;

  // Add nodes to the graph
  nodes.forEach(node => {
    // In v12, prefer actual width/height if available, fallback to measured values
    const width = node.width || node.measured?.width || nodeWidth;
    const height = node.height || node.measured?.height || nodeHeight;
    g.setNode(node.id, { width, height });
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
      sourcePosition: 'left',
      targetPosition: 'right',
    };
  });

  return updatedNodes;
}
