import 'dotenv/config'; // Loads environment variables from .env file

import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch'; // Required for external API mock
import {
  createUserInputSchema,
  loginUserInputSchema,
  forgotPasswordInputSchema,
  resetPasswordInputSchema,
  createTaskInputSchema,
  updateTaskInputSchema,
  searchTasksInputSchema,
  createCategoryInputSchema,
  updateCategoryInputSchema,
  searchCategoriesInputSchema,
  taskSchema,
  categorySchema,
  userSchema,
  taskPriorityEnum,
  lastActiveViewInputSchema, // New schema for last_active_view input
} from './schema.ts'; // Ensure this path is correct for Zod schemas

// ESM workaround for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey'; // Fallback for dev, use .env for prod
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

// --- PostgreSQL Pool Setup ---
const { Pool } = pkg;
const { DATABASE_URL, PGHOST, PGDATABASE, PGUSER, PGPASSWORD, PGPORT = 5432 } = process.env;

const pool = new Pool(
  DATABASE_URL
    ? {
        connectionString: DATABASE_URL,
        ssl: { require: true },
      }
    : {
        host: PGHOST || "ep-ancient-dream-abbsot9k-pooler.eu-west-2.aws.neon.tech",
        database: PGDATABASE || "neondb",
        username: PGUSER || "neondb_owner",
        password: PGPASSWORD || "npg_jAS3aITLC5DX",
        port: 5432,
        ssl: {
          require: true,
          rejectUnauthorized: false // Required for connecting to Neon, as their self-signed certs might not be trusted by default
        },
      }
);

// --- Middleware ---
app.use(express.json()); // Parses incoming JSON requests
app.use(cors()); // Enables CORS for all routes
// Custom morgan logger: Be cautious of logging sensitive info in production
app.use(morgan((tokens, req, res) => {
  return [
    tokens.method(req, res),
    tokens.url(req, res),
    // REMOVED logging of headers, params, query, body due to potential sensitive information exposure
    // JSON.stringify(req.headers),
    // JSON.stringify(req.params),
    // JSON.stringify(req.query),
    // JSON.stringify(req.body),
    tokens.status(req, res),
    tokens['response-time'](req, res), 'ms'
  ].join(' ');
}));

// --- Utility Functions ---

/**
 * Generates a unique ID (UUID).
 * @returns {string} A UUID.
 */
function generateId() {
  return uuidv4();
}

/**
 * Converts a Date object to a Unix timestamp in milliseconds.
 * @param {Date | number | null} date - The Date object or number (timestamp) to convert.
 * @returns {number | null} Unix timestamp in milliseconds, or null if input is null.
 */
function toUnixTimestamp(date) {
  if (date instanceof Date) {
    return date.getTime();
  }
  if (typeof date === 'number') {
    return date; // Assume it's already a timestamp
  }
  return null;
}

/**
 * Converts a Unix timestamp in milliseconds to a Date object.
 * @param {number | null} timestamp - The Unix timestamp.
 * @returns {Date | null} A Date object, or null if input is null.
 */
function fromUnixTimestamp(timestamp) {
  return timestamp ? new Date(Number(timestamp)) : null;
}

/**
 * Creates an error response object.
 * @param {string} message - The error message.
 * @param {string} [code] - Optional application-specific error code.
 * @param {any} [details] - Optional additional error details.
 * @returns {object} Error response object.
 */
function errorResponse(message, code = null, details = null) {
  return { message, code, details };
}

/**
 * JWT Authentication Middleware
 * Verifies the JWT token from the Authorization header and attaches user info to req.user.
 */
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json(errorResponse('Authentication token required.'));
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json(errorResponse('Invalid or expired token.'));
    }
    req.user = user; // Attach user payload (e.g., { id: 'user_id', email: 'user@example.com' })
    next();
  });
}

// Simple in-memory store for password reset tokens for mocking purposes
const passwordResetTokens = new Map(); // token -> { userId, expiresAt }

/**
 * `@@need:external-api: This function would typically interact with an external email service (e.g., SendGrid, Mailgun)
 * to send an email. For this implementation, it's mocked to use fetch with SendGrid credentials.`
 * Mocks sending a password reset email.
 * @param {string} email - The recipient's email address.
 * @param {string} resetLink - The password reset link to send.
 */
async function sendPasswordResetEmail(email, resetLink) {
  const SENDER_EMAIL = process.env.SENDER_EMAIL;
  const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;

  if (!SENDER_EMAIL || !SENDGRID_API_KEY) {
    console.warn("SendGrid API Key or Sender Email environment variables are missing. Email sending will be mocked to console.");
    console.log(`MOCK EMAIL SERVICE: Sending password reset email to ${email}`);
    console.log(`Reset Link: ${resetLink}`);
    return; // Don't attempt actual fetch if keys are missing
  }

  const payload = {
    personalizations: [
      {
        to: [{ email: email }]
      }
    ],
    from: {
      email: SENDER_EMAIL,
      name: "NexGen TaskPad"
    },
    subject: "Password Reset Request - NexGen TaskPad",
    content: [
      {
        type: "text/html", // Use HTML to ensure link is clickable
        value: `Hello,<br><br>You requested a password reset for your NexGen TaskPad account. Please click on the following link to reset your password: <a href="${resetLink}">Reset Password</a><br><br>If you did not request this, please ignore this email.<br><br>Regards,<br>The NexGen TaskPad Team`
      }
    ]
  };

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) { // SendGrid returns 202 Accepted for success
      console.log(`Password reset email sent successfully to ${email} via SendGrid.`);
    } else {
      const errorData = await response.json();
      console.error(`FAILED to send password reset email to ${email} via SendGrid. Status: ${response.status}, Error:`, errorData);
    }
  } catch (error) {
    console.error(`ERROR sending password reset email to ${email} via SendGrid:`, error);
  }
}

// --- Routes ---

/**
 * POST /api/register
 * Registers a new user.
 * Validates input, hashes password, creates user and default categories, provides JWT.
 */
app.post('/api/register', async (req, res) => {
  const client = await pool.connect();
  try {
    const { email, password } = createUserInputSchema.parse(req.body);

    const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json(errorResponse('Email already registered.', 'EMAIL_EXISTS'));
    }

    const password_hash = await bcrypt.hash(password, 10);
    const userId = generateId();
    const now = Date.now();

    await client.query('BEGIN'); // Start transaction

    const insertUserQuery = `
      INSERT INTO users (id, email, password_hash, created_at, updated_at, last_login_at, last_active_view)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, email, created_at, updated_at, last_login_at, last_active_view;
    `;
    // last_active_view initialized as NULL, which is the default for JSONB unless specified.
    const userResult = await client.query(insertUserQuery, [userId, email, password_hash, now, now, now, null]);
    const userData = userResult.rows[0];

    // Create default categories for the new user
    const defaultCategories = ["Work", "Personal", "Shopping", "Errands"];
    for (const catName of defaultCategories) {
      const categoryId = generateId();
      const insertCategoryQuery = `
        INSERT INTO categories (id, user_id, name, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5);
      `;
      await client.query(insertCategoryQuery, [categoryId, userId, catName, now, now]);
    }

    await client.query('COMMIT'); // Commit transaction

    const token = jwt.sign({ id: userId, email: email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.status(201).json({
      user: userSchema.parse({
        id: userData.id,
        email: userData.email,
        // password_hash is not part of the schema returned by the API
        created_at: fromUnixTimestamp(Number(userData.created_at)),
        updated_at: fromUnixTimestamp(Number(userData.updated_at)),
        last_login_at: fromUnixTimestamp(Number(userData.last_login_at)),
        last_active_view: userData.last_active_view, // This will be null initially
      }),
      token,
    });
  } catch (error) {
    await client.query('ROLLBACK'); // Rollback transaction on error
    if (error.name === 'ZodError') {
      return res.status(400).json(errorResponse('Validation Error', 'VALIDATION_FAILED', error.errors));
    }
    console.error('Registration error:', error);
    res.status(500).json(errorResponse('Internal server error during registration.'));
  } finally {
    client.release();
  }
});

/**
 * POST /api/login
 * Logs in an existing user.
 * Validates credentials, updates last_login_at, provides JWT.
 */
app.post('/api/login', async (req, res) => {
  const client = await pool.connect();
  try {
    const { email, password } = loginUserInputSchema.parse(req.body);

    const userResult = await client.query('SELECT id, email, password_hash, created_at, updated_at, last_login_at, last_active_view FROM users WHERE email = $1', [email]);
    const user = userResult.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json(errorResponse('Invalid email or password.'));
    }

    const now = Date.now();
    await client.query('UPDATE users SET last_login_at = $1 WHERE id = $2', [now, user.id]);

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.status(200).json({
      user: userSchema.parse({
        id: user.id,
        email: user.email,
        // password_hash is not part of the schema
        created_at: fromUnixTimestamp(Number(user.created_at)),
        updated_at: fromUnixTimestamp(Number(user.updated_at)),
        last_login_at: fromUnixTimestamp(now),
        last_active_view: user.last_active_view, // Directly return JSONB object
      }),
      token,
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json(errorResponse('Validation Error', 'VALIDATION_FAILED', error.errors));
    }
    console.error('Login error:', error);
    res.status(500).json(errorResponse('Internal server error during login.'));
  } finally {
    client.release();
  }
});

/**
 * POST /api/forgot-password
 * Initiates password reset process. Mocks email sending.
 */
app.post('/api/forgot-password', async (req, res) => {
  const client = await pool.connect();
  try {
    const { email } = forgotPasswordInputSchema.parse(req.body);

    const userResult = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    const user = userResult.rows[0];

    // Always return a success message to prevent email enumeration attacks
    if (user) {
      const resetToken = uuidv4();
      const expiresAt = Date.now() + 3600000; // Token valid for 1 hour

      passwordResetTokens.set(resetToken, { userId: user.id, expiresAt });

      const clientHost = req.get('origin') || `${req.protocol}://${req.get('host')}`;
      const resetLink = `${clientHost}/reset-password?token=${resetToken}`; // Client-side route for reset

      await sendPasswordResetEmail(email, resetLink); // External API call (mocked)
    }

    res.status(200).json({ message: 'If an account with that email exists, a password reset link has been sent.' });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json(errorResponse('Validation Error', 'VALIDATION_FAILED', error.errors));
    }
    console.error('Forgot password error:', error);
    res.status(500).json(errorResponse('Internal server error.'));
  } finally {
    client.release();
  }
});

/**
 * POST /api/reset-password
 * Resets user password using a token.
 * Validates token, updates password_hash.
 */
app.post('/api/reset-password', async (req, res) => {
  const client = await pool.connect();
  try {
    const { token, new_password, confirm_new_password } = resetPasswordInputSchema.parse(req.body);

    if (new_password !== confirm_new_password) {
      return res.status(400).json(errorResponse('New passwords do not match.'));
    }

    const tokenData = passwordResetTokens.get(token);

    if (!tokenData || tokenData.expiresAt < Date.now()) {
      return res.status(401).json(errorResponse('Invalid or expired reset token.'));
    }

    const password_hash = await bcrypt.hash(new_password, 10);
    const now = Date.now();

    await client.query('UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3', [password_hash, now, tokenData.userId]);

    passwordResetTokens.delete(token); // Invalidate token after use

    res.status(200).json({ message: 'Your password has been reset successfully. Please log in.' });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json(errorResponse('Validation Error', 'VALIDATION_FAILED', error.errors));
    }
    console.error('Reset password error:', error);
    res.status(500).json(errorResponse('Internal server error.'));
  } finally {
    client.release();
  }
});

/**
 * POST /api/logout
 * Logs out the authenticated user.
 * For JWT, this typically means the client discards the token. Backend can optionally implement token blacklisting.
 */
app.post('/api/logout', authenticateToken, (req, res) => {
  // With JWT, logout is primarily client-side discarding of the token.
  // For robustness in real apps, consider token blacklisting or shorter JWT expiry.
  res.status(200).json({ message: 'Logged out successfully.' });
});


/**
 * POST /api/tasks
 * Creates a new task for the authenticated user.
 * Manages order_index by shifting existing incomplete tasks.
 */
app.post('/api/tasks', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.user.id;
    // Input schema does NOT include order_index, as it's managed by the backend
    const { title, description, due_date_at, priority, category_id } = createTaskInputSchema.parse(req.body);
    const now = Date.now();

    if (category_id) {
      const categoryResult = await client.query('SELECT 1 FROM categories WHERE id = $1 AND user_id = $2', [category_id, userId]);
      if (categoryResult.rows.length === 0) {
        return res.status(400).json(errorResponse('Category not found or does not belong to user.', 'CATEGORY_NOT_FOUND'));
      }
    }

    await client.query('BEGIN'); // Start transaction for order_index management

    // Shift existing *incomplete* tasks' order_index to make space for the new task at the top (order_index = 0)
    // Only incomplete tasks participate in this order_index scheme for active lists.
    await client.query('UPDATE tasks SET order_index = order_index + 1 WHERE user_id = $1 AND is_completed = FALSE', [userId]);

    const taskId = generateId();
    const insertTaskQuery = `
      INSERT INTO tasks (id, user_id, category_id, title, description, due_date_at, priority, is_completed, completed_at, order_index, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, user_id, category_id, title, description, due_date_at, priority, is_completed, completed_at, order_index, created_at, updated_at;
    `;
    const taskResult = await client.query(insertTaskQuery, [
      taskId,
      userId,
      category_id,
      title,
      description || null,
      toUnixTimestamp(due_date_at), // Convert Date object to Unix timestamp (BIGINT)
      priority || 'medium',
      false, // is_completed defaults to false
      null, // completed_at defaults to null
      0,     // new task always at order_index 0 for active tasks
      now,
      now,
    ]);
    await client.query('COMMIT'); // Commit transaction

    res.status(201).json(taskSchema.parse({
      id: taskResult.rows[0].id,
      user_id: taskResult.rows[0].user_id,
      category_id: taskResult.rows[0].category_id,
      title: taskResult.rows[0].title,
      description: taskResult.rows[0].description,
      due_date_at: fromUnixTimestamp(Number(taskResult.rows[0].due_date_at)), // Convert from BIGINT to Date
      priority: taskResult.rows[0].priority,
      is_completed: taskResult.rows[0].is_completed,
      completed_at: fromUnixTimestamp(Number(taskResult.rows[0].completed_at)), // Convert from BIGINT to Date
      order_index: taskResult.rows[0].order_index,
      created_at: fromUnixTimestamp(Number(taskResult.rows[0].created_at)), // Convert from BIGINT to Date
      updated_at: fromUnixTimestamp(Number(taskResult.rows[0].updated_at)), // Convert from BIGINT to Date
    }));
  } catch (error) {
    await client.query('ROLLBACK'); // Rollback on error
    if (error.name === 'ZodError') {
      return res.status(400).json(errorResponse('Validation Error', 'VALIDATION_FAILED', error.errors));
    }
    console.error('Error creating task:', error);
    res.status(500).json(errorResponse('Internal server error creating task.'));
  } finally {
    client.release();
  }
});

/**
 * GET /api/tasks
 * Retrieves tasks for the authenticated user, with extensive filtering and sorting capabilities.
 */
app.get('/api/tasks', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.user.id;
    // Parse query parameters with Zod
    const {
      query,
      category_id,
      priority,
      is_completed, // boolean, default true for active tasks, false for completed
      due_date_before, // Unix timestamp (number)
      due_date_after,  // Unix timestamp (number)
      limit = 10,
      offset = 0,
      sort_by = 'order_index', // Default sort by order_index for active tasks
      sort_order = 'asc',      // Default sort order (asc for order_index, desc for dates usually)
    } = searchTasksInputSchema.parse(req.query);

    let whereClauses = [`user_id = $1`];
    const queryParams = [userId];
    let paramIndex = 2;

    if (query) {
      whereClauses.push(`(title ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
      queryParams.push(`%${query}%`);
      paramIndex++;
    }

    // Handle category_id filter: can be specific ID, or "null" string for uncategorized
    if (category_id !== undefined) {
      if (category_id === "null") { // Check for explicit "null" string from query param
        whereClauses.push(`category_id IS NULL`);
      } else {
        whereClauses.push(`category_id = $${paramIndex}`);
        queryParams.push(category_id);
        paramIndex++;
      }
    }
    if (priority) {
      whereClauses.push(`priority = $${paramIndex}`);
      queryParams.push(priority);
      paramIndex++;
    }

    // Default to show incomplete tasks if is_completed not provided
    if (is_completed !== undefined) {
      // Zod converts "true"/"false" strings to actual booleans
      whereClauses.push(`is_completed = $${paramIndex}`);
      queryParams.push(is_completed);
      paramIndex++;
    } else {
      // Default to show active tasks if is_completed is not specified
      whereClauses.push(`is_completed = FALSE`);
    }

    if (due_date_before) {
      whereClauses.push(`due_date_at <= $${paramIndex}`);
      queryParams.push(due_date_before); // Zod already ensures it's a number (timestamp)
      paramIndex++;
    }
    if (due_date_after) {
      whereClauses.push(`due_date_at >= $${paramIndex}`);
      queryParams.push(due_date_after); // Zod already ensures it's a number (timestamp)
      paramIndex++;
    }

    let orderByClauses = [];

    // Prioritize sorting for active tasks as per FR.TASK.VIEW.30
    // This logic applies primarily when viewing incomplete tasks and not explicitly overriding sort_by
    if (is_completed === false || is_completed === undefined) {
      // 1. Overdue tasks (due_date_at < now AND is_completed = FALSE) first, oldest first
      orderByClauses.push(`CASE WHEN due_date_at IS NOT NULL AND due_date_at < ${Date.now()} AND is_completed = FALSE THEN 0 ELSE 1 END ASC`); // Overdue flag
      orderByClauses.push('due_date_at ASC NULLS LAST'); // Sort by due date asc, tasks without due dates last
      // 2. Priority (High > Medium > Low)
      orderByClauses.push(`CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 WHEN 'low' THEN 2 ELSE 3 END ASC`);
      // 3. Order Index
      orderByClauses.push('order_index ASC'); // Manual order
    } else { // For completed tasks or if specific sort_by is requested
      // If a specific sort_by is requested, use it, otherwise default (e.g. order_index for completed list)
      orderByClauses.push(`${sort_by} ${sort_order === 'desc' ? 'DESC' : 'ASC'}`);
    }

    const orderByString = orderByClauses.length > 0 ? `ORDER BY ${orderByClauses.join(', ')}` : '';

    const taskQuery = `
      SELECT id, user_id, category_id, title, description, due_date_at, priority, is_completed, completed_at, order_index, created_at, updated_at
      FROM tasks
      WHERE ${whereClauses.join(' AND ')}
      ${orderByString}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
    `;
    queryParams.push(limit, offset);

    const result = await client.query(taskQuery, queryParams);

    // Map and parse results using Zod schema for type safety and transformation
    const tasks = result.rows.map(row => taskSchema.parse({
      id: row.id,
      user_id: row.user_id,
      category_id: row.category_id,
      title: row.title,
      description: row.description,
      due_date_at: fromUnixTimestamp(row.due_date_at), // Convert from BIGINT to Date
      priority: row.priority,
      is_completed: row.is_completed,
      completed_at: fromUnixTimestamp(row.completed_at), // Convert from BIGINT to Date
      order_index: row.order_index,
      created_at: fromUnixTimestamp(row.created_at), // Convert from BIGINT to Date
      updated_at: fromUnixTimestamp(row.updated_at), // Convert from BIGINT to Date
    }));

    res.status(200).json(tasks);
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json(errorResponse('Validation Error', 'VALIDATION_FAILED', error.errors));
    }
    console.error('Error fetching tasks:', error);
    res.status(500).json(errorResponse('Internal server error fetching tasks.'));
  } finally {
    client.release();
  }
});

/**
 * PATCH /api/tasks/{task_id}
 * Updates an existing task. Handles partial updates and order_index reordering.
 */
app.patch('/api/tasks/:task_id', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.user.id;
    const { task_id } = req.params;
    const updateFields = updateTaskInputSchema.parse(req.body); // All fields optional
    const now = Date.now();

    const currentTaskResult = await client.query('SELECT order_index, is_completed, category_id FROM tasks WHERE id = $1 AND user_id = $2', [task_id, userId]);
    const currentTask = currentTaskResult.rows[0];

    if (!currentTask) {
      return res.status(404).json(errorResponse('Task not found or does not belong to user.'));
    }

    // If category_id is being updated, validate it
    if (updateFields.category_id !== undefined && updateFields.category_id !== null) {
      const categoryResult = await client.query('SELECT 1 FROM categories WHERE id = $1 AND user_id = $2', [updateFields.category_id, userId]);
      if (categoryResult.rows.length === 0) {
        return res.status(400).json(errorResponse('Category not found or does not belong to user.', 'CATEGORY_NOT_FOUND'));
      }
    }

    let queryParts = [];
    const queryParams = [task_id, userId]; // First two params are task_id, user_id for WHERE clause
    let paramIndex = 3; // Start from $3 for SET clause

    // Build query parts for fields to update
    if (updateFields.title !== undefined) {
      queryParts.push(`title = $${paramIndex++}`);
      queryParams.push(updateFields.title);
    }
    if (updateFields.description !== undefined) {
      queryParts.push(`description = $${paramIndex++}`);
      queryParams.push(updateFields.description);
    }
    if (updateFields.due_date_at !== undefined) {
      queryParts.push(`due_date_at = $${paramIndex++}`);
      queryParams.push(toUnixTimestamp(updateFields.due_date_at));
    }
    if (updateFields.priority !== undefined) {
      queryParts.push(`priority = $${paramIndex++}`);
      queryParams.push(updateFields.priority);
    }
    if (updateFields.is_completed !== undefined) {
      const oldIsCompleted = currentTask.is_completed;
      const newIsCompleted = updateFields.is_completed;

      queryParts.push(`is_completed = $${paramIndex++}`);
      queryParams.push(newIsCompleted);

      // Handle completed_at timestamp
      if (newIsCompleted === true && oldIsCompleted === false) {
        // Task becomes completed
        queryParts.push(`completed_at = $${paramIndex++}`);
        queryParams.push(now);
      } else if (newIsCompleted === false && oldIsCompleted === true) {
        // Task becomes incomplete (un-completed)
        queryParts.push(`completed_at = NULL`);
        // If it becomes incomplete, it gets a new order_index at the end of the active list
        const maxOrderResult = await client.query(
            `SELECT MAX(order_index) FROM tasks WHERE user_id = $1 AND is_completed = FALSE;`,
            [userId]
        );
        // Find the next available order_index for incomplete tasks
        const newOrderIndexForIncomplete = (maxOrderResult.rows[0].max || -1) + 1;
        queryParts.push(`order_index = $${paramIndex++}`);
        queryParams.push(newOrderIndexForIncomplete);
      } else if (newIsCompleted === true && oldIsCompleted === true) {
        // Already completed, ensure completed_at is not inadvertently nulled if already set.
        // It's safest not to touch completed_at if it's already completed.
        // The schema specifies it as nullable, so it's fine if it's there or not for already completed tasks.
      } else if (newIsCompleted === false && oldIsCompleted === false) {
        // Already incomplete, ensure completed_at is NULL
        queryParts.push(`completed_at = NULL`);
      }
    }

    // Handle order_index reordering for active tasks if provided AND task is incomplete/remains incomplete
    if (updateFields.order_index !== undefined && // order_index provided
        updateFields.order_index !== currentTask.order_index && // order_index is actually changing
        (updateFields.is_completed === false || updateFields.is_completed === undefined && currentTask.is_completed === false) // Task is or remains incomplete
    ) {
      const oldIndex = currentTask.order_index;
      const newIndex = updateFields.order_index;

      // Validate newIndex
      if (newIndex < 0) {
        return res.status(400).json(errorResponse('Order index cannot be negative.'));
      }
      const maxOrderResult = await client.query(
        `SELECT MAX(order_index) FROM tasks WHERE user_id = $1 AND is_completed = FALSE;`,
        [userId]
      );
      const maxOrderIndex = maxOrderResult.rows[0].max || -1; // If no tasks, max is -1 initially for 0-indexing

      if (newIndex > maxOrderIndex + 1) {
        return res.status(400).json(errorResponse(`Order index ${newIndex} is out of bounds. Max allowable is ${maxOrderIndex + 1}.`));
      }

      await client.query('BEGIN'); // Transaction for order_index updates
      if (newIndex < oldIndex) {
        // Shift tasks down: increment order_index for tasks between newIndex and oldIndex-1
        await client.query(
          `UPDATE tasks SET order_index = order_index + 1
           WHERE user_id = $1 AND is_completed = FALSE
             AND order_index >= $2 AND order_index < $3 AND id != $4;`,
          [userId, newIndex, oldIndex, task_id]
        );
      } else { // newIndex > oldIndex
        // Shift tasks up: decrement order_index for tasks between oldIndex+1 and newIndex
        await client.query(
          `UPDATE tasks SET order_index = order_index - 1
           WHERE user_id = $1 AND is_completed = FALSE
             AND order_index > $2 AND order_index <= $3 AND id != $4;`,
          [userId, oldIndex, newIndex, task_id]
        );
      }
      queryParts.push(`order_index = $${paramIndex++}`);
      queryParams.push(newIndex);
    } else if (updateFields.order_index !== undefined) {
      // If order_index was provided but task is completed, or it's not changing, ignore manual order_index changes
      // The previous logic handles setting order_index when task becomes incomplete from completed.
      // Do nothing here, as `order_index` is only relevant for incomplete tasks.
    }

    if (updateFields.category_id !== undefined) {
      queryParts.push(`category_id = $${paramIndex++}`);
      queryParams.push(updateFields.category_id);
    }

    queryParts.push(`updated_at = $${paramIndex++}`); // Always update updated_at
    queryParams.push(now);

    const updateQuery = `
      UPDATE tasks
      SET ${queryParts.join(', ')}
      WHERE id = $1 AND user_id = $2
      RETURNING id, user_id, category_id, title, description, due_date_at, priority, is_completed, completed_at, order_index, created_at, updated_at;
    `;

    const result = await client.query(updateQuery, queryParams);

    if (result.rows.length === 0) {
      // If a transaction was started for order_index, it needs to be rolled back here
      try { await client.query('ROLLBACK'); } catch (e) { console.error("Error rolling back:", e); }
      return res.status(404).json(errorResponse('Task not found or does not belong to user.'));
    }

    // Commit if transaction was started (only for order_index updates)
    if (queryParts.includes(`order_index = $${paramIndex - 1}`)) { // Check if order_index was pushed
      await client.query('COMMIT');
    }

    res.status(200).json(taskSchema.parse({
      id: result.rows[0].id,
      user_id: result.rows[0].user_id,
      category_id: result.rows[0].category_id,
      title: result.rows[0].title,
      description: result.rows[0].description,
      due_date_at: fromUnixTimestamp(result.rows[0].due_date_at),
      priority: result.rows[0].priority,
      is_completed: result.rows[0].is_completed,
      completed_at: fromUnixTimestamp(result.rows[0].completed_at),
      order_index: result.rows[0].order_index,
      created_at: fromUnixTimestamp(result.rows[0].created_at),
      updated_at: fromUnixTimestamp(result.rows[0].updated_at),
    }));
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (e) { console.error("Error during PATCH rollback:", e); }
    if (error.name === 'ZodError') {
      return res.status(400).json(errorResponse('Validation Error', 'VALIDATION_FAILED', error.errors));
    }
    console.error('Error updating task:', error);
    res.status(500).json(errorResponse('Internal server error updating task.'));
  } finally {
    client.release();
  }
});


/**
 * DELETE /api/tasks/{task_id}
 * Deletes a task by ID. Manages order_index by collapsing gaps for active tasks.
 */
app.delete('/api/tasks/:task_id', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.user.id;
    const { task_id } = req.params;

    await client.query('BEGIN'); // Start transaction for order_index integrity

    const taskToDeleteResult = await client.query('SELECT order_index, is_completed FROM tasks WHERE id = $1 AND user_id = $2', [task_id, userId]);
    const taskToDelete = taskToDeleteResult.rows[0];

    if (!taskToDelete) {
      await client.query('ROLLBACK');
      return res.status(404).json(errorResponse('Task not found or does not belong to user.'));
    }

    const deleteResult = await client.query('DELETE FROM tasks WHERE id = $1 AND user_id = $2', [task_id, userId]);

    if (deleteResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(errorResponse('Task not found or does not belong to user.'));
    }

    // Only shift order_index for incomplete tasks if the deleted task was also incomplete
    if (taskToDelete.is_completed === false) {
      await client.query(
        'UPDATE tasks SET order_index = order_index - 1 WHERE user_id = $1 AND is_completed = FALSE AND order_index > $2;',
        [userId, taskToDelete.order_index]
      );
    }

    await client.query('COMMIT'); // Commit transaction

    res.status(204).send(); // No Content
  } catch (error) {
    await client.query('ROLLBACK'); // Rollback on error
    console.error('Error deleting task:', error);
    res.status(500).json(errorResponse('Internal server error deleting task.'));
  } finally {
    client.release();
  }
});


/**
 * GET /api/categories
 * Retrieves all categories for the authenticated user.
 */
app.get('/api/categories', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.user.id;
    const { query, limit = 10, offset = 0, sort_by = 'name', sort_order = 'asc' } = searchCategoriesInputSchema.parse(req.query);

    let whereClauses = [`user_id = $1`];
    const queryParams = [userId];
    let paramIndex = 2; // Start from $2 for WHERE conditions

    if (query) {
      whereClauses.push(`name ILIKE $${paramIndex++}`);
      queryParams.push(`%${query}%`);
    }

    const orderByClause = `ORDER BY ${sort_by} ${sort_order === 'desc' ? 'DESC' : 'ASC'}`;

    const categoryQuery = `
      SELECT id, user_id, name, created_at, updated_at
      FROM categories
      WHERE ${whereClauses.join(' AND ')}
      ${orderByClause}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++};
    `;
    queryParams.push(limit, offset);


    const result = await client.query(categoryQuery, queryParams);

    const categories = result.rows.map(row => categorySchema.parse({
      id: row.id,
      user_id: row.user_id,
      name: row.name,
      created_at: fromUnixTimestamp(row.created_at),
      updated_at: fromUnixTimestamp(row.updated_at),
    }));

    res.status(200).json(categories);
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json(errorResponse('Validation Error', 'VALIDATION_FAILED', error.errors));
    }
    console.error('Error fetching categories:', error);
    res.status(500).json(errorResponse('Internal server error fetching categories.'));
  } finally {
    client.release();
  }
});

/**
 * POST /api/categories
 * Creates a new category for the authenticated user.
 * Enforces uniqueness of category names per user.
 */
app.post('/api/categories', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.user.id;
    const { name } = createCategoryInputSchema.parse(req.body);
    const now = Date.now();

    const existingCategory = await client.query('SELECT id FROM categories WHERE user_id = $1 AND name = $2', [userId, name]);
    if (existingCategory.rows.length > 0) {
      return res.status(400).json(errorResponse('Category with this name already exists.', 'DUPLICATE_CATEGORY_NAME'));
    }

    const categoryId = generateId();
    const insertCategoryQuery = `
      INSERT INTO categories (id, user_id, name, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, user_id, name, created_at, updated_at;
    `;
    const result = await client.query(insertCategoryQuery, [categoryId, userId, name, now, now]);

    res.status(201).json(categorySchema.parse({
      id: result.rows[0].id,
      user_id: result.rows[0].user_id,
      name: result.rows[0].name,
      created_at: fromUnixTimestamp(result.rows[0].created_at),
      updated_at: fromUnixTimestamp(result.rows[0].updated_at),
    }));
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json(errorResponse('Validation Error', 'VALIDATION_FAILED', error.errors));
    }
    console.error('Error creating category:', error);
    res.status(500).json(errorResponse('Internal server error creating category.'));
  } finally {
    client.release();
  }
});

/**
 * PATCH /api/categories/{category_id}
 * Updates a category's name. Enforces uniqueness.
 */
app.patch('/api/categories/:category_id', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.user.id;
    const { category_id } = req.params;
    const { name } = updateCategoryInputSchema.parse(req.body);
    const now = Date.now();

    const currentCategoryResult = await client.query('SELECT 1 FROM categories WHERE id = $1 AND user_id = $2', [category_id, userId]);
    if (currentCategoryResult.rows.length === 0) {
      return res.status(404).json(errorResponse('Category not found or does not belong to user.'));
    }

    const existingCategoryWithNewName = await client.query('SELECT id FROM categories WHERE user_id = $1 AND name = $2 AND id != $3', [userId, name, category_id]);
    // The previous category with the same name if it's not the one being updated (for uniqueness constraint)
    if (existingCategoryWithNewName.rows.length > 0) {
      return res.status(400).json(errorResponse('Category with this name already exists for your account.', 'DUPLICATE_CATEGORY_NAME'));
    }

    const updateCategoryQuery = `
      UPDATE categories
      SET name = $1, updated_at = $2
      WHERE id = $3 AND user_id = $4
      RETURNING id, user_id, name, created_at, updated_at;
    `;
    const result = await client.query(updateCategoryQuery, [name, now, category_id, userId]);

    res.status(200).json(categorySchema.parse({
      id: result.rows[0].id,
      user_id: result.rows[0].user_id,
      name: result.rows[0].name,
      created_at: fromUnixTimestamp(result.rows[0].created_at),
      updated_at: fromUnixTimestamp(result.rows[0].updated_at),
    }));
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json(errorResponse('Validation Error', 'VALIDATION_FAILED', error.errors));
    }
    console.error('Error updating category:', error);
    res.status(500).json(errorResponse('Internal server error updating category.'));
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/categories/{category_id}
 * Deletes a category. Tasks previously in this category will have category_id set to NULL due to FK constraint.
 */
app.delete('/api/categories/:category_id', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.user.id;
    const { category_id } = req.params;

    const deleteResult = await client.query('DELETE FROM categories WHERE id = $1 AND user_id = $2', [category_id, userId]);

    if (deleteResult.rowCount === 0) {
      return res.status(404).json(errorResponse('Category not found or does not belong to user.'));
    }

    // Due to FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    // tasks linked to this category will automatically have their category_id set to NULL.
    // No explicit task update query is needed here.

    res.status(204).send(); // No Content
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json(errorResponse('Internal server error deleting category.'));
  } finally {
    client.release();
  }
});

/**
 * PUT /api/users/me/last-active-view
 * Updates the authenticated user's last active view preferences.
 * Stores a JSONB object in the users table.
 */
app.put('/api/users/me/last-active-view', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.user.id;
    // Validate the incoming JSON data using the Zod schema for last_active_view
    const lastActiveView = lastActiveViewInputSchema.parse(req.body);
    const now = Date.now();

    const updateViewQuery = `
      UPDATE users
      SET last_active_view = $1, updated_at = $2
      WHERE id = $3;
    `;
    const result = await client.query(updateViewQuery, [lastActiveView, now, userId]);

    if(result.rowCount === 0) {
      return res.status(404).json(errorResponse('User not found.'));
    }

    res.status(200).json({ message: 'View preferences updated successfully.' });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json(errorResponse('Validation Error', 'VALIDATION_FAILED', error.errors));
    }
    console.error('Error updating last active view:', error);
    res.status(500).json(errorResponse('Internal server error updating view preferences.'));
  } finally {
    client.release();
  }
});


// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Fallback for single-page application (SPA) routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Server Start ---
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Access at http://localhost:${PORT}`);
});