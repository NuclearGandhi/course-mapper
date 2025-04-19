import React from 'react';

const InfoPopup = ({ course, onClose }) => (
  <div className="react-flow__info-popup">
    <button className="react-flow__info-popup-close" onClick={onClose}>×</button>
    <h2 className="react-flow__info-popup-title">{course['שם מקצוע']}</h2>
    <div className="react-flow__info-popup-details">
      <b>מספר מקצוע:</b> {course['מספר מקצוע']}<br />
      <b>נקודות:</b> {course['נקודות'] || '-'}<br />
      <b>קדם:</b> {course['מקצועות קדם'] || '-'}<br />
      <b>סילבוס:</b> {course['סילבוס'] || '-'}<br />
    </div>
  </div>
);

export default InfoPopup;
