import uuid
import time

def generate_uuid7() -> str:
    """
    Generate a UUIDv7 (time-ordered UUID).
    Combines Unix timestamp in milliseconds with random bytes.
    """
    timestamp_ms = int(time.time() * 1000)
    # 48-bit timestamp
    time_high = (timestamp_ms >> 16) & 0xFFFFFFFF
    time_low = timestamp_ms & 0xFFFF
    
    # Random bits
    random_bytes = uuid.uuid4().bytes
    
    # Construct 128-bit UUIDv7
    uuid_int = (time_high << 96) | (time_low << 80) | (0x7000 << 64) | (int.from_bytes(random_bytes[8:], 'big') & 0x3FFFFFFFFFFFFFFF)
    return str(uuid.UUID(int=uuid_int))
