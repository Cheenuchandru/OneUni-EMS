from fastapi import Request
from ua_parser import user_agent_parser
from typing import Dict, Any

def get_client_ip(request: Request) -> str:
    """Extract client IP address, aware of X-Forwarded-For behind reverse proxies (e.g. Nginx)."""
    x_forwarded_for = request.headers.get("x-forwarded-for")
    if x_forwarded_for:
        # First IP in X-Forwarded-For list is the client IP
        return x_forwarded_for.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "127.0.0.1"

def parse_device_info(request: Request) -> Dict[str, str]:
    """
    Parse server-side device information from User-Agent and client IP.
    NEVER trust client-sent device fields.
    Note: Laptop vs desktop tower is not distinguishable from UA; both map to 'desktop'.
    """
    user_agent_str = request.headers.get("user-agent", "")
    parsed_ua = user_agent_parser.Parse(user_agent_str)

    # Extract Device Family
    device_family = parsed_ua.get("device", {}).get("family", "")
    os_family = parsed_ua.get("os", {}).get("family", "")
    
    # Classify device_type
    device_type = "desktop"
    if device_family and device_family.lower() not in ["other", "generic desktop"]:
        if any(mobile_word in device_family.lower() for mobile_word in ["iphone", "android", "mobile", "phone"]):
            device_type = "mobile"
        elif any(tablet_word in device_family.lower() for tablet_word in ["ipad", "tablet"]):
            device_type = "tablet"
    elif any(mobile_os in os_family.lower() for mobile_os in ["ios", "android"]):
        device_type = "mobile"

    # Extract OS Version
    os_major = parsed_ua.get("os", {}).get("major", "")
    os_minor = parsed_ua.get("os", {}).get("minor", "")
    os_version = f"{os_major}.{os_minor}".strip(".") if os_major else "Unknown"

    # Extract Browser
    user_agent_family = parsed_ua.get("user_agent", {}).get("family", "Unknown")
    user_agent_major = parsed_ua.get("user_agent", {}).get("major", "")
    browser = f"{user_agent_family} {user_agent_major}".strip()

    return {
        "ip": get_client_ip(request),
        "user_agent": user_agent_str,
        "device_type": device_type,
        "os_name": os_family if os_family else "Unknown",
        "os_version": os_version,
        "browser": browser if browser else "Unknown",
    }
