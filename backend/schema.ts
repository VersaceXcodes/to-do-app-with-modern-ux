import { z } from 'zod';

// --- User Schemas ---

export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  password_hash: z.string(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  last_login_at: z.coerce.date().nullable(),
  last_active_view: z.any().nullable(), // JSONB type
});

export const createUserInputSchema = z.object({
  email: z.string().email("Invalid email address").max(255),
  password: z.string().min(8, "Password must be at least 8 characters long").max(255), // Not password_hash
});

export const updateUserPartialInputSchema = z.object({
  email: z.string().email("Invalid email address").max(255).optional(),
  password: z.string().min(8, "Password must be at least 8 characters long").max(255).optional(), // Not password_hash
  last_login_at: z.coerce.date().nullable().optional(),
  last_active_view: z.any().nullable().optional(), // JSONB type
});

export const findUserQuerySchema = z.object({
  id: z.string().optional(),
  email: z.string().email().optional(),
});

export type User = z.infer<typeof userSchema>;
export type CreateUserInput = z.infer<typeof createUserInputSchema>;
export type UpdateUserPartialInput = z.infer<typeof updateUserPartialInputSchema>;
export type FindUserQuery = z.infer<typeof findUserQuerySchema>;


// --- Category Schemas ---

export const categorySchema = z.object({
  id: z.string(),
  user_id: z.string(),
  name: z.string(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export const createCategoryInputSchema = z.object({
  name: z.string().min(1, "Category name cannot be empty").max(255),
});

export const updateCategoryInputSchema = z.object({
  name: z.string().min(1, "Category name cannot be empty").max(255).optional(),
});

export const searchCategoriesInputSchema = z.object({
  query: z.string().optional(),
  user_id: z.string().optional(),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['name', 'created_at', 'updated_at']).default('name'),
  sort_order: z.enum(['asc', 'desc']).default('asc')
});

export type Category = z.infer<typeof categorySchema>;
export type CreateCategoryInput = z.infer<typeof createCategoryInputSchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategoryInputSchema>;
export type SearchCategoriesInput = z.infer<typeof searchCategoriesInputSchema>;

// --- Task Schemas ---

export const taskPriorityEnum = z.enum(["low", "medium", "high"]);

export const taskSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  category_id: z.string().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  due_date_at: z.coerce.date().nullable(),
  priority: taskPriorityEnum,
  is_completed: z.boolean(),
  completed_at: z.coerce.date().nullable(),
  order_index: z.number().int(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export const createTaskInputSchema = z.object({
  category_id: z.string().nullable().optional(),
  title: z.string().min(1, "Title cannot be empty").max(255),
  description: z.string().max(5000).nullable().optional(),
  due_date_at: z.coerce.date().nullable().optional(),
  priority: taskPriorityEnum.default("medium").optional(),
  order_index: z.number().int().nonnegative(),
});

export const updateTaskInputSchema = z.object({
  category_id: z.string().nullable().optional(),
  title: z.string().min(1, "Title cannot be empty").max(255).optional(),
  description: z.string().max(5000).nullable().optional(),
  due_date_at: z.coerce.date().nullable().optional(),
  priority: taskPriorityEnum.optional(),
  is_completed: z.boolean().optional(),
  completed_at: z.coerce.date().nullable().optional(),
  order_index: z.number().int().nonnegative().optional(),
});

export const searchTasksInputSchema = z.object({
  query: z.string().optional(),
  user_id: z.string().optional(),
  category_id: z.string().nullable().optional(),
  priority: taskPriorityEnum.optional(),
  is_completed: z.boolean().optional(),
  due_date_before: z.coerce.date().optional(),
  due_date_after: z.coerce.date().optional(),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['title', 'due_date_at', 'priority', 'created_at', 'updated_at', 'order_index']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

export type Task = z.infer<typeof taskSchema>;
export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskInputSchema>;
export type SearchTasksInput = z.infer<typeof searchTasksInputSchema>;
export type TaskPriority = z.infer<typeof taskPriorityEnum>;