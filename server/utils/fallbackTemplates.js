// server/utils/fallbackTemplates.js

const templates = {
  oop: `# Object-Oriented Programming (OOP) Concepts

Object-Oriented Programming (OOP) is a programming paradigm based on the concept of "objects", which can contain data and code: data in the form of fields (often known as attributes or properties), and code, in the form of procedures (often known as methods).

## Why OOP is Used (Key Benefits)
- **Modularity**: The source code for a class can be written and maintained independently of the source code for other classes.
- **Reusability**: Once a class is written, it can be distributed to other programmers and reused in their programs.
- **Flexibility through Polymorphism**: Single function names can be shared by many classes, simplifying coding.
- **Data Hiding**: Details of how a class is implemented can be hidden from other classes, preventing unauthorized modifications.

## Core Concepts
- **Class**: A blueprint or template for creating objects. It defines data members and methods.
- **Object**: A basic unit of Object-Oriented Programming and represents real-life entities. An instance of a class.
- **Encapsulation**: Binding the data and the functions that manipulate them together, keeping both safe from outside interference.
- **Abstraction**: Displaying only essential information and hiding the implementation details.
- **Inheritance**: The mechanism in Java by which one class is allowed to inherit the features (fields and methods) of another class.
- **Polymorphism**: The ability of a message to be displayed in more than one form (e.g., method overloading and overriding).

## Code Example (JavaScript)
\`\`\`javascript
// Defining a base class
class Animal {
  constructor(name) {
    this._name = name; // Encapsulation: prefixing with _ to indicate private/protected
  }

  // Abstraction / Polymorphism: a method to be overridden
  makeSound() {
    return "Some generic sound";
  }

  get name() {
    return this._name;
  }
}

// Inheritance
class Dog extends Animal {
  constructor(name, breed) {
    super(name);
    this.breed = breed;
  }

  // Polymorphism: overriding the base class method
  makeSound() {
    return "Woof! Woof!";
  }
}

const myDog = new Dog("Buddy", "Golden Retriever");
console.log(\`\${myDog.name} says: \${myDog.makeSound()}\`);
\`\`\`

## Real-World Uses
- **Enterprise Web Applications**: Java (Spring Boot) and C# (.NET) are standard backend frameworks.
- **GUI Desktop Apps**: Native applications built on C++, C#, or Java.
- **Game Development**: Game engines like Unity (C#) and Unreal Engine (C++) heavily rely on OOP principles for game objects.

## Learning Roadmap for Beginners
1. Learn the difference between Simplistic Procedural and Object-Oriented Programming.
2. Master the concepts of Classes and Objects.
3. Understand the 4 pillars of OOP: Encapsulation, Abstraction, Inheritance, and Polymorphism.
4. Implement OOP principles in your language of choice (Java, C++, Python, or JavaScript).
5. Learn Object-Oriented Design Patterns (Singleton, Factory, Observer, etc.).

## Top OOP Interview Questions and Answers
1. **What is the difference between a Class and an Object?**
   A class is a blueprint or template, while an object is an instance of a class.
2. **What are the four pillars of OOP?**
   Encapsulation, Abstraction, Inheritance, and Polymorphism.
3. **What is method overloading vs method overriding?**
   Overloading is compile-time polymorphism (same name, different arguments). Overriding is runtime polymorphism (child class redefines parent method).

## Conclusion
Object-Oriented Programming remains a foundational paradigm in modern software development, promoting clean, reusable, and maintainable code architecture.`,

  mern: `# MERN Stack Development: The Ultimate Guide

The MERN stack is a popular collection of JavaScript-based technologies used to build robust, scalable full-stack web applications. It consists of MongoDB, Express.js, React, and Node.js.

## Why MERN is Used (Key Benefits)
- **Single Language**: Developers use JavaScript/TypeScript for both frontend and backend development.
- **Performance**: Node.js non-blocking I/O combined with React virtual DOM ensures highly performant apps.
- **JSON Everywhere**: MongoDB stores data in BSON (binary JSON), which maps naturally to JavaScript objects.
- **Active Community**: Millions of active developers and packages available through NPM.

## Core Components
- **MongoDB**: A document-oriented, NoSQL database designed for high volume storage.
- **Express.js**: A minimal and flexible Node.js web application framework that provides robust features for building APIs.
- **React.js**: A declarative, efficient, and flexible JavaScript library for building user interfaces.
- **Node.js**: A JavaScript runtime built on Chrome's V8 engine, executing JavaScript code outside the browser.

## Code Example (MERN Backend API Route)
\`\`\`javascript
// express-server.js
import express from 'express';
import mongoose from 'mongoose';

const app = express();
app.use(express.json());

// MongoDB Schema
const UserSchema = new mongoose.Schema({
  name: String,
  email: String
});
const User = mongoose.model('User', UserSchema);

// REST API endpoint
app.post('/api/users', async (req, res) => {
  try {
    const newUser = new User(req.body);
    await newUser.save();
    res.status(201).json({ success: true, user: newUser });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
\`\`\`

## Real-World Uses
- **Social Media Platforms**: Interactive, real-time messaging feeds.
- **E-Commerce Web Apps**: Dynamic product catalogs, filters, and shopping carts.
- **SaaS Platforms**: Subscription dashboards and interactive management platforms.

## Learning Roadmap for Beginners
1. Master JavaScript fundamentals (ES6+, Promises, Async/Await).
2. Learn Frontend development with React (JSX, Hooks, Context, State).
3. Build backend RESTful APIs with Node.js and Express.js.
4. Learn database modeling with MongoDB and Mongoose.
5. Combine them together, handle authorization (JWT), and deploy to the cloud.

## Top MERN Stack Interview Questions
1. **What is the request/response lifecycle in a MERN application?**
   The browser sends a request -> parsed by Express/Node -> queries MongoDB -> returns JSON back -> React updates UI.
2. **Why is MongoDB preferred in MERN over relational SQL databases?**
   Because MongoDB stores data in BSON format, which maps 1-to-1 with JSON objects used by React and Express.
3. **What is the role of Virtual DOM in React?**
   React maintains a virtual copy of the UI. When state changes, it diffs the virtual DOM with the real DOM and applies only the minimal required updates.`,

  react: `# React.js Front-End Library

React is a popular free and open-source front-end JavaScript library developed by Meta (formerly Facebook) for building user interfaces based on components.

## Why React is Used (Key Benefits)
- **Component-Based Architecture**: Build encapsulated components that manage their own state, then compose them to make complex UIs.
- **Declarative Views**: React makes it painless to create interactive UIs. React will efficiently update and render the right components when your data changes.
- **Strong Ecosystem**: Includes tools for routing (React Router), state management (Redux, Zustand), and visual components.

## Core Concepts
- **JSX**: Syntax extension to JavaScript, resembling HTML, used to describe what the UI should look like.
- **Props**: Immutable configuration parameters passed down from parent components.
- **State**: Mutable data managed internally by a component, triggering a re-render when changed.
- **Hooks**: Special functions like \`useState\` and \`useEffect\` that let functional components tap into React lifecycle features.

## Code Example (React Functional Component)
\`\`\`jsx
import React, { useState, useEffect } from 'react';

function Counter() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    document.title = \`Count is \${count}\`;
  }, [count]);

  return (
    <div className="counter-card" style={{ padding: 20, textAlign: 'center' }}>
      <h3>Interactive Counter</h3>
      <p>Current value: <strong>{count}</strong></p>
      <button onClick={() => setCount(count + 1)}>Increment</button>
    </div>
  );
}
export default Counter;
\`\`\`

## Real-World Uses
- **Meta Services**: Facebook, Instagram, and WhatsApp Web are built using React.
- **Streaming Platforms**: Netflix uses React to deliver high-performance streaming catalog interfaces.
- **Fintech Dashboards**: Real-time ticker and analytics tools.

## Learning Roadmap for Beginners
1. Master HTML, CSS, and basic JavaScript concepts.
2. Understand JSX and rendering components.
3. Learn props passing and managing state with \`useState\`.
4. Learn side-effects management with \`useEffect\`.
5. Learn custom hooks and advanced state libraries (Context API, Zustand).

## Top React Interview Questions
1. **What is React Hooks?**
   Functions that let functional components handle state and side-effects.
2. **What is the difference between props and state?**
   Props are configuration passed from outside; state is local, private data owned by the component.
3. **What is standard reconciliation?**
   React's diffing algorithm to update only modified parts of the real browser DOM.`,

  node: `# Node.js Backend Runtime

Node.js is a cross-platform, open-source JavaScript runtime environment that executes JavaScript code outside a web browser, leveraging Google Chrome's high-performance V8 engine.

## Why Node.js is Used (Key Benefits)
- **Asynchronous & Event-Driven**: All APIs of Node.js library are asynchronous (non-blocking), enabling excellent concurrent request handling.
- **Fast Execution**: V8 compiles JavaScript directly into machine code, delivering high performance.
- **Rich Package Manager**: NPM (Node Package Manager) has over a million libraries.

## Core Concepts
- **Event Loop**: Single-threaded loop that delegates offloaded asynchronous I/O tasks to system threads.
- **Buffer & Streams**: Optimized file and network buffer streaming to handle large binary chunks.
- **CommonJS & ES Modules**: Standard module importing syntax (require vs import).

## Code Example (Simple HTTP Server)
\`\`\`javascript
import http from 'http';

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    message: "Hello from Node.js backend!",
    timestamp: Date.now()
  }));
});

server.listen(5001, () => {
  console.log("Server listening on port 5001");
});
\`\`\`

## Learning Roadmap for Beginners
1. Master JavaScript fundamentals outside the browser.
2. Learn Node.js file system APIs (\`fs\` module) and process models.
3. Understand streams, event emitters, and buffers.
4. Implement a web framework like Express.js.
5. Build database integrations and secure backend APIs.

## Top Node.js Interview Questions
1. **How is Node.js single-threaded but handles concurrency?**
   It uses the Event Loop. Asynchronous operations are delegated to Libuv thread-pool, freeing the main thread to handle next requests.
2. **What is the difference between \`setImmediate()\` and \`process.nextTick()\`?**
   \`process.nextTick()\` runs immediately after current operation completes, before event loop moves on. \`setImmediate()\` queue is processed in the check phase of event loop.`,

  python: `# Python Programming Language

Python is a high-level, general-purpose, and interpreted programming language famous for its simple readability and versatile developer ecosystem.

## Why Python is Used (Key Benefits)
- **Simple Syntax**: Reads like structured English, making it fast to write and easy to learn.
- **Massive Ecosystem**: Top-tier libraries for AI/ML, Data Science, Web scripting, and Automation.
- **Interpreted Nature**: Run code instantly line-by-line without slow compilation steps.

## Core Concepts
- **Dynamically Typed**: Variable types are determined at runtime.
- **List Comprehensions**: Concise syntax to create lists based on existing lists.
- **Indentation Rules**: Code blocks are structured using spaces/indents, avoiding brackets.

## Code Example (Data Analysis)
\`\`\`python
# Simple Python data processing script
import math

class DataProcessor:
    def __init__(self, data):
        self.data = data

    def filter_and_square(self):
        # List comprehension with filtering
        return [math.pow(x, 2) for x in self.data if x > 0]

processor = DataProcessor([-2, -1, 0, 1, 2, 3])
print("Processed results:", processor.filter_and_square())
\`\`\`

## Real-World Uses
- **Machine Learning**: TensorFlow, PyTorch, Scikit-Learn libraries.
- **Web Backend Frameworks**: Django, Flask, FastAPI.
- **Automation / Scripting**: Scraping the web (BeautifulSoup, Selenium), devops tools.

## Top Python Interview Questions
1. **What is PEP 8?**
   The official style guide for writing readable python code.
2. **What is dynamic typing?**
   Variables do not require explicit type declaration; it is resolved at runtime.
3. **What is the difference between list and tuple?**
   Lists are mutable (can be changed); tuples are immutable.`,

  dsa: `# Data Structures & Algorithms (DSA)

Data Structures and Algorithms represent the core computer science concepts used to store, organize, and process data efficiently in software development.

## Why DSA is Used (Key Benefits)
- **Performance Optimization**: Choose the right structure to execute operations in minimum time.
- **Resource Management**: Efficient memory footprint for applications.
- **Problem Solving**: Provides standard templates (graphs, trees) to solve complex search/sort tasks.

## Core Concepts
- **Big O Notation**: Measures the execution speed/memory complexity as input scales.
- **Data Structures**: Arrays, Linked Lists, Stacks, Queues, Binary Trees, Graphs, Hash Tables.
- **Algorithms**: Sorting (Merge, Quick), Searching (Binary Search), Dynamic Programming, Graph Traversal (BFS/DFS).

## Code Example (Binary Search Implementation)
\`\`\`javascript
// Binary Search in JavaScript
function binarySearch(arr, target) {
  let left = 0;
  let right = arr.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (arr[mid] === target) return mid; // Found it
    
    if (arr[mid] < target) {
      left = mid + 1; // Search right half
    } else {
      right = mid - 1; // Search left half
    }
  }
  return -1; // Not found
}

const sortedArray = [11, 22, 33, 44, 55, 66];
console.log("Index of 44:", binarySearch(sortedArray, 44));
\`\`\`

## Top DSA Interview Questions
1. **What is the difference between an Array and a Linked List?**
   Arrays are stored contiguously (constant lookup index, slow insertion). Linked lists use node pointers (fast insertion, linear lookup).
2. **What is the time complexity of Quick Sort?**
   Average: O(N log N). Worst case: O(N^2) if pivot choices are highly unbalanced.
3. **What is Dynamic Programming?**
   An optimization technique that solves subproblems, stores their results (memoization), and avoids recomputing them.`
};

/**
 * Returns a high-quality fallback technical document for a given topic
 * if the AI model fails or times out.
 */
export function getPopularTopicFallback(topic) {
  if (!topic) return getDefaultFallback('Educational Content');

  const t = topic.toLowerCase();

  if (t.includes('oops') || t.includes('opps') || t.includes('oop') || t.includes('object orient')) {
    return templates.oop;
  }
  if (t.includes('mern')) {
    return templates.mern;
  }
  if (t.includes('react')) {
    return templates.react;
  }
  if (t.includes('node')) {
    return templates.node;
  }
  if (t.includes('python')) {
    return templates.python;
  }
  if (t.includes('data structure') || t.includes('dsa')) {
    return templates.dsa;
  }

  return getDefaultFallback(topic);
}

function getDefaultFallback(topic) {
  // Title casing helper
  const title = topic.split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  return `# ${title}

This document provides a comprehensive technical overview and structured reference guide about: "${title}".

## Introduction & Definition
A detailed examination and fundamental breakdown of "${title}" within modern software engineering, computer science, and practical system development.

## Why it is Used (Key Benefits)
- **Increased Scalability**: Facilitates modular growth, allowing systems to grow linearly.
- **Enhanced Productivity**: Speeds up developer iterations and simplifies codebases.
- **Robust Integration**: Offers clear standard APIs and boundaries, allowing components to interact smoothly.
- **Future-Proof Design**: Easily accommodates feature expansion and updates.

## Core Concepts
1. **Foundational Architecture**: Standard setups, designs, and architectural patterns.
2. **Workflow and Execution**: The execution cycle, protocols, and data pathways.
3. **Best Practices**: Practical developer workflows, testing methodologies, and debugging protocols.

## Code Example (Demonstration)
\`\`\`javascript
// Demonstration implementation of standard concepts
function executeWorkflow(parameters) {
  console.log("Running workflow with parameters:", parameters);
  return {
    status: "success",
    timestamp: Date.now(),
    payload: parameters
  };
}

const result = executeWorkflow({ debugMode: true, topic: "${title}" });
console.log("Result:", result);
\`\`\`

## Real-World Applications
- **Enterprise Solutions**: Used by world-class corporations to manage transaction volumes.
- **Distributed Networks**: Powers server mesh configurations and cloud endpoints.
- **Consumer Applications**: Delivers highly interactive interfaces and APIs to millions of active clients.

## Learning Roadmap for Beginners
1. Master core vocabulary and baseline syntax prerequisites.
2. Build small sandbox components to verify request/response operations.
3. Explore automated testing, debugging, and telemetry protocols.
4. Scale components and deploy to cloud host providers.

## Top Interview Questions and Answers
1. **What is the primary technical challenge solved by this topic?**
   It allows developers to decouple components and scale them independently with minimal integration friction.
2. **What are the key performance metrics to track?**
   Track latency, memory footprint, request volume throughput, and cache efficiency metrics.

## Conclusion
Gaining deep technical expertise in "${title}" is highly valuable for modern software development, paving the way for designing elegant, robust, and highly scalable code structures.`;
}
