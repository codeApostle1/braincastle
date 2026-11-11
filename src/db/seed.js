/**
 * Database Seed Script
 * Populates initial categories, default creator account (codeapostle1), and sample published quizzes.
 * Run manually via: node src/db/seed.js
 */
const bcrypt = require('bcryptjs');
const db = require('./database');

function seedDatabase() {
  console.log('🌱 Starting database seed...');

  // 1. Seed Categories
  const categoryCount = db.prepare('SELECT COUNT(*) as count FROM categories').get().count;
  if (categoryCount === 0) {
    const insertCategory = db.prepare(`
      INSERT INTO categories (name, slug, description, icon)
      VALUES (?, ?, ?, ?)
    `);

    const categories = [
      ['Web Development', 'web-development', 'HTML, CSS, JavaScript, and modern web fundamentals', '🌐'],
      ['Computer Science', 'computer-science', 'Algorithms, data structures, and computer architecture', '💻'],
      ['General Science', 'general-science', 'Physics, chemistry, biology, and the natural world', '🔬'],
      ['World History', 'world-history', 'Historical eras, famous figures, and pivotal world events', '🏛️']
    ];

    for (const cat of categories) {
      insertCategory.run(cat[0], cat[1], cat[2], cat[3]);
    }
    console.log('✔ Initial categories created.');
  }

  // 2. Seed System User (no exposed credentials)
  let systemUser = db.prepare('SELECT id FROM users WHERE email = ?').get('system@braincastle.local');
  let systemUserId;
  if (!systemUser) {
    const insertUser = db.prepare(`
      INSERT INTO users (email, password_hash, name)
      VALUES (?, ?, ?)
    `);
    // Generate a random password hash (not needed for login)
    const randomHash = bcrypt.hashSync(Math.random().toString(36).slice(-8), 10);
    const result = insertUser.run('system@braincastle.local', randomHash, 'System');
    systemUserId = result.lastInsertRowid;
    console.log('✔ System user created for default quizzes.');
  } else {
    systemUserId = systemUser.id;
    // Ensure name is set to System
    db.prepare('UPDATE users SET name = ? WHERE id = ?').run('System', systemUserId);
  }
  let creator = db.prepare('SELECT id FROM users WHERE email = ?').get('creator@example.com');
  let creatorId;
  if (!creator) {
    const passwordHash = bcrypt.hashSync('password123', 10);
    const insertUser = db.prepare(`
      INSERT INTO users (email, password_hash, name)
      VALUES (?, ?, ?)
    `);
    const result = insertUser.run('creator@example.com', passwordHash, 'codeapostle1');
    creatorId = result.lastInsertRowid;
    console.log('✔ Default creator account created: creator@example.com / password123 (codeapostle1)');
  } else {
    creatorId = creator.id;
    db.prepare('UPDATE users SET name = ? WHERE id = ?').run('codeapostle1', creatorId);
  }

  // 3. Seed Sample Quiz Collections
  const webDevCat = db.prepare("SELECT id FROM categories WHERE slug = 'web-development'").get() || { id: 1 };
  const csCat = db.prepare("SELECT id FROM categories WHERE slug = 'computer-science'").get() || { id: 2 };

  // Collection 1: Web Development Fundamentals (10 questions)
  let coll1 = db.prepare("SELECT id FROM collections WHERE title = 'Web Development Fundamentals'").get();
  if (coll1) {
    // If it has fewer than 10 questions, recreate its questions
    const currentQCount = db.prepare('SELECT COUNT(*) as count FROM questions WHERE collection_id = ?').get(coll1.id).count;
    if (currentQCount < 10) {
      db.prepare('DELETE FROM questions WHERE collection_id = ?').run(coll1.id);
      insertQuestions(coll1.id, getWebDevQuestions());
      console.log('✔ Updated "Web Development Fundamentals" to 10 questions.');
    }
  } else {
    const insertCollection = db.prepare(`
      INSERT INTO collections (user_id, category_id, title, description, cover_image, is_published)
      VALUES (?, ?, ?, ?, ?, 1)
    `);

    const collResult = insertCollection.run(
      creatorId,
      webDevCat.id,
      'Web Development Fundamentals',
      'Master the core building blocks of the web: HTML5 semantic elements, modern CSS layout models, and foundational JavaScript paradigms.',
      'https://images.unsplash.com/photo-1593720213428-28a5b9e94613?auto=format&fit=crop&w=800&q=80'
    );
    coll1 = { id: collResult.lastInsertRowid };
    insertQuestions(coll1.id, getWebDevQuestions());
    console.log('✔ "Web Development Fundamentals" with 10 questions seeded.');
  }

  // Collection 2: Data Structures & Algorithms Essentials (6 questions)
  let coll2 = db.prepare("SELECT id FROM collections WHERE title = 'Data Structures & Algorithms Essentials'").get();
  if (!coll2) {
    const insertCollection = db.prepare(`
      INSERT INTO collections (user_id, category_id, title, description, cover_image, is_published)
      VALUES (?, ?, ?, ?, ?, 1)
    `);

    const collResult = insertCollection.run(
      creatorId,
      csCat.id,
      'Data Structures & Algorithms Essentials',
      'Sharpen your problem-solving skills with questions on time complexity, stacks, queues, binary trees, and sorting algorithms.',
      'https://images.unsplash.com/photo-1516116211227-bbc05452d9a6?auto=format&fit=crop&w=800&q=80'
    );
    coll2 = { id: collResult.lastInsertRowid };

    const questions2 = [
      {
        text: 'What is the average time complexity of searching an element in a balanced Binary Search Tree (BST)?',
        hint: 'Each comparison cuts the search space in half.',
        explanation: 'In a balanced BST, each comparison halves the remaining candidates, yielding an O(log n) average search time.',
        options: [
          { text: 'O(log n)', is_correct: 1 },
          { text: 'O(n)', is_correct: 0 },
          { text: 'O(1)', is_correct: 0 },
          { text: 'O(n log n)', is_correct: 0 }
        ]
      },
      {
        text: 'Which data structure follows the First-In, First-Out (FIFO) principle?',
        hint: 'Think of waiting in line at a grocery checkout.',
        explanation: 'A Queue processes elements in FIFO order: the first element added is the first one removed.',
        options: [
          { text: 'Queue', is_correct: 1 },
          { text: 'Stack', is_correct: 0 },
          { text: 'Binary Tree', is_correct: 0 },
          { text: 'Heap', is_correct: 0 }
        ]
      },
      {
        text: 'Which sorting algorithm has a worst-case time complexity of O(n log n) and uses a divide-and-conquer strategy?',
        hint: 'It splits arrays down to single items and merges them in order.',
        explanation: 'Merge Sort consistently achieves O(n log n) time in all cases (worst, best, average) by dividing the list in half recursively and merging sorted halves.',
        options: [
          { text: 'Merge Sort', is_correct: 1 },
          { text: 'Quick Sort', is_correct: 0 },
          { text: 'Bubble Sort', is_correct: 0 },
          { text: 'Insertion Sort', is_correct: 0 }
        ]
      },
      {
        text: 'What data structure is typically used to implement Breadth-First Search (BFS) in a graph?',
        hint: 'BFS explores neighbors level by level in FIFO order.',
        explanation: 'BFS uses a Queue to keep track of vertices to visit next in FIFO order, ensuring level-by-level traversal.',
        options: [
          { text: 'Queue', is_correct: 1 },
          { text: 'Stack', is_correct: 0 },
          { text: 'Priority Queue', is_correct: 0 },
          { text: 'Disjoint Set', is_correct: 0 }
        ]
      },
      {
        text: 'What is the space complexity of an iterative binary search algorithm on a sorted array?',
        hint: 'Iterative binary search only stores two pointers: low and high.',
        explanation: 'Iterative binary search requires only a few pointer variables (low, high, mid), so it uses O(1) auxiliary space.',
        options: [
          { text: 'O(1) constant space', is_correct: 1 },
          { text: 'O(log n) space', is_correct: 0 },
          { text: 'O(n) linear space', is_correct: 0 },
          { text: 'O(n^2) quadratic space', is_correct: 0 }
        ]
      },
      {
        text: 'In a Hash Table, what is the term for when two different keys hash to the same index?',
        hint: 'When two objects crash into each other.',
        explanation: 'A hash collision occurs when two distinct keys produce the same hash code or bucket index.',
        options: [
          { text: 'Collision', is_correct: 1 },
          { text: 'Overflow', is_correct: 0 },
          { text: 'Fragmentation', is_correct: 0 },
          { text: 'Rehash Exception', is_correct: 0 }
        ]
      }
    ];

    insertQuestions(coll2.id, questions2);
    console.log('✔ "Data Structures & Algorithms Essentials" with 6 questions seeded.');
  }

  console.log('🎉 Database seeding complete!');
}

function getWebDevQuestions() {
  return [
    {
      text: 'What does the HTML <main> element represent?',
      hint: 'Think about unique content vs headers, sidebars, and footers.',
      explanation: 'The <main> element represents the dominant content of the <body> of a document, excluding repeated headers, footers, or navigation links.',
      options: [
        { text: 'The dominant content unique to the document', is_correct: 1 },
        { text: 'The primary navigation menu of the page', is_correct: 0 },
        { text: 'The metadata and scripts for the webpage', is_correct: 0 },
        { text: 'The footer and copyright notice', is_correct: 0 }
      ]
    },
    {
      text: 'Which CSS property defines the space between the content and its border?',
      hint: 'It is inside the element, unlike margin which is outside.',
      explanation: 'Padding creates space inside an element between its content and its border, whereas margin creates space outside.',
      options: [
        { text: 'padding', is_correct: 1 },
        { text: 'margin', is_correct: 0 },
        { text: 'gap', is_correct: 0 },
        { text: 'border-spacing', is_correct: 0 }
      ]
    },
    {
      text: 'Which JavaScript keyword declares a block-scoped variable that cannot be reassigned?',
      hint: 'Think of "constant".',
      explanation: 'const creates a block-scoped variable whose identifier cannot be reassigned after initialization.',
      options: [
        { text: 'const', is_correct: 1 },
        { text: 'let', is_correct: 0 },
        { text: 'var', is_correct: 0 },
        { text: 'static', is_correct: 0 }
      ]
    },
    {
      text: 'What is the purpose of the Event.preventDefault() method in JavaScript?',
      hint: 'It stops what the browser would normally do for an event, like form submission.',
      explanation: 'Event.preventDefault() cancels the default action that belongs to the event, such as navigating a link or submitting a form without page reload.',
      options: [
        { text: 'Stops the browser from executing the default event action', is_correct: 1 },
        { text: 'Immediately deletes the event listener from memory', is_correct: 0 },
        { text: 'Prevents the event from bubbling up the DOM tree', is_correct: 0 },
        { text: 'Pauses JavaScript execution for a specified duration', is_correct: 0 }
      ]
    },
    {
      text: 'In SQLite, which pragma must be enabled to enforce relational foreign key constraints?',
      hint: 'It contains the words foreign and keys.',
      explanation: 'SQLite requires PRAGMA foreign_keys = ON; to be set on database connections to enforce foreign key constraints.',
      options: [
        { text: 'PRAGMA foreign_keys = ON', is_correct: 1 },
        { text: 'PRAGMA enable_relations = TRUE', is_correct: 0 },
        { text: 'PRAGMA enforce_integrity = 1', is_correct: 0 },
        { text: 'PRAGMA strict_tables = ON', is_correct: 0 }
      ]
    },
    {
      text: 'What does CSS "box-sizing: border-box" do?',
      hint: 'It includes padding and border in the element\'s total width and height.',
      explanation: 'With border-box, the width and height properties include content, padding, and border, making responsive layouts much easier to manage.',
      options: [
        { text: 'Includes padding and border in the element\'s total width and height', is_correct: 1 },
        { text: 'Removes all margins and borders from the element', is_correct: 0 },
        { text: 'Forces the element to display as an inline-block box', is_correct: 0 },
        { text: 'Adds a drop shadow to the border box', is_correct: 0 }
      ]
    },
    {
      text: 'Which array method in JavaScript creates a new array populated with the results of calling a provided function on every element?',
      hint: 'It maps elements 1-to-1 to a new array.',
      explanation: 'Array.prototype.map() creates a new array populated with the results of calling a provided callback function on every element in the calling array.',
      options: [
        { text: 'Array.prototype.map()', is_correct: 1 },
        { text: 'Array.prototype.forEach()', is_correct: 0 },
        { text: 'Array.prototype.filter()', is_correct: 0 },
        { text: 'Array.prototype.reduce()', is_correct: 0 }
      ]
    },
    {
      text: 'What is the purpose of the HTTP status code 401?',
      hint: 'It indicates that credentials are missing or invalid.',
      explanation: 'HTTP 401 Unauthorized indicates that the client request has not been completed because it lacks valid authentication credentials.',
      options: [
        { text: 'Unauthorized: authentication is required and has failed or not been provided', is_correct: 1 },
        { text: 'Forbidden: the server understands the request but refuses to authorize it', is_correct: 0 },
        { text: 'Not Found: the requested resource could not be found on the server', is_correct: 0 },
        { text: 'Internal Server Error: an unexpected condition was encountered', is_correct: 0 }
      ]
    },
    {
      text: 'Which HTML attribute specifies an alternate text for an image if the image cannot be displayed?',
      hint: 'Short for alternate.',
      explanation: 'The alt attribute provides alternative information for an image if a user cannot view it, and is crucial for accessibility screen readers.',
      options: [
        { text: 'alt', is_correct: 1 },
        { text: 'title', is_correct: 0 },
        { text: 'src', is_correct: 0 },
        { text: 'description', is_correct: 0 }
      ]
    },
    {
      text: 'In Express.js, what does middleware function "next()" do?',
      hint: 'It hands control over to the next handler in the stack.',
      explanation: 'Calling next() passes control to the next matching middleware function in the request-response cycle.',
      options: [
        { text: 'Passes control to the next middleware function in the stack', is_correct: 1 },
        { text: 'Immediately ends the HTTP response and sends data to the client', is_correct: 0 },
        { text: 'Skips all remaining routes and terminates the Node.js process', is_correct: 0 },
        { text: 'Restarts the Express application server', is_correct: 0 }
      ]
    }
  ];
}

function insertQuestions(collectionId, questions) {
  const insertQuestion = db.prepare(`
    INSERT INTO questions (collection_id, question_text, hint, explanation, order_index)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertOption = db.prepare(`
    INSERT INTO options (question_id, option_text, is_correct, order_index)
    VALUES (?, ?, ?, ?)
  `);

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const qResult = insertQuestion.run(collectionId, q.text, q.hint, q.explanation, i + 1);
    const questionId = qResult.lastInsertRowid;

    for (let j = 0; j < q.options.length; j++) {
      const opt = q.options[j];
      insertOption.run(questionId, opt.text, opt.is_correct, j + 1);
    }
  }
}

if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;
