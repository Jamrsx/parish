<?php

namespace App\Http\Controllers;

use App\Models\ManageRequest;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class NotificationController extends Controller
{
    /**
     * Expire pending requests for the authenticated parishioner before reads.
     */
    protected function expirePendingForUser(User $user): int
    {
        return ManageRequest::expirePendingRequests($user->user_id);
    }

    /**
     * Get all notifications for authenticated user
     */
    public function index(Request $request)
    {
        /** @var User|null $user */
        $user = $request->user();
        
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthenticated'
            ], 401);
        }

        // Only parishioners have notifications
        if (!$user->isParishioner()) {
            return response()->json([
                'success' => false,
                'message' => 'Only parishioners can access notifications.'
            ], 403);
        }

        $this->expirePendingForUser($user);

        $perPage = $request->input('per_page', 20);
        $notifications = Notification::where('user_id', $user->user_id)
            ->with('request')
            ->orderBy('created_at', 'desc')
            ->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $notifications
        ]);
    }

    /**
     * Get unread notification count
     */
    public function unreadCount(Request $request)
    {
        /** @var User|null $user */
        $user = $request->user();
        
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthenticated'
            ], 401);
        }

        if (!$user->isParishioner()) {
            return response()->json([
                'success' => false,
                'message' => 'Only parishioners can access notifications.'
            ], 403);
        }

        $this->expirePendingForUser($user);

        $count = Notification::where('user_id', $user->user_id)
            ->where('status', 'unread')
            ->count();

        return response()->json([
            'success' => true,
            'data' => [
                'count' => $count
            ]
        ]);
    }

    /**
     * Get unread notifications for dropdown
     */
    public function unreadNotifications(Request $request)
    {
        /** @var User|null $user */
        $user = $request->user();
        
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthenticated'
            ], 401);
        }

        if (!$user->isParishioner()) {
            return response()->json([
                'success' => false,
                'message' => 'Only parishioners can access notifications.'
            ], 403);
        }

        $limit = $request->input('limit', 10);
        $notifications = Notification::where('user_id', $user->user_id)
            ->where('status', 'unread')
            ->with('request')
            ->orderBy('created_at', 'desc')
            ->limit($limit)
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'notifications' => $notifications
            ]
        ]);
    }

    /**
     * Mark notification as read
     */
    public function markAsRead($id)
    {
        /** @var User|null $user */
        $user = auth('sanctum')->user();
        
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthenticated'
            ], 401);
        }

        if (!$user->isParishioner()) {
            return response()->json([
                'success' => false,
                'message' => 'Only parishioners can access notifications.'
            ], 403);
        }

        $notification = Notification::where('notification_id', $id)
            ->where('user_id', $user->user_id)
            ->first();

        if (!$notification) {
            return response()->json([
                'success' => false,
                'message' => 'Notification not found'
            ], 404);
        }

        $notification->markAsRead();

        return response()->json([
            'success' => true,
            'message' => 'Notification marked as read'
        ]);
    }

    /**
     * Mark all notifications as read
     */
    public function markAllAsRead(Request $request)
    {
        /** @var User|null $user */
        $user = $request->user();
        
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthenticated'
            ], 401);
        }

        if (!$user->isParishioner()) {
            return response()->json([
                'success' => false,
                'message' => 'Only parishioners can access notifications.'
            ], 403);
        }

        Notification::where('user_id', $user->user_id) 
            ->where('status', 'unread')
            ->update(['status' => 'read']);

        return response()->json([
            'success' => true,
            'message' => 'All notifications marked as read'
        ]);
    }

    /**
     * Get deleted (trashed) notifications for authenticated user
     */
    public function deleted(Request $request)
    {
        /** @var User|null $user */
        $user = $request->user();

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthenticated'
            ], 401);
        }

        if (!$user->isParishioner()) {
            return response()->json([
                'success' => false,
                'message' => 'Only parishioners can access notifications.'
            ], 403);
        }

        $perPage = $request->input('per_page', 20);
        $notifications = Notification::onlyTrashed()
            ->where('user_id', $user->user_id)
            ->with('request')
            ->orderBy('deleted_at', 'desc')
            ->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $notifications
        ]);
    }

    /**
     * Restore a deleted notification
     */
    public function restore($id)
    {
        /** @var User|null $user */
        $user = auth('sanctum')->user();

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthenticated'
            ], 401);
        }

        if (!$user->isParishioner()) {
            return response()->json([
                'success' => false,
                'message' => 'Only parishioners can access notifications.'
            ], 403);
        }

        $notification = Notification::onlyTrashed()
            ->where('notification_id', $id)
            ->where('user_id', $user->user_id)
            ->first();

        if (!$notification) {
            return response()->json([
                'success' => false,
                'message' => 'Deleted notification not found'
            ], 404);
        }

        $notification->restore();

        return response()->json([
            'success' => true,
            'message' => 'Notification restored successfully'
        ]);
    }

    /**
     * Delete notification (soft delete — recoverable from Deleted tab)
     */
    public function destroy($id)
    {
        /** @var User|null $user */
        $user = auth('sanctum')->user();
        
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthenticated'
            ], 401);
        }

        if (!$user->isParishioner()) {
            return response()->json([
                'success' => false,
                'message' => 'Only parishioners can access notifications.'
            ], 403);
        }

        $notification = Notification::where('notification_id', $id)
            ->where('user_id', $user->user_id)
            ->first();

        if (!$notification) {
            return response()->json([
                'success' => false,
                'message' => 'Notification not found'
            ], 404);
        }

        $notification->delete();

        return response()->json([
            'success' => true,
            'message' => 'Notification deleted successfully'
        ]);
    }
}