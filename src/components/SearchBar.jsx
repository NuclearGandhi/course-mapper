import React, { useState, useEffect, useRef } from 'react';
import './SearchBar.css';

const SearchBar = ({ courses, onSelectResult, className }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const inputRef = useRef(null);
  const resultsContainerRef = useRef(null);

  // Search functionality
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    
    const query = searchQuery.toLowerCase();
    const results = Object.values(courses)
      .filter(course => 
        course.name?.toLowerCase().includes(query) || 
        course.id?.toLowerCase().includes(query)
      )
      .slice(0, 20); // Limit to 20 results for performance
    
    setSearchResults(results);
    setCurrentIndex(results.length > 0 ? 0 : -1);
  }, [searchQuery, courses]);

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      return;
    }

    if (!isOpen && (e.key === 'ArrowDown' || e.key === '/')) {
      setIsOpen(true);
      if (e.key === '/') {
        e.preventDefault(); // Prevent '/' from being entered in the input
      }
      return;
    }

    if (!searchResults.length) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setCurrentIndex(prev => (prev + 1) % searchResults.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setCurrentIndex(prev => (prev - 1 + searchResults.length) % searchResults.length);
        break;
      case 'Enter':
        if (currentIndex >= 0 && currentIndex < searchResults.length) {
          handleResultClick(searchResults[currentIndex]);
        }
        break;
    }
  };

  const handleResultClick = (course) => {
    onSelectResult(course);
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleNextResult = () => {
    if (searchResults.length > 0) {
      const newIndex = (currentIndex + 1) % searchResults.length;
      setCurrentIndex(newIndex);
      onSelectResult(searchResults[newIndex]);
    }
  };

  const handlePrevResult = () => {
    if (searchResults.length > 0) {
      const newIndex = (currentIndex - 1 + searchResults.length) % searchResults.length;
      setCurrentIndex(newIndex);
      onSelectResult(searchResults[newIndex]);
    }
  };

  // Scroll the highlighted result into view
  useEffect(() => {
    if (currentIndex >= 0 && resultsContainerRef.current) {
      const resultElements = resultsContainerRef.current.querySelectorAll('.search-result');
      if (resultElements[currentIndex]) {
        resultElements[currentIndex].scrollIntoView({ block: 'nearest' });
      }
    }
  }, [currentIndex]);

  return (
    <div className={`search-container ${className || ''}`}>
      <div className="search-input-wrapper">
        <input
          ref={inputRef}
          type="text"
          placeholder="Search courses... (Press / to focus)"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="search-input"
        />
        {searchQuery && (
          <button 
            className="search-clear" 
            onClick={() => setSearchQuery('')}
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>

      {isOpen && searchResults.length > 0 && (
        <div className="search-results" ref={resultsContainerRef}>
          {searchResults.map((course, index) => (
            <div
              key={course.id}
              className={`search-result ${index === currentIndex ? 'selected' : ''}`}
              onClick={() => handleResultClick(course)}
            >
              <div className="result-id">{course.id}</div>
              <div className="result-name">{course.name}</div>
            </div>
          ))}
          {searchResults.length > 1 && (
            <div className="search-navigation">
              <span>{currentIndex + 1} of {searchResults.length} results</span>
              <button 
                onClick={handlePrevResult} 
                className="nav-button"
                aria-label="Previous result"
              >
                ↑
              </button>
              <button 
                onClick={handleNextResult} 
                className="nav-button"
                aria-label="Next result"
              >
                ↓
              </button>
            </div>
          )}
        </div>
      )}
      
      {isOpen && searchQuery.length >= 2 && searchResults.length === 0 && (
        <div className="search-no-results">
          No courses found matching "{searchQuery}"
        </div>
      )}
    </div>
  );
};

export default SearchBar;