import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import axios, { AxiosInstance, AxiosError } from 'axios';

// --- Type Definitions (from Analysis) ---
export type Priority = 'low' | 'medium' | 'high';

export interface User {
  id: string;
  email: string;
  created_at: number; // Unix timestamp
  updated_at: number; // Unix timestamp
  last_login_at: number | null; // Unix timestamp
  last_active_view: {
    filter_type?: 'category' | 'date' | 'other' | null;
    filter_value?: string | null;
    show_completed?: boolean | null;
    sort_order?: 'asc' | 'desc' | null;
  } | null;
}

export interface Task {
  id: string;
  user_id: string;
  category_id: string | null;
  title: string;
  description: string | null;
  due_date_at: number | null; // Unix timestamp
  priority: Priority;
  is_completed: boolean;
  completed_at: number | null; // Unix timestamp
  order_index: number;
  created_at: number; // Unix timestamp
  updated_at: number; // Unix timestamp
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  created_at: number; // Unix timestamp
  updated_at: number; // Unix timestamp
}

export interface Notification {
  message: string;
  type: 'success' | 'error' | 'info';
  id: string; // Unique ID for notification management
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  password: string;
}

export interface RequestPasswordResetInput {
  email: string;
}

export interface ResetPasswordInput {
  token: string;
  new_password: string;
  confirm_new_password: string;
}

export interface LastActiveViewInput {
  filter_type?: 'category' | 'date' | 'other' | null;
  filter_value?: string | null;
  show_completed?: boolean | null;
  sort_order?: 'asc' | 'desc' | null;
}

// --- API Response Schemas ---
interface UserAuthResponse {
  user: User;
  token: string;
}

interface MessageResponse {
  message: string;
}

interface ErrorResponse {
  message: string;
  code?: string;
  details?: Record<string, string>;
}

// --- Store State Interface ---
export interface AppState {
  // Auth State
  auth_token: string | null;
  current_user: User | null;
  is_authenticating: boolean;

  // Notification State
  current_notification: Notification | null;

  // Data Cache States
  tasks_by_id: Record<string, Task>;
  categories_by_id: Record<string, Category>;
  is_fetching_tasks: boolean;
  is_fetching_categories: boolean;

  // Actions
  // Auth Actions
  set_auth_token: (token: string | null) => void;
  set_current_user: (user: User | null) => void;
  set_is_authenticating: (status: boolean) => void;

  login_user: (input: LoginInput) => Promise<void>;
  register_user: (input: RegisterInput) => Promise<void>;
  logout_user: () => Promise<void>;
  request_password_reset: (input: RequestPasswordResetInput) => Promise<void>;
  reset_password: (input: ResetPasswordInput) => Promise<void>;
  update_last_active_view: (view_preferences: LastActiveViewInput) => Promise<void>;

  // Notification Actions
  show_notification: (message: string, type: 'success' | 'error' | 'info') => void;
  dismiss_notification: () => void;

  // Data Cache Actions
  set_tasks: (tasks: Task[]) => void;
  add_or_update_task: (task: Task) => void;
  remove_task: (task_id: string) => void;
  set_is_fetching_tasks: (status: boolean) => void;

  set_categories: (categories: Category[]) => void;
  add_or_update_category: (category: Category) => void;
  remove_category: (category_id: string) => void;
  set_is_fetching_categories: (status: boolean) => void;
}

// --- Axios Instance Setup ---
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Axios Interceptor for Authorization
api.interceptors.request.use(
  (config) => {
    const token = useAppStore.getState().auth_token; // Access state directly
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Axios Interceptor for Global Error Handling (e.g., 401 Unauthorized)
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const store = useAppStore.getState();
    if (error.response) {
      const error_data: ErrorResponse = error.response.data as ErrorResponse;
      if (error.response.status === 401 && store.auth_token) {
        // If 401 and user was supposedly authenticated, clear auth and notify
        store.set_auth_token(null);
        store.set_current_user(null);
        store.show_notification(error_data.message || 'Session expired. Please log in again.', 'error');
        // Optionally redirect to login page here, but typically handled by router guards in consumer app.
      } else {
        // Show other API errors
        const message = error_data.message || error.message || 'An unexpected error occurred.';
        store.show_notification(message, 'error');
      }
    } else if (error.request) {
      // The request was made but no response was received (e.g., network error)
      store.show_notification('Network error. Please check your internet connection and try again.', 'error');
    } else {
      // Something happened in setting up the request that triggered an Error
      store.show_notification('An unexpected error occurred.', 'error');
    }
    return Promise.reject(error);
  }
);

// --- Zustand Store Definition ---
export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // --- Initial State ---
      auth_token: null,
      current_user: null,
      is_authenticating: false,
      current_notification: null,
      tasks_by_id: {},
      categories_by_id: {},
      is_fetching_tasks: false,
      is_fetching_categories: false,

      // --- Auth Actions ---
      set_auth_token: (token) => set({ auth_token: token }),
      set_current_user: (user) => set({ current_user: user }),
      set_is_authenticating: (status) => set({ is_authenticating: status }),

      login_user: async (input) => {
        set({ is_authenticating: true });
        try {
          const response = await api.post<UserAuthResponse>('/api/login', input);
          set({
            auth_token: response.data.token,
            current_user: response.data.user,
          });
          get().show_notification('Welcome back!', 'success');
        } catch (error) {
          // Error handled by interceptor, no need to show_notification here
          throw error; // Re-throw to allow component specific error handling if needed
        } finally {
          set({ is_authenticating: false });
        }
      },

      register_user: async (input) => {
        set({ is_authenticating: true });
        try {
          const response = await api.post<UserAuthResponse>('/api/register', input);
          set({
            auth_token: response.data.token,
            current_user: response.data.user,
          });
          get().show_notification('Account created successfully!', 'success');
        } catch (error) {
          // Error handled by interceptor
          throw error;
        } finally {
          set({ is_authenticating: false });
        }
      },

      logout_user: async () => {
        try {
          // Attempt to notify backend, don't rely on it for local state clearance
          await api.post<MessageResponse>('/api/logout');
          get().show_notification('Logged out successfully.', 'success');
        } catch (error) {
          // Error handled by interceptor, or if network error, still clear local state
          get().show_notification('Failed to log out cleanly, but local session cleared.', 'error');
        } finally {
          set({ auth_token: null, current_user: null, tasks_by_id: {}, categories_by_id: {} });
        }
      },

      request_password_reset: async (input) => {
        set({ is_authenticating: true });
        try {
          await api.post<MessageResponse>('/api/forgot-password', input);
          get().show_notification('If an account with that email exists, a password reset link has been sent.', 'info');
        } catch (error) {
          // Error handled by interceptor
          throw error;
        } finally {
          set({ is_authenticating: false });
        }
      },

      reset_password: async (input) => {
        set({ is_authenticating: true });
        try {
          await api.post<MessageResponse>('/api/reset-password', input);
          get().show_notification('Password reset successfully. Please log in.', 'success');
        } catch (error) {
          // Error handled by interceptor
          throw error;
        } finally {
          set({ is_authenticating: false });
        }
      },

      update_last_active_view: async (view_preferences) => {
        const current_user = get().current_user;
        if (!current_user) {
          // No user logged in, cannot update last active view
          return;
        }
        try {
          await api.put<MessageResponse>('/api/users/me/last-active-view', view_preferences);
          // Optimistically update current_user in store only if the remote update succeeds
          set((state) => ({
            current_user: state.current_user
              ? { ...state.current_user, last_active_view: view_preferences }
              : null,
          }));
        } catch (error) {
          // Error handled by interceptor. No specific toast needed for this common background update.
          console.error("Failed to update last active view:", error);
        }
      },

      // --- Notification Actions ---
      show_notification: (message, type) => {
        const id = Date.now().toString(); // Simple unique ID
        set({ current_notification: { message, type, id } });
        // Auto-dismiss after 5 seconds
        setTimeout(() => {
          if (get().current_notification?.id === id) {
            get().dismiss_notification();
          }
        }, 5000);
      },

      dismiss_notification: () => {
        set({ current_notification: null });
      },

      // --- Data Cache Actions (for tasks) ---
      set_tasks: (tasks) => {
        const new_tasks_by_id = tasks.reduce((acc, task) => {
          acc[task.id] = task;
          return acc;
        }, {} as Record<string, Task>);
        set({ tasks_by_id: new_tasks_by_id });
      },
      add_or_update_task: (task) => {
        set((state) => ({
          tasks_by_id: {
            ...state.tasks_by_id,
            [task.id]: task,
          },
        }));
      },
      remove_task: (task_id) => {
        set((state) => {
          const new_tasks = { ...state.tasks_by_id };
          delete new_tasks[task_id];
          return { tasks_by_id: new_tasks };
        });
      },
      set_is_fetching_tasks: (status) => set({ is_fetching_tasks: status }),

      // --- Data Cache Actions (for categories) ---
      set_categories: (categories) => {
        const new_categories_by_id = categories.reduce((acc, category) => {
          acc[category.id] = category;
          return acc;
        }, {} as Record<string, Category>);
        set({ categories_by_id: new_categories_by_id });
      },
      add_or_update_category: (category) => {
        set((state) => ({
          categories_by_id: {
            ...state.categories_by_id,
            [category.id]: category,
          },
        }));
      },
      remove_category: (category_id) => {
        set((state) => {
          const new_categories = { ...state.categories_by_id };
          delete new_categories[category_id];
          return { categories_by_id: new_categories };
        });
      },
      set_is_fetching_categories: (status) => set({ is_fetching_categories: status }),
    }),
    {
      name: 'nexgen-taskpad-storage', // unique name
      storage: createJSONStorage(() => localStorage), // Here we specify localStorage

      // only these parts of the state will be persisted
      partialize: (state) => ({
        auth_token: state.auth_token,
        current_user: state.current_user,
        // tasks_by_id and categories_by_id are typically re-fetched on app load
        // so they don't need to be persisted unless for offline use cases not in MVP
        // But the PRD states 'Super important: Use localStorage for persistence to avoid data loss on refresh.'
        // This implies raw data states like tasks and categories.
        // However, a typical pattern is to fetch on load. For this direct instruction, we persist current cache.
        tasks_by_id: state.tasks_by_id,
        categories_by_id: state.categories_by_id,
      }),

      // Optional: migrate function for versioning, if schema changes in future
      // version: 1,
      // migrate: (persistedState, version) => { /* ... migration logic ... */ return nextState; },
    }
  )
);