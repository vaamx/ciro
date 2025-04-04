#!/usr/bin/env python3
import json

# Load the task definition
with open('task-def-working.json', 'r') as f:
    task_def = json.load(f)

# Get the container definitions
container_defs = task_def['taskDefinition']['containerDefinitions']

# Find the backend container and update the FRONTEND_URL
for container in container_defs:
    if container['name'] == 'backend':
        for env in container['environment']:
            if env['name'] == 'FRONTEND_URL':
                print(f"Changing FRONTEND_URL from '{env['value']}' to 'https://app.ciroai.us'")
                env['value'] = 'https://app.ciroai.us'

# Prepare task definition for registration by removing the fields AWS will set
for field in ['taskDefinitionArn', 'revision', 'status', 'requiresAttributes', 'compatibilities', 'registeredAt', 'registeredBy']:
    if field in task_def['taskDefinition']:
        del task_def['taskDefinition'][field]

# Write the updated task definition
with open('task-def-fixed-url.json', 'w') as f:
    json.dump(task_def['taskDefinition'], f, indent=2)

print("Updated task definition saved to task-def-fixed-url.json") 