import React, { useEffect, useState, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import {
  Category as CategoryType, // Renamed to avoid conflict with literal type
  SearchCategoriesInput,
} from '@schema'; // Assuming Category type is exported from @schema
import { format } from 'date-fns';

// Props interface for GV_SideBar
interface GVSideBarProps {}

const GV_SideBar: React.FC<GVSideBarProps> = () => {
  const { auth_token, categories_by_id, set_categories, set_is_fetching_categories, update_last_active_view, show_notification } = useAppStore();
  const location = useLocation();
  const navigate = useNavigate();

  // Determine the active filter from URL query parameters
  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

  // Derive activeFilter state from URL and `categories_by_id` global state
  const activeFilter = useMemo(() => {
    const category_id = queryParams.get('category_id');
    const due_date_type = queryParams.get('due_date_type');
    const show_completed_tasks_only = queryParams.get('show_completed_tasks_only') === 'true';

    if (show_completed_tasks_only) return { type: 'completed_tasks', value: null as string | null };
    if (category_id) return { type: 'category', value: category_id };
    if (due_date_type) return { type: 'due_date', value: due_date_type };
    return { type: 'all_tasks', value: null as string | null };
  }, [queryParams]);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

  // Function to fetch categories
  const getCategories = async (): Promise<CategoryType[]> => {
    set_is_fetching_categories(true);
    try {
      const response = await axios.get<CategoryType[]>(
        `${API_BASE_URL}/api/categories`,
        {
          headers: {
            Authorization: `Bearer ${auth_token}`,
          },
          params: {
            limit: 100, // Reasonable limit for sidebar categories
            offset: 0,
            sort_by: 'name',
            sort_order: 'asc',
          } as SearchCategoriesInput, // Ensure type safety for params
        }
      );
      set_categories(response.data); // Update global Zustand store
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to fetch categories.';
      show_notification(errorMessage, 'error');
      throw new Error(errorMessage);
    } finally {
      set_is_fetching_categories(false);
    }
  };

  // React Query to fetch categories
  const { data: userCategoriesArray = [], isLoading: isLoadingCategories } = useQuery<CategoryType[], Error>({
    queryKey: ['categories', auth_token],
    queryFn: getCategories,
    enabled: !!auth_token, // Only fetch if auth_token exists
    staleTime: 5 * 60 * 1000, // 5 minutes fresh
    cacheTime: 10 * 60 * 1000, // 10 minutes cached
  });


  // Action handlers
  const handleFilterClick = (filterType: 'all_tasks' | 'due_date' | 'category', value: string | null) => {
    const newQueryParams = new URLSearchParams();

    // Reset completed tasks for all other filters
    newQueryParams.delete('show_completed_tasks_only'); 

    if (filterType === 'category') {
      newQueryParams.set('category_id', value!);
    } else {
      newQueryParams.delete('category_id');
    }

    if (filterType === 'due_date') {
      newQueryParams.set('due_date_type', value!);
    } else {
      newQueryParams.delete('due_date_type');
    }

    // Always reset sort and query when changing main filters for consistency
    newQueryParams.delete('sort_by');
    newQueryParams.delete('sort_order');
    newQueryParams.delete('query');

    const newPath = `/tasks?${newQueryParams.toString()}`;
    navigate(newPath);

    // Persist last active view
    update_last_active_view({
      filter_type: filterType === 'category' ? 'category' : (filterType === 'due_date' ? 'date' : 'other'),
      filter_value: value,
      show_completed: false, // Assuming these filters imply active tasks
    });
  };

  const handleCompletedTasksToggle = () => {
    const newQueryParams = new URLSearchParams();
    // Only set show_completed_tasks_only to true, and clear all other filters
    newQueryParams.set('show_completed_tasks_only', 'true');
    newQueryParams.delete('category_id');
    newQueryParams.delete('due_date_type');
    newQueryParams.delete('sort_by');
    newQueryParams.delete('sort_order');
    newQueryParams.delete('query');


    const newPath = `/tasks?${newQueryParams.toString()}`;
    navigate(newPath);

    // Persist last active view
    update_last_active_view({
      filter_type: 'other', // Or a dedicated 'completed' type if backend supports
      filter_value: 'completed_tasks',
      show_completed: true,
    });
  };

  const handleManageCategoriesClick = () => {
    navigate('/categories');
  };

  // Convert categories_by_id object to an array for rendering, sorted by name
  const sortedCategories = useMemo(() => {
    return Object.values(categories_by_id)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [categories_by_id]);


  return (
    <>
      <aside className="hidden md:flex flex-col w-64 bg-gray-50 p-4 border-r border-gray-200">
        <nav className="flex-1 space-y-4">
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tra cking-wider">Tasks</h3>
            <ul className="mt-2 space-y-1">
              <li>
                <Link
                  to="/tasks"
                  className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200
                    ${activeFilter.type === 'all_tasks' && !activeFilter.value && !queryParams.get('show_completed_tasks_only')
                      ? 'bg-blue-100 text-blue-700 font-semibold'
                      : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  onClick={() => handleFilterClick('all_tasks', null)}
                >
                  All Tasks
                </Link>
              </li>
              <li>
                <Link
                  to="/tasks?due_date_type=today"
                  className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200
                    ${activeFilter.type === 'due_date' && activeFilter.value === 'today'
                      ? 'bg-blue-100 text-blue-700 font-semibold'
                      : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  onClick={() => handleFilterClick('due_date', 'today')}
                >
                  Today
                </Link>
              </li>
              <li>
                <Link
                  to="/tasks?due_date_type=tomorrow"
                  className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200
                    ${activeFilter.type === 'due_date' && activeFilter.value === 'tomorrow'
                      ? 'bg-blue-100 text-blue-700 font-semibold'
                      : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  onClick={() => handleFilterClick('due_date', 'tomorrow')}
                >
                  Tomorrow
                </Link>
              </li>
              <li>
                <Link
                  to="/tasks?due_date_type=this_week"
                  className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200
                    ${activeFilter.type === 'due_date' && activeFilter.value === 'this_week'
                      ? 'bg-blue-100 text-blue-700 font-semibold'
                      : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  onClick={() => handleFilterClick('due_date', 'this_week')}
                >
                  This Week
                </Link>
              </li>
              <li>
                <Link
                  to="/tasks?due_date_type=overdue"
                  className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200
                    ${activeFilter.type === 'due_date' && activeFilter.value === 'overdue'
                      ? 'bg-blue-100 text-blue-700 font-semibold'
                      : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  onClick={() => handleFilterClick('due_date', 'overdue')}
                >
                  Overdue
                </Link>
              </li>
              <li>
                <button
                  type="button"
                  className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200`}
                  onClick={handleCompletedTasksToggle}
                >
                  <span className={`block
                    ${activeFilter.type === 'completed_tasks' && activeFilter.value === null && queryParams.get('show_completed_tasks_only') === 'true'
                      ? 'bg-blue-100 text-blue-700 font-semibold'
                      : 'text-gray-700 hover:bg-gray-100'
                    }`}>
                    Completed Tasks
                  </span>
                </button>
              </li>
            </ul>
          </div>

          <div className="pt-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Categories
            </h3>
            <ul className="mt-2 space-y-1">
              {isLoadingCategories ? (
                // Skeleton loading for categories
                <>
                  <li className="h-6 bg-gray-200 rounded-md animate-pulse w-3/4"></li>
                  <li className="h-6 bg-gray-200 rounded-md animate-pulse w-2/3"></li>
                  <li className="h-6 bg-gray-200 rounded-md animate-pulse w-4/5"></li>
                </>
              ) : sortedCategories.length > 0 ? (
                sortedCategories.map((category) => (
                  <li key={category.id}>
                    <Link
                      to={`/tasks?category_id=${category.id}`}
                      className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200
                        ${activeFilter.type === 'category' && activeFilter.value === category.id
                          ? 'bg-blue-100 text-blue-700 font-semibold'
                          : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      onClick={() => handleFilterClick('category', category.id)}
                    >
                      {category.name}
                    </Link>
                  </li>
                ))
              ) : (
                <li className="text-sm text-gray-500 px-3 py-2">No categories yet.</li>
              )}
            </ul>
            <Link
              to="/categories"
              className="mt-4 block text-blue-600 hover:text-blue-800 text-sm font-medium"
              onClick={handleManageCategoriesClick}
            >
              Manage Categories
            </Link>
          </div>
        </nav>
      </aside>
    </>
  );
};

export default GV_SideBar;