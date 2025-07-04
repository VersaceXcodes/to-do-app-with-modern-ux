import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLocation, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { IoAddOutline, IoCheckmarkCircle, IoCheckmarkCircleOutline, IoTrash, IoPencil, IoTimeOutline, IoCalendarOutline } from 'react-icons/io5';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { format, isToday, isTomorrow, isPast, isThisWeek, parseISO } from 'date-fns';


import { useAppStore } from '@/store/main';
import type { Task, Category, CreateTaskInput, UpdateTaskInput, SearchTasksInput, LastActiveViewInput, MessageResponse } from '@schema';

// Component Imports (assuming they are implemented elsewhere, as per instructions)
// In a real scenario, these would typically be in a `components` directory.
// For this task, we focus only on UV_TaskDashboard itself.
// UV_TaskEditModal is implicitly defined as opening here.
// GV_ConfirmationModal is handled via showConfirmation prop.

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

interface UV_TaskDashboardProps {
  showConfirmation: (message: string, onConfirm: () => void, onCancel?: () => void) => void;
}

const UV_TaskDashboard: React.FC<UV_TaskDashboardProps> = ({ showConfirmation }) => {
  const navigate = useNavigate();
  const searchParams = useSearchParams();
  const location = useLocation();
  const queryClient = useQueryClient();

  // Global State Access
  const {
    auth_token,
    tasks_by_id,
    categories_by_id, // For displaying category names
    set_tasks, // To update the global tasks_by_id cache
    add_or_update_task,
    remove_task,
    show_notification, // For toast notifications
    update_last_active_view, // To persist user preferences
  } = useAppStore();

  // Local State Variables (as per datamap)
  const [quick_add_title_input, setQuickAddTitleInput] = useState<string>('');
  const [is_quick_add_input_focused, setIsQuickAddInputFocused] = useState<boolean>(false);
  const [is_edit_modal_open, setIsEditModalOpen] = useState<boolean>(false); // Controls UV_TaskEditModal visibility
  const [editing_task_id, setEditingTaskId] = useState<string | null>(null); // Task ID for UV_TaskEditModal
  const [editing_inline_task_id, setEditingInlineTaskId] = useState<string | null>(null); // Task ID for inline edit
  const [inline_edit_value, setInlineEditValue] = useState<string>(''); // Value for inline edit input
  const [has_unsaved_changes_inline, setHasUnsavedChangesInline] = useState<boolean>(false);
  
  // Ref for the inline edit input field
  const inlineEditInputRef = useRef<HTMLInputElement>(null);

  // Parse URL query parameters to construct API request
  const currentQueryParams = useMemo(() => {
    const params: Partial<SearchTasksInput> = {};
    const category_id = searchParams.get('category_id');
    const priority = searchParams.get('priority');
    const is_completed_str = searchParams.get('is_completed');
    const due_date_type = searchParams.get('due_date_type');
    const query = searchParams.get('query');
    const sort_by = searchParams.get('sort_by');
    const sort_order = searchParams.get('sort_order');

    if (category_id) params.category_id = category_id;
    if (priority) params.priority = priority as 'low' | 'medium' | 'high';
    if (is_completed_str !== null) params.is_completed = is_completed_str === 'true';
    if (query) params.query = query;
    if (sort_by) params.sort_by = sort_by as SearchTasksInput['sort_by'];
    if (sort_order) params.sort_order = sort_order as 'asc' | 'desc';

    // Translate due_date_type to due_date_before/after
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Start of today

    if (due_date_type === 'today') {
      params.due_date_after = now.getTime();
      const endOfToday = new Date(now);
      endOfToday.setDate(now.getDate() + 1);
      endOfToday.setMilliseconds(endOfToday.getMilliseconds() - 1);
      params.due_date_before = endOfToday.getTime();
      if (params.is_completed === undefined) params.is_completed = false; // By default, 'today' filter implies incomplete tasks
    } else if (due_date_type === 'tomorrow') {
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      params.due_date_after = tomorrow.getTime();
      const endOfTomorrow = new Date(tomorrow);
      endOfTomorrow.setDate(tomorrow.getDate() + 1);
      endOfTomorrow.setMilliseconds(endOfTomorrow.getMilliseconds() - 1);
      params.due_date_before = endOfTomorrow.getTime();
      if (params.is_completed === undefined) params.is_completed = false;
    } else if (due_date_type === 'this_week') {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday as start of week
      params.due_date_after = startOfWeek.getTime();
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 7);
      endOfWeek.setMilliseconds(endOfWeek.getMilliseconds() - 1);
      params.due_date_before = endOfWeek.getTime();
       if (params.is_completed === undefined) params.is_completed = false;
    } else if (due_date_type === 'overdue') {
      params.due_date_before = now.getTime(); // Due before today
      if (params.is_completed === undefined) params.is_completed = false;
    }

    // Default sorting for initial view for "All Tasks" or when specific filter is not applied
    if (!params.sort_by) {
        if (params.is_completed === true) { // Completed tasks usually sorted by completion date or updated_at
           params.sort_by = 'completed_at';
           params.sort_order = 'desc';
        } else {
             // For active tasks, sorting by due date then priority then order_index
             // This logic needs client-side sorting as API supports only one sort_by
             params.sort_by = 'order_index'; // The API default
             params.sort_order = 'asc';
        }
    }


    return params;
  }, [searchParams]);

  // Query to fetch tasks
  const fetchTasks = async (): Promise<Task[]> => {
    const { data } = await axios.get<Task[]>(`${API_BASE_URL}/api/tasks`, {
      headers: { Authorization: `Bearer ${auth_token}` },
      params: currentQueryParams,
    });
    set_tasks(data); // Update Zustand store with fetched tasks
    return data;
  };

  const { data: fetched_tasks = [], isLoading: is_tasks_loading, error: tasks_fetch_error } = useQuery<Task[], Error>({
    queryKey: ['tasks', currentQueryParams], // Key changes when filters change
    queryFn: fetchTasks,
    enabled: !!auth_token, // Only fetch if authenticated
    placeholderData: (previousData) => previousData, // Keep previous data while fetching new
    staleTime: 5 * 60 * 1000, // Data considered fresh for 5 minutes
  });


    // Reactive filtering and sorting based on client-side logic
    // This is necessary because the backend API only supports one sort_by parameter,
    // but the FRD specifies a multi-level sort (Due Date, Priority, Creation Date/Order Index).
    const display_tasks = useMemo(() => {
        // Start with tasks from global state, not just newly fetched ones, for consistency
        let filtered_and_sorted_tasks = Object.values(tasks_by_id);

        // Apply filters directly from URL params if fetchTasks hasn't already filtered via API completely
        // The currentQueryParams are directly used in fetchTasks, so tasks_by_id should already be somewhat filtered.
        // However, if the API doesn't fully support all filter combinations, or for responsive UI sorting,
        // we might need additional client-side filtering here.
        // For now, assuming fetchTasks does the main filtering and sorting by `order_index`.


        // Secondary client-side sorting given API limitation (for order_index + due_date + priority)
        // This logic comes from FR.TASK.VIEW.30: "ordered by Due Date (soonest first), then by Priority (High to Low), then by creation date."
        // This is a complex sort and usually would be handled backend. If `order_index` from backend is primary, we respect it.
        // If sorting only by due_date_at/priority is chosen, a backend API call should specify that.
        // Given currentQueryParams includes `sort_by`, if `sort_by === 'order_index'`, it means primary sorting is by dnd.
        // If another sort_by is passed by SideBar, we use that.

        // Fallback for multi-level sort if `sort_by` is not explicitly `order_index` from URL
        filtered_and_sorted_tasks.sort((a, b) => {
            // 1. Overdue tasks first, oldest first
            const now = Date.now();
            const a_overdue = a.due_date_at && !a.is_completed && a.due_date_at < now;
            const b_overdue = b.due_date_at && !b.is_completed && b.due_date_at < now;

            if (a_overdue && !b_overdue) return -1;
            if (!a_overdue && b_overdue) return 1;
            if (a_overdue && b_overdue) {
                // Both overdue, sort by due_date_at ascending (oldest first)
                return (a.due_date_at || 0) - (b.due_date_at || 0);
            }

            // 2. Then by Due Date (soonest first) for non-overdue and incomplete tasks
            const a_has_due = a.due_date_at !== null;
            const b_has_due = b.due_date_at !== null;

            if (a_has_due && !b_has_due) return -1; // tasks with due date before tasks without
            if (!a_has_due && b_has_due) return 1;
            if (a_has_due && b_has_due) {
                const date_a = a.due_date_at || Infinity; // Handle nulls for sorting
                const date_b = b.due_date_at || Infinity;
                if (date_a !== date_b) return date_a - date_b;
            }

            // 3. Then by Priority (High to Low)
            const priorityOrder: Record<Priority, number> = { high: 3, medium: 2, low: 1 };
            const pA = priorityOrder[a.priority];
            const pB = priorityOrder[b.priority];
            if (pA !== pB) return pB - pA; // Descending priority

            // 4. Then by order_index (for manual ordering)
             if (a.order_index !== b.order_index) return a.order_index - b.order_index;

            // 5. Finally by created_at (newest first for same due date, priority, order_index)
            return (b.created_at || 0) - (a.created_at || 0); // Newest first
        });

        return filtered_and_sorted_tasks;
    }, [tasks_by_id, currentQueryParams]); // React when raw tasks or query params change


  // Mutation for creating a task (quick add)
  const createTaskMutation = useMutation<Task, Error, CreateTaskInput>({
    mutationFn: async (newTask) => {
      const { data } = await axios.post<Task>(`${API_BASE_URL}/api/tasks`, newTask, {
        headers: { Authorization: `Bearer ${auth_token}` },
      });
      return data;
    },
    onSuccess: (newTask) => {
      // Optimistically add the new task. Re-fetch will ensure correct order_index.
      add_or_update_task(newTask);
      show_notification('Task added successfully!', 'success');
      setQuickAddTitleInput(''); // Clear input
      queryClient.invalidateQueries({ queryKey: ['tasks'] }); // Re-fetch all tasks to get definitive order
    },
    onError: (error) => {
      show_notification(`Failed to add task: ${error.message}`, 'error');
    },
  });

  // Mutation for updating a task (toggle completion, inline edit, drag-drop)
  const updateTaskMutation = useMutation<Task, Error, { id: string; updates: Partial<UpdateTaskInput> }>({
    mutationFn: async ({ id, updates }) => {
      const { data } = await axios.patch<Task>(`${API_BASE_URL}/api/tasks/${id}`, updates, {
        headers: { Authorization: `Bearer ${auth_token}` },
      });
      return data;
    },
    onMutate: async ({ id, updates }) => {
      // Cancel any outgoing refetches for tasks
      await queryClient.cancelQueries({ queryKey: ['tasks'] });

      // Snapshot the previous tasks_by_id value to revert in case of error
      const previousTasksById = useAppStore.getState().tasks_by_id;

      // Optimistically update the task in Zustand
      useAppStore.getState().add_or_update_task({
        ...(previousTasksById[id] || {}), // Fallback if task not in cache (shouldn't happen often)
        ...updates,
        id, // Ensure ID is present
        // Handle completed_at timestamp
        completed_at: updates.is_completed ? Date.now() : null,
      } as Task); // Cast as Task, ensuring all required properties (even if partial update)

      // Return a context object with the snapshot
      return { previousTasksById };
    },
    onSuccess: (updatedTask) => {
      add_or_update_task(updatedTask); // Ensure Zustand is in sync with server response
      show_notification('Task updated successfully!', 'success');
      queryClient.invalidateQueries({ queryKey: ['tasks'] }); // Re-fetch to apply any backend order_index changes
    },
    onError: (error, { id }, context) => {
      show_notification(`Failed to update task: ${error.message}`, 'error');
      // Revert to the old state in case of error
      if (context?.previousTasksById) {
        set_tasks(Object.values(context.previousTasksById));
      }
      setHasUnsavedChangesInline(true); // If inline edit, keep changes so user can fix
      if (editing_inline_task_id === id) { // Focus the same element if it was an error during inline editing
          // Ensure the ref exists and direct focus can be applied
          setTimeout(() => {
            inlineEditInputRef.current?.focus();
            inlineEditInputRef.current?.select(); // Select text for easy re-editing
          }, 0);
      }
    },
    onSettled: () => {
      // This will ensure tasks are refetched after the mutation, regardless of success or failure.
      // queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  // Mutation for deleting a task
  const deleteTaskMutation = useMutation<void, Error, string>({
    mutationFn: async (task_id) => {
      await axios.delete(`${API_BASE_URL}/api/tasks/${task_id}`, {
        headers: { Authorization: `Bearer ${auth_token}` },
      });
    },
    onMutate: async (task_id) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      const previousTasksById = useAppStore.getState().tasks_by_id;
      remove_task(task_id); // Optimistic update
      return { previousTasksById }; // Snapshot for rollback
    },
    onSuccess: () => {
      show_notification('Task deleted successfully!', 'success');
      queryClient.invalidateQueries({ queryKey: ['tasks'] }); // Re-fetch to clean up order_index if backend handles it
    },
    onError: (error, task_id, context) => {
      show_notification(`Failed to delete task: ${error.message}`, 'error');
      if (context?.previousTasksById) {
        set_tasks(Object.values(context.previousTasksById)); // Rollback
      }
    },
    onSettled: () => {
      // queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  // Action: handle_quick_add_input_change
  const handle_quick_add_input_change = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuickAddTitleInput(e.target.value);
  };

  // Action: handle_quick_add_focus
  const handle_quick_add_focus = useCallback(() => {
    setIsQuickAddInputFocused(true);
  }, []);

  // Action: handle_quick_add_blur
  const handle_quick_add_blur = useCallback(() => {
    setIsQuickAddInputFocused(false);
  }, []);

  // Action: handle_quick_add_submit
  const handle_quick_add_submit = async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!quick_add_title_input.trim()) return;

    // Get the maximum order_index for the current display tasks.
    // This provides a reasonable starting point for the new task's order.
    const maxOrderIndex = display_tasks.reduce((max, task) => Math.max(max, task.order_index), -1);

    await createTaskMutation.mutateAsync({
      title: quick_add_title_input.trim(),
      order_index: maxOrderIndex + 1, // Place it at the end
    });
  };

  // Action: handle_task_item_click (opens UV_TaskEditModal)
  const handle_task_item_click = (task_id: string | null) => {
    setEditingTaskId(task_id);
    setIsEditModalOpen(true);
  };

  // Action: handle_task_completion_toggle
  const handle_task_completion_toggle = (task_id: string, is_completed: boolean) => {
    updateTaskMutation.mutate({
      id: task_id,
      updates: { is_completed, completed_at: is_completed ? Date.now() : null },
    });
  };

  // Action: handle_inline_task_title_edit_start
  const handle_inline_task_title_edit_start = (task: Task) => {
    setEditingInlineTaskId(task.id);
    setInlineEditValue(task.title);
    setHasUnsavedChangesInline(false); // Reset on start
    // Focus the input field after it renders
    setTimeout(() => {
      inlineEditInputRef.current?.focus();
      inlineEditInputRef.current?.select();
    }, 0);
  };

  // Action: handle_inline_task_title_edit_save
  const handle_inline_task_title_edit_save = async () => {
    if (!editing_inline_task_id) return;

    const trimmedValue = inline_edit_value.trim();
    const originalTask = tasks_by_id[editing_inline_task_id];

    if (!trimmedValue) {
      show_notification('Task title cannot be empty.', 'error');
      setInlineEditValue(originalTask?.title || ''); // Revert to original or empty
      setEditingInlineTaskId(null); // Exit edit mode
      setHasUnsavedChangesInline(false);
      return;
    }

    if (trimmedValue === originalTask?.title) {
        // No actual change, just exit edit mode
        setEditingInlineTaskId(null);
        setHasUnsavedChangesInline(false);
        return;
    }

    try {
      await updateTaskMutation.mutateAsync({
        id: editing_inline_task_id,
        updates: { title: trimmedValue },
      });
      setEditingInlineTaskId(null);
      setHasUnsavedChangesInline(false);
    } catch (e) {
      // Error handled by mutation's onError callback
      // keeps `has_unsaved_changes_inline` true
    }
  };

  // Action: handle_inline_task_title_edit_cancel
  const handle_inline_task_title_edit_cancel = () => {
    setEditingInlineTaskId(null);
    setInlineEditValue('');
    setHasUnsavedChangesInline(false);
  };

  // Action: handle_task_delete (triggers confirmation modal)
  const handle_task_delete = (task_id: string, task_title: string) => {
    showConfirmation(
      `Are you sure you want to delete "${task_title}"? This cannot be undone.`,
      () => confirm_and_delete_task(task_id)
    );
  };

  // Action: confirm_and_delete_task (called after confirmation)
  const confirm_and_delete_task = async (task_id: string) => {
    await deleteTaskMutation.mutateAsync(task_id);
  };

  // Action: handle_drag_end
  const handle_drag_end = async (result: DropResult) => {
    if (!result.destination) return; // Dropped outside a droppable area

    const { source, destination, draggableId } = result;

    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return; // No change in position
    }

    // Get the actual task item that was dragged
    const draggedTask = display_tasks.find(task => task.id === draggableId);
    if (!draggedTask) return;

    // Create a mutable copy of the current displayed list for reordering
    const newDisplayTasks = Array.from(display_tasks);
    const [removed] = newDisplayTasks.splice(source.index, 1);
    newDisplayTasks.splice(destination.index, 0, removed);

    // Recompute order_index for affected tasks in the local list
    const updatedTasksForBackend: { id: string; updates: Partial<UpdateTaskInput> }[] = [];
    newDisplayTasks.forEach((task, index) => {
        if (task.order_index !== index) { // Only update if order_index changed
            updatedTasksForBackend.push({
                id: task.id,
                updates: { order_index: index }
            });
             // Optimistically update Zustand cache immediately
             add_or_update_task({ ...task, order_index: index });
        }
    });

    // Send updates to the backend
    // For simplicity, we'll send a patch for each task whose order_index changed.
    // In a real production app, consider a batch update endpoint if many tasks move.
    for (const { id, updates } of updatedTasksForBackend) {
        try {
           await updateTaskMutation.mutateAsync({ id, updates });
        } catch (error) {
            console.error(`Failed to update order for task ${id}:`, error);
            // Error handling for individual patch already happens in updateTaskMutation
            // but we might want more granular feedback here if one fails.
        }
    }
    // After all updates, invalidate to ensure data consistency with backend's final state.
     queryClient.invalidateQueries({ queryKey: ['tasks'] });
  };

  // Action: handle_edit_modal_close
  const handle_edit_modal_close = () => {
    setIsEditModalOpen(false);
    setEditingTaskId(null);
  };

  // Action: save_current_view_preference
  const save_current_view_preference = useCallback(() => {
    const filters: LastActiveViewInput = {};
    const category_id = searchParams.get('category_id');
    const due_date_type = searchParams.get('due_date_type');
    const is_completed = searchParams.get('is_completed');
    const sort_order = searchParams.get('sort_order');

    if (category_id) {
      filters.filter_type = 'category';
      filters.filter_value = category_id;
    } else if (due_date_type) {
      filters.filter_type = 'date';
      filters.filter_value = due_date_type;
    } else {
        filters.filter_type = null; // Clear if no specific filters
        filters.filter_value = null;
    }

    if (is_completed !== null) filters.show_completed = is_completed === 'true';
    else filters.show_completed = null; // Default to null if not explicitly set

    if (sort_order) filters.sort_order = sort_order as 'asc' | 'desc';
    else filters.sort_order = null;


    update_last_active_view(filters);
  }, [searchParams, update_last_active_view]);

    // Effect to save view preferences on component unmount
    useEffect(() => {
      // Set tasks_by_id state in Zustand based on fetched_tasks (only when fetched_tasks updates, not for every re-render)
      // This is crucial for display_tasks computed memo, ensuring it reflects the correct cache.
      if (fetched_tasks.length > 0 || Object.keys(tasks_by_id).length > 0) {
        set_tasks(fetched_tasks);
      }

      return () => {
        save_current_view_preference();
      };
    }, [fetched_tasks, save_current_view_preference, set_tasks, tasks_by_id]);


  // Effect for focusing inline edit input
  useEffect(() => {
    if (editing_inline_task_id && inlineEditInputRef.current) {
      inlineEditInputRef.current.focus();
      inlineEditInputRef.current.select();
    }
  }, [editing_inline_task_id]);

  // Helper to format due date display
  const getFormattedDueDate = (timestamp: number | null): React.ReactNode => {
    if (timestamp === null) return null;

    const date = new Date(timestamp);
    let className = 'text-gray-500 text-sm';
    let text = format(date, 'MMM do');

    if (isToday(date)) {
      text = 'Today';
      className += ' text-indigo-600 font-semibold';
    } else if (isTomorrow(date)) {
      text = 'Tomorrow';
      className += ' text-cyan-600 font-medium';
    } else if (isPast(date) && !isToday(date)) {
      text = `Overdue (${format(date, 'MMM do')})`;
      className += ' text-red-600 font-semibold';
    }

    return <span className={className}>{text}</span>;
  };

  // Helper to get priority display (e.g., color dot)
  const getPriorityColor = (priority: Task['priority']): string => {
    switch (priority) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-400';
    }
  };


  return (
    <>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-6 sticky top-0 bg-white z-10 py-2">Your Tasks</h1>

        {/* Quick Add Task Bar */}
        <form onSubmit={handle_quick_add_submit} className="mb-8 relative">
          <input
            type="text"
            className={`w-full p-4 pl-12 border rounded-full shadow-md focus:outline-none transition-all duration-300
              ${is_quick_add_input_focused ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-gray-200'}
            `}
            placeholder="Add a new task..."
            value={quick_add_title_input}
            onChange={handle_quick_add_input_change}
            onFocus={handle_quick_add_focus}
            onBlur={handle_quick_add_blur}
            aria-label="Add a new task"
          />
          <IoAddOutline
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            size={24}
          />
          <button
            type="submit"
            className="absolute right-4 top-1/2 -translate-y-1/2 px-4 py-2 rounded-full bg-indigo-600 text-white
                       hover:bg-indigo-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                       disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!quick_add_title_input.trim() || createTaskMutation.isPending}
            aria-label="Submit new task"
          >
            {createTaskMutation.isPending ? 'Adding...' : 'Add'}
          </button>
        </form>

        {is_tasks_loading && (
          <div className="text-center py-8">
            <p className="text-xl text-gray-600">Loading tasks...</p>
            {/* Add a simple spinner here */}
             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mt-4"></div>
          </div>
        )}

        {tasks_fetch_error && (
          <div className="text-center py-8 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
            <p className="font-bold">Error loading tasks!</p>
            <p className="text-sm">{tasks_fetch_error.message}</p>
          </div>
        )}

        {!is_tasks_loading && !tasks_fetch_error && display_tasks.length === 0 && (
          <div className="text-center py-16 px-4 bg-gray-50 rounded-lg shadow-inner">
            <img src="https://picsum.photos/seed/empty-tasks/300/200" alt="No tasks illustration" className="mx-auto mb-6 rounded-lg shadow-sm" />
            <p className="text-2xl font-semibold text-gray-700 mb-2">You have no tasks yet!</p>
            <p className="text-gray-500">Time to clear your mind and conquer your day. Add your first task above!</p>
          </div>
        )}

        {!is_tasks_loading && display_tasks.length > 0 && (
          <DragDropContext onDragEnd={handle_drag_end}>
            <Droppable droppableId="task-list">
              {(provided) => (
                <ul
                  className="space-y-4"
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                >
                  {display_tasks.map((task, index) => (
                    <Draggable key={task.id} draggableId={task.id} index={index}>
                      {(provided, snapshot) => (
                        <li
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={`
                            group flex items-center p-4 border rounded-lg shadow-sm bg-white transition-all duration-200
                            ${task.is_completed ? 'opacity-60 bg-gray-100 line-through' : 'hover:shadow-md'}
                            ${snapshot.isDragging ? 'shadow-lg border-indigo-400 bg-indigo-50 !opacity-100 transform scale-[1.02]' : ''}
                          `}
                          aria-label={`Task: ${task.title}`}
                          tabIndex={0}
                          role="listitem"
                        >
                            {/* Checkbox */}
                              <button
                                type="button"
                                onClick={() => handle_task_completion_toggle(task.id, !task.is_completed)}
                                className="flex-shrink-0 mr-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-full"
                                aria-label={task.is_completed ? `Mark "${task.title}" as incomplete` : `Mark "${task.title}" as complete`}
                              >
                                {task.is_completed ? (
                                  <IoCheckmarkCircle className="text-green-500" size={28} />
                                ) : (
                                  <IoCheckmarkCircleOutline className="text-gray-400 hover:text-green-500 transition-colors" size={28} />
                                )}
                              </button>

                            {/* Task Content */}
                            <div className="flex-1 min-w-0">
                                {editing_inline_task_id === task.id ? (
                                    <input
                                        ref={inlineEditInputRef}
                                        type="text"
                                        value={inline_edit_value}
                                        onChange={(e) => setInlineEditValue(e.target.value)}
                                        onBlur={handle_inline_task_title_edit_save}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handle_inline_task_title_edit_save();
                                            if (e.key === 'Escape') handle_inline_task_title_edit_cancel();
                                        }}
                                        className="text-lg font-medium text-gray-900 w-full p-1 -ml-1 border-b-2 border-indigo-500 outline-none bg-transparent"
                                        aria-label={`Edit task title: ${task.title}`}
                                    />
                                ) : (
                                    <span
                                        className={`text-lg font-medium select-none cursor-text
                                            ${task.is_completed ? 'text-gray-500' : 'text-gray-900'}
                                        `}
                                        onClick={() => handle_inline_task_title_edit_start(task)}
                                        tabIndex={0}
                                        role="textbox"
                                        aria-label={`Current task title: ${task.title}, click to edit`}
                                    >
                                        {task.title}
                                    </span>
                                )}

                              <div className="flex items-center text-sm mt-1 space-x-2">
                                {/* Due Date */}
                                {task.due_date_at && (
                                  <div className="flex items-center space-x-1">
                                    <IoCalendarOutline className="text-gray-400" />
                                    {getFormattedDueDate(task.due_date_at)}
                                  </div>
                                )}

                                {/* Priority */}
                                <div className="flex items-center space-x-1">
                                  <span className={`w-2 h-2 rounded-full ${getPriorityColor(task.priority)}`}></span>
                                  <span className="capitalize text-gray-500">{task.priority}</span>
                                </div>

                                {/* Category */}
                                {task.category_id && (
                                  <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full font-medium">
                                    {categories_by_id[task.category_id]?.name || 'Uncategorized'}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Actions (Edit and Delete) */}
                            <div className="flex-shrink-0 ml-4 flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                              <button
                                type="button"
                                onClick={() => handle_task_item_click(task.id)}
                                disabled={editing_inline_task_id !== null}
                                className="p-2 rounded-full text-gray-500 hover:bg-gray-200 hover:text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                aria-label={`Edit details for task: ${task.title}`}
                                title="Edit details"
                              >
                                <IoPencil size={20} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handle_task_delete(task.id, task.title)}
                                disabled={editing_inline_task_id !== null}
                                className="p-2 rounded-full text-gray-500 hover:bg-red-200 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500"
                                aria-label={`Delete task: ${task.title}`}
                                title="Delete task"
                              >
                                <IoTrash size={20} />
                              </button>
                            </div>
                        </li>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </ul>
              )}
            </Droppable>
          </DragDropContext>
        )}
      </div>

      {/* Task Edit Modal (UV_TaskEditModal) */}
      {is_edit_modal_open && (
        <UV_TaskEditModal
          task_id_to_edit={editing_task_id}
          on_close={handle_edit_modal_close}
        />
      )}
    </>
  );
};

export default UV_TaskDashboard;