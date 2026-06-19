# Contract: Profile Service (Extended)

**File**: `src/services/profileService.ts` (extends existing)

## New / Updated Functions

### `updateProfile(patch): Promise<UserProfile>`

Updates `display_name`, `dob`, `gender`, `location_city`, `location_country`.

**Input**: `Partial<Pick<UserProfile, 'displayName' | 'dob' | 'gender' | 'locationCity' | 'locationCountry'>>`
**Output**: Updated `UserProfile`
**Throws**: `ProfileUpdateError`

---

### `uploadAvatar(localUri): Promise<{ avatarUrl: string; avatarPath: string }>`

Uploads avatar to `avatars/{userId}.jpg`, generates signed URL, updates `profiles.avatar_url + avatar_path`.

**Input**: Local file URI string
**Output**: `{ avatarUrl: string; avatarPath: string }`
**Throws**: `AvatarUploadError` (storage), `ProfileUpdateError` (db)

**Side effect**: Deletes previous avatar file from Storage if `avatar_path` already set.

---

### `deleteAvatar(): Promise<void>`

Removes avatar from Storage and clears `profiles.avatar_url + avatar_path`.
