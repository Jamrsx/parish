<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class AuthController extends Controller
{
    /**
     * Register a new user
     */
    public function register(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'first_name' => 'required|string|max:50',
            'middle_name' => 'nullable|string|max:50',
            'last_name' => 'required|string|max:50',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8|confirmed',
            'contact_number' => 'nullable|string|max:20',
            'address' => 'nullable|string',
            'role' => ['sometimes', Rule::in(['parishioner'])],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $role = $request->role ?? 'parishioner';
        if (!in_array($role, ['parishioner'])) { 
            return response()->json([
                'success' => false,
                'message' => 'Invalid role for registration. Only parishioner accounts can be self-registered.'
            ], 422);
        }

        $user = User::create([
            'first_name' => $request->first_name,
            'middle_name' => $request->middle_name,
            'last_name' => $request->last_name,
            'email' => $request->email,
            'password' => $request->password,
            'contact_number' => $request->contact_number,
            'address' => $request->address,
            'role' => $role,
        ]);

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => 'Registration successful',
            'data' => [
                'user' => $this->formatUserData($user),
                'token' => $token
            ]
        ], 201);
    }

    /**
     * Login - Accepts all roles (for web)
     */
    public function webLogin(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'login' => 'required|string',
            'password' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $user = User::where('email', $request->login)
            ->orWhere('username', $request->login)
            ->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid credentials'
            ], 401);
        }

        if (!$user->isActive()) {
            return response()->json([
                'success' => false,
                'message' => 'This account has been disabled. Please contact the parish office.'
            ], 403);
        }
        
        $user->update(['last_login' => now()]);
        
        
        $token = $user->createToken('auth_token', [$user->role])->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => 'Login successful',
            'data' => [
                'user' => $this->formatUserData($user),
                'token' => $token,
                'role' => $user->role,
            ]
        ]);
    }

    /**
     * Login - Only accepts parishioner role (for mobile)
     */
    public function mobileLogin(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'login' => 'required|string',
            'password' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $user = User::where('email', $request->login)
            ->orWhere('username', $request->login)
            ->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid credentials'
            ], 401);
        }

        if (!$user->isActive()) {
            return response()->json([
                'success' => false,
                'message' => 'This account has been disabled. Please contact the parish office.'
            ], 403);
        }

        if (!$user->isParishioner()) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid credentials'
            ], 401);
        }

        $user->update(['last_login' => now()]);
        
        $token = $user->createToken('auth_token', [$user->role])->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => 'Login successful',
            'data' => [
                'user' => $this->formatUserData($user),
                'token' => $token,
                'role' => $user->role,
            ]
        ]);
    }

    /**
     * Original login method (kept for backward compatibility)
     */
    public function login(Request $request)
    {
        return $this->webLogin($request);
    }

    /**
     * Logout 
     */
    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'success' => true,
            'message' => 'Logged out successfully'
        ]);
    }

    /**
     * Get user profile
     */
    public function profile(Request $request)
    {
        $user = $request->user();

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'User not found'
            ], 404);
        }

        $data = $this->formatUserData($user);

        // Add role-specific data
        if ($user->isParishioner()) {
            $data['requests_count'] = $user->requests()->count();
            $data['unread_notifications_count'] = $user->unreadNotifications()->count();
        }

        if ($user->isPriest()) {
            $data['assigned_requests_count'] = $user->assignedRequests()->count();
        }

        if ($user->isAdmin()) {
            $data['processed_requests_count'] = $user->processedRequests()->count();
        }

        return response()->json([
            'success' => true,
            'data' => $data
        ]);
    }

    /**
     * Verify token
     */
    public function verify(Request $request)
    {
        $user = $request->user();

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid token'
            ], 401);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'user_id' => $user->user_id,
                'full_name' => $user->full_name,
                'email' => $user->email,
                'role' => $user->role,
                'is_verified' => true,
            ]
        ]);
    }

    /**
     * Update user profile
     */
    public function updateProfile(Request $request)
    {
        $user = $request->user();

        $validator = Validator::make($request->all(), [
            'first_name' => 'sometimes|string|max:50',
            'middle_name' => 'nullable|string|max:50',
            'last_name' => 'sometimes|string|max:50',
            'email' => 'sometimes|email|unique:users,email,' . $user->user_id . ',user_id',
            'password' => 'sometimes|string|min:8|confirmed',
            'contact_number' => 'nullable|string|max:20',
            'address' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $updateData = $request->only([
            'first_name',
            'middle_name',
            'last_name',
            'contact_number',
            'address'
        ]);

        if ($request->has('email')) {
            $updateData['email'] = $request->email;
        }

        if ($request->has('password')) {
            $updateData['password'] = $request->password;
        }

        $user->update($updateData);

        return response()->json([
            'success' => true,
            'message' => 'Profile updated successfully',
            'data' => $this->formatUserData($user->fresh())
        ]);
    }

    /**
     * Format user data for response
     */
    private function formatUserData($user): array
    {
        return [
            'user_id' => $user->user_id,
            'first_name' => $user->first_name,
            'middle_name' => $user->middle_name,
            'last_name' => $user->last_name,
            'full_name' => $user->full_name,
            'email' => $user->email,
            'username' => $user->username,
            'contact_number' => $user->contact_number,
            'address' => $user->address,
            'role' => $user->role,
            'role_label' => $user->role_label,
            'is_active' => $user->is_active,
            'is_available' => $user->is_available ?? true,
            'last_login' => $user->last_login,
            'created_at' => $user->created_at,
            'updated_at' => $user->updated_at,
        ];
    }

    /**
     * Admin only: Create admin users
     */
    public function createAdmin(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'first_name' => 'required|string|max:50',
            'middle_name' => 'nullable|string|max:50',
            'last_name' => 'required|string|max:50',
            'username' => 'required|string|max:50|unique:users,username',
            'email' => 'nullable|email|unique:users,email',
            'password' => 'required|string|min:8',
            'role' => ['required', Rule::in(['secretary', 'cashier'])],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $user = User::create([
            'first_name' => $request->first_name,
            'middle_name' => $request->middle_name,
            'last_name' => $request->last_name,
            'username' => $request->username,
            'email' => $request->email,
            'password' => $request->password,
            'role' => $request->role,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Admin user created successfully',
            'data' => $this->formatUserData($user)
        ], 201);
    }

    /**
     * Admin only: Create priest user
     */
    public function createPriest(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'first_name' => 'required|string|max:50',
            'middle_name' => 'nullable|string|max:50',
            'last_name' => 'required|string|max:50',
            'email' => 'required|email|unique:users,email',
            'contact_number' => 'nullable|string|max:20',
            'password' => 'required|string|min:8',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $user = User::create([
            'first_name' => $request->first_name,
            'middle_name' => $request->middle_name,
            'last_name' => $request->last_name,
            'email' => $request->email,
            'contact_number' => $request->contact_number,
            'password' => $request->password,
            'role' => 'priest',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Priest created successfully',
            'data' => $this->formatUserData($user)
        ], 201);
    }

    /**
     * List users by role (Admin only)
     */
    public function listUsers(Request $request)
    {
        $query = User::query();

        if ($request->has('role') && $request->role !== 'all') {
            $query->where('role', $request->role);
        }

        if ($request->boolean('active_only')) {
            $query->where('is_active', true);
        }

        if ($request->boolean('available_only')) {
            $query->where('is_available', true);
        }

        if ($request->has('search')) {
            $query->search($request->search);
        }

        $users = $query->orderBy('created_at', 'desc')
            ->paginate($request->per_page ?? 15);

        return response()->json([
            'success' => true,
            'data' => $users->through(function ($user) {
                return $this->formatUserData($user);
            })
        ]);
    }

    /**
     * Get user by ID (Admin only)
     */
    public function getUser($id)
    {
        $user = User::find($id);

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'User not found'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $this->formatUserData($user)
        ]);
    }

    /**
     * Delete user (Admin only)
     */
    public function deleteUser($id)
    {
        $user = User::find($id);

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'User not found'
            ], 404);
        }

        // Prevent deleting the last admin
        if ($user->isAdmin()) {
            $adminCount = User::admins()->count();
            if ($adminCount <= 1) {
                return response()->json([
                    'success' => false,
                    'message' => 'Cannot delete the last admin user'
                ], 422);
            }
        }

        $user->delete();

        return response()->json([
            'success' => true,
            'message' => 'User deleted successfully'
        ]);
    }

    /**
     * Disable a priest account (Admin only)
     */
    public function disableUser($id)
    {
        $user = User::find($id);

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'User not found'
            ], 404);
        }

        if (!$user->isPriest()) {
            return response()->json([
                'success' => false,
                'message' => 'Only priest accounts can be disabled from this action.'
            ], 422);
        }

        if (!$user->isActive()) {
            return response()->json([
                'success' => false,
                'message' => 'This priest account is already disabled.'
            ], 422);
        }

        $user->update(['is_active' => false]);
        $user->tokens()->delete();

        return response()->json([
            'success' => true,
            'message' => 'Priest account disabled successfully.',
            'data' => $this->formatUserData($user->fresh())
        ]);
    }

    /**
     * Re-enable a priest account (Admin only)
     */
    public function enableUser($id)
    {
        $user = User::find($id);

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'User not found'
            ], 404);
        }

        if (!$user->isPriest()) {
            return response()->json([
                'success' => false,
                'message' => 'Only priest accounts can be enabled from this action.'
            ], 422);
        }

        if ($user->isActive()) {
            return response()->json([
                'success' => false,
                'message' => 'This priest account is already active.'
            ], 422);
        }

        $user->update(['is_active' => true]);

        return response()->json([
            'success' => true,
            'message' => 'Priest account enabled successfully.',
            'data' => $this->formatUserData($user->fresh())
        ]);
    }

    /**
     * Priest only: Update availability for new assignments
     */
    public function updatePriestAvailability(Request $request)
    {
        /** @var User|null $user */
        $user = $request->user();

        if (!$user || !$user->isPriest()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Priest authentication required.'
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'is_available' => 'required|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $isAvailable = $request->boolean('is_available');
        $user->update(['is_available' => $isAvailable]);

        return response()->json([
            'success' => true,
            'message' => $isAvailable
                ? 'You are now available for new assignments.'
                : 'You are now unavailable for new assignments.',
            'data' => $this->formatUserData($user->fresh())
        ]);
    }
}