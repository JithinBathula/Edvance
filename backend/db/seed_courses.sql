-- =============================================================================
-- Seed Data for Courses
-- Run this AFTER running schema.sql to populate course content
-- =============================================================================

-- Insert the Python Fundamentals course for each theme
INSERT INTO courses (id, title, description, theme) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Python Fundamentals', 'Learn the fundamentals of Python programming', 'finance'),
    ('22222222-2222-2222-2222-222222222222', 'Python Fundamentals', 'Learn the fundamentals of Python programming', 'gaming'),
    ('33333333-3333-3333-3333-333333333333', 'Python Fundamentals', 'Learn the fundamentals of Python programming', 'chatbot');

-- =============================================================================
-- FINANCE THEME LESSONS
-- =============================================================================
INSERT INTO course_lessons (id, course_id, position, title, description, content, challenge_description, starter_code, hints) VALUES
(
    'f1111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    1,
    'Basics: Print, Variables & Data Types',
    'Learn the fundamentals of Python programming',
    '# Lesson 1: Python Basics

## Variables
Variables are containers for storing data. In Python, you create a variable by assigning a value to it:

```python
name = "Alice"
age = 25
is_student = True
```

## Data Types
Python has several basic data types:
- **Strings**: Text in quotes - `"Hello"` or `''Hello''`
- **Numbers**: Integers like `42` or decimals like `3.14`
- **Booleans**: `True` or `False`

## Print Function
The `print()` function displays output:
```python
print("Hello, World!")
print(age)
```

Now let''s apply this to build part of your budget tracker!',
    'Create variables for your budget tracker. Define the variables shown in the example, then print them out.',
    '# Define your variables here
budget = 1000
rent = 500
groceries = 200

# Print them
print(budget)',
    ARRAY['Variables are created with the = sign', 'Print each variable on a new line', 'Make sure variable names match exactly']
),
(
    'f2222222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111',
    2,
    'Operations: Math, Strings & Lists',
    'Perform operations on your data',
    '# Lesson 2: Operations

## Mathematical Operations
Python can do math with numbers:
```python
total = 100 + 50
difference = 100 - 50
product = 10 * 5
quotient = 100 / 4
```

## String Operations
You can combine strings with the + operator:
```python
first_name = "John"
last_name = "Doe"
full_name = first_name + " " + last_name
```

## List Operations
Lists store multiple items:
```python
numbers = [1, 2, 3, 4, 5]
numbers.append(6)  # Add item
first = numbers[0]  # Access by index
```

Now let''s add calculations to your expense calculator!',
    'Perform operations on the variables from the previous lesson. Calculate totals and show the results.',
    '# Your variables from lesson 1
budget = 1000
rent = 500
groceries = 200

# Perform operations here
total_expenses = rent + groceries + utilities
savings = budget - total_expenses

# Print the results',
    ARRAY['Use + for addition and - for subtraction', 'You can combine multiple operations', 'Print your calculated values to see results']
),
(
    'f3333333-3333-3333-3333-333333333333',
    '11111111-1111-1111-1111-111111111111',
    3,
    'Loops & Conditionals',
    'Control the flow of your program',
    '# Lesson 3: Loops & Conditionals

## If Statements
Make decisions in your code:
```python
age = 18
if age >= 18:
    print("Adult")
else:
    print("Minor")
```

## For Loops
Repeat code for each item in a sequence:
```python
fruits = ["apple", "banana", "orange"]
for fruit in fruits:
    print(fruit)
```

## While Loops
Repeat while a condition is true:
```python
count = 0
while count < 5:
    print(count)
    count = count + 1
```

Complete your expense reporter with loops!',
    'Use loops to process multiple items. Create a list and iterate through it.',
    '# Previous code
budget = 1000
rent = 500
groceries = 200
total_expenses = rent + groceries + utilities
savings = budget - total_expenses

# Add loops here
expenses = [rent, groceries, utilities, transport]
for expense in expenses:
    print("Expense:", expense)

print("Your expense reporter is complete!")',
    ARRAY['for loops iterate over lists', 'Use meaningful variable names in loops', 'Remember to indent code inside loops']
);

-- Finance theme tasks
INSERT INTO course_lesson_tasks (lesson_id, position, task_description) VALUES
('f1111111-1111-1111-1111-111111111111', 1, 'Define the core variables for your budget tracker exactly as described in the blog post.'),
('f1111111-1111-1111-1111-111111111111', 2, 'Print each variable on its own line so you can confirm the values in the terminal.'),
('f1111111-1111-1111-1111-111111111111', 3, 'Personalize the data by changing at least one value to match your own scenario.'),
('f2222222-2222-2222-2222-222222222222', 1, 'Reuse or recreate the variables from Lesson 1 inside the IDE.'),
('f2222222-2222-2222-2222-222222222222', 2, 'Create new variables that perform the calculations described in the challenge.'),
('f2222222-2222-2222-2222-222222222222', 3, 'Display every result with a clear print statement so the output tells a story.'),
('f3333333-3333-3333-3333-333333333333', 1, 'Start with the variables and calculations from previous lessons.'),
('f3333333-3333-3333-3333-333333333333', 2, 'Build a list that represents the items or events you want to iterate over.'),
('f3333333-3333-3333-3333-333333333333', 3, 'Write a loop that prints each value with context so the output reads naturally.');

-- Finance theme highlights
INSERT INTO course_lesson_highlights (lesson_id, position, title, heading, detail, icon_name) VALUES
('f1111111-1111-1111-1111-111111111111', 1, 'Scene Setting', 'Make your budget tracker feel real', 'Choose vivid variable names that show who or what is in your program. Imagine you''re a narrator introducing each character.', 'BookOpen'),
('f1111111-1111-1111-1111-111111111111', 2, 'Narrate Out Loud', 'Use print() to guide your audience', 'Explain what each value represents as you run the demo. Students should hear how the data connects to the bigger scenario.', 'Sparkles'),
('f1111111-1111-1111-1111-111111111111', 3, 'Vocabulary Check', 'Spot a string, a number, and a boolean', 'Call out which data type each variable uses so learners connect syntax to meaning.', 'ListChecks'),
('f2222222-2222-2222-2222-222222222222', 1, 'Math in Motion', 'Calculate what changes in your budget tracker', 'Show how a single variable tweak (like a higher cost or bigger score) flows through your calculations.', 'Target'),
('f2222222-2222-2222-2222-222222222222', 2, 'Explain the Story', 'Wrap results in friendly messages', 'Use string formatting to report your totals as if you''re giving helpful advice to a teammate.', 'BookOpen'),
('f2222222-2222-2222-2222-222222222222', 3, 'Predict & Check', 'Ask "what if?" and verify with code', 'Before you run the program, guess the output. Then compare the terminal result to reinforce mental math skills.', 'Lightbulb'),
('f3333333-3333-3333-3333-333333333333', 1, 'Loop the Experience', 'Tour every item in your budget tracker', 'Describe what repeats each time through the loop so learners follow the rhythm of your program.', 'Sparkles'),
('f3333333-3333-3333-3333-333333333333', 2, 'Decision Points', 'Tie if-statements to real outcomes', 'Explain why a condition matters: what happens when it''s true versus false?', 'Target'),
('f3333333-3333-3333-3333-333333333333', 3, 'Reflect & Remix', 'Ask for one "what should we try next?" idea', 'Invite students to add an item or rule to the loop so they practice modifying live code.', 'Lightbulb');

-- =============================================================================
-- GAMING THEME LESSONS
-- =============================================================================
INSERT INTO course_lessons (id, course_id, position, title, description, content, challenge_description, starter_code, hints) VALUES
(
    'a1111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    1,
    'Basics: Print, Variables & Data Types',
    'Learn the fundamentals of Python programming',
    '# Lesson 1: Python Basics

## Variables
Variables are containers for storing data. In Python, you create a variable by assigning a value to it:

```python
name = "Alice"
age = 25
is_student = True
```

## Data Types
Python has several basic data types:
- **Strings**: Text in quotes - `"Hello"` or `''Hello''`
- **Numbers**: Integers like `42` or decimals like `3.14`
- **Booleans**: `True` or `False`

## Print Function
The `print()` function displays output:
```python
print("Hello, World!")
print(age)
```

Now let''s apply this to build part of your game!',
    'Create variables for your game. Define the variables shown in the example, then print them out.',
    '# Define your variables here
player_health = 100
enemy_health = 50
score = 0

# Print them
print(player_health)',
    ARRAY['Variables are created with the = sign', 'Print each variable on a new line', 'Make sure variable names match exactly']
),
(
    'a2222222-2222-2222-2222-222222222222',
    '22222222-2222-2222-2222-222222222222',
    2,
    'Operations: Math, Strings & Lists',
    'Perform operations on your data',
    '# Lesson 2: Operations

## Mathematical Operations
Python can do math with numbers:
```python
total = 100 + 50
difference = 100 - 50
product = 10 * 5
quotient = 100 / 4
```

## String Operations
You can combine strings with the + operator:
```python
first_name = "John"
last_name = "Doe"
full_name = first_name + " " + last_name
```

## List Operations
Lists store multiple items:
```python
numbers = [1, 2, 3, 4, 5]
numbers.append(6)  # Add item
first = numbers[0]  # Access by index
```

Now let''s add calculations to your combat system!',
    'Perform operations on the variables from the previous lesson. Calculate totals and show the results.',
    '# Your variables from lesson 1
player_health = 100
enemy_health = 50
score = 0

# Perform operations here
damage = 15
enemy_health = enemy_health - damage
if enemy_health <= 0:
    print("Enemy defeated!")

# Print the results',
    ARRAY['Use + for addition and - for subtraction', 'You can combine multiple operations', 'Print your calculated values to see results']
),
(
    'a3333333-3333-3333-3333-333333333333',
    '22222222-2222-2222-2222-222222222222',
    3,
    'Loops & Conditionals',
    'Control the flow of your program',
    '# Lesson 3: Loops & Conditionals

## If Statements
Make decisions in your code:
```python
age = 18
if age >= 18:
    print("Adult")
else:
    print("Minor")
```

## For Loops
Repeat code for each item in a sequence:
```python
fruits = ["apple", "banana", "orange"]
for fruit in fruits:
    print(fruit)
```

## While Loops
Repeat while a condition is true:
```python
count = 0
while count < 5:
    print(count)
    count = count + 1
```

Complete your inventory system with loops!',
    'Use loops to process multiple items. Create a list and iterate through it.',
    '# Previous code
player_health = 100
enemy_health = 50
score = 0
damage = 15
enemy_health = enemy_health - damage
if enemy_health <= 0:
    print("Enemy defeated!")

# Add loops here
items = ["sword", "shield", "potion"]
for item in items:
    print("Collected:", item)

print("Your inventory system is complete!")',
    ARRAY['for loops iterate over lists', 'Use meaningful variable names in loops', 'Remember to indent code inside loops']
);

-- Gaming theme tasks
INSERT INTO course_lesson_tasks (lesson_id, position, task_description) VALUES
('a1111111-1111-1111-1111-111111111111', 1, 'Define the core variables for your game exactly as described in the blog post.'),
('a1111111-1111-1111-1111-111111111111', 2, 'Print each variable on its own line so you can confirm the values in the terminal.'),
('a1111111-1111-1111-1111-111111111111', 3, 'Personalize the data by changing at least one value to match your own scenario.'),
('a2222222-2222-2222-2222-222222222222', 1, 'Reuse or recreate the variables from Lesson 1 inside the IDE.'),
('a2222222-2222-2222-2222-222222222222', 2, 'Create new variables that perform the calculations described in the challenge.'),
('a2222222-2222-2222-2222-222222222222', 3, 'Display every result with a clear print statement so the output tells a story.'),
('a3333333-3333-3333-3333-333333333333', 1, 'Start with the variables and calculations from previous lessons.'),
('a3333333-3333-3333-3333-333333333333', 2, 'Build a list that represents the items or events you want to iterate over.'),
('a3333333-3333-3333-3333-333333333333', 3, 'Write a loop that prints each value with context so the output reads naturally.');

-- Gaming theme highlights
INSERT INTO course_lesson_highlights (lesson_id, position, title, heading, detail, icon_name) VALUES
('a1111111-1111-1111-1111-111111111111', 1, 'Scene Setting', 'Make your game feel real', 'Choose vivid variable names that show who or what is in your program. Imagine you''re a narrator introducing each character.', 'BookOpen'),
('a1111111-1111-1111-1111-111111111111', 2, 'Narrate Out Loud', 'Use print() to guide your audience', 'Explain what each value represents as you run the demo. Students should hear how the data connects to the bigger scenario.', 'Sparkles'),
('a1111111-1111-1111-1111-111111111111', 3, 'Vocabulary Check', 'Spot a string, a number, and a boolean', 'Call out which data type each variable uses so learners connect syntax to meaning.', 'ListChecks'),
('a2222222-2222-2222-2222-222222222222', 1, 'Math in Motion', 'Calculate what changes in your game', 'Show how a single variable tweak (like a higher cost or bigger score) flows through your calculations.', 'Target'),
('a2222222-2222-2222-2222-222222222222', 2, 'Explain the Story', 'Wrap results in friendly messages', 'Use string formatting to report your totals as if you''re giving helpful advice to a teammate.', 'BookOpen'),
('a2222222-2222-2222-2222-222222222222', 3, 'Predict & Check', 'Ask "what if?" and verify with code', 'Before you run the program, guess the output. Then compare the terminal result to reinforce mental math skills.', 'Lightbulb'),
('a3333333-3333-3333-3333-333333333333', 1, 'Loop the Experience', 'Tour every item in your game', 'Describe what repeats each time through the loop so learners follow the rhythm of your program.', 'Sparkles'),
('a3333333-3333-3333-3333-333333333333', 2, 'Decision Points', 'Tie if-statements to real outcomes', 'Explain why a condition matters: what happens when it''s true versus false?', 'Target'),
('a3333333-3333-3333-3333-333333333333', 3, 'Reflect & Remix', 'Ask for one "what should we try next?" idea', 'Invite students to add an item or rule to the loop so they practice modifying live code.', 'Lightbulb');

-- =============================================================================
-- CHATBOT THEME LESSONS
-- =============================================================================
INSERT INTO course_lessons (id, course_id, position, title, description, content, challenge_description, starter_code, hints) VALUES
(
    'c1111111-1111-1111-1111-111111111111',
    '33333333-3333-3333-3333-333333333333',
    1,
    'Basics: Print, Variables & Data Types',
    'Learn the fundamentals of Python programming',
    '# Lesson 1: Python Basics

## Variables
Variables are containers for storing data. In Python, you create a variable by assigning a value to it:

```python
name = "Alice"
age = 25
is_student = True
```

## Data Types
Python has several basic data types:
- **Strings**: Text in quotes - `"Hello"` or `''Hello''`
- **Numbers**: Integers like `42` or decimals like `3.14`
- **Booleans**: `True` or `False`

## Print Function
The `print()` function displays output:
```python
print("Hello, World!")
print(age)
```

Now let''s apply this to build part of your chatbot!',
    'Create variables for your chatbot. Define the variables shown in the example, then print them out.',
    '# Define your variables here
bot_name = "CodeBot"
user_name = "Student"
greeting = "Hello"

# Print them
print(bot_name)',
    ARRAY['Variables are created with the = sign', 'Print each variable on a new line', 'Make sure variable names match exactly']
),
(
    'c2222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333',
    2,
    'Operations: Math, Strings & Lists',
    'Perform operations on your data',
    '# Lesson 2: Operations

## Mathematical Operations
Python can do math with numbers:
```python
total = 100 + 50
difference = 100 - 50
product = 10 * 5
quotient = 100 / 4
```

## String Operations
You can combine strings with the + operator:
```python
first_name = "John"
last_name = "Doe"
full_name = first_name + " " + last_name
```

## List Operations
Lists store multiple items:
```python
numbers = [1, 2, 3, 4, 5]
numbers.append(6)  # Add item
first = numbers[0]  # Access by index
```

Now let''s add calculations to your response generator!',
    'Perform operations on the variables from the previous lesson. Calculate totals and show the results.',
    '# Your variables from lesson 1
bot_name = "CodeBot"
user_name = "Student"
greeting = "Hello"

# Perform operations here
response = "I can help you with coding!"
full_message = bot_name + " says: " + response

# Print the results',
    ARRAY['Use + for addition and - for subtraction', 'You can combine multiple operations', 'Print your calculated values to see results']
),
(
    'c3333333-3333-3333-3333-333333333333',
    '33333333-3333-3333-3333-333333333333',
    3,
    'Loops & Conditionals',
    'Control the flow of your program',
    '# Lesson 3: Loops & Conditionals

## If Statements
Make decisions in your code:
```python
age = 18
if age >= 18:
    print("Adult")
else:
    print("Minor")
```

## For Loops
Repeat code for each item in a sequence:
```python
fruits = ["apple", "banana", "orange"]
for fruit in fruits:
    print(fruit)
```

## While Loops
Repeat while a condition is true:
```python
count = 0
while count < 5:
    print(count)
    count = count + 1
```

Complete your conversation system with loops!',
    'Use loops to process multiple items. Create a list and iterate through it.',
    '# Previous code
bot_name = "CodeBot"
user_name = "Student"
greeting = "Hello"
response = "I can help you with coding!"
full_message = bot_name + " says: " + response

# Add loops here
responses = ["Hello!", "How can I help?", "Goodbye!"]
for response in responses:
    print(bot_name + ":", response)

print("Your conversation system is complete!")',
    ARRAY['for loops iterate over lists', 'Use meaningful variable names in loops', 'Remember to indent code inside loops']
);

-- Chatbot theme tasks
INSERT INTO course_lesson_tasks (lesson_id, position, task_description) VALUES
('c1111111-1111-1111-1111-111111111111', 1, 'Define the core variables for your chatbot exactly as described in the blog post.'),
('c1111111-1111-1111-1111-111111111111', 2, 'Print each variable on its own line so you can confirm the values in the terminal.'),
('c1111111-1111-1111-1111-111111111111', 3, 'Personalize the data by changing at least one value to match your own scenario.'),
('c2222222-2222-2222-2222-222222222222', 1, 'Reuse or recreate the variables from Lesson 1 inside the IDE.'),
('c2222222-2222-2222-2222-222222222222', 2, 'Create new variables that perform the calculations described in the challenge.'),
('c2222222-2222-2222-2222-222222222222', 3, 'Display every result with a clear print statement so the output tells a story.'),
('c3333333-3333-3333-3333-333333333333', 1, 'Start with the variables and calculations from previous lessons.'),
('c3333333-3333-3333-3333-333333333333', 2, 'Build a list that represents the items or events you want to iterate over.'),
('c3333333-3333-3333-3333-333333333333', 3, 'Write a loop that prints each value with context so the output reads naturally.');

-- Chatbot theme highlights
INSERT INTO course_lesson_highlights (lesson_id, position, title, heading, detail, icon_name) VALUES
('c1111111-1111-1111-1111-111111111111', 1, 'Scene Setting', 'Make your chatbot feel real', 'Choose vivid variable names that show who or what is in your program. Imagine you''re a narrator introducing each character.', 'BookOpen'),
('c1111111-1111-1111-1111-111111111111', 2, 'Narrate Out Loud', 'Use print() to guide your audience', 'Explain what each value represents as you run the demo. Students should hear how the data connects to the bigger scenario.', 'Sparkles'),
('c1111111-1111-1111-1111-111111111111', 3, 'Vocabulary Check', 'Spot a string, a number, and a boolean', 'Call out which data type each variable uses so learners connect syntax to meaning.', 'ListChecks'),
('c2222222-2222-2222-2222-222222222222', 1, 'Math in Motion', 'Calculate what changes in your chatbot', 'Show how a single variable tweak (like a higher cost or bigger score) flows through your calculations.', 'Target'),
('c2222222-2222-2222-2222-222222222222', 2, 'Explain the Story', 'Wrap results in friendly messages', 'Use string formatting to report your totals as if you''re giving helpful advice to a teammate.', 'BookOpen'),
('c2222222-2222-2222-2222-222222222222', 3, 'Predict & Check', 'Ask "what if?" and verify with code', 'Before you run the program, guess the output. Then compare the terminal result to reinforce mental math skills.', 'Lightbulb'),
('c3333333-3333-3333-3333-333333333333', 1, 'Loop the Experience', 'Tour every item in your chatbot', 'Describe what repeats each time through the loop so learners follow the rhythm of your program.', 'Sparkles'),
('c3333333-3333-3333-3333-333333333333', 2, 'Decision Points', 'Tie if-statements to real outcomes', 'Explain why a condition matters: what happens when it''s true versus false?', 'Target'),
('c3333333-3333-3333-3333-333333333333', 3, 'Reflect & Remix', 'Ask for one "what should we try next?" idea', 'Invite students to add an item or rule to the loop so they practice modifying live code.', 'Lightbulb');
