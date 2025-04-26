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

    # Normalize the string: add spaces around parentheses and operators
    s = prereq_str
    s = re.sub(r'([()])', r' \1 ', s)
    s = re.sub(r'או', ' או ', s)
    s = re.sub(r'ו-', ' ו ', s)
    s = re.sub(r'ו', ' ו ', s)
    s = re.sub(r',', ' , ', s)
    tokens = [t for t in s.split() if t]

    def parse_tokens(tokens):
        def parse_expr(idx):
            terms = []
            op = None
            while idx < len(tokens):
                token = tokens[idx]
                if token == '(':  # Start subexpression
                    sub, idx = parse_expr(idx + 1)
                    terms.append(sub)
                elif token == ')':  # End subexpression
                    idx += 1
                    break
                elif token == 'או':
                    op = 'or'
                    idx += 1
                elif token == 'ו' or token == ',':
                    op = 'and'
                    idx += 1
                elif re.match(r'^\d{8}$', token):
                    terms.append(token)
                    idx += 1
                else:
                    idx += 1  # Skip unknown tokens

                # If next token is an operator, continue; else, check for end of subexpression
                if idx < len(tokens) and tokens[idx] in ('או', 'ו', ','):
                    continue
                elif idx < len(tokens) and tokens[idx] == ')':
                    continue
                elif idx < len(tokens) and tokens[idx] == '(': 
                    continue

            # Build the tree
            if op == 'or' and len(terms) > 1:
                return ({'or': terms}, idx)
            elif op == 'and' and len(terms) > 1:
                return ({'and': terms}, idx)
            elif len(terms) == 1:
                return (terms[0], idx)
            else:
                return (terms, idx)

        tree, _ = parse_expr(0)
        return tree

    try:
        return parse_tokens(tokens)
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