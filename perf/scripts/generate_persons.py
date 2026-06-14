#!/usr/bin/env python3
"""
Genera un CSV de personas con IDs únicos para las pruebas de k6.
Uso:
  python3 generate_persons.py 1000 perf/data/persons_generated.csv
"""
import sys
import csv
import random

if len(sys.argv) < 3:
    print("Usage: generate_persons.py <count> <output.csv>")
    sys.exit(1)

count = int(sys.argv[1])
outpath = sys.argv[2]

first_names = ['Juan','María','Carlos','Sofia','Andrés','Luis','Ana','Pedro','Lucia','Diego']
last_names = ['Gomez','Rodriguez','Martinez','Lopez','Garcia','Perez','Sanchez','Diaz','Torres','Ramirez']
genders = ['MALE','FEMALE']

# Default start_id is small to keep generated IDs within Java `int` range
start_id = 1000

# Optional third argument: start_id (to control numeric range)
if len(sys.argv) >= 4:
  try:
    start_id = int(sys.argv[3])
  except ValueError:
    print("Invalid start_id, using default 1000")

with open(outpath, 'w', newline='') as f:
    writer = csv.writer(f)
    writer.writerow(['id','name','age','gender','alive'])
    for i in range(count):
        _id = start_id + i
        name = f"{random.choice(first_names)} {random.choice(last_names)}"
        age = random.randint(18, 90)
        gender = random.choice(genders)
        alive = 'true'
        writer.writerow([_id, name, age, gender, alive])

print(f"Wrote {count} rows to {outpath}")
