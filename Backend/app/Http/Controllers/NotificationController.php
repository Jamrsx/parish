<?php

namespace App\Http\Controllers;

use App\Models\ManageRequest;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    private const REQUEST_RELATIONS = ['request.service:service_id,service_type'];

    private function withRequestSummary(Notification $notification): Notification
    {
        $request = $notification->request;
        $summary = null;

        if ($request) {
            $date = $request->preferred_date
                ? \Carbon\Carbon::parse($request->preferred_date)->format('M d, Y')
                : null;
            $time = ManageRequest::normalizeTime($request->preferred_time);

            $summary = [
                'service_name' => $request->notificationServiceLabel(),
                'date_label' => $date,
                'time_label' => $time !== '' ? date('g:i A', strtotime($time)) : null,
            ];
        }

        $notification->setAttribute('request_summary', $summary);
        return $notification;
    }

    protected function canAccessNotifications(User $user): bool
    {
        return $user->isParishioner() || $user->isPriest();
    }

    /**
     * Expire pending requests for parishioners before reads.
     */
    protected function expirePendingForUser(User $user): int
    {
        if (!$user->isParishioner()) {
            return 0;
        }

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

        if (!$this->canAccessNotifications($user)) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized to access notifications.'
            ], 403);
        }

        $this->expirePendingForUser($user);

        $perPage = $request->input('per_page', 20);
        $notifications = Notification::where('user_id', $user->user_id)
            ->with(self::REQUEST_RELATIONS)
            ->orderBy('created_at', 'desc')
            ->paginate($perPage)
            ->through(fn (Notification $n) => $this->withRequestSummary($n));

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

        if (!$this->canAccessNotifications($user)) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized to access notifications.'
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

        if (!$this->canAccessNotifications($user)) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized to access notifications.'
            ], 403);
        }

        if ($user->isPriest()) {
            try {
                ManageRequest::syncPriestUpcomingReminders($user->user_id);
            } catch (\Exception $e) {
                // continue
            }
        }

        $limit = $request->input('limit', 10);
        $notifications = Notification::where('user_id', $user->user_id)
            ->where('status', 'unread')
            ->with(self::REQUEST_RELATIONS)
            ->orderBy('created_at', 'desc')
            ->limit($limit)
            ->get()
            ->map(fn (Notification $n) => $this->withRequestSummary($n));

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

        if (!$this->canAccessNotifications($user)) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized to access notifications.'
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

        if (!$this->canAccessNotifications($user)) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized to access notifications.'
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

        if (!$this->canAccessNotifications($user)) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized to access notifications.'
            ], 403);
        }

        $perPage = $request->input('per_page', 20);
        $notifications = Notification::onlyTrashed()
            ->where('user_id', $user->user_id)
            ->with(self::REQUEST_RELATIONS)
            ->orderBy('deleted_at', 'desc')
            ->paginate($perPage)
            ->through(fn (Notification $n) => $this->withRequestSummary($n));

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

        if (!$this->canAccessNotifications($user)) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized to access notifications.'
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

        if (!$this->canAccessNotifications($user)) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized to access notifications.'
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
