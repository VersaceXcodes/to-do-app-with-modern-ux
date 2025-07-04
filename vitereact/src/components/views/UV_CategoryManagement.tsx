import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useAppStore } from '@/store/main';
import {
  Category,
  CreateCategoryInput,
  UpdateCategoryInput,
  CreateTaskInput, // Included for Zod type inference needs in future if validation library is integrated for forms
} from '@schema'; // Import types from shared schemas
import { type ConfirmFunction } from '@/components/views/GV_ConfirmationModal'; // Adjust path as per your project structure

interface UV_CategoryManagementProps {
  showConfirmation: ConfirmFunction;
}

const UV_CategoryManagement: React.FC<UV_CategoryManagementProps> = ({ showConfirmation }) => {
  const queryClient = useQueryClient();
  const {
    show_notification,
    categories_by_id,
    set_categories,
    add_or_update_category,
    remove_category,
    tasks_by_id, // Access global tasks_by_id for deletion logic
  } = useAppStore(state => ({
    show_notification: state.show_notification,
    categories_by_id: state.categories_by_id,
    set_categories: state.set_categories,
    add_or_update_category: state.add_or_update_category,
    remove_category: state.remove_category,
    tasks_by_id: state.tasks_by_id,
  }));

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState<string>('');
  const [formErrors, setFormErrors] = useState<{ newCategory?: string; editCategory?: string }>({});

  const categoriesArray = Object.values(categories_by_id).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  // --- API Calls using React Query ---

  // Query to fetch categories
  const { isLoading, error } = useQuery<Category[], Error>({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await axios.get<Category[]>(`${API_BASE_URL}/api/categories`, {
        params: { sort_by: 'name', sort_order: 'asc' }, // FR.CAT.MNG.20 and default sorting
      });
      set_categories(data); // Update Zustand store with fetched categories
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    onError: err => {
      show_notification(`Failed to load categories: ${err.message}`, 'error');
    },
  });

  // Mutation to create a new category
  const createCategoryMutation = useMutation<Category, Error, CreateCategoryInput>({
    mutationFn: async (newCategory: CreateCategoryInput) => {
      const { data } = await axios.post<Category>(`${API_BASE_URL}/api/categories`, newCategory);
      return data;
    },
    onSuccess: data => {
      add_or_update_category(data); // Add new category to Zustand store
      setNewCategoryName(''); // Clear input
      setFormErrors({});
      show_notification('Category created successfully!', 'success');
      queryClient.invalidateQueries({ queryKey: ['categories'] }); // Invalidate to keep data fresh, re-fetches background for GV_Sidebar
    },
    onError: err => {
      setFormErrors({ newCategory: err.message });
      show_notification(`Failed to create category: ${err.message}`, 'error');
    },
  });

  // Mutation to update an existing category
  const updateCategoryMutation = useMutation<Category, Error, { id: string; name: string }>({
    mutationFn: async ({ id, name }) => {
      const { data } = await axios.patch<Category>(`${API_BASE_URL}/api/categories/${id}`, { name });
      return data;
    },
    onSuccess: data => {
      add_or_update_category(data); // Update category in Zustand store
      setEditingCategoryId(null); // Exit editing mode
      setEditingCategoryName('');
      setFormErrors({});
      show_notification('Category updated successfully!', 'success');
      queryClient.invalidateQueries({ queryKey: ['categories'] }); // Invalidate
    },
    onError: err => {
      setFormErrors({ editCategory: err.message });
      show_notification(`Failed to update category: ${err.message}`, 'error');
    },
  });

  // Mutation to delete a category
  const deleteCategoryMutation = useMutation<void, Error, string>({
    mutationFn: async (id: string) => {
      await axios.delete(`${API_BASE_URL}/api/categories/${id}`);
    },
    onSuccess: (_, id) => {
      remove_category(id); // Remove category from Zustand store
      show_notification('Category deleted successfully!', 'success');
      queryClient.invalidateQueries({ queryKey: ['categories'] }); // Invalidate categories
      queryClient.invalidateQueries({ queryKey: ['tasks'] }); // Invalidate tasks to reflect category_id becoming null
    },
    onError: err => {
      show_notification(`Failed to delete category: ${err.message}`, 'error');
    },
  });

  // --- Handlers ---

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCategoryName.trim() === '') {
      setFormErrors({ newCategory: 'Category name cannot be empty.' });
      return;
    }
    setFormErrors({});
    createCategoryMutation.mutate({ name: newCategoryName });
  };

  const handleEditClick = (category: Category) => {
    setEditingCategoryId(category.id);
    setEditingCategoryName(category.name);
    setFormErrors({}); // Clear errors when starting edit
  };

  const handleEditSave = (categoryId: string) => {
    if (editingCategoryName.trim() === '') {
      setFormErrors({ editCategory: 'Category name cannot be empty.' });
      return;
    }
    // Check if name is unchanged, no need to update
    const currentCategory = categories_by_id[categoryId];
    if (currentCategory && currentCategory.name === editingCategoryName) {
      setEditingCategoryId(null);
      setEditingCategoryName('');
      setFormErrors({});
      return;
    }
    setFormErrors({});
    updateCategoryMutation.mutate({ id: categoryId, name: editingCategoryName });
  };

  const handleEditCancel = () => {
    setEditingCategoryId(null);
    setEditingCategoryName('');
    setFormErrors({});
  };

  const handleDeleteCategory = (categoryId: string, categoryName: string) => {
    const tasksInThisCategory = Object.values(tasks_by_id).filter(
      task => task.category_id === categoryId
    );

    let confirmMessage = `Are you sure you want to delete "${categoryName}"?`;
    if (tasksInThisCategory.length > 0) {
      confirmMessage += ` This category contains ${tasksInThisCategory.length} task(s). Deleting it will reassign these tasks to 'Uncategorized'.`;
    }

    showConfirmation(confirmMessage, () => {
      deleteCategoryMutation.mutate(categoryId);
    });
  };

  // --- Rendering ---
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        <p className="ml-3 text-gray-700">Loading categories...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-600 text-center p-4">
        <p>Error: {error.message}</p>
        <p>Failed to load categories. Please try again.</p>
      </div>
    );
  }

  return (
    <>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Category Management</h1>

        {/* Back to Tasks Link */}
        <div className="mb-6">
          <Link to="/tasks" className="text-blue-600 hover:underline flex items-center">
            <svg
              className="w-4 h-4 mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              ></path>
            </svg>
            Back to Tasks
          </Link>
        </div>

        {/* Add New Category Form */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Add New Category</h2>
          <form onSubmit={handleCreateCategory} className="flex flex-col sm:flex-row gap-4">
            <div className="flex-grow">
              <input
                type="text"
                placeholder="Category Name"
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  formErrors.newCategory ? 'border-red-500' : 'border-gray-300'
                }`}
                aria-label="New category name"
                disabled={createCategoryMutation.isPending}
              />
              {formErrors.newCategory && (
                <p className="text-red-500 text-sm mt-1">{formErrors.newCategory}</p>
              )}
            </div>
            <button
              type="submit"
              className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={createCategoryMutation.isPending}
            >
              {createCategoryMutation.isPending ? (
                <span className="flex items-center">
                  <svg
                    className="animate-spin h-5 w-5 text-white mr-2"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circular-progress-indicator-component name="progress"></circular-progress-indicator-component>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Adding...
                </span>
              ) : (
                'Add Category'
              )}
            </button>
          </form>
        </div>

        {/* Category List */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Your Categories</h2>
          {categoriesArray.length === 0 ? (
            <p className="text-gray-600 text-center py-4">No categories created yet!</p>
          ) : (
            <ul className="divide-y divide-gray-200">
              {categoriesArray.map(category => (
                <li key={category.id} className="py-4 flex flex-col sm:flex-row items-center gap-4">
                  {editingCategoryId === category.id ? (
                    <div className="flex-grow flex flex-col sm:flex-row items-center gap-2 w-full">
                      <input
                        type="text"
                        value={editingCategoryName}
                        onChange={e => setEditingCategoryName(e.target.value)}
                        onBlur={() => handleEditSave(category.id)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleEditSave(category.id);
                          if (e.key === 'Escape') handleEditCancel();
                        }}
                        className={`flex-grow p-2 border rounded-lg focus:ring-1 focus:ring-blue-400 focus:border-blue-400 ${
                          formErrors.editCategory ? 'border-red-500' : 'border-gray-300'
                        }`}
                        aria-label={`Edit ${category.name}`}
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditSave(category.id)}
                          className="p-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors duration-200"
                          title="Save"
                          disabled={updateCategoryMutation.isPending}
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M5 13l4 4L19 7"
                            ></path>
                          </svg>
                        </button>
                        <button
                          onClick={handleEditCancel}
                          className="p-2 bg-gray-400 text-white rounded-md hover:bg-gray-500 transition-colors duration-200"
                          title="Cancel"
                          disabled={updateCategoryMutation.isPending}
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M6 18L18 6M6 6l12 12"
                            ></path>
                          </svg>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <span className="font-medium text-gray-700 flex-grow text-lg">
                      {category.name}
                    </span>
                  )}
                  <div className="flex gap-2 min-w-max">
                    {editingCategoryId !== category.id && (
                      <button
                        onClick={() => handleEditClick(category)}
                        className="p-2 text-blue-600 hover:text-blue-800 transition-colors duration-200"
                        title="Edit category"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                          ></path>
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteCategory(category.id, category.name)}
                      className="p-2 text-red-600 hover:text-red-800 transition-colors duration-200"
                      title="Delete category"
                      disabled={deleteCategoryMutation.isPending}
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        ></path>
                      </svg>
                    </button>
                  </div>
                </li>
              ))}
              {formErrors.editCategory && (
                <p className="text-red-500 text-sm mt-2 text-center">{formErrors.editCategory}</p>
              )}
            </ul>
          )}
        </div>
      </div>
    </>
  );
};

export default UV_CategoryManagement; // Export the component
