import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAppStore } from '@/store/main';
import { z } from 'zod';
import { reset_password_input, message_response, error_response } from '@schema'; // Assuming these types exist from relevant Zod schemas

// Define local validation schema for the form
// This mirrors the backend's validation for new_password and confirm_new_password
const clientResetPasswordSchema = z.object({
  new_password: z.string().min(8, "Password must be at least 8 characters long").max(255),
  confirm_new_password: z.string(),
}).refine((data) => data.new_password === data.confirm_new_password, {
  message: "Passwords do not match",
  path: ["confirm_new_password"],
});

type FormErrors = {
  new_password?: string;
  confirm_new_password?: string;
  general?: string;
};

const UV_PasswordResetForm: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get('token') || '';

  const [new_password_input, setNew_password_input] = useState('');
  const [confirm_new_password_input, setConfirm_new_password_input] = useState('');
  const [form_errors, setForm_errors] = useState<FormErrors>({});

  const is_authenticating = useAppStore((state) => state.is_authenticating);
  const reset_password = useAppStore((state) => state.reset_password);
  const show_notification = useAppStore((state) => state.show_notification);

  useEffect(() => {
    // If no token is provided in the URL, redirect or show error
    if (!token) {
      show_notification('Invalid or missing password reset token. Please request a new link.', 'error');
      navigate('/forgot-password', { replace: true });
    }
  }, [token, navigate, show_notification]);

  const handle_new_password_change = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNew_password_input(e.target.value);
    setForm_errors((prev) => ({ ...prev, new_password: undefined, general: undefined }));
  };

  const handle_confirm_new_password_change = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirm_new_password_input(e.target.value);
    setForm_errors((prev) => ({ ...prev, confirm_new_password: undefined, general: undefined }));
  };

  const handle_reset_password_submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setForm_errors({}); // Clear previous errors

    try {
      // Client-side validation
      clientResetPasswordSchema.parse({
        new_password: new_password_input,
        confirm_new_password: confirm_new_password_input,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        const errors: FormErrors = {};
        err.errors.forEach((error) => {
          if (error.path[0]) {
            errors[error.path[0] as keyof FormErrors] = error.message;
          }
        });
        setForm_errors(errors);
      }
      return;
    }

    if (!token) {
      show_notification('Invalid reset link. Token is missing.', 'error');
      return;
    }

    try {
      const resetPayload: z.infer<typeof reset_password_input> = {
        token,
        new_password: new_password_input,
        confirm_new_password: confirm_new_password_input,
      };
      await reset_password(resetPayload);
      navigate('/login', { replace: true }); // Redirect to login on success
    } catch (error: any) {
      // Errors are typically handled by the Axios interceptor in useAppStore
      // If a specific error needs to be put into form_errors, it would go here.
      // For this view, general form errors (e.g. invalid token) are caught by global notification.
    }
  };

  return (
    <>
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
        <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8 space-y-6">
          <Link to="/" className="flex justify-center mb-6">
            <h1 className="text-3xl font-extrabold text-indigo-600">NexGen TaskPad</h1>
          </Link>
          <h2 className="text-2xl font-bold text-gray-900 text-center">Reset Your Password</h2>
          <p className="text-center text-gray-600 text-sm">Enter and confirm your new password below.</p>

          <form className="space-y-6" onSubmit={handle_reset_password_submit}>
            <div>
              <label
                htmlFor="new-password"
                className="block text-sm font-medium text-gray-700"
              >
                New Password
              </label>
              <div className="mt-1">
                <input
                  id="new-password"
                  name="new_password"
                  type="password"
                  autoComplete="new-password"
                  required
                  className={`appearance-none block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
                    form_errors.new_password ? 'border-red-500' : 'border-gray-300'
                  }`}
                  value={new_password_input}
                  onChange={handle_new_password_change}
                />
                {form_errors.new_password && (
                  <p className="mt-2 text-sm text-red-600">{form_errors.new_password}</p>
                )}
              </div>
            </div>

            <div>
              <label
                htmlFor="confirm-new-password"
                className="block text-sm font-medium text-gray-700"
              >
                Confirm New Password
              </label>
              <div className="mt-1">
                <input
                  id="confirm-new-password"
                  name="confirm_new_password"
                  type="password"
                  autoComplete="new-password"
                  required
                  className={`appearance-none block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
                    form_errors.confirm_new_password ? 'border-red-500' : 'border-gray-300'
                  }`}
                  value={confirm_new_password_input}
                  onChange={handle_confirm_new_password_change}
                />
                {form_errors.confirm_new_password && (
                  <p className="mt-2 text-sm text-red-600">{form_errors.confirm_new_password}</p>
                )}
              </div>
            </div>

            {form_errors.general && (
              <p className="text-sm text-red-600 text-center">{form_errors.general}</p>
            )}

            <div>
              <button
                type="submit"
                disabled={is_authenticating || !new_password_input || !confirm_new_password_input || !!form_errors.new_password || !!form_errors.confirm_new_password}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {is_authenticating ? (
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  'Reset Password'
                )}
              </button>
            </div>
          </form>

          <div className="text-sm text-center">
            <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_PasswordResetForm;