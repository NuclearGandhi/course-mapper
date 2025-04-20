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
    else:
        raise RuntimeError(f"Failed to fetch courses for semester {semester}: {response.status_code}")

def main():
    last_semesters = get_last_semesters()
    print("Fetched last semesters from the server")
    
    # Define paths for both regular data directory and public data directory
    data_dir = "data"
    public_data_dir = "public/data"
    
    # Ensure directories exist
    os.makedirs(data_dir, exist_ok=True)
    os.makedirs(public_data_dir, exist_ok=True)
    
    # Save the last semesters to JSON files in both locations
    for directory in [data_dir, public_data_dir]:
        with open(f"{directory}/last_semesters.json", "w") as f:
            json.dump(last_semesters, f, indent=4)
    print("Updated last_semesters.json in both data and public/data directories")
    
    latest_winter, latest_spring = get_latest_two_semesters(last_semesters)
    
    # Save course data to both directories
    if latest_winter:
        fetch_and_save_courses(latest_winter, f"{data_dir}/last_winter_semester.json")
        fetch_and_save_courses(latest_winter, f"{public_data_dir}/last_winter_semester.json")
    if latest_spring:
        fetch_and_save_courses(latest_spring, f"{data_dir}/last_spring_semester.json")
        fetch_and_save_courses(latest_spring, f"{public_data_dir}/last_spring_semester.json")
    print("Updated last_winter_semester.json and last_spring_semester.json in both data and public/data directories")

if __name__ == "__main__":
    main()