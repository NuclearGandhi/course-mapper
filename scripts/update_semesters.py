import json
import re
from pathlib import Path
import os

import requests

def get_last_semesters():
    last_semesters_url = "https://michael-maltsev.github.io/technion-sap-info-fetcher/last_semesters.json"
    last_semesters_sap = requests.get(last_semesters_url).json()

    last_semesters = {}
    for last_semester in last_semesters_sap:
        semester = str(last_semester["year"]) + str(
            last_semester["semester"] - 200 + 1
        ).zfill(2)
        last_semesters[semester] = {
            "start": last_semester["start"],
            "end": last_semester["end"],
        }

    return last_semesters

def get_latest_two_semesters(last_semesters):
    # Sort by year and semester code (02=spring, 01=winter)
    sorted_semesters = sorted(
        [((int(key[:4]), int(key[4:])), key) for key in last_semesters.keys()],
        reverse=True
    )
    latest_spring = next((original_key for (year, semester), original_key in sorted_semesters if semester == 2), None)
    latest_winter = next((original_key for (year, semester), original_key in sorted_semesters if semester == 1), None)
    return latest_winter, latest_spring

def map_semester_code(semester):
    year = semester[:4]
    sem = semester[4:]
    # Map '01' to '200' (winter), '02' to '201' (spring)
    if sem == '01':
        mapped_sem = '200'
    elif sem == '02':
        mapped_sem = '201'
    else:
        raise ValueError(f"Unknown semester code: {sem}")
    return year, mapped_sem

def fetch_and_save_courses(semester, filename):
    year, mapped_sem = map_semester_code(semester)
    courses_url = f"https://raw.githubusercontent.com/michael-maltsev/technion-sap-info-fetcher/gh-pages/courses_{year}_{mapped_sem}.json"
    response = requests.get(courses_url)
    if response.status_code == 200:
        # Ensure the directory exists
        os.makedirs(os.path.dirname(filename), exist_ok=True)
        with open(filename, "w", encoding="utf-8") as f:
            json.dump(response.json(), f, ensure_ascii=False, indent=4)
        return response.json()
    else:
        raise RuntimeError(f"Failed to fetch courses for semester {semester}: {response.status_code}")

# Python version of parsePrerequisiteTree from courseGraph.js
def parse_prerequisite_tree(prereq_str):
    if not prereq_str:
        return None
    
    # Clean and normalize the input string
    # Handle punctuation and Hebrew conjunctions ("ו-" for AND, "או" for OR)
    normalized_str = prereq_str
    
    # Replace Hebrew conjunction "ו-" after a course number (e.g. "12345678ו-" becomes "12345678 ו ")
    normalized_str = re.sub(r'(\d{8})[\s]*ו-', r'\1 ו ', normalized_str)
    # Replace standalone "ו-" with space-padded "ו"
    normalized_str = re.sub(r'ו-', ' ו ', normalized_str)
    
    # Add spaces around parentheses and other operators for tokenization
    normalized_str = re.sub(r'[(]', ' ( ', normalized_str)
    normalized_str = re.sub(r'[)]', ' ) ', normalized_str)
    normalized_str = re.sub(r',', ' , ', normalized_str)
    normalized_str = re.sub(r'או', ' או ', normalized_str)
    normalized_str = re.sub(r'ו', ' ו ', normalized_str)
    
    # Split into tokens and filter out empty strings
    tokens = [t for t in normalized_str.split() if t]
    
    # Debug the tokens
    # print(f"Tokens for '{prereq_str}': {tokens}")
    
    # Current position in token stream
    pos = [0]  # Use a list for pass-by-reference behavior in the nested functions
    
    def parse_expr():
        """Parse an expression which can include OR operations"""
        # First parse a term which can be a course number or an AND group
        term = parse_term()
        if term is None:
            return None
        
        # Check if we have OR operations
        or_terms = []
        
        while pos[0] < len(tokens) and tokens[pos[0]] == 'או':
            pos[0] += 1  # Skip 'או'
            right = parse_term()
            if right is not None:
                if not or_terms:  # First OR encountered
                    or_terms = [term]  # Add the first term to the list
                or_terms.append(right)
        
        if or_terms:
            return {'or': or_terms}
        else:
            return term
    
    def parse_term():
        """Parse a term which can include AND operations"""
        # Parse a factor (course number or parenthesized expression)
        factor = parse_factor()
        if factor is None:
            return None
        
        # Check for AND operations
        and_factors = []
        
        # If we have a factor, add it to our list
        and_factors = [factor]
        
        # Keep adding factors as long as we see 'ו' (AND) or ',' (also treated as AND)
        while pos[0] < len(tokens) and (tokens[pos[0]] == 'ו' or tokens[pos[0]] == ','):
            pos[0] += 1  # Skip 'ו' or ','
            next_factor = parse_factor()
            if next_factor is not None:
                and_factors.append(next_factor)
        
        # If we only found one factor, return it directly
        if len(and_factors) == 1:
            return and_factors[0]
        else:
            # Otherwise return an AND group
            return {'and': and_factors}
    
    def parse_factor():
        """Parse a factor (course ID or parenthesized expression)"""
        if pos[0] >= len(tokens):
            return None
        
        token = tokens[pos[0]]
        
        if token == '(':
            # Skip the opening parenthesis
            pos[0] += 1
            
            # Parse the expression inside the parentheses
            expr = parse_expr()
            
            # Expect a closing parenthesis
            if pos[0] < len(tokens) and tokens[pos[0]] == ')':
                pos[0] += 1  # Skip the closing parenthesis
            else:
                # Missing closing parenthesis, but try to recover
                print(f"Warning: Missing closing parenthesis in '{prereq_str}'")
            
            return expr
        
        # Check if token is a course number (8 digits)
        elif re.match(r'^\d{8}$', token):
            pos[0] += 1  # Move past this token
            return token
        else:
            # Skip unrecognized tokens
            pos[0] += 1
            return None
    
    try:
        return parse_expr()
    except Exception as e:
        print(f"Error parsing prerequisite string: '{prereq_str}'. Error: {str(e)}")
        return None

# Build a map: courseNum -> { name, prereqTree: logicTree, semesters: ["חורף", "אביב"] }
def build_course_map(courses, semester_label):
    course_map = {}
    for course in courses:
        general = course.get('general', {})
        num = general.get('מספר מקצוע')
        name = general.get('שם מקצוע')
        prereq_str = general.get('מקצועות קדם')
        if num and name:
            if num not in course_map:
                prereq_tree = parse_prerequisite_tree(prereq_str)
                course_map[num] = {
                    'name': name,
                    'prereqTree': prereq_tree,
                    'semesters': [semester_label],
                }
            else:
                if semester_label not in course_map[num]['semesters']:
                    course_map[num]['semesters'].append(semester_label)
    return course_map

# Python version of mergeCourseMaps from courseGraph.js - without 'prereqs' field
def merge_course_maps(winter_map, spring_map):
    merged = winter_map.copy()
    for num, course in spring_map.items():
        if num in merged:
            merged[num]['semesters'] = list(set(merged[num]['semesters'] + course['semesters']))
        else:
            merged[num] = course
    return merged

def main():
    last_semesters = get_last_semesters()
    print("Fetched last semesters from the server")
    
    # Define the public data directory path
    public_data_dir = "public/data"
    
    # Ensure directory exists
    os.makedirs(public_data_dir, exist_ok=True)
    
    # Save the last semesters to JSON file
    with open(f"{public_data_dir}/last_semesters.json", "w") as f:
        json.dump(last_semesters, f, indent=4)
    print("Updated last_semesters.json in public/data directory")
    
    latest_winter, latest_spring = get_latest_two_semesters(last_semesters)
    
    # Save individual semester data and also build merged data
    winter_courses = None
    spring_courses = None
    
    if latest_winter:
        winter_courses = fetch_and_save_courses(latest_winter, f"{public_data_dir}/last_winter_semester.json")
        print("Updated last_winter_semester.json in public/data directory")
    
    if latest_spring:
        spring_courses = fetch_and_save_courses(latest_spring, f"{public_data_dir}/last_spring_semester.json")
        print("Updated last_spring_semester.json in public/data directory")
    
    # Build and merge course maps
    if winter_courses and spring_courses:
        winter_map = build_course_map(winter_courses, 'חורף')
        spring_map = build_course_map(spring_courses, 'אביב')
        merged_map = merge_course_maps(winter_map, spring_map)
        
        # Save the merged map
        with open(f"{public_data_dir}/merged_courses.json", "w", encoding="utf-8") as f:
            json.dump(merged_map, f, ensure_ascii=False, indent=4)
        print("Created merged_courses.json in public/data directory")
    else:
        print("Could not create merged_courses.json because one or both semester data files are missing")

if __name__ == "__main__":
    main()