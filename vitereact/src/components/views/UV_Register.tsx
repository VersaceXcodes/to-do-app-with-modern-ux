import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/main';
import { createUserInputSchema } from '@schema';
import { z } from 'zod';

interface UV_RegisterProps {}

const UV_Register: React.FC<UV_RegisterProps> = () => {
  const navigate = useNavigate();
  const register_user = useAppStore((state) => state.register_user);
  const is_authenticating = useAppStore((state) => state.is_authenticating);

  const [email_input, setEmail_input] = useState<string>('');
  const [password_input, setPassword_input] = useState<string>('');
  const [confirm_password_input, setConfirm_password_input] = useState<string>('');
  const [form_errors, setForm_errors] = useState<Record<string, string>>({});

  // Redirect if already authenticated, handled by PublicRoute in App.tsx
  // This component will only render if PublicRoute permits it.

  // Zod schema for client-side validation (with confirm password)
  const registerFormSchema = createUserInputSchema.extend({
    confirm_password: z.string(),
  }).refine((data) => data.password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"], // Path to the field that caused the error
  });

  const handle_register_submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setForm_errors({}); // Clear previous errors

    try {
      // Client-side validation using Zod
      const validated_data = registerFormSchema.parse({
        email: email_input,
        password: password_input,
        confirm_password: confirm_password_input,
      });

      // Call the global register_user action
      // It handles success (navigation, notification) and error (notification)
      await register_user({
        email: validated_data.email,
        password: validated_data.password,
      });
      // Navigation handled by useAppStore's register_user success logic via PublicRoute redirect
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Map Zod errors to form_errors state
        const new_errors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path && err.path.length > 0) {
            new_errors[err.path[0]] = err.message;
          }
        });
        setForm_errors(new_errors);
      } else {
        // Backend errors are handled by Axios interceptor and show_notification in useAppStore
        // No need to set form_errors for generic backend errors here beyond what interceptor does
      }
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="px-8 py-6 mt-4 text-left bg-white shadow-lg w-full max-w-md rounded-lg dark:bg-gray-800">
        <h3 className="text-2xl font-bold text-center text-gray-900 dark:text-gray-100">Sign Up for TaskPad</h3>
        <form onSubmit={handle_register_submit}>
          <div className="mt-4">
            <div>
              <label className="block text-gray-700 dark:text-gray-300" htmlFor="email">Email</label>
              <input
                type="email"
                placeholder="Email"
                className={`w-full px-4 py-2 mt-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 ${form_errors.email ? 'border-red-500' : 'border-gray-300'}`}
                id="email"
                value={email_input}
                onChange={(e) => {
                  setEmail_input(e.target.value);
                  if (form_errors.email) setForm_errors((prev) => ({ ...prev, email: '' })); // Clear error on change
                }}
                required
              />
              {form_errors.email && <p className="text-red-500 text-xs mt-1">{form_errors.email}</p>}
            </div>
            <div className="mt-4">
              <label className="block text-gray-700 dark:text-gray-300" htmlFor="password">Password</label>
              <input
                type="password"
                placeholder="Password"
                className={`w-full px-4 py-2 mt-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 ${form_errors.password ? 'border-red-500' : 'border-gray-300'}`}
                id="password"
                value={password_input}
                onChange={(e) => {
                  setPassword_input(e.target.value);
                  if (form_errors.password) setForm_errors((prev) => ({ ...prev, password: '' })); // Clear error on change
                }}
                required
              />
              {form_errors.password && <p className="text-red-500 text-xs mt-1">{form_errors.password}</p>}
            </div>
            <div className="mt-4">
              <label className="block text-gray-700 dark:text-gray-300" htmlFor="confirm_password">Confirm Password</label>
              <input
                type="password"
                placeholder="Confirm Password"
                className={`w-full px-4 py-2 mt-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 ${form_errors.confirm_password ? 'border-red-500' : 'border-gray-300'}`}
                id="confirm_password"
                value={confirm_password_input}
                onChange={(e) => {
                  setConfirm_password_input(e.target.value);
                  if (form_errors.confirm_password) setForm_errors((prev) => ({ ...prev, confirm_password: '' })); // Clear error on change
                }}
                required
              />
              {form_errors.confirm_password && <p className="text-red-500 text-xs mt-1">{form_errors.confirm_password}</p>}
            </div>
            <div className="flex items-baseline justify-between mt-6">
              <button
                type="submit"
                className="px-6 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-900 focus:outline-none focus:bg-blue-900 transition-colors duration-200 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={is_authenticating}
              >
                {is_authenticating ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Signing Up...
                  </span>
                ) : (
                  'Sign Up'
                )}
              </button>
            </div>
            <div className="mt-4 text-center">
              <span className="text-gray-700 dark:text-gray-300">Already have an account? </span>
              <Link to="/login" className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-600 font-semibold transition-colors duration-200 ease-in-out">
                Log In
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UV_Register;
