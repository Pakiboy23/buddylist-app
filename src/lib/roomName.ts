export function normalizeRoomName(roomName: string) {
  return roomName.trim().replace(/^#+/, '');
}

export function normalizeRoomKey(roomName: string) {
  return normalizeRoomName(roomName).toLowerCase();
}

export function sameRoom(left: string, right: string) {
  return normalizeRoomKey(left) === normalizeRoomKey(right);
}
