import React, { useEffect, useState } from 'react';
import './App.css';

const App = () => {
  const [courses, setCourses] = useState([]);

  useEffect(() => {
    const fetchCourses = async () => {
      const lastSemestersUrl = "https://michael-maltsev.github.io/technion-sap-info-fetcher/last_semesters.json";
      const coursesUrl = "https://michael-maltsev.github.io/technion-sap-info-fetcher/courses.json";

      try {
        // Fetch last semester data
        const lastSemestersResponse = await fetch(lastSemestersUrl);
        const lastSemestersData = await lastSemestersResponse.json();
        const lastSemesterKey = Object.keys(lastSemestersData).pop();

        // Fetch courses data for the last semester
        const coursesResponse = await fetch(coursesUrl);
        const coursesData = await coursesResponse.json();

        // Filter and map courses data
        const filteredCourses = Object.values(coursesData[lastSemesterKey] || {}).map(course => ({
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
