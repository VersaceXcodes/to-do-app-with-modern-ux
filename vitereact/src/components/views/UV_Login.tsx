import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/main';
import { z } from 'zod';
import { LoginInput } from '@/store/main'; // Importing type for input conformity

// Define local Zod schema for validation
const loginFormSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type FormErrors = {
  email?: string;
  password?: string;
  general?: string;
};

const UV_Login: React.FC = () => {
  const navigate = useNavigate();
  const login_user = useAppStore((state) => state.login_user);
  const is_authenticating = useAppStore((state) => state.is_authenticating);
  const auth_token = useAppStore((state) => state.auth_token);
  const current_user = useAppStore((state) => state.current_user);

  const [email_input, set_email_input] = useState<string>('');
  const [password_input, set_password_input] = useState<string>('');
  const [form_errors, set_form_errors] = useState<FormErrors>({});

  // Redirect if already authenticated (handled by PublicRoute in App.tsx)
  useEffect(() => {
    if (auth_token && current_user) {
      navigate('/tasks');
    }
  }, [auth_token, current_user, navigate]);

  const handle_email_change = (event: React.ChangeEvent<HTMLInputElement>) => {
    set_email_input(event.target.value);
    set_form_errors((prev) => ({ ...prev, email: undefined, general: undefined }));
  };

  const handle_password_change = (event: React.ChangeEvent<HTMLInputElement>) => {
    set_password_input(event.target.value);
    set_form_errors((prev) => ({ ...prev, password: undefined, general: undefined }));
  };

  const handle_login_submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    set_form_errors({}); // Clear previous errors

    // Client-side validation
    try {
      loginFormSchema.parse({
        email: email_input,
        password: password_input,
      } as LoginInput);
    } catch (e) {
      if (e instanceof z.ZodError) {
        const errors: FormErrors = {};
        e.errors.forEach((err) => {
          if (err.path[0] === 'email') {
            errors.email = err.message;
          } else if (err.path[0] === 'password') {
            errors.password = err.message;
          }
        });
        set_form_errors(errors);
      }
      return;
    }

    try {
      await login_user({ email: email_input, password: password_input });
      // Redirection handled by PublicRoute in App.tsx on auth_token/current_user change
    } catch (error: any) {
      // Errors are caught by the Axios interceptor and handled by Zustand's show_notification.
      // For specific form errors that need to appear inline, you might need to
      // parse the error message or code from the backend error response if available.
      // For now, general error displayed by toast notification from interceptor.
      // If backend returns specific field errors (e.g., details: { email: '...' }),
      // you could set them here. For this MVP, we assume general login errors are covered by toast.
      console.error('Login failed:', error);
      set_form_errors((prev) => ({ ...prev, general: 'Invalid email or password.' }));
    }
  };

  return (
    <>
      <div className="flex min-h-full flex-col justify-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-md">
          <h2 className="mt-4 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
        </div>

        <div className="mt-8 mx-auto w-full max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <form className="space-y-6" onSubmit={handle_login_submit}>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email address
                </label>
                <div className="mt-1">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email_input}
                    onChange={handle_email_change}
                    className={`appearance-none block w-full px-3 py-2 border ${
                      form_errors.email ? 'border-red-500' : 'border-gray-300'
                    } rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}
                  />
                  {form_errors.email && (
                    <p className="mt-2 text-sm text-red-600">{form_errors.email}</p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <div className="mt-1">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password_input}
                    onChange={handle_password_change}
                    className={`appearance-none block w-full px-3 py-2 border ${
                      form_errors.password ? 'border-red-500' : 'border-gray-300'
                    } rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}
                  />
                  {form_errors.password && (
                    <p className="mt-2 text-sm text-red-600">{form_errors.password}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <Link
                    to="/forgot-password"
                    className="font-medium text-indigo-600 hover:text-indigo-500"
                  >
                    Forgot your password?
                  </Link>
                </div>
              </div>
              
              {form_errors.general && (
                <p className="mt-2 text-sm text-red-600 text-center">{form_errors.general}</p>
              )}

              <div>
                <button
                  type="submit"
                  disabled={is_authenticating}
                  className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                    is_authenticating ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {is_authenticating ? (
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                  ) : (
                    'Log In'
                  )}
                </button>
              </div>
            </form>

            <div className="mt-6 text-center text-sm">
              <p>
                Don't have an account?{' '}
                <Link
                  to="/register"
                  className="font-medium text-indigo-600 hover:text-indigo-500"
                >
                  Sign Up
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_Login;