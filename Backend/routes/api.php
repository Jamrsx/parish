<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\ManageRequestController;
use App\Http\Controllers\BaptismFormController;
use App\Http\Controllers\ServiceFormController;
use App\Http\Controllers\CertificateFormController;
use App\Http\Controllers\ChurchServiceController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\AvailabilityController;
use App\Http\Controllers\GodparentController;
use App\Http\Controllers\InventoryController;

// ============ PUBLIC ROUTES ============

// Authentication
Route::prefix('auth')->group(function () {
    // Web Login - Accepts all roles
    Route::post('/web-login', [AuthController::class, 'webLogin']);

    // Mobile Login - Only parishioners
    Route::post('/mobile-login', [AuthController::class, 'mobileLogin']);

    // Original login (kept for backward compatibility)
    Route::post('/login', [AuthController::class, 'login']);

    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/logout', [AuthController::class, 'logout'])->middleware('auth:sanctum');
    Route::get('/profile', [AuthController::class, 'profile'])->middleware('auth:sanctum');
    Route::get('/verify', [AuthController::class, 'verify'])->middleware('auth:sanctum');
    Route::put('/profile', [AuthController::class, 'updateProfile'])->middleware('auth:sanctum');
});

// Availability (public)
Route::get('/availability', [AvailabilityController::class, 'getAvailability']);
Route::get('/availability/{serviceName}', [AvailabilityController::class, 'getServiceAvailability']);

// Church Services (public)
Route::get('/church-services', [ChurchServiceController::class, 'index']);
Route::get('/church-services/options', [ChurchServiceController::class, 'getOptions']);
Route::get('/church-services/{id}', [ChurchServiceController::class, 'show']);

// ============ AUTHENTICATED ROUTES ============
Route::middleware('auth:sanctum')->group(function () {

    // ============ ADMIN ROUTES (Secretary & Cashier) ============
    Route::middleware('role:secretary,cashier')->prefix('admin')->group(function () {

        // User Management
        Route::prefix('users')->group(function () {
            Route::get('/', [AuthController::class, 'listUsers']);
            Route::get('/{id}', [AuthController::class, 'getUser']);
            Route::post('/{id}/disable', [AuthController::class, 'disableUser']);
            Route::post('/{id}/enable', [AuthController::class, 'enableUser']);
            Route::delete('/{id}', [AuthController::class, 'deleteUser']);
        });

        // Admin Creation
        Route::post('/create-admin', [AuthController::class, 'createAdmin']);
        Route::post('/create-priest', [AuthController::class, 'createPriest']);

        // Manage Requests
        Route::prefix('requests')->group(function () {
            Route::get('/', [ManageRequestController::class, 'index']);
            Route::get('/{id}', [ManageRequestController::class, 'show']);
            Route::post('/{id}/approve', [ManageRequestController::class, 'approve']);
            Route::post('/{id}/complete', [ManageRequestController::class, 'complete']);
            Route::post('/{id}/cancel', [ManageRequestController::class, 'cancel']);
            Route::post('/{id}/pay', [ManageRequestController::class, 'pay']);
            Route::post('/{id}/reschedule', [ManageRequestController::class, 'reschedule']);
            Route::post('/{id}/assign-priest', [ManageRequestController::class, 'assignPriest']);
            Route::get('/form-details', [ManageRequestController::class, 'getFormDetails']);
            Route::get('/export', [ManageRequestController::class, 'export']);
        });

        // Baptism Management
        Route::prefix('baptisms')->group(function () {
            Route::get('/processed', [ManageRequestController::class, 'getProcessedBaptisms']);
            Route::get('/{id}', [ManageRequestController::class, 'getBaptismDetails']);
            Route::put('/{id}/status', [ManageRequestController::class, 'updateBaptismStatus']);
        });

        // Funeral Mass Management
        Route::prefix('funeral-masses')->group(function () {
            Route::get('/processed', [ManageRequestController::class, 'getProcessedFuneralMasses']);
            Route::put('/{id}/status', [ManageRequestController::class, 'updateFuneralMassStatus']);
        });

        // House Blessings
        Route::prefix('house-blessings')->group(function () {
            Route::get('/', [ManageRequestController::class, 'getHouseBlessings']);
            Route::put('/{id}/status', [ManageRequestController::class, 'updateHouseBlessingStatus']);
        });

        // Marriage Management
        Route::prefix('marriages')->group(function () {
            Route::get('/processed', [ManageRequestController::class, 'getProcessedMarriages']);
            Route::put('/{id}/status', [ManageRequestController::class, 'updateMarriageStatus']);
        });

        // Church Services Management
        Route::prefix('church-services')->group(function () {
            Route::post('/', [ChurchServiceController::class, 'store']);
            Route::put('/{id}', [ChurchServiceController::class, 'update']);
            Route::delete('/{id}', [ChurchServiceController::class, 'destroy']);
            Route::put('/{id}/fee', [ChurchServiceController::class, 'updateFee']);
            Route::put('/{id}/slots', [ChurchServiceController::class, 'updateSlots']);
        });

        // Inventory Management 
        Route::prefix('inventory')->group(function () {
            Route::get('/categories', [InventoryController::class, 'getCategories']);
            Route::get('/borrowed', [InventoryController::class, 'getBorrowed']);
            Route::get('/borrow-records', [InventoryController::class, 'getAllBorrowRecords']);
            Route::get('/overdue', [InventoryController::class, 'getOverdue']);
            Route::get('/available', [InventoryController::class, 'getAvailable']);
            Route::get('/statistics', [InventoryController::class, 'getStatistics']);
            Route::get('/search', [InventoryController::class, 'search']);
            
            // GENERIC ROUTES AFTER
            Route::get('/', [InventoryController::class, 'index']);
            Route::post('/', [InventoryController::class, 'store']);
            Route::get('/{id}', [InventoryController::class, 'show']);
            Route::put('/{id}', [InventoryController::class, 'update']);
            Route::delete('/{id}', [InventoryController::class, 'destroy']);
            Route::post('/{id}/borrow', [InventoryController::class, 'borrow']);
            Route::post('/{id}/return', [InventoryController::class, 'returnItem']);
            Route::get('/{id}/history', [InventoryController::class, 'getBorrowHistory']);
        });
    });

    // ============ PARISHIONER ROUTES ============
    Route::middleware('role:parishioner')->prefix('parishioner')->group(function () {
        // Profile
        Route::get('/profile', [AuthController::class, 'profile']);
        Route::put('/profile', [AuthController::class, 'updateProfile']);

        // Baptism Forms
        Route::prefix('baptism-forms')->group(function () {
            Route::get('/', [BaptismFormController::class, 'index']);
            Route::post('/', [BaptismFormController::class, 'store']);
            Route::get('/{id}', [BaptismFormController::class, 'show']);
            Route::get('/{id}/godparents', [BaptismFormController::class, 'getGodparents']);

            Route::post('/{id}/godparents', [BaptismFormController::class, 'addGodparent']);
            Route::post('/{id}/godparents/bulk', [BaptismFormController::class, 'bulkAddGodparents']);
            Route::delete('/{baptismId}/godparents/{godparentId}', [BaptismFormController::class, 'removeGodparent']);
        });

        // Service Forms
        Route::prefix('service-forms')->group(function () {
            Route::get('/', [ServiceFormController::class, 'index']);
            Route::post('/', [ServiceFormController::class, 'store']);
            Route::get('/{id}', [ServiceFormController::class, 'show']);
        });

        // Certificate Forms
        Route::prefix('certificate-forms')->group(function () {
            Route::get('/', [CertificateFormController::class, 'index']);
            Route::post('/', [CertificateFormController::class, 'store']);
            Route::get('/{id}', [CertificateFormController::class, 'show']);
        });

        // Manage Requests
        Route::post('/manage-requests', [ManageRequestController::class, 'store']);
        Route::post('/manage-requests/expire-pending', [ManageRequestController::class, 'expirePendingRequests']);
        Route::get('/requests', [ManageRequestController::class, 'getUserRequests']);
        Route::get('/statistics', [ManageRequestController::class, 'getUserStatistics']);

        // Notifications
        Route::prefix('notifications')->group(function () {
            Route::get('/', [NotificationController::class, 'index']);
            Route::get('/unread-count', [NotificationController::class, 'unreadCount']);
            Route::get('/unread', [NotificationController::class, 'unreadNotifications']);
            Route::get('/deleted', [NotificationController::class, 'deleted']);
            Route::post('/{id}/mark-read', [NotificationController::class, 'markAsRead']);
            Route::post('/mark-all-read', [NotificationController::class, 'markAllAsRead']);
            Route::post('/{id}/restore', [NotificationController::class, 'restore']);
            Route::delete('/{id}', [NotificationController::class, 'destroy']);
        });
    });

    // ============ PRIEST ROUTES ============
    Route::middleware('role:priest')->prefix('priest')->group(function () {
        Route::get('/profile', [AuthController::class, 'profile']);
        Route::get('/assigned-requests', [ManageRequestController::class, 'getAssignedRequests']);
        Route::put('/requests/{id}/status', [ManageRequestController::class, 'updateRequestStatus']);
    });
});

// ============ ADDITIONAL ROUTES ============

// Godparents
Route::prefix('godparents')->middleware('auth:sanctum')->group(function () {
    Route::get('/baptism/{baptismId}', [GodparentController::class, 'getByBaptismForm']);
    Route::post('/', [GodparentController::class, 'store']);
    Route::delete('/{id}', [GodparentController::class, 'destroy']);
});