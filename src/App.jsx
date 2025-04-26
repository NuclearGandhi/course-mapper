import React, { useEffect, useState, useCallback } from 'react';
import { Background, Controls, MiniMap } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './App.css';
import { courseNodesAndEdges, applySemesterLayout, extractCourseNumbersFromTree } from './courseGraph';
import InfoPopup from './components/InfoPopup';
import CourseGraphView from './components/CourseGraphView';
import SearchBar from './components/SearchBar';

// Helper to get all prerequisites of a course recursively
function getAllPrereqs(courseMap, courseNum, visited = new Set()) {
  if (!courseMap[courseNum] || visited.has(courseNum)) return visited;
  visited.add(courseNum);
  const prereqs = extractCourseNumbersFromTree(courseMap[courseNum].prereqTree);
  prereqs.forEach(pr => getAllPrereqs(courseMap, pr, visited));
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

// Helper function to resolve paths relative to the base URL of the app
const resolvePath = (path) => {
  // Remove any leading slash
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;
  // Get base URL from import.meta.env
  const base = import.meta.env.BASE_URL || '/';
  return `${base}${cleanPath}`;
};

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
  const [searchableItems, setSearchableItems] = useState([]);
  
  // Reference to ReactFlow instance for panning to nodes
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  // Add defaultViewport state for initial positioning
  const [defaultViewport, setDefaultViewport] = useState(null);
  const [initialPositionSet, setInitialPositionSet] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Load mechanical engineering courses data
        const coursePaths = await fetch(resolvePath('path/course_paths.json'))
          .then(r => {
            if (!r.ok) throw new Error(`Failed to load course paths: ${r.status}`);
            return r.json();
          });
        
        // Store the semester data for layout purposes
        // Create a set of all course numbers from the JSON file
        const courseNumbers = new Set();
        Object.values(coursePaths['הנדסת מכונות']).forEach(courses => {
          courses.forEach(courseNum => courseNumbers.add(courseNum));
        });
        
        // Load the pre-merged course data created by the Python script
        const mergedCourses = await fetch(resolvePath('data/merged_courses.json'))
          .then(r => {
            if (!r.ok) throw new Error(`Failed to load merged course data: ${r.status}`);
            return r.json();
          });
        
        // Filter to only include courses in the study path
        const filtered = Object.fromEntries(
          Object.entries(mergedCourses).filter(([num]) => courseNumbers.has(num))
        );
        
        // Find missing prereqs by extracting course numbers from prereqTree
        for (const course of Object.values(filtered)) {
          const prereqNumbers = extractCourseNumbersFromTree(course.prereqTree);
          for (const prereq of prereqNumbers) {
            if (!filtered[prereq] && mergedCourses[prereq]) {
              filtered[prereq] = mergedCourses[prereq];
            }
          }
        }
        
        setCourseMap(filtered);
        
        // Prepare searchable items
        const searchItems = Object.entries(filtered).map(([id, course]) => ({
          id,
          name: course.name,
        }));
        setSearchableItems(searchItems);
        
        // Save raw course info for popups
        // We still need to load the individual semester data for course details
        const [winter, spring] = await Promise.all([
          fetch(resolvePath('data/last_winter_semester.json'))
            .then(r => r.ok ? r.json() : [])
            .catch(() => []),
          fetch(resolvePath('data/last_spring_semester.json'))
            .then(r => r.ok ? r.json() : [])
            .catch(() => []),
        ]);
        
        const raw = {};
        [...winter, ...spring].forEach(c => {
          if (c.general && c.general['מספר מקצוע']) raw[c.general['מספר מקצוע']] = c.general;
        });
        setRawCourses(raw);
        
        // Process course nodes and edges with the new semester-based layout
        const { nodes, edges } = courseNodesAndEdges(filtered);
        const layoutedNodes = applySemesterLayout(nodes, edges, coursePaths['הנדסת מכונות']);
        setElements({ nodes: layoutedNodes, edges });
        
        // Set initial viewport position once nodes are available
        if (layoutedNodes.length > 0) {
          // Find the topmost nodes (courses from early semesters)
          const sortedByY = [...layoutedNodes].sort((a, b) => a.position.y - b.position.y);
          const topNodes = sortedByY.slice(0, 5); // Take the top 5 nodes
          
          // Calculate the average x position of top nodes
          const avgX = topNodes.reduce((sum, node) => sum + node.position.x, 0) / topNodes.length;
          const topY = sortedByY[0].position.y;
          
          // Set default viewport to focus on the top of the graph
          setDefaultViewport({
            x: avgX,
            y: topY - 100, // Position slightly above the topmost node
            zoom: 1.2,     // Slight zoom for better visibility
          });
        }
      } catch (error) {
        console.error("Error fetching course data:", error);
      }
    };
    fetchData();
  }, []);

  // Handle initial positioning when ReactFlow instance is available
  const onInit = useCallback((instance) => {
    setReactFlowInstance(instance);
    if (defaultViewport && !initialPositionSet) {
      // Use setTimeout to ensure this happens after the component is fully rendered
      setTimeout(() => {
        instance.setCenter(
          defaultViewport.x,
          defaultViewport.y,
          { zoom: defaultViewport.zoom, duration: 1000 }
        );
        setInitialPositionSet(true);
      }, 500);
    }
  }, [defaultViewport, initialPositionSet]);

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

  // Function to handle search result selection
  const handleSearchSelect = useCallback((course) => {
    if (!course || !course.id) return;
    
    setSelected(course.id);
    
    // Pan the view to focus on the selected node
    if (reactFlowInstance) {
      // Find the node coordinates
      const node = elements.nodes.find(n => n.id === course.id);
      if (node) {
        const x = node.position.x;
        const y = node.position.y;
        const zoom = 1.5; // Slightly zoomed in for better visibility
        
        reactFlowInstance.setCenter(x, y, { zoom, duration: 800 });
      }
    }
  }, [elements.nodes, reactFlowInstance]);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <CourseGraphView
        nodes={elements.nodes}
        edges={elements.edges}
        selected={selected}
        highlighted={highlighted}
        highlightedAnd={highlightedAnd}
        highlightedOr={highlightedOr}
        highlightedEdges={highlightedEdges}
        style={{ width: '100%', height: '100%' }}
        onNodeClick={(_, n) => setSelected(n.id)}
        onNodeDoubleClick={(_, n) => setPopupCourse(rawCourses[n.id])}
        onInit={onInit}
        fitView={false} // Disable automatic fitView
        showControls={true}
        showMiniMap={true}
      />
      
      <div className="app-floating-elements">
        <div className="app-logo-section">
          <img src={resolvePath('icons/icon.png')} alt="CourseMapper Logo" className="app-logo" />
          <h1>CourseMapper</h1>
        </div>
      </div>
      
      <div className="app-search-container">
        <SearchBar 
          courses={searchableItems}
          onSelectResult={handleSearchSelect}
        />
      </div>
      
      {popupCourse && <InfoPopup course={popupCourse} onClose={() => setPopupCourse(null)} courseMap={courseMap} />}
    </div>
  );
};

export default App;
