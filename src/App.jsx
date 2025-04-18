import React, { useEffect, useState } from 'react';
import './App.css';

const App = () => {
  const [courses, setCourses] = useState([]);

  useEffect(() => {
    const fetchCourses = async () => {
      try {

        const winterCoursesResponse = await fetch('/last_winter_semester.json');
        const winterCoursesData = await winterCoursesResponse.json();

        const springCoursesResponse = await fetch('/last_spring_semester.json');
        const springCoursesData = await springCoursesResponse.json();

        // Combine winter and spring courses
        const combinedCourses = { ...winterCoursesData, ...springCoursesData };

        // Process combined courses
        const filteredCourses = Object.values(combinedCourses).map(course => ({
          id: course.general["מספר מקצוע"],
          name: course.general["שם מקצוע"],
          prerequisites: course.general["מקצועות קדם"]?.split(/\s*או\s*|\s*\)\s*|\s*\(\s*/).filter(Boolean) || []
        }));

        setCourses(filteredCourses);
      } catch (error) {
        console.error("Error fetching courses data:", error);
      }
    };

    fetchCourses();
  }, []);

  const renderTree = (course) => (
    <li key={course.id}>
      {course.name}
      {course.prerequisites.length > 0 && (
        <ul>
          {course.prerequisites.map(prerequisiteId => {
            const prerequisite = courses.find(c => c.id === prerequisiteId);
            return prerequisite ? renderTree(prerequisite) : <li key={prerequisiteId}>{prerequisiteId}</li>;
          })}
        </ul>
      )}
    </li>
  );

  return (
    <div className="App" style={{ direction: 'rtl', textAlign: 'right' }}>
      <h1>עץ קורסים</h1>
      <ul>
        {courses.map(course => renderTree(course))}
      </ul>
    </div>
  );
};

export default App;
