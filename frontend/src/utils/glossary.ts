// Comprehensive glossary of programming/CS terms with student-friendly definitions.
// Keys are the exact terms to match (case-insensitive at render time).
// Multi-word terms like "API endpoint" are matched before shorter terms like "API"
// thanks to longest-first sorting in the matching algorithm.

export const GLOSSARY: Record<string, string> = {
  // ── Web / Networking ──────────────────────────────────────────────
  "API endpoint":
    "A specific URL where your program can send or receive data from a server.",
  "API key":
    "A secret code that identifies your app when it talks to an external service.",
  "REST API":
    "A web API that uses standard HTTP methods (GET, POST, etc.) and URLs to let programs exchange data.",
  API: "Application Programming Interface — a way for different programs to talk to each other.",
  REST: "A design pattern for web APIs where each URL represents a resource, and you use HTTP methods like GET and POST to interact with it.",
  HTTP: "HyperText Transfer Protocol — the rules that web browsers and servers use to communicate.",
  HTTPS:
    "HTTP with encryption — the secure version that protects data as it travels between your browser and the server.",
  JSON: "JavaScript Object Notation — a lightweight text format for storing and exchanging data using key-value pairs.",
  XML: "eXtensible Markup Language — a text format for structured data that uses tags similar to HTML.",
  URL: "Uniform Resource Locator — the address you type in a browser to reach a web page or API.",
  DNS: "Domain Name System — the internet's phone book that converts domain names (like google.com) into IP addresses.",
  WebSocket:
    "A protocol that keeps a two-way connection open between a browser and server so they can send messages instantly.",
  CORS: "Cross-Origin Resource Sharing — browser security rules that control which websites can request data from your server.",
  cookie:
    "A small piece of data a website stores in your browser to remember things like login sessions.",
  session:
    "A way for a server to remember who you are across multiple requests, usually using a cookie or token.",
  middleware:
    "Code that runs between receiving a request and sending a response — often used for logging, authentication, or error handling.",
  webhook:
    "A URL that another service calls automatically when something happens — like getting notified when a payment completes.",
  OAuth:
    "An industry-standard protocol that lets users log in to your app using their Google, GitHub, or other accounts.",
  JWT: "JSON Web Token — a compact, self-contained token used to securely transmit information between parties, often for authentication.",
  endpoint:
    "A specific URL path that your server listens on, like /users or /login.",

  // ── HTTP Methods & Status ─────────────────────────────────────────
  GET: "An HTTP method used to retrieve (read) data from a server.",
  POST: "An HTTP method used to send new data to a server.",
  PUT: "An HTTP method used to update existing data on a server by replacing it entirely.",
  DELETE: "An HTTP method used to remove data from a server.",
  PATCH:
    "An HTTP method used to partially update existing data on a server.",
  "status code":
    "A three-digit number a server sends back to tell you what happened — like 200 (OK) or 404 (Not Found).",

  // ── JavaScript ────────────────────────────────────────────────────
  callback:
    "A function you pass as an argument to another function, to be called later when something happens.",
  promise:
    "An object that represents a value that may not be available yet — it will either resolve with a result or reject with an error.",
  async:
    "Short for asynchronous — code that can start a task and move on without waiting for it to finish.",
  await:
    "A keyword that pauses an async function until a promise settles, making asynchronous code read like synchronous code.",
  closure:
    "A function that remembers the variables from the scope where it was created, even after that scope has finished executing.",
  destructuring:
    "A shorthand syntax for pulling values out of arrays or properties out of objects into separate variables.",
  "spread operator":
    "The three-dot syntax (...) that expands an array or object into individual elements or properties.",
  "arrow function":
    "A shorter way to write functions in JavaScript using => instead of the function keyword.",
  "template literal":
    "A string wrapped in backticks (`) that lets you embed expressions with ${} and span multiple lines.",
  "event listener":
    "Code that waits for a specific event (like a click or keypress) and runs a function when it happens.",
  DOM: "Document Object Model — the browser's representation of a web page as a tree of objects that JavaScript can manipulate.",
  "null": "A value that intentionally means 'nothing' or 'empty' — it's explicitly set by the programmer.",
  undefined:
    "A value JavaScript gives to variables that have been declared but not yet assigned a value.",
  hoisting:
    "JavaScript's behavior of moving variable and function declarations to the top of their scope before code runs.",
  "event loop":
    "The mechanism that lets JavaScript handle asynchronous tasks by continuously checking for and processing queued callbacks.",
  fetch:
    "A built-in browser function for making HTTP requests to load data from a server.",
  localStorage:
    "A browser feature that lets you store key-value pairs that persist even after closing the browser.",
  map: "An array method that creates a new array by transforming each element with a function you provide.",
  filter:
    "An array method that creates a new array containing only the elements that pass a test you provide.",
  reduce:
    "An array method that combines all elements into a single value by running a function on each element with an accumulator.",
  "try/catch":
    "A way to handle errors gracefully — code in 'try' runs normally, and if it throws an error, the 'catch' block handles it.",

  // ── TypeScript ────────────────────────────────────────────────────
  TypeScript:
    "A programming language that adds type annotations to JavaScript, helping catch mistakes before your code runs.",
  interface:
    "A TypeScript structure that defines the shape of an object — what properties it should have and their types.",
  "type alias":
    "A name you give to a type in TypeScript so you can reuse it, like `type User = { name: string; age: number }`.",
  generic:
    "A way to write reusable code that works with multiple types — like a function that can sort arrays of numbers OR strings.",
  enum: "A TypeScript feature that defines a set of named constants, like directions (Up, Down, Left, Right).",

  // ── React ─────────────────────────────────────────────────────────
  useState:
    "A React hook that lets you add a piece of changeable data (state) to your component.",
  useEffect:
    "A React hook that lets you run code when your component loads or when certain values change.",
  useRef:
    "A React hook that creates a container for a value that persists across renders without causing re-renders.",
  useContext:
    "A React hook that lets you read shared data (context) without passing it through every component manually.",
  useMemo:
    "A React hook that caches the result of an expensive calculation so it only re-runs when its dependencies change.",
  useCallback:
    "A React hook that caches a function so it doesn't get recreated on every render.",
  props:
    "Short for 'properties' — the data you pass into a React component from its parent.",
  state:
    "Data that a component manages internally — when state changes, the component re-renders to show the update.",
  component:
    "A reusable building block in React — a function that returns a piece of UI.",
  JSX: "A syntax extension that lets you write HTML-like code inside JavaScript — React uses it to describe what the UI should look like.",
  "virtual DOM":
    "React's lightweight copy of the real DOM — it compares changes and updates only what's needed for better performance.",
  "conditional rendering":
    "Showing or hiding parts of the UI based on a condition, like displaying a login button only when the user is signed out.",
  "event handler":
    "A function attached to a UI element (like a button) that runs when the user interacts with it.",
  "controlled component":
    "A form element whose value is controlled by React state rather than the browser.",
  context:
    "A React feature that lets you share data across many components without passing props through every level.",

  // ── Python ────────────────────────────────────────────────────────
  Python:
    "A beginner-friendly programming language known for its clean syntax and wide use in web development, data science, and AI., A beginner-friendly programming language known for its clean syntax and wide use in web development, data science, and AI., A beginner-friendly programming language known for its clean syntax and wide use in web development, data science, and AI., A beginner-friendly programming language known for its clean syntax and wide use in web development, data science, and AI., A beginner-friendly programming language known for its clean syntax and wide use in web development, data science, and AI.",
  pip: "Python's package installer — you use it to download and install libraries from the internet.",
  "virtual environment":
    "An isolated Python setup that keeps each project's libraries separate so they don't conflict.",
  decorator:
    "A special function in Python (marked with @) that wraps another function to add extra behavior.",
  "list comprehension":
    "A concise Python syntax for creating lists by transforming or filtering items in one line.",
  dictionary:
    "A Python data structure that stores key-value pairs — like a real dictionary where you look up a word (key) to find its meaning (value).",
  tuple:
    "An ordered collection of values in Python that cannot be changed after creation — like a read-only list.",
  "f-string":
    "A Python string prefixed with f that lets you embed expressions directly inside curly braces, like f\"Hello {name}\".",
  Flask:
    "A lightweight Python web framework for building APIs and web applications with minimal boilerplate.",
  lambda:
    "A small anonymous function in Python written in one line — useful for short, throwaway operations.",
  "class":
    "A blueprint for creating objects — it defines what data (attributes) and behavior (methods) the objects will have.",
  method:
    "A function that belongs to a class or object — it defines an action that the object can perform.",
  inheritance:
    "When a class gets all the properties and methods from a parent class, so you can reuse and extend existing code.",
  module:
    "A single Python file containing functions, classes, or variables that you can import and use in other files.",
  package:
    "A collection of related Python modules organized in a folder with an __init__.py file.",
  exception:
    "An error that occurs during program execution — Python lets you catch and handle exceptions gracefully.",
  REPL: "Read-Eval-Print Loop — an interactive Python shell where you can type code and see results immediately.",
  // ── Data Structures ───────────────────────────────────────────────
  array:
    "An ordered collection of items stored at numbered positions (indexes) — like a numbered list.",
  "linked list":
    "A data structure where each element (node) points to the next one — like a chain of connected boxes.",
  stack:
    "A data structure where the last item added is the first one removed — like a stack of plates.",
  queue:
    "A data structure where the first item added is the first one removed — like a line of people waiting.",
  "hash map":
    "A data structure that stores key-value pairs and can look up values almost instantly using the key.",
  tree: "A hierarchical data structure where each item (node) can have child items — like a family tree.",
  graph:
    "A data structure made of nodes connected by edges — useful for modeling relationships like social networks.",
  "binary search":
    "An efficient algorithm that finds an item in a sorted list by repeatedly cutting the search area in half.",
  recursion:
    "When a function calls itself to solve a smaller version of the same problem — like looking up a word that's defined using another word.",

  // ── Databases ─────────────────────────────────────────────────────
  SQL: "Structured Query Language — a language for creating, reading, updating, and deleting data in relational databases.",
  database:
    "An organized collection of data stored on a computer — like a super-powered spreadsheet that programs can query.",
  query:
    "A request you send to a database to retrieve or modify data — usually written in SQL.",
  schema:
    "The blueprint that defines how your database is organized — what tables exist, what columns they have, and their types.",
  migration:
    "A script that changes your database structure (like adding a table or column) in a controlled, reversible way.",
  "primary key":
    "A unique identifier for each row in a database table — like a student ID number.",
  "foreign key":
    "A column in one table that references the primary key of another table — it links related data together.",
  CRUD: "Create, Read, Update, Delete — the four basic operations you can perform on data.",
  ORM: "Object-Relational Mapping — a tool that lets you interact with a database using your programming language instead of raw SQL.",
  Supabase:
    "An open-source backend platform that provides a PostgreSQL database, authentication, and real-time features out of the box.",
  PostgreSQL:
    "A powerful open-source relational database known for reliability and advanced features like JSON support.",

  // ── Git / Version Control ─────────────────────────────────────────
  Git: "A version control system that tracks changes to your code over time and lets you collaborate with others.",
  repository:
    "A folder tracked by Git that contains your project's files and their entire change history.",
  commit:
    "A snapshot of your code at a specific point in time — like a save point you can always go back to.",
  branch:
    "A parallel version of your code where you can make changes without affecting the main version.",
  "merge conflict":
    "When two branches change the same line of code and Git can't automatically decide which version to keep.",
  "pull request":
    "A proposal to merge your changes into the main branch — teammates can review and discuss before approving.",

  // ── General CS / Programming ──────────────────────────────────────
  algorithm:
    "A step-by-step set of instructions for solving a problem — like a recipe for a computer.",
  "big O notation":
    "A way to describe how fast an algorithm runs as the input grows — like O(n) means time grows linearly with input size.",
  debugging:
    "The process of finding and fixing errors (bugs) in your code.",
  refactoring:
    "Restructuring existing code to make it cleaner or more efficient without changing what it does.",
  abstraction:
    "Hiding complex details behind a simpler interface — like driving a car without knowing how the engine works.",
  encapsulation:
    "Bundling data and the methods that operate on it together, and restricting direct access to some of the details.",
  polymorphism:
    "The ability for different types to be used through the same interface — like a 'draw' function that works on circles, squares, and triangles.",
  "design pattern":
    "A reusable solution to a common programming problem — like a tried-and-tested recipe for structuring code.",
  "dependency injection":
    "A technique where a function or class receives its dependencies from outside rather than creating them internally.",
  "environment variable":
    "A value stored outside your code (in the system or a .env file) that configures settings like API keys or database URLs.",
  "version control":
    "A system that tracks every change to your files so you can review history, undo mistakes, and collaborate.",
  "CI/CD":
    "Continuous Integration / Continuous Deployment — automated systems that test and deploy your code whenever you push changes.",
  linting:
    "Automatically checking your code for style issues and potential bugs before you run it.",
  "unit test":
    "A small, focused test that checks whether a single function or piece of code works correctly.",
  "integration test":
    "A test that checks whether multiple parts of your application work correctly together.",
  framework:
    "A pre-built structure that provides common tools and patterns so you don't have to build everything from scratch.",
  library:
    "A collection of pre-written code you can import and use in your project to avoid reinventing the wheel.",
  "IDE":
    "Integrated Development Environment — a code editor with built-in tools like debugging, autocompletion, and version control.",
  runtime:
    "The environment where your code actually executes — for JavaScript that's the browser or Node.js.",
  compiler:
    "A program that translates your source code into machine code or another language before it runs.",
  interpreter:
    "A program that reads and executes your code line by line, without compiling it first.",
  "syntax error":
    "A mistake in the structure of your code that prevents it from running — like a typo in a keyword.",
  "type error":
    "An error that happens when you try to use a value in a way that doesn't match its type — like adding a number to a string.",
  boolean:
    "A data type that can only be true or false — often used for conditions and toggles.",
  string:
    "A data type that holds text — a sequence of characters like \"hello world\".",
  integer:
    "A whole number with no decimal point — like 1, 42, or -7.",
  float:
    "A number with a decimal point — like 3.14 or -0.5.",
  variable:
    "A named container that holds a value in your program — you can read it, change it, and use it in expressions.",
  function:
    "A reusable block of code that performs a specific task — you define it once and call it whenever you need it.",
  parameter:
    "A variable listed in a function's definition that acts as a placeholder for the value you'll pass in.",
  argument:
    "The actual value you pass into a function when you call it.",
  "return value":
    "The result a function gives back after it finishes running — captured by whatever called the function.",
  loop: "A structure that repeats a block of code multiple times — like processing each item in a list.",
  iteration:
    "One complete pass through a loop — or the general process of repeating steps.",
  "scope":
    "The area of your code where a variable exists and can be accessed — local scope is inside a function, global scope is everywhere.",
  "import":
    "A statement that brings code from another file or library into your current file so you can use it.",
  "export":
    "A statement that makes code from your file available for other files to import.",
  "package manager":
    "A tool (like npm or pip) that downloads, installs, and manages the libraries your project depends on.",
  npm: "Node Package Manager — the default package manager for JavaScript that installs libraries from the npm registry.",
  Node:
    "Node.js — a runtime that lets you run JavaScript outside the browser, commonly used for building servers.",
  Vite: "A fast build tool and development server for modern web projects that provides instant hot module replacement.",
  "hot reload":
    "A development feature that instantly shows your code changes in the browser without a full page refresh.",
  deployment:
    "The process of putting your application on a server so real users can access it.",
  Docker:
    "A tool that packages your application and its dependencies into a container that runs the same way everywhere.",
  container:
    "A lightweight, isolated environment that runs your application with all its dependencies — like a mini virtual machine.",
  "ISO 8601":
    "An international standard for writing dates and times — like 2024-01-15T09:30:00Z.",
  regex:
    "Regular expression — a pattern-matching language for finding, validating, or replacing text.",
  Markdown:
    "A simple text formatting syntax where you use symbols like # for headings and ** for bold — widely used in README files.",
  responsive:
    "A design approach where your website automatically adjusts its layout to look good on any screen size.",
  "Tailwind CSS":
    "A utility-first CSS framework where you style elements by adding pre-built class names directly in your HTML.",
  CSS: "Cascading Style Sheets — the language that controls how web pages look (colors, layout, fonts, spacing).",
  HTML: "HyperText Markup Language — the standard language for structuring web page content with tags like <div> and <p>.",
  Flexbox:
    "A CSS layout system that makes it easy to align and distribute space among items in a row or column.",
  Grid: "A CSS layout system for creating two-dimensional layouts with rows and columns.",
};
