from typing import List, Dict, Set

# Canonical registry of all system permission keys
PERMISSIONS_REGISTRY = [
    # Attendance
    "attendance.punch",
    "attendance.view_own",
    "attendance.view_all",
    "attendance.view_device_all",
    "attendance.edit_with_reason",
    
    # EOD Reports
    "eod.submit",
    "eod.view_own",
    "eod.view_all",
    "eod.templates",
    
    # Projects & Tasks
    "projects.view_assigned",
    "projects.update_status_assigned",
    "projects.manage",
    "projects.edit_any_status",
    
    # Calendar & Leave
    "calendar.view",
    "calendar.manage",
    "leave.request",
    "leave.approve",
    
    # Comms & Dashboards
    "comms.comment",
    "comms.announce",
    "dashboard.self",
    
    # User Management & RBAC
    "users.create_non_admin",
    "users.manage_all",
    "roles.manage",
    
    # Operations, Mail & System Settings
    "mail.route",
    "mail.receive_punch_default",
    "export.attendance",
    "audit.view",
    "settings.manage",
]

# System roles default permission mappings
SYSTEM_ROLE_PERMISSIONS: Dict[str, Set[str]] = {
    "employee": {
        "attendance.punch",
        "attendance.view_own",
        "eod.submit",
        "eod.view_own",
        "projects.update_status_assigned",
        "projects.view_assigned",
        "calendar.view",
        "leave.request",
        "comms.comment",
        "dashboard.self",
    },
    "md": {
        # Inherits employee permissions
        "attendance.punch",
        "attendance.view_own",
        "eod.submit",
        "eod.view_own",
        "projects.update_status_assigned",
        "projects.view_assigned",
        "calendar.view",
        "leave.request",
        "comms.comment",
        "dashboard.self",
        # MD executive leadership permissions
        "attendance.view_all",
        "attendance.view_device_all",
        "attendance.edit_with_reason",
        "eod.view_all",
        "projects.manage",
        "projects.edit_any_status",
        "users.create_non_admin",
        "calendar.manage",
        "leave.approve",
        "comms.announce",
        "export.attendance",
        "mail.receive_punch_default",
        "audit.view",
    },

    "admin": {
        "*"  # Full administrative access
    },
    "director": {
        "attendance.punch", "attendance.view_own", "eod.submit", "eod.view_own",
        "projects.update_status_assigned", "projects.view_assigned", "calendar.view",
        "leave.request", "comms.comment", "dashboard.self",
        "attendance.view_all", "attendance.view_device_all", "attendance.edit_with_reason",
        "eod.view_all", "projects.manage", "projects.edit_any_status",
        "users.create_non_admin", "calendar.manage", "leave.approve", "comms.announce",
        "export.attendance", "audit.view"
    },
    "cto": {
        "attendance.punch", "attendance.view_own", "eod.submit", "eod.view_own",
        "projects.update_status_assigned", "projects.view_assigned", "calendar.view",
        "leave.request", "comms.comment", "dashboard.self",
        "attendance.view_all", "eod.view_all", "projects.manage", "projects.edit_any_status",
        "users.create_non_admin", "calendar.manage", "leave.approve", "comms.announce",
        "export.attendance", "audit.view", "settings.manage"
    },
    "manager": {
        "attendance.punch", "attendance.view_own", "eod.submit", "eod.view_own",
        "projects.update_status_assigned", "projects.view_assigned", "calendar.view",
        "leave.request", "comms.comment", "dashboard.self",
        "attendance.view_all", "eod.view_all", "projects.manage", "projects.edit_any_status",
        "leave.approve", "comms.announce"
    },
    "tl": {
        "attendance.punch", "attendance.view_own", "eod.submit", "eod.view_own",
        "projects.update_status_assigned", "projects.view_assigned", "calendar.view",
        "leave.request", "comms.comment", "dashboard.self",
        "attendance.view_all", "eod.view_all", "projects.edit_any_status", "comms.announce"
    }
}
